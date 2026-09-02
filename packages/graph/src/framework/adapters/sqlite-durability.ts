import {
  COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
  GraphDurabilityDriver,
  GraphPersistenceCommit,
  GraphPersistenceCompareAndSwapResult,
} from '../durability';

interface SQLiteRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

interface SQLiteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): SQLiteRunResult;
}

interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

type SQLiteDatabaseConstructor = new (path: string) => SQLiteDatabase;

export type SQLiteDurabilityErrorCode =
  | 'SQLITE_UNAVAILABLE'
  | 'SQLITE_ROW_INVALID'
  | 'SQLITE_COMMIT_INVALID';

export class SQLiteDurabilityError extends Error {
  readonly code: SQLiteDurabilityErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: SQLiteDurabilityErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SQLiteDurabilityError';
    this.code = code;
    this.details = details;
  }
}

export interface SQLiteGraphDurabilityDriverOptions {
  readonly busyTimeoutMs?: number;
}

function loadDatabaseConstructor(): SQLiteDatabaseConstructor {
  let loaded: unknown;
  try {
    loaded = require('node:sqlite');
  } catch (error: unknown) {
    throw new SQLiteDurabilityError(
      'SQLITE_UNAVAILABLE',
      'node:sqlite is unavailable. Node 22.12 requires --experimental-sqlite for this adapter.',
      {},
      { cause: error },
    );
  }
  if (typeof loaded !== 'object' || loaded === null || !('DatabaseSync' in loaded)) {
    throw new SQLiteDurabilityError('SQLITE_UNAVAILABLE', 'node:sqlite did not expose DatabaseSync');
  }
  const constructorValue = (loaded as { readonly DatabaseSync?: unknown }).DatabaseSync;
  if (typeof constructorValue !== 'function') {
    throw new SQLiteDurabilityError('SQLITE_UNAVAILABLE', 'node:sqlite DatabaseSync is not constructable');
  }
  return constructorValue as SQLiteDatabaseConstructor;
}

function asRow(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label} must be an object row`);
  }
  return value as Record<string, unknown>;
}

function asSafeInteger(value: unknown, label: string): number {
  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    if (Number.isSafeInteger(numberValue)) return numberValue;
  }
  if (Number.isSafeInteger(value)) return value as number;
  throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label} must be a safe integer`, { value });
}

function asText(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label} must be text`);
  }
  return value;
}

function parseJson(value: unknown, label: string): unknown {
  const text = asText(value, label);
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label} contains invalid JSON`, {}, { cause: error });
  }
}

function assertCommitShape(commit: GraphPersistenceCommit): void {
  const nextVersion = commit.expectedStorageVersion + 1;
  if (!Number.isSafeInteger(commit.expectedStorageVersion) || commit.expectedStorageVersion < 0) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'expectedStorageVersion must be a non-negative safe integer');
  }
  if (
    commit.event.graphId !== commit.graphId
    || commit.snapshot.graph.graphId !== commit.graphId
    || commit.idempotency.receipt.graphId !== commit.graphId
  ) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Commit graph identifiers are inconsistent', { graphId: commit.graphId });
  }
  if (
    commit.event.baseRevision !== commit.expectedStorageVersion
    || commit.event.revision !== nextVersion
    || commit.snapshot.graph.revision !== nextVersion
    || commit.snapshot.eventCount !== nextVersion
  ) {
    throw new SQLiteDurabilityError(
      'SQLITE_COMMIT_INVALID',
      'Commit revision/storageVersion sequence is inconsistent',
      { graphId: commit.graphId, expectedStorageVersion: commit.expectedStorageVersion },
    );
  }
  if (
    commit.idempotency.idempotencyKey !== commit.event.idempotencyKey
    || commit.idempotency.requestHash !== commit.event.requestHash
    || commit.idempotency.receipt.eventId !== commit.event.eventId
    || commit.idempotency.receipt.eventHash !== commit.event.eventHash
  ) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Commit idempotency record is not bound to its event', { graphId: commit.graphId });
  }
}

export class SQLiteGraphDurabilityDriver implements GraphDurabilityDriver {
  private readonly database: SQLiteDatabase;
  private closed = false;

  constructor(databasePath: string, options: SQLiteGraphDurabilityDriverOptions = {}) {
    if (typeof databasePath !== 'string' || databasePath.length === 0) {
      throw new TypeError('databasePath must be a non-empty string');
    }
    const busyTimeoutMs = options.busyTimeoutMs ?? 5_000;
    if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
      throw new TypeError('busyTimeoutMs must be a safe integer between 0 and 60000');
    }

    const DatabaseSync = loadDatabaseConstructor();
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = ${busyTimeoutMs};

      CREATE TABLE IF NOT EXISTS cos_graph_heads (
        graph_id TEXT PRIMARY KEY,
        storage_version INTEGER NOT NULL CHECK (storage_version >= 1),
        snapshot_json TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cos_graph_events (
        graph_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        event_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (graph_id, revision),
        UNIQUE (event_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cos_graph_idempotency (
        graph_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        PRIMARY KEY (graph_id, idempotency_key)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS cos_graph_events_graph_event_id
        ON cos_graph_events (graph_id, event_id);
    `);
  }

  load(graphId: string): unknown | null {
    this.assertOpen();
    const headValue = this.database.prepare(
      'SELECT storage_version, snapshot_json FROM cos_graph_heads WHERE graph_id = ?',
    ).get(graphId);
    if (headValue === undefined) return null;
    const head = asRow(headValue, 'cos_graph_heads');
    const storageVersion = asSafeInteger(head.storage_version, 'cos_graph_heads.storage_version');
    const snapshot = parseJson(head.snapshot_json, 'cos_graph_heads.snapshot_json');

    const events = this.database.prepare(
      'SELECT event_json FROM cos_graph_events WHERE graph_id = ? ORDER BY revision ASC',
    ).all(graphId).map((value, index) => {
      const row = asRow(value, `cos_graph_events[${index}]`);
      return parseJson(row.event_json, `cos_graph_events[${index}].event_json`);
    });

    const idempotency = this.database.prepare(
      'SELECT idempotency_key, request_hash, receipt_json FROM cos_graph_idempotency WHERE graph_id = ? ORDER BY idempotency_key ASC',
    ).all(graphId).map((value, index) => {
      const row = asRow(value, `cos_graph_idempotency[${index}]`);
      return {
        idempotencyKey: asText(row.idempotency_key, `cos_graph_idempotency[${index}].idempotency_key`),
        requestHash: asText(row.request_hash, `cos_graph_idempotency[${index}].request_hash`),
        receipt: parseJson(row.receipt_json, `cos_graph_idempotency[${index}].receipt_json`),
      };
    });

    return {
      schema: COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
      graphId,
      storageVersion,
      snapshot,
      events,
      idempotency,
    };
  }

  compareAndSwap(commit: GraphPersistenceCommit): GraphPersistenceCompareAndSwapResult {
    this.assertOpen();
    assertCommitShape(commit);
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const headValue = this.database.prepare(
        'SELECT storage_version FROM cos_graph_heads WHERE graph_id = ?',
      ).get(commit.graphId);
      const currentVersion = headValue === undefined
        ? 0
        : asSafeInteger(asRow(headValue, 'cos_graph_heads').storage_version, 'cos_graph_heads.storage_version');

      if (currentVersion !== commit.expectedStorageVersion) {
        this.database.exec('ROLLBACK;');
        return { status: 'conflict' };
      }

      const nextVersion = currentVersion + 1;
      this.database.prepare(
        'INSERT INTO cos_graph_events (graph_id, revision, event_id, event_json) VALUES (?, ?, ?, ?)',
      ).run(commit.graphId, commit.event.revision, commit.event.eventId, JSON.stringify(commit.event));

      this.database.prepare(
        'INSERT INTO cos_graph_idempotency (graph_id, idempotency_key, request_hash, receipt_json) VALUES (?, ?, ?, ?)',
      ).run(
        commit.graphId,
        commit.idempotency.idempotencyKey,
        commit.idempotency.requestHash,
        JSON.stringify(commit.idempotency.receipt),
      );

      if (currentVersion === 0) {
        this.database.prepare(
          'INSERT INTO cos_graph_heads (graph_id, storage_version, snapshot_json) VALUES (?, ?, ?)',
        ).run(commit.graphId, nextVersion, JSON.stringify(commit.snapshot));
      } else {
        const update = this.database.prepare(
          'UPDATE cos_graph_heads SET storage_version = ?, snapshot_json = ? WHERE graph_id = ? AND storage_version = ?',
        ).run(nextVersion, JSON.stringify(commit.snapshot), commit.graphId, currentVersion);
        const changes = typeof update.changes === 'bigint' ? Number(update.changes) : update.changes;
        if (changes !== 1) {
          throw new SQLiteDurabilityError(
            'SQLITE_COMMIT_INVALID',
            'Graph head compare-and-swap update affected an unexpected number of rows',
            { graphId: commit.graphId, changes },
          );
        }
      }

      this.database.exec('COMMIT;');
      return { status: 'committed', storageVersion: nextVersion };
    } catch (error: unknown) {
      try {
        this.database.exec('ROLLBACK;');
      } catch {
        // Preserve the original write failure. A failed rollback leaves this driver unsafe;
        // the caller should discard/close it rather than treating the operation as committed.
      }
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) throw new SQLiteDurabilityError('SQLITE_UNAVAILABLE', 'SQLite durability driver is closed');
  }
}
