import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '@cos/runtime';
import {
  buildAuthorityCapabilitySignalV2,
  type AuthorityCapabilitySignalV2,
  type IAuthorityCapabilitySignalSinkV2,
} from './authority-capability-evidence-v2';
import type { AuthorityCapabilitySignalAppendResultV2 } from './authority-capability-signal-store-v2';

export interface AuthorityCapabilitySignalRowV2 {
  signal_id: string;
  schema_version: number | string;
  content_hash: string;
  signal_type: string;
  outcome: string;
  near_miss: boolean;
  project_id: string;
  principal_id: string;
  capability: string;
  resource_uri: string;
  operation_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  occurred_at: string | Date;
  error_code: string | null;
  details: Record<string, unknown>;
}

export const AUTHORITY_CAPABILITY_SIGNAL_POSTGRES_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_observability;

CREATE TABLE IF NOT EXISTS cos_observability.capability_signals_v2 (
  signal_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version = 2),
  content_hash TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  near_miss BOOLEAN NOT NULL,
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  resource_uri TEXT NOT NULL,
  operation_id TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  error_code TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cos_capability_signals_project_time_idx
  ON cos_observability.capability_signals_v2(project_id, occurred_at, signal_id);
CREATE INDEX IF NOT EXISTS cos_capability_signals_operation_time_idx
  ON cos_observability.capability_signals_v2(operation_id, occurred_at, signal_id)
  WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cos_capability_signals_near_miss_idx
  ON cos_observability.capability_signals_v2(project_id, near_miss, occurred_at)
  WHERE near_miss = TRUE;
`;

/** Append-only Postgres/Supabase-compatible capability evidence store. */
export class AuthorityCapabilitySignalPostgresStoreV2 implements IAuthorityCapabilitySignalSinkV2 {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(AUTHORITY_CAPABILITY_SIGNAL_POSTGRES_DDL);
  }

  async append(signal: AuthorityCapabilitySignalV2): Promise<AuthorityCapabilitySignalAppendResultV2> {
    const validated = validateSignal(signal);
    return this.db.transaction(async tx => {
      const inserted = await tx.query<AuthorityCapabilitySignalRowV2>(`
        INSERT INTO cos_observability.capability_signals_v2 (
          signal_id, schema_version, content_hash, signal_type, outcome,
          near_miss, project_id, principal_id, capability, resource_uri,
          operation_id, correlation_id, causation_id, occurred_at,
          error_code, details
        ) VALUES (
          $1,2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14,$15::jsonb
        )
        ON CONFLICT(signal_id) DO NOTHING
        RETURNING *
      `, rowParams(validated));
      if (inserted.rowCount === 1) {
        return { signal: rowToSignal(requireRow(inserted, 'insert')), appended: true };
      }
      const duplicate = await tx.query<AuthorityCapabilitySignalRowV2>(
        'SELECT * FROM cos_observability.capability_signals_v2 WHERE signal_id=$1 FOR SHARE',
        [validated.signalId],
      );
      if (duplicate.rowCount !== 1) {
        throw new Error(`CAPABILITY_SIGNAL_POSTGRES_CONCURRENCY_INVARIANT id=${validated.signalId}`);
      }
      const existing = rowToSignal(requireRow(duplicate, 'duplicate'));
      if (existing.contentHash !== validated.contentHash) {
        throw new Error(`CAPABILITY_SIGNAL_ID_CONFLICT id=${validated.signalId}`);
      }
      return { signal: existing, appended: false };
    });
  }

  async get(signalId: string): Promise<AuthorityCapabilitySignalV2 | null> {
    const result = await this.db.query<AuthorityCapabilitySignalRowV2>(
      'SELECT * FROM cos_observability.capability_signals_v2 WHERE signal_id=$1',
      [nonEmpty(signalId, 'signalId')],
    );
    return result.rowCount ? rowToSignal(requireRow(result, 'get')) : null;
  }

  async listProject(
    projectId: string,
    options: { from?: string; to?: string; nearMiss?: boolean; limit?: number } = {},
  ): Promise<AuthorityCapabilitySignalV2[]> {
    const project = nonEmpty(projectId, 'projectId');
    const from = options.from === undefined ? null : canonicalTime(options.from, 'from');
    const to = options.to === undefined ? null : canonicalTime(options.to, 'to');
    if (from !== null && to !== null && Date.parse(to) < Date.parse(from)) {
      throw new Error('signal query to cannot precede from');
    }
    const limit = options.limit ?? 1000;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
      throw new Error('signal query limit must be a safe integer in [0,100000]');
    }
    const result = await this.db.query<AuthorityCapabilitySignalRowV2>(`
      SELECT * FROM cos_observability.capability_signals_v2
      WHERE project_id=$1
        AND ($2::timestamptz IS NULL OR occurred_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR occurred_at <= $3::timestamptz)
        AND ($4::boolean IS NULL OR near_miss = $4::boolean)
      ORDER BY occurred_at ASC, signal_id ASC
      LIMIT $5
    `, [project, from, to, options.nearMiss ?? null, limit]);
    return result.rows.map(rowToSignal);
  }
}

function validateSignal(signal: AuthorityCapabilitySignalV2): AuthorityCapabilitySignalV2 {
  const rebuilt = buildAuthorityCapabilitySignalV2({
    type: signal.type,
    outcome: signal.outcome,
    nearMiss: signal.nearMiss,
    projectId: signal.projectId,
    principalId: signal.principalId,
    capability: signal.capability,
    resourceUri: signal.resourceUri,
    operationId: signal.operationId,
    correlationId: signal.correlationId,
    causationId: signal.causationId,
    occurredAt: signal.occurredAt,
    errorCode: signal.errorCode,
    details: signal.details,
  });
  if (rebuilt.signalId !== signal.signalId) {
    throw new Error(`CAPABILITY_SIGNAL_ID_MISMATCH expected=${rebuilt.signalId} actual=${signal.signalId}`);
  }
  if (rebuilt.contentHash !== signal.contentHash) {
    throw new Error(`CAPABILITY_SIGNAL_HASH_MISMATCH id=${signal.signalId}`);
  }
  return rebuilt;
}

function rowParams(signal: AuthorityCapabilitySignalV2): unknown[] {
  return [
    signal.signalId,
    signal.contentHash,
    signal.type,
    signal.outcome,
    signal.nearMiss,
    signal.projectId,
    signal.principalId,
    signal.capability,
    signal.resourceUri,
    signal.operationId,
    signal.correlationId,
    signal.causationId,
    signal.occurredAt,
    signal.errorCode,
    JSON.stringify(signal.details),
  ];
}

function rowToSignal(row: AuthorityCapabilitySignalRowV2): AuthorityCapabilitySignalV2 {
  if (Number(row.schema_version) !== 2) {
    throw new Error(`Unsupported capability signal row schema ${row.schema_version}`);
  }
  const rebuilt = buildAuthorityCapabilitySignalV2({
    type: row.signal_type as AuthorityCapabilitySignalV2['type'],
    outcome: row.outcome as AuthorityCapabilitySignalV2['outcome'],
    nearMiss: Boolean(row.near_miss),
    projectId: row.project_id,
    principalId: row.principal_id,
    capability: row.capability,
    resourceUri: row.resource_uri,
    operationId: row.operation_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    occurredAt: toIso(row.occurred_at),
    errorCode: row.error_code,
    details: structuredClone(row.details ?? {}),
  });
  if (rebuilt.signalId !== row.signal_id) {
    throw new Error(`CAPABILITY_SIGNAL_ROW_ID_MISMATCH expected=${rebuilt.signalId} actual=${row.signal_id}`);
  }
  if (rebuilt.contentHash !== row.content_hash) {
    throw new Error(`CAPABILITY_SIGNAL_ROW_HASH_MISMATCH id=${row.signal_id}`);
  }
  return rebuilt;
}

function requireRow<Row>(result: PostgresQueryResult<Row>, label: string): Row {
  const row = result.rows[0];
  if (!row) throw new Error(`Capability signal Postgres ${label} row missing`);
  return row;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function toIso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid Postgres timestamp: ${String(value)}`);
  return date.toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
