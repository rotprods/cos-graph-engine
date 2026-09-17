import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  PostgresExecutor,
  PostgresTransaction,
} from '@cos/runtime';
import type {
  AuthorityLeaseAppendResult,
  AuthorityLeaseRevision,
  IAuthorityLeaseStore,
} from './authority-lease';

export interface AuthorityLeaseRevisionRow {
  revision_id: string;
  resource_uri: string;
  resource_revision: string | number;
  lease_id: string;
  lease_revision: string | number;
  operation_key: string;
  operation_hash: string;
  owner_id: string;
  state: AuthorityLeaseRevision['state'];
  fencing_token: string | number;
  acquired_at: string | Date;
  expires_at: string | Date;
  recorded_at: string | Date;
  previous_revision_id: string | null;
  metadata: Record<string, unknown>;
  content_hash: string;
}

export const AUTHORITY_LEASE_POSTGRES_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_execution;

CREATE TABLE IF NOT EXISTS cos_execution.authority_lease_revisions (
  revision_id TEXT PRIMARY KEY,
  resource_uri TEXT NOT NULL,
  resource_revision BIGINT NOT NULL CHECK (resource_revision >= 1),
  lease_id TEXT NOT NULL,
  lease_revision BIGINT NOT NULL CHECK (lease_revision >= 1),
  operation_key TEXT NOT NULL,
  operation_hash TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active','released')),
  fencing_token BIGINT NOT NULL CHECK (fencing_token >= 1),
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  previous_revision_id TEXT REFERENCES cos_execution.authority_lease_revisions(revision_id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  UNIQUE(resource_uri, resource_revision),
  UNIQUE(resource_uri, operation_key),
  CHECK (expires_at > acquired_at),
  CHECK (recorded_at >= acquired_at)
);

CREATE INDEX IF NOT EXISTS cos_authority_lease_current_idx
  ON cos_execution.authority_lease_revisions(resource_uri, resource_revision DESC);
CREATE INDEX IF NOT EXISTS cos_authority_lease_owner_idx
  ON cos_execution.authority_lease_revisions(owner_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS cos_authority_lease_expiry_idx
  ON cos_execution.authority_lease_revisions(expires_at, state);
`;

/** Append-only PostgreSQL/Supabase resource lease authority candidate. */
export class AuthorityLeasePostgresStore implements IAuthorityLeaseStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(AUTHORITY_LEASE_POSTGRES_DDL);
  }

  async append(
    raw: AuthorityLeaseRevision,
    expectedResourceRevision: number,
  ): Promise<AuthorityLeaseAppendResult> {
    const revision = cloneAndVerify(raw);
    assertNonNegativeInteger(expectedResourceRevision, 'expectedResourceRevision');

    return this.db.transaction(async tx => {
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [revision.resourceUri],
      );

      const duplicate = await this.selectOperation(
        tx,
        revision.resourceUri,
        revision.operationKey,
      );
      if (duplicate) return classifyDuplicate(duplicate, revision);

      const current = await this.selectCurrent(tx, revision.resourceUri, true);
      validateAppend(revision, current, expectedResourceRevision);

      const inserted = await tx.query<AuthorityLeaseRevisionRow>(`
        INSERT INTO cos_execution.authority_lease_revisions (
          revision_id, resource_uri, resource_revision, lease_id,
          lease_revision, operation_key, operation_hash, owner_id, state,
          fencing_token, acquired_at, expires_at, recorded_at,
          previous_revision_id, metadata, content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11::timestamptz,$12::timestamptz,$13::timestamptz,
          $14,$15::jsonb,$16
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [
        revision.revisionId,
        revision.resourceUri,
        revision.resourceRevision,
        revision.leaseId,
        revision.leaseRevision,
        revision.operationKey,
        revision.operationHash,
        revision.ownerId,
        revision.state,
        revision.fencingToken,
        revision.acquiredAt,
        revision.expiresAt,
        revision.recordedAt,
        revision.previousRevisionId,
        JSON.stringify(revision.metadata),
        revision.contentHash,
      ]);

      if (inserted.rowCount === 1) {
        return { revision: rowToRevision(inserted.rows[0]), appended: true };
      }

      const operationDuplicate = await this.selectOperation(
        tx,
        revision.resourceUri,
        revision.operationKey,
      );
      if (operationDuplicate) return classifyDuplicate(operationDuplicate, revision);

      const revisionCollision = await this.selectRevisionById(tx, revision.revisionId);
      if (revisionCollision) {
        if (revisionCollision.contentHash === revision.contentHash) {
          return { revision: revisionCollision, appended: false };
        }
        throw new Error(`LEASE_REVISION_ID_COLLISION id=${revision.revisionId}`);
      }

      throw new Error(
        `LEASE_APPEND_CONFLICT resource=${revision.resourceUri} revision=${revision.resourceRevision}`,
      );
    });
  }

  async getCurrent(resourceUri: string): Promise<AuthorityLeaseRevision | null> {
    return this.selectCurrent(this.db, normalizeResource(resourceUri), false);
  }

  async getByOperationKey(
    resourceUri: string,
    operationKey: string,
  ): Promise<AuthorityLeaseRevision | null> {
    return this.selectOperation(
      this.db,
      normalizeResource(resourceUri),
      nonEmpty(operationKey, 'operationKey'),
    );
  }

  async getHistory(resourceUri: string): Promise<AuthorityLeaseRevision[]> {
    const result = await this.db.query<AuthorityLeaseRevisionRow>(`
      SELECT * FROM cos_execution.authority_lease_revisions
      WHERE resource_uri=$1
      ORDER BY resource_revision ASC, recorded_at ASC, revision_id ASC
    `, [normalizeResource(resourceUri)]);
    return result.rows.map(rowToRevision);
  }

  private async selectCurrent(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    resourceUri: string,
    forUpdate: boolean,
  ): Promise<AuthorityLeaseRevision | null> {
    const suffix = forUpdate ? ' FOR UPDATE' : '';
    const result = await queryable.query<AuthorityLeaseRevisionRow>(`
      SELECT * FROM cos_execution.authority_lease_revisions
      WHERE resource_uri=$1
      ORDER BY resource_revision DESC
      LIMIT 1${suffix}
    `, [resourceUri]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  private async selectOperation(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    resourceUri: string,
    operationKey: string,
  ): Promise<AuthorityLeaseRevision | null> {
    const result = await queryable.query<AuthorityLeaseRevisionRow>(`
      SELECT * FROM cos_execution.authority_lease_revisions
      WHERE resource_uri=$1 AND operation_key=$2
    `, [resourceUri, operationKey]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }

  private async selectRevisionById(
    queryable: Pick<PostgresExecutor, 'query'> | PostgresTransaction,
    revisionId: string,
  ): Promise<AuthorityLeaseRevision | null> {
    const result = await queryable.query<AuthorityLeaseRevisionRow>(`
      SELECT * FROM cos_execution.authority_lease_revisions
      WHERE revision_id=$1
    `, [revisionId]);
    return result.rowCount ? rowToRevision(result.rows[0]) : null;
  }
}

function classifyDuplicate(
  existing: AuthorityLeaseRevision,
  incoming: AuthorityLeaseRevision,
): AuthorityLeaseAppendResult {
  if (existing.operationHash !== incoming.operationHash) {
    throw new Error(`LEASE_OPERATION_KEY_CONFLICT key=${incoming.operationKey}`);
  }
  return { revision: structuredClone(existing), appended: false };
}

function validateAppend(
  incoming: AuthorityLeaseRevision,
  current: AuthorityLeaseRevision | null,
  expectedResourceRevision: number,
): void {
  const currentResourceRevision = current?.resourceRevision ?? 0;
  if (currentResourceRevision !== expectedResourceRevision) {
    throw new Error(
      `STALE_LEASE_RESOURCE_REVISION expected=${expectedResourceRevision} current=${currentResourceRevision}`,
    );
  }
  if (incoming.resourceRevision !== currentResourceRevision + 1) {
    throw new Error(
      `LEASE_RESOURCE_REVISION_SEQUENCE expected=${currentResourceRevision + 1} incoming=${incoming.resourceRevision}`,
    );
  }

  if (!current) {
    if (incoming.resourceRevision !== 1
      || incoming.leaseRevision !== 1
      || incoming.previousRevisionId !== null
      || incoming.fencingToken !== 1) {
      throw new Error(`LEASE_INVALID_INITIAL_REVISION resource=${incoming.resourceUri}`);
    }
    return;
  }

  if (incoming.previousRevisionId !== current.revisionId) {
    throw new Error(`LEASE_REVISION_PARENT_MISMATCH resource=${incoming.resourceUri}`);
  }
  if (Date.parse(incoming.recordedAt) <= Date.parse(current.recordedAt)) {
    throw new Error(`LEASE_SYSTEM_TIME_NOT_MONOTONIC resource=${incoming.resourceUri}`);
  }
  if (incoming.leaseId === current.leaseId) {
    if (incoming.leaseRevision !== current.leaseRevision + 1) {
      throw new Error(`LEASE_REVISION_SEQUENCE lease=${incoming.leaseId}`);
    }
    if (incoming.fencingToken !== current.fencingToken) {
      throw new Error(`LEASE_FENCING_CHANGED_DURING_SAME_LEASE lease=${incoming.leaseId}`);
    }
    return;
  }
  if (incoming.leaseRevision !== 1) {
    throw new Error(`LEASE_NEW_ID_REVISION_INVALID lease=${incoming.leaseId}`);
  }
  if (incoming.fencingToken !== current.fencingToken + 1) {
    throw new Error(
      `LEASE_FENCING_SEQUENCE expected=${current.fencingToken + 1} incoming=${incoming.fencingToken}`,
    );
  }
}

function rowToRevision(row: AuthorityLeaseRevisionRow): AuthorityLeaseRevision {
  return cloneAndVerify({
    revisionId: row.revision_id,
    resourceUri: row.resource_uri,
    resourceRevision: safeInteger(row.resource_revision, 'resource_revision', 1),
    leaseId: row.lease_id,
    leaseRevision: safeInteger(row.lease_revision, 'lease_revision', 1),
    operationKey: row.operation_key,
    operationHash: row.operation_hash,
    ownerId: row.owner_id,
    state: row.state,
    fencingToken: safeInteger(row.fencing_token, 'fencing_token', 1),
    acquiredAt: canonicalTime(row.acquired_at, 'acquired_at'),
    expiresAt: canonicalTime(row.expires_at, 'expires_at'),
    recordedAt: canonicalTime(row.recorded_at, 'recorded_at'),
    previousRevisionId: row.previous_revision_id,
    metadata: structuredClone(row.metadata ?? {}),
    contentHash: row.content_hash,
  });
}

function cloneAndVerify(raw: AuthorityLeaseRevision): AuthorityLeaseRevision {
  const revision = structuredClone(raw);
  canonicalSerialize(revision);
  const { contentHash: _ignored, ...payload } = revision;
  const expected = canonicalHash128(payload);
  if (expected !== revision.contentHash) {
    throw new Error(`LEASE_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
  if (Date.parse(revision.expiresAt) <= Date.parse(revision.acquiredAt)) {
    throw new Error(`LEASE_TIME_WINDOW_INVALID revision=${revision.revisionId}`);
  }
  return revision;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
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

function normalizeResource(value: string): string {
  return nonEmpty(value, 'resourceUri');
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
