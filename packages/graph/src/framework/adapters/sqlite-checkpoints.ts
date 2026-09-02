import {
  GraphCheckpointCompareAndSwapResult,
  GraphCheckpointDriver,
  GraphWorkflowCheckpoint,
} from '../checkpoint-runtime';

interface SQLiteRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

interface SQLiteStatement {
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): SQLiteRunResult;
}

interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

type SQLiteDatabaseConstructor = new (path: string) => SQLiteDatabase;

export type SQLiteCheckpointErrorCode =
  | 'SQLITE_CHECKPOINT_UNAVAILABLE'
  | 'SQLITE_CHECKPOINT_ROW_INVALID'
  | 'SQLITE_CHECKPOINT_COMMIT_INVALID';

export class SQLiteCheckpointError extends Error {
  readonly code: SQLiteCheckpointErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: SQLiteCheckpointErrorCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SQLiteCheckpointError';
    this.code = code;
    this.details = details;
  }
}

export interface SQLiteGraphCheckpointDriverOptions {
  readonly busyTimeoutMs?: number;
}

function loadDatabaseConstructor(): SQLiteDatabaseConstructor {
  let loaded: unknown;
  try {
    loaded = require('node:sqlite');
  } catch (error: unknown) {
    throw new SQLiteCheckpointError(
      'SQLITE_CHECKPOINT_UNAVAILABLE',
      'node:sqlite is unavailable. Node 22.12 requires --experimental-sqlite for this adapter.',
      {},
      { cause: error },
    );
  }
  if (typeof loaded !== 'object' || loaded === null || !('DatabaseSync' in loaded)) {
    throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_UNAVAILABLE', 'node:sqlite did not expose DatabaseSync');
  }
  const constructorValue = (loaded as { readonly DatabaseSync?: unknown }).DatabaseSync;
  if (typeof constructorValue !== 'function') {
    throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_UNAVAILABLE', 'node:sqlite DatabaseSync is not constructable');
  }
  return constructorValue as SQLiteDatabaseConstructor;
}

function asRow(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_ROW_INVALID', `${label} must be an object row`);
  }
  return value as Record<string, unknown>;
}

function asSafeInteger(value: unknown, label: string): number {
  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    if (Number.isSafeInteger(numberValue)) return numberValue;
  }
  if (Number.isSafeInteger(value)) return value as number;
  throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_ROW_INVALID', `${label} must be a safe integer`, { value });
}

function asText(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_ROW_INVALID', `${label} must be text`);
  }
  return value;
}

function parseJson(value: unknown, label: string): unknown {
  const text = asText(value, label);
  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new SQLiteCheckpointError(
      'SQLITE_CHECKPOINT_ROW_INVALID',
      `${label} contains invalid JSON`,
      {},
      { cause: error },
    );
  }
}

function changesAsNumber(result: SQLiteRunResult, label: string): number {
  const changes = typeof result.changes === 'bigint' ? Number(result.changes) : result.changes;
  if (!Number.isSafeInteger(changes) || changes < 0) {
    throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_ROW_INVALID', `${label}.changes must be a non-negative safe integer`);
  }
  return changes;
}

export class SQLiteGraphCheckpointDriver implements GraphCheckpointDriver {
  private readonly database: SQLiteDatabase;
  private closed = false;

  constructor(databasePath: string, options: SQLiteGraphCheckpointDriverOptions = {}) {
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

      CREATE TABLE IF NOT EXISTS cos_graph_workflow_checkpoints (
        run_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK (revision >= 1),
        checkpoint_json TEXT NOT NULL
      ) STRICT;
    `);
  }

  load(runId: string): unknown | null {
    this.assertOpen();
    const value = this.database.prepare(
      'SELECT revision, checkpoint_json FROM cos_graph_workflow_checkpoints WHERE run_id = ?',
    ).get(runId);
    if (value === undefined) return null;
    const row = asRow(value, 'cos_graph_workflow_checkpoints');
    const revision = asSafeInteger(row.revision, 'cos_graph_workflow_checkpoints.revision');
    const checkpoint = parseJson(row.checkpoint_json, 'cos_graph_workflow_checkpoints.checkpoint_json');
    const checkpointRecord = asRow(checkpoint, 'checkpoint_json');
    if (checkpointRecord.runId !== runId) {
      throw new SQLiteCheckpointError(
        'SQLITE_CHECKPOINT_ROW_INVALID',
        'Checkpoint payload runId does not match row key',
        { runId, payloadRunId: checkpointRecord.runId },
      );
    }
    if (checkpointRecord.revision !== revision) {
      throw new SQLiteCheckpointError(
        'SQLITE_CHECKPOINT_ROW_INVALID',
        'Checkpoint payload revision does not match row revision',
        { runId, revision, payloadRevision: checkpointRecord.revision },
      );
    }
    return checkpoint;
  }

  compareAndSwap(
    expectedRevision: number,
    checkpoint: GraphWorkflowCheckpoint,
  ): GraphCheckpointCompareAndSwapResult {
    this.assertOpen();
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new SQLiteCheckpointError(
        'SQLITE_CHECKPOINT_COMMIT_INVALID',
        'expectedRevision must be a non-negative safe integer',
        { expectedRevision },
      );
    }
    if (checkpoint.revision !== expectedRevision + 1) {
      throw new SQLiteCheckpointError(
        'SQLITE_CHECKPOINT_COMMIT_INVALID',
        'Checkpoint revision must advance exactly once per compare-and-swap',
        { runId: checkpoint.runId, expectedRevision, checkpointRevision: checkpoint.revision },
      );
    }

    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const currentValue = this.database.prepare(
        'SELECT revision FROM cos_graph_workflow_checkpoints WHERE run_id = ?',
      ).get(checkpoint.runId);
      const currentRevision = currentValue === undefined
        ? 0
        : asSafeInteger(asRow(currentValue, 'cos_graph_workflow_checkpoints').revision, 'cos_graph_workflow_checkpoints.revision');

      if (currentRevision !== expectedRevision) {
        this.database.exec('ROLLBACK;');
        return { status: 'conflict' };
      }

      if (currentRevision === 0) {
        this.database.prepare(
          'INSERT INTO cos_graph_workflow_checkpoints (run_id, revision, checkpoint_json) VALUES (?, ?, ?)',
        ).run(checkpoint.runId, checkpoint.revision, JSON.stringify(checkpoint));
      } else {
        const result = this.database.prepare(
          'UPDATE cos_graph_workflow_checkpoints SET revision = ?, checkpoint_json = ? WHERE run_id = ? AND revision = ?',
        ).run(checkpoint.revision, JSON.stringify(checkpoint), checkpoint.runId, expectedRevision);
        if (changesAsNumber(result, 'checkpoint update') !== 1) {
          throw new SQLiteCheckpointError(
            'SQLITE_CHECKPOINT_COMMIT_INVALID',
            'Checkpoint compare-and-swap update affected an unexpected number of rows',
            { runId: checkpoint.runId, expectedRevision },
          );
        }
      }

      this.database.exec('COMMIT;');
      return { status: 'committed', revision: checkpoint.revision };
    } catch (error: unknown) {
      try {
        this.database.exec('ROLLBACK;');
      } catch {
        // Preserve the original failure; caller must discard an unsafe connection.
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
    if (this.closed) {
      throw new SQLiteCheckpointError('SQLITE_CHECKPOINT_UNAVAILABLE', 'SQLite checkpoint driver is closed');
    }
  }
}
