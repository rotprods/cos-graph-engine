import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalizeJsonValue,
  type CanonicalJsonValue,
} from '@cos/core';
import type {
  PostgresExecutor,
  PostgresTransaction,
} from '@cos/runtime';
import {
  SIDE_EFFECT_LEDGER_SCHEMA_VERSION,
  assertSideEffectRevision,
  cloneSideEffectRevision,
  type ISideEffectLedgerStore,
  type SideEffectAppendResult,
  type SideEffectError,
  type SideEffectOperationRevision,
  type SideEffectOperationState,
} from './side-effect-ledger';

export interface SideEffectRevisionRow {
  schema_version: number | string;
  serialization_version: number | string;
  revision_id: string;
  operation_id: string;
  transition_key: string;
  transition_intent_hash: string;
  operation_key: string;
  revision: number | string;
  state: string;
  principal_id: string;
  project_id: string;
  resource_uri: string;
  action_name: string;
  request_hash: string;
  source_ref: string;
  system_from: string | Date;
  fencing_version: number | string | null;
  provider_reference: string | null;
  result_payload: unknown;
  error_payload: unknown;
  uncertainty_reason: string | null;
  compensation_reference: string | null;
  metadata: unknown;
  previous_revision_id: string | null;
  content_hash: string;
}

export const POSTGRES_SIDE_EFFECT_LEDGER_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.side_effect_operation_revisions (
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  serialization_version INTEGER NOT NULL CHECK (serialization_version = 1),
  revision_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  transition_key TEXT NOT NULL UNIQUE,
  transition_intent_hash TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  revision BIGINT NOT NULL CHECK (revision >= 1),
  state TEXT NOT NULL CHECK (state IN (
    'claimed','prepared','executing','succeeded','failed','uncertain','compensating','compensated'
  )),
  principal_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  resource_uri TEXT NOT NULL,
  action_name TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  system_from TIMESTAMPTZ NOT NULL,
  fencing_version BIGINT CHECK (fencing_version IS NULL OR fencing_version >= 1),
  provider_reference TEXT,
  result_payload JSONB,
  error_payload JSONB,
  uncertainty_reason TEXT,
  compensation_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_revision_id TEXT,
  content_hash TEXT NOT NULL,
  UNIQUE(operation_id, revision)
);

CREATE INDEX IF NOT EXISTS cos_side_effect_project_time_idx
  ON cos_execution.side_effect_operation_revisions(project_id, system_from, operation_id, revision);
CREATE INDEX IF NOT EXISTS cos_side_effect_operation_revision_idx
  ON cos_execution.side_effect_operation_revisions(operation_id, revision DESC);
CREATE INDEX IF NOT EXISTS cos_side_effect_state_idx
  ON cos_execution.side_effect_operation_revisions(state, system_from);
`;

/**
 * Append-only Postgres/Supabase candidate for the side-effect operation ledger.
 *
 * A transaction-scoped advisory lock serializes revisions per operation. No
 * historical row is updated. Provider exactly-once semantics are deliberately
 * outside this adapter's claim surface.
 */
export class PostgresSideEffectLedgerStore implements ISideEffectLedgerStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_SIDE_EFFECT_LEDGER_DDL);
  }

  async appendRevision(
    revision: SideEffectOperationRevision,
    expectedCurrentRevision: number,
  ): Promise<SideEffectAppendResult> {
    assertSideEffectRevision(revision);
    assertExpectedRevision(expectedCurrentRevision);

    return this.db.transaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) AS locked', [revision.operationId]);

      const duplicate = await tx.query<SideEffectRevisionRow>(`
        SELECT * FROM cos_execution.side_effect_operation_revisions
        WHERE transition_key=$1
      `, [revision.transitionKey]);
      if (duplicate.rowCount) {
        const existing = rowToRevision(duplicate.rows[0]);
        if (existing.contentHash !== revision.contentHash) {
          throw new Error(`SIDE_EFFECT_TRANSITION_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: existing, appended: false };
      }

      const currentResult = await tx.query<SideEffectRevisionRow>(`
        SELECT * FROM cos_execution.side_effect_operation_revisions
        WHERE operation_id=$1
        ORDER BY revision DESC
        LIMIT 1
      `, [revision.operationId]);
      const current = currentResult.rowCount ? rowToRevision(currentResult.rows[0]) : null;
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(
          `STALE_SIDE_EFFECT_REVISION operation=${revision.operationId} expected=${expectedCurrentRevision} current=${currentRevision}`,
        );
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(
          `SIDE_EFFECT_REVISION_SEQUENCE operation=${revision.operationId} expected=${currentRevision + 1} incoming=${revision.revision}`,
        );
      }
      if (current) assertDbContinuity(current, revision);
      else if (revision.previousRevisionId !== null || revision.state !== 'claimed') {
        throw new Error(`SIDE_EFFECT_INITIAL_REVISION_INVALID operation=${revision.operationId}`);
      }

      const inserted = await insertRevision(tx, revision);
      if (inserted.rowCount !== 1) {
        throw new Error(`SIDE_EFFECT_INSERT_INVARIANT operation=${revision.operationId}`);
      }
      return { revision: rowToRevision(inserted.rows[0]), appended: true };
    });
  }

  async getCurrent(operationId: string): Promise<SideEffectOperationRevision | null> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_operation_revisions
      WHERE operation_id=$1
      ORDER BY revision DESC
      LIMIT 1
    `, [nonEmpty(operationId, 'operationId')]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  async getHistory(operationId: string): Promise<SideEffectOperationRevision[]> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_operation_revisions
      WHERE operation_id=$1
      ORDER BY revision ASC
    `, [nonEmpty(operationId, 'operationId')]);
    return result.rows.map(rowToRevision);
  }

  async getByTransitionKey(transitionKey: string): Promise<SideEffectOperationRevision | null> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_operation_revisions
      WHERE transition_key=$1
    `, [nonEmpty(transitionKey, 'transitionKey')]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  async listProjectOperations(projectId: string): Promise<SideEffectOperationRevision[]> {
    const result = await this.db.query<SideEffectRevisionRow>(`
      SELECT * FROM cos_execution.side_effect_operation_revisions
      WHERE project_id=$1
      ORDER BY system_from ASC, operation_id ASC, revision ASC, revision_id ASC
    `, [nonEmpty(projectId, 'projectId')]);
    return result.rows.map(rowToRevision);
  }
}

async function insertRevision(
  tx: PostgresTransaction,
  revision: SideEffectOperationRevision,
) {
  return tx.query<SideEffectRevisionRow>(`
    INSERT INTO cos_execution.side_effect_operation_revisions (
      schema_version, serialization_version, revision_id, operation_id,
      transition_key, transition_intent_hash, operation_key, revision, state,
      principal_id, project_id, resource_uri, action_name, request_hash,
      source_ref, system_from, fencing_version, provider_reference,
      result_payload, error_payload, uncertainty_reason, compensation_reference,
      metadata, previous_revision_id, content_hash
    ) VALUES (
      1,1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,
      $15,$16,$17::jsonb,$18::jsonb,$19,$20,$21::jsonb,$22,$23
    )
    RETURNING *
  `, [
    revision.revisionId,
    revision.operationId,
    revision.transitionKey,
    revision.transitionIntentHash,
    revision.operationKey,
    revision.revision,
    revision.state,
    revision.principalId,
    revision.projectId,
    revision.resource,
    revision.action,
    revision.requestHash,
    revision.sourceRef,
    revision.systemFrom,
    revision.fencingVersion,
    revision.providerReference,
    revision.result === null ? null : JSON.stringify(revision.result),
    revision.error === null ? null : JSON.stringify(revision.error),
    revision.uncertaintyReason,
    revision.compensationReference,
    JSON.stringify(revision.metadata),
    revision.previousRevisionId,
    revision.contentHash,
  ]);
}

export function rowToRevision(row: SideEffectRevisionRow): SideEffectOperationRevision {
  if (Number(row.schema_version) !== SIDE_EFFECT_LEDGER_SCHEMA_VERSION) {
    throw new Error(`Unsupported side-effect row schema ${row.schema_version}`);
  }
  if (Number(row.serialization_version) !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported side-effect row serialization ${row.serialization_version}`);
  }
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error(`SIDE_EFFECT_ROW_REVISION_INVALID value=${String(row.revision)}`);
  }
  const fencingVersion = row.fencing_version === null ? null : Number(row.fencing_version);
  if (fencingVersion !== null && (!Number.isSafeInteger(fencingVersion) || fencingVersion < 1)) {
    throw new Error(`SIDE_EFFECT_ROW_FENCING_INVALID value=${String(row.fencing_version)}`);
  }

  const result = row.result_payload === null
    ? null
    : canonicalizeJsonValue(row.result_payload);
  const error = row.error_payload === null
    ? null
    : canonicalError(row.error_payload);
  const metadata = canonicalObject(row.metadata ?? {}, 'side-effect row metadata');
  const mapped: SideEffectOperationRevision = {
    schemaVersion: SIDE_EFFECT_LEDGER_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    revisionId: row.revision_id,
    operationId: row.operation_id,
    transitionKey: row.transition_key,
    transitionIntentHash: row.transition_intent_hash,
    operationKey: row.operation_key,
    revision,
    state: row.state as SideEffectOperationState,
    principalId: row.principal_id,
    projectId: row.project_id,
    resource: row.resource_uri,
    action: row.action_name,
    requestHash: row.request_hash,
    sourceRef: row.source_ref,
    systemFrom: toIso(row.system_from),
    fencingVersion,
    providerReference: row.provider_reference,
    result,
    error,
    uncertaintyReason: row.uncertainty_reason,
    compensationReference: row.compensation_reference,
    metadata,
    previousRevisionId: row.previous_revision_id,
    contentHash: row.content_hash,
  };
  assertSideEffectRevision(mapped);
  return cloneSideEffectRevision(mapped);
}

function canonicalError(value: unknown): SideEffectError {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error('side-effect row error must be an object');
  }
  const candidate = canonical as Record<string, CanonicalJsonValue>;
  if (typeof candidate.code !== 'string'
    || typeof candidate.message !== 'string'
    || typeof candidate.retryable !== 'boolean'
    || !Object.prototype.hasOwnProperty.call(candidate, 'details')) {
    throw new Error('side-effect row error has invalid shape');
  }
  return {
    code: candidate.code,
    message: candidate.message,
    retryable: candidate.retryable,
    details: candidate.details,
  };
}

function canonicalObject(value: unknown, label: string): Record<string, CanonicalJsonValue> {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error(`${label} must canonicalize to an object`);
  }
  return canonical as Record<string, CanonicalJsonValue>;
}

function assertDbContinuity(
  current: SideEffectOperationRevision,
  next: SideEffectOperationRevision,
): void {
  if (next.previousRevisionId !== current.revisionId) {
    throw new Error(`SIDE_EFFECT_PARENT_MISMATCH operation=${next.operationId}`);
  }
  const immutable: Array<keyof SideEffectOperationRevision> = [
    'operationId', 'operationKey', 'principalId', 'projectId', 'resource', 'action', 'requestHash', 'sourceRef',
  ];
  for (const field of immutable) {
    if (next[field] !== current[field]) {
      throw new Error(`SIDE_EFFECT_IDENTITY_MUTATION field=${String(field)} operation=${next.operationId}`);
    }
  }
  if (Date.parse(next.systemFrom) <= Date.parse(current.systemFrom)) {
    throw new Error(`SIDE_EFFECT_SYSTEM_TIME_NOT_MONOTONIC operation=${next.operationId}`);
  }
}

function assertExpectedRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('expectedCurrentRevision must be a non-negative safe integer');
  }
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function toIso(value: string | Date): string {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid side-effect row timestamp: ${String(value)}`);
  return new Date(parsed).toISOString();
}
