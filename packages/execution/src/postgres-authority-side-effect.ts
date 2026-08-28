import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  PostgresExecutor,
  PostgresQueryResult,
  PostgresTransaction,
} from '@cos/runtime';
import type {
  AuthoritySideEffectAppendResult,
  AuthoritySideEffectRevision,
  IAuthoritySideEffectStore,
} from './authority-side-effect';

interface OperationRow {
  operation_id: string;
  project_id: string;
  idempotency_key: string;
  logical_hash: string;
  created_at: string | Date;
}

export interface SideEffectRevisionRow {
  revision_id: string;
  operation_id: string;
  project_id: string;
  idempotency_key: string;
  transition_key: string;
  transition_hash: string;
  logical_hash: string;
  revision: string | number;
  previous_revision_id: string | null;
  state: AuthoritySideEffectRevision['state'];
  effect_knowledge: AuthoritySideEffectRevision['effectKnowledge'];
  principal_id: string;
  agent_run_id: string | null;
  capability: string;
  resource_uri: string;
  input_value: unknown;
  input_hash: string;
  attempt: string | number;
  fencing_token: string | number | null;
  provider_idempotency_key: string | null;
  result_value: unknown | null;
  result_hash: string | null;
  error_value: AuthoritySideEffectRevision['error'];
  error_hash: string | null;
  compensation_value: AuthoritySideEffectRevision['compensation'];
  correlation_id: string;
  causation_id: string | null;
  provenance: AuthoritySideEffectRevision['provenance'];
  metadata: Record<string, unknown>;
  created_at: string | Date;
  recorded_at: string | Date;
  content_hash: string;
}

export const POSTGRES_AUTHORITY_SIDE_EFFECT_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.side_effect_operations (
  operation_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  logical_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(project_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS cos_execution.side_effect_revisions (
  revision_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES cos_execution.side_effect_operations(operation_id),
  project_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  transition_key TEXT NOT NULL,
  transition_hash TEXT NOT NULL,
  logical_hash TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 1),
  previous_revision_id TEXT REFERENCES cos_execution.side_effect_revisions(revision_id),
  state TEXT NOT NULL,
  effect_knowledge TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  agent_run_id TEXT,
  capability TEXT NOT NULL,
  resource_uri TEXT NOT NULL,
  input_value JSONB NOT NULL,
  input_hash TEXT NOT NULL,
  attempt BIGINT NOT NULL CHECK (attempt >= 0),
  fencing_token BIGINT,
  provider_idempotency_key TEXT,
  result_value JSONB,
  result_hash TEXT,
  error_value JSONB,
  error_hash TEXT,
  compensation_value JSONB,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  provenance JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE(operation_id, revision),
  UNIQUE(project_id, transition_key),
  CHECK ((result_value IS NULL) = (result_hash IS NULL)),
  CHECK ((error_value IS NULL) = (error_hash IS NULL))
);

CREATE INDEX IF NOT EXISTS cos_side_effect_current_idx
  ON cos_execution.side_effect_revisions(operation_id, revision DESC);
CREATE INDEX IF NOT EXISTS cos_side_effect_project_state_idx
  ON cos_execution.side_effect_revisions(project_id, state, recorded_at DESC);
`;

/**
 * Append-only PostgreSQL/Supabase authority store for external side effects.
 *
 * The store owns persistence concurrency only. It does not execute providers and
 * does not validate resource fencing; AuthoritySideEffectService validates the
 * token at execution/commit boundaries. Every mutation is serialized with a
 * transaction-scoped advisory lock and writes a new immutable revision.
 */
export class PostgresAuthoritySideEffectStore implements IAuthoritySideEffectStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_AUTHORITY_SIDE_EFFECT_DDL);
  }

  async append(
    raw: AuthoritySideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthoritySideEffectAppendResult> {
    const revision = cloneAndAssertRevision(raw);
    assertExpectedRevision(expectedCurrentRevision);

    return this.db.transaction(async tx => {
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${revision.projectId}\u0000${revision.idempotencyKey}\u0000${revision.operationId}`],
      );

      const duplicateTransition = await this.selectByTransition(
        tx,
        revision.projectId,
        revision.transitionKey,
      );
      if (duplicateTransition) {
        if (duplicateTransition.operationId !== revision.operationId
          || duplicateTransition.transitionHash !== revision.transitionHash) {
          throw new Error(`SIDE_EFFECT_TRANSITION_KEY_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: duplicateTransition, appended: false };
      }

      await tx.query<OperationRow>(`
        INSERT INTO cos_execution.side_effect_operations (
          operation_id, project_id, idempotency_key, logical_hash, created_at
        ) VALUES ($1,$2,$3,$4,$5::timestamptz)
        ON CONFLICT(project_id, idempotency_key) DO NOTHING
        RETURNING *
      `, [
        revision.operationId,
        revision.projectId,
        revision.idempotencyKey,
        revision.logicalHash,
        revision.createdAt,
      ]);

      const operationResult = await tx.query<OperationRow>(`
        SELECT * FROM cos_execution.side_effect_operations
        WHERE project_id=$1 AND idempotency_key=$2
        FOR UPDATE
      `, [revision.projectId, revision.idempotencyKey]);
      if (operationResult.rowCount !== 1) {
        throw new Error(`SIDE_EFFECT_OPERATION_CLAIM_INVARIANT key=${revision.idempotencyKey}`);
      }
      const operation = operationResult.rows[0];
      if (operation.operation_id !== revision.operationId
        || operation.logical_hash !== revision.logicalHash) {
        throw new Error(`SIDE_EFFECT_IDEMPOTENCY_CONFLICT key=${revision.idempotencyKey}`);
      }

      const current = await this.selectCurrent(tx, revision.operationId);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_SIDE_EFFECT_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`SIDE_EFFECT_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.previousRevisionId !== current.revisionId) {
          throw new Error(`SIDE_EFFECT_REVISION_PARENT_MISMATCH operation=${revision.operationId}`);
        }
        if (revision.logicalHash !== current.logicalHash) {
          throw new Error(`SIDE_EFFECT_LOGICAL_IDENTITY_DRIFT operation=${revision.operationId}`);
        }
        if (Date.parse(revision.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${revision.operationId}`);
        }
      } else if (revision.revision !== 1
        || revision.previousRevisionId !== null
        || revision.state !== 'claimed') {
        throw new Error(`SIDE_EFFECT_INVALID_INITIAL_REVISION operation=${revision.operationId}`);
      }

      try {
        const inserted = await tx.query<SideEffectRevisionRow>(`
          INSERT INTO cos_execution.side_effect_revisions (
            revision_id, operation_id, project_id, idempotency_key,
            transition_key, transition_hash, logical_hash, revision,
            previous_revision_id, state, effect_knowledge, principal_id,
            agent_run_id, capability, resource_uri, input_value, input_hash,
            attempt, fencing_token, provider_idempotency_key, result_value,
            result_hash, error_value, error_hash, compensation_value,
            correlation_id, causation_id, provenance, metadata, created_at,
            recorded_at, content_hash
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
            $16::jsonb,$17,$18,$19,$20,$21::jsonb,$22,$23::jsonb,$24,
            $25::jsonb,$26,$27,$28::jsonb,$29::jsonb,$30::timestamptz,
            $31::timestamptz,$32
          )
          RETURNING *
        `, revisionParams(revision));
        if (inserted.rowCount !== 1) {
          throw new Error(`SIDE_EFFECT_INSERT_INVARIANT revision=${revision.revisionId}`);
        }
        return { revision: rowToRevision(inserted.rows[0]), appended: true };
      } catch (error) {
        const duplicate = await this.selectByTransition(
          tx,
          revision.projectId,
          revision.transitionKey,
        );
        if (duplicate) {
          if (duplicate.operationId === revision.operationId
            && duplicate.transitionHash === revision.transitionHash) {
            return { revision: duplicate, appended: false };
          }
          throw new Error(`SIDE_EFFECT_TRANSITION_KEY_CONFLICT key=${revision.transitionKey}`);
        }
        throw error;
      }
    });
  }

  async getCurrent(operationId: string): Promise<AuthoritySideEffectRevision | null> {
    return this.selectCurrent(this.db, nonEmpty(operationId, 'operationId'));
  }

  async getHistory(operationId: string): Promise<AuthoritySideEffectRevision[]> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_revisions
      WHERE operation_id=$1
      ORDER BY revision ASC, recorded_at ASC, revision_id ASC
    `, [nonEmpty(operationId, 'operationId')]);
    return result.rows.map(rowToRevision);
  }

  async getByIdempotencyKey(
    projectId: string,
    idempotencyKey: string,
  ): Promise<AuthoritySideEffectRevision | null> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT r.* FROM cos_execution.side_effect_operations o
      JOIN LATERAL (
        SELECT * FROM cos_execution.side_effect_revisions r
        WHERE r.operation_id=o.operation_id
        ORDER BY r.revision DESC
        LIMIT 1
      ) r ON TRUE
      WHERE o.project_id=$1 AND o.idempotency_key=$2
    `, [nonEmpty(projectId, 'projectId'), nonEmpty(idempotencyKey, 'idempotencyKey')]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  async getByTransitionKey(
    projectId: string,
    transitionKey: string,
  ): Promise<AuthoritySideEffectRevision | null> {
    return this.selectByTransition(
      this.db,
      nonEmpty(projectId, 'projectId'),
      nonEmpty(transitionKey, 'transitionKey'),
    );
  }

  private async selectCurrent(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    operationId: string,
  ): Promise<AuthoritySideEffectRevision | null> {
    const result = await queryable.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_revisions
      WHERE operation_id=$1
      ORDER BY revision DESC
      LIMIT 1
    `, [operationId]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  private async selectByTransition(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    projectId: string,
    transitionKey: string,
  ): Promise<AuthoritySideEffectRevision | null> {
    const result = await queryable.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_revisions
      WHERE project_id=$1 AND transition_key=$2
    `, [projectId, transitionKey]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }
}

function revisionParams(revision: AuthoritySideEffectRevision): unknown[] {
  return [
    revision.revisionId,
    revision.operationId,
    revision.projectId,
    revision.idempotencyKey,
    revision.transitionKey,
    revision.transitionHash,
    revision.logicalHash,
    revision.revision,
    revision.previousRevisionId,
    revision.state,
    revision.effectKnowledge,
    revision.principalId,
    revision.agentRunId,
    revision.capability,
    revision.resourceUri,
    JSON.stringify(revision.input),
    revision.inputHash,
    revision.attempt,
    revision.fencingToken,
    revision.providerIdempotencyKey,
    revision.result === null ? null : JSON.stringify(revision.result),
    revision.resultHash,
    revision.error === null ? null : JSON.stringify(revision.error),
    revision.errorHash,
    revision.compensation === null ? null : JSON.stringify(revision.compensation),
    revision.correlationId,
    revision.causationId,
    JSON.stringify(revision.provenance),
    JSON.stringify(revision.metadata),
    revision.createdAt,
    revision.recordedAt,
    revision.contentHash,
  ];
}

function rowToRevision(row: SideEffectRevisionRow): AuthoritySideEffectRevision {
  const revision: AuthoritySideEffectRevision = {
    revisionId: row.revision_id,
    operationId: row.operation_id,
    projectId: row.project_id,
    idempotencyKey: row.idempotency_key,
    transitionKey: row.transition_key,
    transitionHash: row.transition_hash,
    logicalHash: row.logical_hash,
    revision: safeInteger(row.revision, 'revision', 1),
    previousRevisionId: row.previous_revision_id,
    state: row.state,
    effectKnowledge: row.effect_knowledge,
    principalId: row.principal_id,
    agentRunId: row.agent_run_id,
    capability: row.capability,
    resourceUri: row.resource_uri,
    input: structuredClone(row.input_value),
    inputHash: row.input_hash,
    attempt: safeInteger(row.attempt, 'attempt', 0),
    fencingToken: row.fencing_token === null
      ? null
      : safeInteger(row.fencing_token, 'fencing_token', 1),
    providerIdempotencyKey: row.provider_idempotency_key,
    result: row.result_value === null ? null : structuredClone(row.result_value),
    resultHash: row.result_hash,
    error: row.error_value === null ? null : structuredClone(row.error_value),
    errorHash: row.error_hash,
    compensation: row.compensation_value === null
      ? null
      : structuredClone(row.compensation_value),
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    provenance: structuredClone(row.provenance),
    metadata: structuredClone(row.metadata ?? {}),
    createdAt: canonicalTime(row.created_at, 'created_at'),
    recordedAt: canonicalTime(row.recorded_at, 'recorded_at'),
    contentHash: row.content_hash,
  };
  return cloneAndAssertRevision(revision);
}

function cloneAndAssertRevision(raw: AuthoritySideEffectRevision): AuthoritySideEffectRevision {
  const revision = structuredClone(raw);
  canonicalSerialize(revision);
  const contentHash = canonicalHash128(withoutContentHash(revision));
  if (contentHash !== revision.contentHash) {
    throw new Error(`SIDE_EFFECT_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
  if (revision.inputHash !== canonicalHash128(revision.input)) {
    throw new Error(`SIDE_EFFECT_INPUT_HASH_MISMATCH operation=${revision.operationId}`);
  }
  if ((revision.result === null) !== (revision.resultHash === null)) {
    throw new Error(`SIDE_EFFECT_RESULT_HASH_PRESENCE_MISMATCH operation=${revision.operationId}`);
  }
  if (revision.result !== null && revision.resultHash !== canonicalHash128(revision.result)) {
    throw new Error(`SIDE_EFFECT_RESULT_HASH_MISMATCH operation=${revision.operationId}`);
  }
  if ((revision.error === null) !== (revision.errorHash === null)) {
    throw new Error(`SIDE_EFFECT_ERROR_HASH_PRESENCE_MISMATCH operation=${revision.operationId}`);
  }
  if (revision.error !== null && revision.errorHash !== canonicalHash128(revision.error)) {
    throw new Error(`SIDE_EFFECT_ERROR_HASH_MISMATCH operation=${revision.operationId}`);
  }
  return revision;
}

function withoutContentHash(revision: AuthoritySideEffectRevision): Record<string, unknown> {
  const { contentHash: _ignored, ...rest } = revision;
  return rest;
}

function assertExpectedRevision(value: number): void {
  safeInteger(value, 'expectedCurrentRevision', 0);
}

function safeInteger(value: string | number, label: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return parsed;
}

function canonicalTime(value: string | Date, label: string): string {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${String(value)}`);
  return new Date(parsed).toISOString();
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
