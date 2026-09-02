import {
  COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
  GraphDurabilityDriver,
  GraphPersistenceCommit,
  GraphPersistenceCompaction,
  GraphPersistenceCompactionResult,
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

function asNullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return asText(value, label);
}

function parseJson(value: unknown, label: string): unknown {
  const text = asText(value, label);
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label} contains invalid JSON`, {}, { cause: error });
  }
}

function changesAsNumber(result: SQLiteRunResult, label: string): number {
  const changes = typeof result.changes === 'bigint' ? Number(result.changes) : result.changes;
  if (!Number.isSafeInteger(changes) || changes < 0) {
    throw new SQLiteDurabilityError('SQLITE_ROW_INVALID', `${label}.changes must be a non-negative safe integer`);
  }
  return changes;
}

function assertCommitShape(commit: GraphPersistenceCommit): void {
  if (!Number.isSafeInteger(commit.expectedStorageVersion) || commit.expectedStorageVersion < 0) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'expectedStorageVersion must be a non-negative safe integer');
  }
  if (
    commit.event.graphId !== commit.graphId
    || commit.snapshot.graph.graphId !== commit.graphId
    || commit.idempotency.receipt.graphId !== commit.graphId
  ) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Commit graph identifiers are inconsistent', {
      graphId: commit.graphId,
    });
  }
  if (
    commit.event.revision !== commit.event.baseRevision + 1
    || commit.snapshot.graph.revision !== commit.event.revision
    || commit.snapshot.eventCount !== commit.event.revision
    || commit.snapshot.lastEventHash !== commit.event.eventHash
    || commit.snapshot.stateHash !== commit.event.afterStateHash
  ) {
    throw new SQLiteDurabilityError(
      'SQLITE_COMMIT_INVALID',
      'Commit semantic revision/snapshot sequence is inconsistent',
      {
        graphId: commit.graphId,
        expectedStorageVersion: commit.expectedStorageVersion,
        eventBaseRevision: commit.event.baseRevision,
        eventRevision: commit.event.revision,
      },
    );
  }
  if (
    commit.idempotency.idempotencyKey !== commit.event.idempotencyKey
    || commit.idempotency.requestHash !== commit.event.requestHash
    || commit.idempotency.receipt.eventId !== commit.event.eventId
    || commit.idempotency.receipt.eventHash !== commit.event.eventHash
    || commit.idempotency.receipt.revision !== commit.event.revision
    || commit.idempotency.receipt.stateHash !== commit.event.afterStateHash
    || commit.idempotency.receipt.idempotentReplay
  ) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Commit idempotency record is not bound to its event', {
      graphId: commit.graphId,
    });
  }
}

function assertCompactionShape(compaction: GraphPersistenceCompaction): void {
  if (!Number.isSafeInteger(compaction.expectedStorageVersion) || compaction.expectedStorageVersion < 1) {
    throw new SQLiteDurabilityError(
      'SQLITE_COMMIT_INVALID',
      'Compaction expectedStorageVersion must be a positive safe integer',
    );
  }
  if (
    compaction.anchor.snapshot.graph.graphId !== compaction.graphId
    || compaction.anchor.snapshot.eventCount !== compaction.anchor.snapshot.graph.revision
    || compaction.anchor.snapshot.eventCount < 1
  ) {
    throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Compaction anchor is inconsistent with graph identity/revision', {
      graphId: compaction.graphId,
    });
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
        snapshot_json TEXT NOT NULL,
        anchor_json TEXT
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
    this.migrateHeadSchemaIfNeeded();
  }

  load(graphId: string): unknown | null {
    this.assertOpen();
    const headValue = this.database.prepare(
      'SELECT storage_version, snapshot_json, anchor_json FROM cos_graph_heads WHERE graph_id = ?',
    ).get(graphId);
    if (headValue === undefined) return null;
    const head = asRow(headValue, 'cos_graph_heads');
    const storageVersion = asSafeInteger(head.storage_version, 'cos_graph_heads.storage_version');
    const snapshot = parseJson(head.snapshot_json, 'cos_graph_heads.snapshot_json');
    const anchorJson = asNullableText(head.anchor_json, 'cos_graph_heads.anchor_json');
    const anchor = anchorJson === null ? null : parseJson(anchorJson, 'cos_graph_heads.anchor_json');

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
      anchor,
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
          'INSERT INTO cos_graph_heads (graph_id, storage_version, snapshot_json, anchor_json) VALUES (?, ?, ?, NULL)',
        ).run(commit.graphId, nextVersion, JSON.stringify(commit.snapshot));
      } else {
        const update = this.database.prepare(
          'UPDATE cos_graph_heads SET storage_version = ?, snapshot_json = ? WHERE graph_id = ? AND storage_version = ?',
        ).run(nextVersion, JSON.stringify(commit.snapshot), commit.graphId, currentVersion);
        if (changesAsNumber(update, 'graph head update') !== 1) {
          throw new SQLiteDurabilityError(
            'SQLITE_COMMIT_INVALID',
            'Graph head compare-and-swap update affected an unexpected number of rows',
            { graphId: commit.graphId },
          );
        }
      }

      this.database.exec('COMMIT;');
      return { status: 'committed', storageVersion: nextVersion };
    } catch (error: unknown) {
      this.rollbackPreserving(error);
    }
  }

  compact(compaction: GraphPersistenceCompaction): GraphPersistenceCompactionResult {
    this.assertOpen();
    assertCompactionShape(compaction);
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const headValue = this.database.prepare(
        'SELECT storage_version, snapshot_json FROM cos_graph_heads WHERE graph_id = ?',
      ).get(compaction.graphId);
      if (headValue === undefined) {
        throw new SQLiteDurabilityError('SQLITE_COMMIT_INVALID', 'Cannot compact a missing graph', {
          graphId: compaction.graphId,
        });
      }
      const head = asRow(headValue, 'cos_graph_heads');
      const currentVersion = asSafeInteger(head.storage_version, 'cos_graph_heads.storage_version');
      if (currentVersion !== compaction.expectedStorageVersion) {
        this.database.exec('ROLLBACK;');
        return { status: 'conflict' };
      }

      const headSnapshot = asRow(parseJson(head.snapshot_json, 'cos_graph_heads.snapshot_json'), 'head snapshot');
      const headGraph = asRow(headSnapshot.graph, 'head snapshot.graph');
      if (
        headGraph.graphId !== compaction.graphId
        || headGraph.revision !== compaction.anchor.snapshot.graph.revision
        || headSnapshot.eventCount !== compaction.anchor.snapshot.eventCount
        || headSnapshot.stateHash !== compaction.anchor.snapshot.stateHash
        || headSnapshot.lastEventHash !== compaction.anchor.snapshot.lastEventHash
      ) {
        throw new SQLiteDurabilityError(
          'SQLITE_COMMIT_INVALID',
          'Compaction anchor does not bind the current durable graph head',
          { graphId: compaction.graphId },
        );
      }

      const countValue = this.database.prepare(
        'SELECT COUNT(*) AS event_count FROM cos_graph_events WHERE graph_id = ?',
      ).get(compaction.graphId);
      const retainedBefore = asSafeInteger(
        asRow(countValue, 'event count').event_count,
        'event count.event_count',
      );
      const beyondValue = this.database.prepare(
        'SELECT COUNT(*) AS event_count FROM cos_graph_events WHERE graph_id = ? AND revision > ?',
      ).get(compaction.graphId, compaction.anchor.snapshot.graph.revision);
      const beyondAnchor = asSafeInteger(
        asRow(beyondValue, 'events beyond anchor').event_count,
        'events beyond anchor.event_count',
      );
      if (beyondAnchor !== 0) {
        throw new SQLiteDurabilityError(
          'SQLITE_COMMIT_INVALID',
          'Compaction-to-head found event rows beyond the proposed anchor',
          { graphId: compaction.graphId, beyondAnchor },
        );
      }

      const deleted = this.database.prepare(
        'DELETE FROM cos_graph_events WHERE graph_id = ? AND revision <= ?',
      ).run(compaction.graphId, compaction.anchor.snapshot.graph.revision);
      const prunedEvents = changesAsNumber(deleted, 'event compaction delete');
      if (prunedEvents !== retainedBefore) {
        throw new SQLiteDurabilityError(
          'SQLITE_COMMIT_INVALID',
          'Compaction did not prune exactly the retained event tail',
          { graphId: compaction.graphId, retainedBefore, prunedEvents },
        );
      }

      const nextVersion = currentVersion + 1;
      const update = this.database.prepare(
        'UPDATE cos_graph_heads SET storage_version = ?, anchor_json = ? WHERE graph_id = ? AND storage_version = ?',
      ).run(nextVersion, JSON.stringify(compaction.anchor), compaction.graphId, currentVersion);
      if (changesAsNumber(update, 'graph anchor update') !== 1) {
        throw new SQLiteDurabilityError(
          'SQLITE_COMMIT_INVALID',
          'Compaction head compare-and-swap update affected an unexpected number of rows',
          { graphId: compaction.graphId },
        );
      }

      this.database.exec('COMMIT;');
      return { status: 'compacted', storageVersion: nextVersion, prunedEvents };
    } catch (error: unknown) {
      this.rollbackPreserving(error);
    }
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private migrateHeadSchemaIfNeeded(): void {
    const columns = this.database.prepare('PRAGMA table_info(cos_graph_heads)').all();
    const hasAnchor = columns.some((value) => asRow(value, 'cos_graph_heads column').name === 'anchor_json');
    if (!hasAnchor) {
      this.database.exec('ALTER TABLE cos_graph_heads ADD COLUMN anchor_json TEXT;');
    }
  }

  private rollbackPreserving(error: unknown): never {
    try {
      this.database.exec('ROLLBACK;');
    } catch {
      // Preserve the original failure. A failed rollback leaves this connection unsafe.
    }
    throw error;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new SQLiteDurabilityError('SQLITE_UNAVAILABLE', 'SQLite durability driver is closed');
    }
  }
}
