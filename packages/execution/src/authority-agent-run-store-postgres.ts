import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';
import type {
  AuthorityAgentRunAppendResult,
  AuthorityAgentRunRevision,
  IAuthorityAgentRunStore,
} from './authority-agent-run';

interface AuthorityAgentRunRow {
  run_id: string;
  project_id: string;
  principal_id: string;
  agent_id: string;
  creation_operation_key: string;
  creation_operation_hash: string;
  immutable_hash: string;
  created_at: string | Date;
}

export interface AuthorityAgentRunRevisionRow {
  revision_id: string;
  run_id: string;
  project_id: string;
  operation_key: string;
  operation_hash: string;
  revision: string | number;
  previous_revision_id: string | null;
  state: AuthorityAgentRunRevision['state'];
  principal_id: string;
  agent_id: string;
  goal_value: AuthorityAgentRunRevision['goal'];
  acceptance_criteria: AuthorityAgentRunRevision['acceptanceCriteria'];
  plan_value: AuthorityAgentRunRevision['plan'];
  step_results: AuthorityAgentRunRevision['stepResults'];
  criterion_results: AuthorityAgentRunRevision['criterionResults'];
  terminal_reason: string | null;
  correlation_id: string;
  causation_id: string | null;
  created_at: string | Date;
  recorded_at: string | Date;
  metadata: Record<string, unknown>;
  content_hash: string;
}

export const AUTHORITY_AGENT_RUN_POSTGRES_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.authority_agent_runs (
  run_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  creation_operation_key TEXT NOT NULL,
  creation_operation_hash TEXT NOT NULL,
  immutable_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(project_id, creation_operation_key)
);

CREATE TABLE IF NOT EXISTS cos_execution.authority_agent_run_revisions (
  revision_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES cos_execution.authority_agent_runs(run_id),
  project_id TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  operation_hash TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 1),
  previous_revision_id TEXT REFERENCES cos_execution.authority_agent_run_revisions(revision_id),
  state TEXT NOT NULL CHECK (state IN (
    'created','planned','running','waiting_approval','blocked','completed',
    'failed','cancelled','compensation_required','compensated'
  )),
  principal_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  goal_value JSONB NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  plan_value JSONB NOT NULL,
  step_results JSONB NOT NULL,
  criterion_results JSONB NOT NULL,
  terminal_reason TEXT,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  UNIQUE(run_id, revision),
  UNIQUE(project_id, operation_key)
);

CREATE INDEX IF NOT EXISTS cos_authority_agent_run_current_idx
  ON cos_execution.authority_agent_run_revisions(run_id, revision DESC);
CREATE INDEX IF NOT EXISTS cos_authority_agent_run_project_state_idx
  ON cos_execution.authority_agent_run_revisions(project_id, state, recorded_at DESC);
`;

/**
 * Append-only PostgreSQL/Supabase store for durable agent-run aggregates.
 *
 * The adapter serializes writers with a transaction advisory lock, classifies
 * idempotent operation-key reuse before stale-revision checks, stores no mutable
 * current-row projection, and verifies every reconstructed revision's content
 * hash. It never catches a uniqueness exception inside an aborted transaction;
 * conflict classification uses `ON CONFLICT DO NOTHING` plus deterministic reads.
 */
export class AuthorityAgentRunPostgresStore implements IAuthorityAgentRunStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(AUTHORITY_AGENT_RUN_POSTGRES_DDL);
  }

  async append(
    raw: AuthorityAgentRunRevision,
    expectedRevision: number,
  ): Promise<AuthorityAgentRunAppendResult> {
    const revision = cloneAndVerify(raw);
    assertExpectedRevision(expectedRevision);

    return this.db.transaction(async tx => {
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${revision.projectId}\u0000${revision.runId}`],
      );

      const operationDuplicate = await this.selectByOperationKey(
        tx,
        revision.projectId,
        revision.operationKey,
      );
      if (operationDuplicate) return classifyOperationDuplicate(operationDuplicate, revision);

      if (revision.revision === 1) {
        await tx.query<AuthorityAgentRunRow>(`
          INSERT INTO cos_execution.authority_agent_runs (
            run_id, project_id, principal_id, agent_id,
            creation_operation_key, creation_operation_hash,
            immutable_hash, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [
          revision.runId,
          revision.projectId,
          revision.principalId,
          revision.agentId,
          revision.operationKey,
          revision.operationHash,
          immutableRunHash(revision),
          revision.createdAt,
        ]);
      }

      const run = await this.selectRunForUpdate(tx, revision.runId);
      if (!run) {
        const conflictingClaim = await this.selectRunByCreationOperation(
          tx,
          revision.projectId,
          revision.operationKey,
        );
        if (conflictingClaim) {
          throw new Error(`AGENT_RUN_OPERATION_KEY_CONFLICT key=${revision.operationKey}`);
        }
        throw new Error(`AGENT_RUN_CLAIM_INVARIANT run=${revision.runId}`);
      }
      assertRunIdentity(run, revision);

      const current = await this.selectCurrent(tx, revision.runId);
      validateAppend(revision, current, expectedRevision);

      const inserted = await tx.query<AuthorityAgentRunRevisionRow>(`
        INSERT INTO cos_execution.authority_agent_run_revisions (
          revision_id, run_id, project_id, operation_key, operation_hash,
          revision, previous_revision_id, state, principal_id, agent_id,
          goal_value, acceptance_criteria, plan_value, step_results,
          criterion_results, terminal_reason, correlation_id, causation_id,
          created_at, recorded_at, metadata, content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,
          $16,$17,$18,$19::timestamptz,$20::timestamptz,$21::jsonb,$22
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `, revisionParams(revision));

      if (inserted.rowCount === 1) {
        return { revision: rowToRevision(inserted.rows[0]), appended: true };
      }

      const duplicate = await this.selectByOperationKey(
        tx,
        revision.projectId,
        revision.operationKey,
      );
      if (duplicate) return classifyOperationDuplicate(duplicate, revision);

      const revisionCollision = await this.selectByRevisionId(tx, revision.revisionId);
      if (revisionCollision) {
        if (revisionCollision.contentHash === revision.contentHash) {
          return { revision: cloneRevision(revisionCollision), appended: false };
        }
        throw new Error(`AGENT_RUN_REVISION_ID_COLLISION id=${revision.revisionId}`);
      }

      throw new Error(`AGENT_RUN_APPEND_CONFLICT run=${revision.runId} revision=${revision.revision}`);
    });
  }

  async getCurrent(runId: string): Promise<AuthorityAgentRunRevision | null> {
    return this.selectCurrent(this.db, nonEmpty(runId, 'runId'));
  }

  async getByOperationKey(
    projectId: string,
    operationKey: string,
  ): Promise<AuthorityAgentRunRevision | null> {
    return this.selectByOperationKey(
      this.db,
      nonEmpty(projectId, 'projectId'),
      nonEmpty(operationKey, 'operationKey'),
    );
  }

  async getHistory(runId: string): Promise<AuthorityAgentRunRevision[]> {
    const result = await this.db.query<AuthorityAgentRunRevisionRow>(`
      SELECT * FROM cos_execution.authority_agent_run_revisions
      WHERE run_id=$1
      ORDER BY revision ASC, recorded_at ASC, revision_id ASC
    `, [nonEmpty(runId, 'runId')]);
    return result.rows.map(rowToRevision);
  }

  private async selectRunForUpdate(
    tx: PostgresTransaction,
    runId: string,
  ): Promise<AuthorityAgentRunRow | null> {
    const result = await tx.query<AuthorityAgentRunRow>(`
      SELECT * FROM cos_execution.authority_agent_runs
      WHERE run_id=$1
      FOR UPDATE
    `, [runId]);
    return result.rowCount ? cloneRunRow(result.rows[0]) : null;
  }

  private async selectRunByCreationOperation(
    tx: PostgresTransaction,
    projectId: string,
    operationKey: string,
  ): Promise<AuthorityAgentRunRow | null> {
    const result = await tx.query<AuthorityAgentRunRow>(`
      SELECT * FROM cos_execution.authority_agent_runs
      WHERE project_id=$1 AND creation_operation_key=$2
      FOR SHARE
    `, [projectId, operationKey]);
    return result.rowCount ? cloneRunRow(result.rows[0]) : null;
  }

  private async selectCurrent(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    runId: string,
  ): Promise<AuthorityAgentRunRevision | null> {
    const result = await queryable.query<AuthorityAgentRunRevisionRow>(`
      SELECT * FROM cos_execution.authority_agent_run_revisions
      WHERE run_id=$1
      ORDER BY revision DESC
      LIMIT 1
    `, [runId]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  private async selectByOperationKey(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    projectId: string,
    operationKey: string,
  ): Promise<AuthorityAgentRunRevision | null> {
    const result = await queryable.query<AuthorityAgentRunRevisionRow>(`
      SELECT * FROM cos_execution.authority_agent_run_revisions
      WHERE project_id=$1 AND operation_key=$2
    `, [projectId, operationKey]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  private async selectByRevisionId(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    revisionId: string,
  ): Promise<AuthorityAgentRunRevision | null> {
    const result = await queryable.query<AuthorityAgentRunRevisionRow>(`
      SELECT * FROM cos_execution.authority_agent_run_revisions
      WHERE revision_id=$1
    `, [revisionId]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }
}

function classifyOperationDuplicate(
  existing: AuthorityAgentRunRevision,
  incoming: AuthorityAgentRunRevision,
): AuthorityAgentRunAppendResult {
  if (existing.runId !== incoming.runId || existing.operationHash !== incoming.operationHash) {
    throw new Error(`AGENT_RUN_OPERATION_KEY_CONFLICT key=${incoming.operationKey}`);
  }
  return { revision: cloneRevision(existing), appended: false };
}

function validateAppend(
  incoming: AuthorityAgentRunRevision,
  current: AuthorityAgentRunRevision | null,
  expectedRevision: number,
): void {
  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== expectedRevision) {
    throw new Error(`STALE_AGENT_RUN_REVISION expected=${expectedRevision} current=${currentRevision}`);
  }
  if (incoming.revision !== currentRevision + 1) {
    throw new Error(`AGENT_RUN_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${incoming.revision}`);
  }
  if (!current) {
    if (incoming.revision !== 1
      || incoming.previousRevisionId !== null
      || incoming.state !== 'created') {
      throw new Error(`AGENT_RUN_INVALID_INITIAL_REVISION run=${incoming.runId}`);
    }
    return;
  }
  if (incoming.previousRevisionId !== current.revisionId) {
    throw new Error(`AGENT_RUN_REVISION_PARENT_MISMATCH run=${incoming.runId}`);
  }
  if (Date.parse(incoming.recordedAt) <= Date.parse(current.recordedAt)) {
    throw new Error(`AGENT_RUN_SYSTEM_TIME_NOT_MONOTONIC run=${incoming.runId}`);
  }
  if (immutableRunHash(incoming) !== immutableRunHash(current)) {
    throw new Error(`AGENT_RUN_IDENTITY_DRIFT run=${incoming.runId}`);
  }
}

function assertRunIdentity(
  row: AuthorityAgentRunRow,
  revision: AuthorityAgentRunRevision,
): void {
  if (row.run_id !== revision.runId
    || row.project_id !== revision.projectId
    || row.principal_id !== revision.principalId
    || row.agent_id !== revision.agentId
    || canonicalTime(row.created_at, 'run row created_at') !== revision.createdAt
    || row.immutable_hash !== immutableRunHash(revision)) {
    throw new Error(`AGENT_RUN_IDENTITY_DRIFT run=${revision.runId}`);
  }
  if (revision.revision === 1
    && (row.creation_operation_key !== revision.operationKey
      || row.creation_operation_hash !== revision.operationHash)) {
    throw new Error(`AGENT_RUN_OPERATION_KEY_CONFLICT key=${revision.operationKey}`);
  }
}

function immutableRunHash(revision: AuthorityAgentRunRevision): string {
  return canonicalHash128({
    runId: revision.runId,
    projectId: revision.projectId,
    principalId: revision.principalId,
    agentId: revision.agentId,
    goal: revision.goal,
    acceptanceCriteria: revision.acceptanceCriteria,
    correlationId: revision.correlationId,
    causationId: revision.causationId,
    createdAt: revision.createdAt,
  });
}

function revisionParams(revision: AuthorityAgentRunRevision): unknown[] {
  return [
    revision.revisionId,
    revision.runId,
    revision.projectId,
    revision.operationKey,
    revision.operationHash,
    revision.revision,
    revision.previousRevisionId,
    revision.state,
    revision.principalId,
    revision.agentId,
    JSON.stringify(revision.goal),
    JSON.stringify(revision.acceptanceCriteria),
    JSON.stringify(revision.plan),
    JSON.stringify(revision.stepResults),
    JSON.stringify(revision.criterionResults),
    revision.terminalReason,
    revision.correlationId,
    revision.causationId,
    revision.createdAt,
    revision.recordedAt,
    JSON.stringify(revision.metadata),
    revision.contentHash,
  ];
}

function rowToRevision(row: AuthorityAgentRunRevisionRow): AuthorityAgentRunRevision {
  return cloneAndVerify({
    revisionId: row.revision_id,
    runId: row.run_id,
    projectId: row.project_id,
    operationKey: row.operation_key,
    operationHash: row.operation_hash,
    revision: safeInteger(row.revision, 'revision', 1),
    previousRevisionId: row.previous_revision_id,
    state: row.state,
    principalId: row.principal_id,
    agentId: row.agent_id,
    goal: structuredClone(row.goal_value),
    acceptanceCriteria: structuredClone(row.acceptance_criteria),
    plan: structuredClone(row.plan_value),
    stepResults: structuredClone(row.step_results),
    criterionResults: structuredClone(row.criterion_results),
    terminalReason: row.terminal_reason,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: canonicalTime(row.created_at, 'created_at'),
    recordedAt: canonicalTime(row.recorded_at, 'recorded_at'),
    metadata: structuredClone(row.metadata ?? {}),
    contentHash: row.content_hash,
  });
}

function cloneAndVerify(raw: AuthorityAgentRunRevision): AuthorityAgentRunRevision {
  const revision = structuredClone(raw);
  canonicalSerialize(revision);
  const { contentHash: _ignored, ...payload } = revision;
  if (canonicalHash128(payload) !== revision.contentHash) {
    throw new Error(`AGENT_RUN_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
  return revision;
}

function cloneRevision(revision: AuthorityAgentRunRevision): AuthorityAgentRunRevision {
  return cloneAndVerify(revision);
}

function cloneRunRow(row: AuthorityAgentRunRow): AuthorityAgentRunRow {
  return {
    ...row,
    created_at: canonicalTime(row.created_at, 'run row created_at'),
  };
}

function safeInteger(value: string | number, label: string, min: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`AGENT_RUN_ROW_${label.toUpperCase()}_INVALID value=${String(value)}`);
  }
  return parsed;
}

function assertExpectedRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`expectedRevision must be a non-negative safe integer`);
  }
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
