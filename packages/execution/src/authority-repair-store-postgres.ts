import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '@cos/runtime';
import type {
  AuthorityRepairAppendResult,
  AuthorityRepairRevision,
  IAuthorityRepairStore,
} from './authority-repair-ledger';

export interface AuthorityRepairRevisionRow {
  revision_id: string;
  repair_id: string;
  operation_key: string;
  revision: number | string;
  project_id: string;
  operation_id: string | null;
  correlation_id: string | null;
  repair_kind: string;
  dedupe_key: string;
  repair_state: string;
  payload: Record<string, unknown>;
  sensitivity: string;
  attempts: number | string;
  max_attempts: number | string;
  next_attempt_at: string | Date;
  lease_owner_id: string | null;
  lease_expires_at: string | Date | null;
  fencing_token: number | string;
  error_value: Record<string, unknown> | null;
  resolution: Record<string, unknown> | null;
  provenance: unknown[];
  recorded_at: string | Date;
  previous_revision_id: string | null;
  content_hash: string;
}

export const AUTHORITY_REPAIR_POSTGRES_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.authority_repair_revisions (
  revision_id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  revision BIGINT NOT NULL CHECK (revision > 0),
  project_id TEXT NOT NULL,
  operation_id TEXT,
  correlation_id TEXT,
  repair_kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  repair_state TEXT NOT NULL,
  payload JSONB NOT NULL,
  sensitivity TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  next_attempt_at TIMESTAMPTZ NOT NULL,
  lease_owner_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  fencing_token BIGINT NOT NULL CHECK (fencing_token >= 0),
  error_value JSONB,
  resolution JSONB,
  provenance JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  previous_revision_id TEXT,
  content_hash TEXT NOT NULL,
  UNIQUE(repair_id, revision)
);

CREATE INDEX IF NOT EXISTS cos_authority_repairs_current_idx
  ON cos_execution.authority_repair_revisions(repair_id, revision DESC);
CREATE INDEX IF NOT EXISTS cos_authority_repairs_dedupe_idx
  ON cos_execution.authority_repair_revisions(project_id, dedupe_key, revision DESC);
CREATE INDEX IF NOT EXISTS cos_authority_repairs_ready_idx
  ON cos_execution.authority_repair_revisions(project_id, repair_state, next_attempt_at, repair_id);
`;

/** Driver-neutral Postgres/Supabase-compatible append-only repair store. */
export class AuthorityRepairPostgresStore implements IAuthorityRepairStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(AUTHORITY_REPAIR_POSTGRES_DDL);
  }

  async append(
    raw: AuthorityRepairRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityRepairAppendResult> {
    const revision = validateRevision(raw);
    if (!Number.isSafeInteger(expectedCurrentRevision) || expectedCurrentRevision < 0) {
      throw new Error('expectedCurrentRevision must be a non-negative safe integer');
    }

    return this.db.transaction(async tx => {
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) AS locked',
        [`repair:${revision.repairId}`],
      );

      const operationDuplicate = await tx.query<AuthorityRepairRevisionRow>(
        'SELECT * FROM cos_execution.authority_repair_revisions WHERE operation_key=$1 FOR SHARE',
        [revision.operationKey],
      );
      if (operationDuplicate.rowCount === 1) {
        const existing = rowToRevision(requireRow(operationDuplicate, 'operation duplicate'));
        if (existing.contentHash !== revision.contentHash) {
          throw new Error(`REPAIR_IDEMPOTENCY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: existing, appended: false };
      }

      const currentResult = await tx.query<AuthorityRepairRevisionRow>(`
        SELECT * FROM cos_execution.authority_repair_revisions
        WHERE repair_id=$1
        ORDER BY revision DESC
        LIMIT 1
        FOR SHARE
      `, [revision.repairId]);
      const current = currentResult.rowCount
        ? rowToRevision(requireRow(currentResult, 'current'))
        : null;
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_REPAIR_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`REPAIR_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.previousRevisionId !== current.revisionId) {
          throw new Error(`REPAIR_REVISION_PARENT_MISMATCH repair=${revision.repairId}`);
        }
        if (Date.parse(revision.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`REPAIR_SYSTEM_TIME_NOT_MONOTONIC repair=${revision.repairId}`);
        }
      } else {
        const dedupe = await tx.query<AuthorityRepairRevisionRow>(`
          SELECT * FROM cos_execution.authority_repair_revisions
          WHERE project_id=$1 AND dedupe_key=$2
          ORDER BY revision DESC
          LIMIT 1
          FOR SHARE
        `, [revision.projectId, revision.dedupeKey]);
        if (dedupe.rowCount === 1) {
          const existing = rowToRevision(requireRow(dedupe, 'dedupe'));
          if (existing.repairId !== revision.repairId) {
            throw new Error(`REPAIR_DEDUPE_COLLISION key=${revision.dedupeKey}`);
          }
        }
      }

      const inserted = await tx.query<AuthorityRepairRevisionRow>(`
        INSERT INTO cos_execution.authority_repair_revisions (
          revision_id, repair_id, operation_key, revision, project_id,
          operation_id, correlation_id, repair_kind, dedupe_key, repair_state,
          payload, sensitivity, attempts, max_attempts, next_attempt_at,
          lease_owner_id, lease_expires_at, fencing_token, error_value,
          resolution, provenance, recorded_at, previous_revision_id, content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15::timestamptz,
          $16,$17::timestamptz,$18,$19::jsonb,$20::jsonb,$21::jsonb,
          $22::timestamptz,$23,$24
        )
        RETURNING *
      `, rowParams(revision));
      if (inserted.rowCount !== 1) {
        throw new Error(`REPAIR_POSTGRES_INSERT_INVARIANT repair=${revision.repairId}`);
      }
      return {
        revision: rowToRevision(requireRow(inserted, 'insert')),
        appended: true,
      };
    });
  }

  async getCurrent(repairId: string): Promise<AuthorityRepairRevision | null> {
    const result = await this.db.query<AuthorityRepairRevisionRow>(`
      SELECT * FROM cos_execution.authority_repair_revisions
      WHERE repair_id=$1
      ORDER BY revision DESC
      LIMIT 1
    `, [nonEmpty(repairId, 'repairId')]);
    return result.rowCount ? rowToRevision(requireRow(result, 'get current')) : null;
  }

  async getByDedupeKey(projectId: string, dedupeKey: string): Promise<AuthorityRepairRevision | null> {
    const result = await this.db.query<AuthorityRepairRevisionRow>(`
      SELECT * FROM cos_execution.authority_repair_revisions
      WHERE project_id=$1 AND dedupe_key=$2
      ORDER BY revision DESC
      LIMIT 1
    `, [nonEmpty(projectId, 'projectId'), nonEmpty(dedupeKey, 'dedupeKey')]);
    return result.rowCount ? rowToRevision(requireRow(result, 'get dedupe')) : null;
  }

  async getHistory(repairId: string): Promise<AuthorityRepairRevision[]> {
    const result = await this.db.query<AuthorityRepairRevisionRow>(`
      SELECT * FROM cos_execution.authority_repair_revisions
      WHERE repair_id=$1
      ORDER BY revision ASC, recorded_at ASC, revision_id ASC
    `, [nonEmpty(repairId, 'repairId')]);
    return result.rows.map(rowToRevision);
  }

  async listProject(projectId: string): Promise<AuthorityRepairRevision[]> {
    const result = await this.db.query<AuthorityRepairRevisionRow>(`
      SELECT * FROM cos_execution.authority_repair_revisions
      WHERE project_id=$1
      ORDER BY recorded_at ASC, repair_id ASC, revision ASC, revision_id ASC
    `, [nonEmpty(projectId, 'projectId')]);
    return result.rows.map(rowToRevision);
  }
}

function rowParams(revision: AuthorityRepairRevision): unknown[] {
  return [
    revision.revisionId,
    revision.repairId,
    revision.operationKey,
    revision.revision,
    revision.projectId,
    revision.operationId,
    revision.correlationId,
    revision.kind,
    revision.dedupeKey,
    revision.state,
    JSON.stringify(revision.payload),
    revision.sensitivity,
    revision.attempts,
    revision.maxAttempts,
    revision.nextAttemptAt,
    revision.leaseOwnerId,
    revision.leaseExpiresAt,
    revision.fencingToken,
    revision.error === null ? null : JSON.stringify(revision.error),
    revision.resolution === null ? null : JSON.stringify(revision.resolution),
    JSON.stringify(revision.provenance),
    revision.recordedAt,
    revision.previousRevisionId,
    revision.contentHash,
  ];
}

function rowToRevision(row: AuthorityRepairRevisionRow): AuthorityRepairRevision {
  return validateRevision({
    revisionId: row.revision_id,
    repairId: row.repair_id,
    operationKey: row.operation_key,
    revision: safeInteger(row.revision, 'repair revision'),
    projectId: row.project_id,
    operationId: row.operation_id,
    correlationId: row.correlation_id,
    kind: row.repair_kind as AuthorityRepairRevision['kind'],
    dedupeKey: row.dedupe_key,
    state: row.repair_state as AuthorityRepairRevision['state'],
    payload: structuredClone(row.payload ?? {}),
    sensitivity: row.sensitivity as AuthorityRepairRevision['sensitivity'],
    attempts: safeInteger(row.attempts, 'repair attempts'),
    maxAttempts: safeInteger(row.max_attempts, 'repair maxAttempts'),
    nextAttemptAt: toIso(row.next_attempt_at),
    leaseOwnerId: row.lease_owner_id,
    leaseExpiresAt: row.lease_expires_at === null ? null : toIso(row.lease_expires_at),
    fencingToken: safeInteger(row.fencing_token, 'repair fencingToken'),
    error: row.error_value === null
      ? null
      : structuredClone(row.error_value) as AuthorityRepairRevision['error'],
    resolution: row.resolution === null ? null : structuredClone(row.resolution),
    provenance: structuredClone(row.provenance) as AuthorityRepairRevision['provenance'],
    recordedAt: toIso(row.recorded_at),
    previousRevisionId: row.previous_revision_id,
    contentHash: row.content_hash,
  });
}

function validateRevision(revision: AuthorityRepairRevision): AuthorityRepairRevision {
  canonicalSerialize(revision);
  const expectedHash = canonicalHash128({ ...revision, contentHash: null });
  if (revision.contentHash !== expectedHash) {
    throw new Error(`REPAIR_CONTENT_HASH_MISMATCH repair=${revision.repairId}`);
  }
  if (!Number.isSafeInteger(revision.revision) || revision.revision < 1) {
    throw new Error('repair revision must be a positive safe integer');
  }
  if (!Number.isSafeInteger(revision.fencingToken) || revision.fencingToken < 0) {
    throw new Error('repair fencingToken must be a non-negative safe integer');
  }
  return structuredClone(revision);
}

function requireRow<Row>(result: PostgresQueryResult<Row>, label: string): Row {
  const row = result.rows[0];
  if (!row) throw new Error(`Repair Postgres ${label} row missing`);
  return row;
}

function safeInteger(value: number | string, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return number;
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
