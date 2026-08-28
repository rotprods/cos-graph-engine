import { stableHash128 } from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';
import type {
  AuthorityMemoryAppendResult,
  AuthorityMemoryRelation,
  AuthorityMemoryRelationAppendResult,
  AuthorityMemoryRevision,
  IAuthorityMemoryRevisionStore,
} from './authority-memory';

interface AuthorityMemoryRevisionRow {
  revision_id: string;
  memory_id: string;
  operation_key: string;
  revision: string | number;
  project_id: string;
  identity_key: string;
  layer: AuthorityMemoryRevision['layer'];
  content: unknown;
  epistemic_type: AuthorityMemoryRevision['epistemicType'];
  confidence: string | number;
  sensitivity: AuthorityMemoryRevision['sensitivity'];
  base_status: AuthorityMemoryRevision['baseStatus'];
  valid_from: string | Date;
  valid_until: string | Date | null;
  observed_at: string | Date;
  system_from: string | Date;
  provenance: AuthorityMemoryRevision['provenance'] | string;
  source: string;
  tags: string[] | string;
  importance: string | number;
  last_verified_at: string | Date | null;
  metadata: Record<string, unknown> | string;
  supersedes_revision_id: string | null;
  content_hash: string;
}

interface AuthorityMemoryRelationRow {
  id: string;
  operation_key: string;
  project_id: string;
  relation_type: AuthorityMemoryRelation['type'];
  from_memory_id: string;
  to_memory_id: string;
  identity_key: string;
  confidence: string | number;
  sensitivity: AuthorityMemoryRelation['sensitivity'];
  provenance: AuthorityMemoryRelation['provenance'] | string;
  recorded_at: string | Date;
  metadata: Record<string, unknown> | string;
  content_hash: string;
}

export const POSTGRES_AUTHORITY_MEMORY_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_memory;

CREATE TABLE IF NOT EXISTS cos_memory.authority_revisions (
  revision_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  operation_key TEXT NOT NULL UNIQUE,
  revision BIGINT NOT NULL CHECK (revision >= 1),
  project_id TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  layer TEXT NOT NULL,
  content JSONB NOT NULL,
  epistemic_type TEXT NOT NULL CHECK (
    epistemic_type IN ('observed','derived','inferred','hypothesis','decision','unknown')
  ),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('public','internal','private','restricted')),
  base_status TEXT NOT NULL CHECK (base_status IN ('active','retracted')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  system_from TIMESTAMPTZ NOT NULL,
  provenance JSONB NOT NULL,
  source TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  importance DOUBLE PRECISION NOT NULL CHECK (importance >= 0 AND importance <= 1),
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  supersedes_revision_id TEXT,
  content_hash TEXT NOT NULL,
  CONSTRAINT cos_authority_memory_valid_window
    CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT cos_authority_memory_observation_order
    CHECK (system_from >= observed_at),
  CONSTRAINT cos_authority_memory_revision_unique
    UNIQUE(memory_id, revision),
  CONSTRAINT cos_authority_memory_parent_fk
    FOREIGN KEY (supersedes_revision_id)
    REFERENCES cos_memory.authority_revisions(revision_id)
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS cos_authority_memory_project_system_idx
  ON cos_memory.authority_revisions(project_id, system_from, memory_id, revision);
CREATE INDEX IF NOT EXISTS cos_authority_memory_memory_system_idx
  ON cos_memory.authority_revisions(memory_id, system_from, revision);
CREATE INDEX IF NOT EXISTS cos_authority_memory_project_valid_idx
  ON cos_memory.authority_revisions(project_id, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS cos_authority_memory_project_layer_idx
  ON cos_memory.authority_revisions(project_id, layer, memory_id, revision);
CREATE INDEX IF NOT EXISTS cos_authority_memory_tags_gin_idx
  ON cos_memory.authority_revisions USING GIN(tags);
CREATE INDEX IF NOT EXISTS cos_authority_memory_metadata_gin_idx
  ON cos_memory.authority_revisions USING GIN(metadata);

CREATE TABLE IF NOT EXISTS cos_memory.authority_relations (
  id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (
    relation_type IN ('supersedes','contradicts','confirms','evidence_for','derived_from')
  ),
  from_memory_id TEXT NOT NULL,
  to_memory_id TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('public','internal','private','restricted')),
  provenance JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash TEXT NOT NULL,
  CONSTRAINT cos_authority_memory_relation_not_self
    CHECK (from_memory_id <> to_memory_id)
);

CREATE INDEX IF NOT EXISTS cos_authority_memory_relations_project_time_idx
  ON cos_memory.authority_relations(project_id, recorded_at, id);
CREATE INDEX IF NOT EXISTS cos_authority_memory_relations_from_idx
  ON cos_memory.authority_relations(from_memory_id, recorded_at, id);
CREATE INDEX IF NOT EXISTS cos_authority_memory_relations_to_idx
  ON cos_memory.authority_relations(to_memory_id, recorded_at, id);
`;

/**
 * Append-only authority memory adapter for Postgres/Supabase.
 *
 * No historical revision is ever UPDATEd or DELETEd by this adapter. For one
 * logical memory, `pg_advisory_xact_lock(hashtext(memory_id))` serializes
 * revision allocation/CAS even when the initial row does not yet exist. A hash
 * collision only over-serializes unrelated memories; it cannot corrupt them.
 */
export class PostgresAuthorityMemoryStore implements IAuthorityMemoryRevisionStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_AUTHORITY_MEMORY_DDL);
  }

  async appendRevision<T>(
    revision: AuthorityMemoryRevision<T>,
    expectedCurrentRevision: number,
  ): Promise<AuthorityMemoryAppendResult<T>> {
    if (!Number.isSafeInteger(expectedCurrentRevision) || expectedCurrentRevision < 0) {
      throw new Error('expectedCurrentRevision must be a non-negative safe integer');
    }
    assertRevisionHash(revision);

    return this.db.transaction(async tx => {
      const duplicate = await findRevisionByOperation<T>(tx, revision.operationKey);
      if (duplicate) return resolveRevisionRetry(duplicate, revision);

      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [revision.memoryId]);

      // Re-check after acquiring the per-memory transaction lock. Another
      // transaction may have completed the same operation while we waited.
      const duplicateAfterLock = await findRevisionByOperation<T>(tx, revision.operationKey);
      if (duplicateAfterLock) return resolveRevisionRetry(duplicateAfterLock, revision);

      const currentResult = await tx.query<AuthorityMemoryRevisionRow>(`
        SELECT * FROM cos_memory.authority_revisions
        WHERE memory_id=$1
        ORDER BY revision DESC
        LIMIT 1
      `, [revision.memoryId]);
      const current = currentResult.rowCount ? rowToRevision<T>(currentResult.rows[0]) : null;
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_MEMORY_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (revision.revision !== currentRevision + 1) {
        throw new Error(`MEMORY_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${revision.revision}`);
      }
      if (current) {
        if (revision.supersedesRevisionId !== current.revisionId) {
          throw new Error(`MEMORY_REVISION_PARENT_MISMATCH memory=${revision.memoryId}`);
        }
        if (Date.parse(revision.systemFrom) <= Date.parse(current.systemFrom)) {
          throw new Error(`MEMORY_SYSTEM_TIME_NOT_MONOTONIC memory=${revision.memoryId}`);
        }
      } else if (revision.supersedesRevisionId !== null) {
        throw new Error(`MEMORY_INITIAL_REVISION_HAS_PARENT memory=${revision.memoryId}`);
      }

      const inserted = await tx.query<AuthorityMemoryRevisionRow>(`
        INSERT INTO cos_memory.authority_revisions (
          revision_id, memory_id, operation_key, revision, project_id, identity_key,
          layer, content, epistemic_type, confidence, sensitivity, base_status,
          valid_from, valid_until, observed_at, system_from, provenance, source,
          tags, importance, last_verified_at, metadata, supersedes_revision_id,
          content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,
          $13::timestamptz,$14::timestamptz,$15::timestamptz,$16::timestamptz,
          $17::jsonb,$18,$19::jsonb,$20,$21::timestamptz,$22::jsonb,$23,$24
        )
        ON CONFLICT(operation_key) DO NOTHING
        RETURNING *
      `, [
        revision.revisionId,
        revision.memoryId,
        revision.operationKey,
        revision.revision,
        revision.projectId,
        revision.identityKey,
        revision.layer,
        JSON.stringify(revision.content),
        revision.epistemicType,
        revision.confidence,
        revision.sensitivity,
        revision.baseStatus,
        revision.validFrom,
        revision.validUntil,
        revision.observedAt,
        revision.systemFrom,
        JSON.stringify(revision.provenance),
        revision.source,
        JSON.stringify(revision.tags),
        revision.importance,
        revision.lastVerifiedAt,
        JSON.stringify(revision.metadata),
        revision.supersedesRevisionId,
        revision.contentHash,
      ]);

      if (inserted.rowCount === 1) {
        const stored = rowToRevision<T>(inserted.rows[0]);
        assertRevisionHash(stored);
        return { revision: stored, appended: true };
      }

      const raced = await findRevisionByOperation<T>(tx, revision.operationKey);
      if (!raced) throw new Error(`MEMORY_OPERATION_CONFLICT_WITHOUT_ROW key=${revision.operationKey}`);
      return resolveRevisionRetry(raced, revision);
    });
  }

  async getCurrent<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T> | null> {
    const result = await this.db.query<AuthorityMemoryRevisionRow>(`
      SELECT * FROM cos_memory.authority_revisions
      WHERE memory_id=$1
      ORDER BY revision DESC
      LIMIT 1
    `, [memoryId]);
    if (!result.rowCount) return null;
    const revision = rowToRevision<T>(result.rows[0]);
    assertRevisionHash(revision);
    return revision;
  }

  async getHistory<T = unknown>(memoryId: string): Promise<AuthorityMemoryRevision<T>[]> {
    const result = await this.db.query<AuthorityMemoryRevisionRow>(`
      SELECT * FROM cos_memory.authority_revisions
      WHERE memory_id=$1
      ORDER BY revision ASC
    `, [memoryId]);
    return result.rows.map(row => {
      const revision = rowToRevision<T>(row);
      assertRevisionHash(revision);
      return revision;
    });
  }

  async listProjectRevisions<T = unknown>(projectId: string): Promise<AuthorityMemoryRevision<T>[]> {
    const result = await this.db.query<AuthorityMemoryRevisionRow>(`
      SELECT * FROM cos_memory.authority_revisions
      WHERE project_id=$1
      ORDER BY memory_id ASC, revision ASC
    `, [projectId]);
    return result.rows.map(row => {
      const revision = rowToRevision<T>(row);
      assertRevisionHash(revision);
      return revision;
    });
  }

  async appendRelation(relation: AuthorityMemoryRelation): Promise<AuthorityMemoryRelationAppendResult> {
    assertRelationHash(relation);
    return this.db.transaction(async tx => {
      const duplicate = await findRelationByOperation(tx, relation.operationKey);
      if (duplicate) return resolveRelationRetry(duplicate, relation);

      // Relation IDs are immutable facts. Serializing on ID closes the race
      // between preflight and insert without requiring an UPDATE-capable row.
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`relation:${relation.id}`]);
      const duplicateAfterLock = await findRelationByOperation(tx, relation.operationKey);
      if (duplicateAfterLock) return resolveRelationRetry(duplicateAfterLock, relation);

      const endpointResult = await tx.query<{ memory_id: string; project_id: string }>(`
        SELECT DISTINCT ON (memory_id) memory_id, project_id
        FROM cos_memory.authority_revisions
        WHERE memory_id = ANY($1::text[])
        ORDER BY memory_id, revision DESC
      `, [[relation.fromMemoryId, relation.toMemoryId]]);
      if (endpointResult.rowCount !== 2) throw new Error('Memory relation endpoints must exist');
      if (endpointResult.rows.some(row => row.project_id !== relation.projectId)) {
        throw new Error('CROSS_PROJECT_MEMORY_RELATION_REJECTED');
      }

      const inserted = await tx.query<AuthorityMemoryRelationRow>(`
        INSERT INTO cos_memory.authority_relations (
          id, operation_key, project_id, relation_type, from_memory_id, to_memory_id,
          identity_key, confidence, sensitivity, provenance, recorded_at, metadata,
          content_hash
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::timestamptz,$12::jsonb,$13
        )
        ON CONFLICT(operation_key) DO NOTHING
        RETURNING *
      `, [
        relation.id,
        relation.operationKey,
        relation.projectId,
        relation.type,
        relation.fromMemoryId,
        relation.toMemoryId,
        relation.identityKey,
        relation.confidence,
        relation.sensitivity,
        JSON.stringify(relation.provenance),
        relation.recordedAt,
        JSON.stringify(relation.metadata),
        relation.contentHash,
      ]);

      if (inserted.rowCount === 1) {
        const stored = rowToRelation(inserted.rows[0]);
        assertRelationHash(stored);
        return { relation: stored, appended: true };
      }
      const raced = await findRelationByOperation(tx, relation.operationKey);
      if (!raced) throw new Error(`MEMORY_RELATION_OPERATION_CONFLICT_WITHOUT_ROW key=${relation.operationKey}`);
      return resolveRelationRetry(raced, relation);
    });
  }

  async listProjectRelations(projectId: string): Promise<AuthorityMemoryRelation[]> {
    const result = await this.db.query<AuthorityMemoryRelationRow>(`
      SELECT * FROM cos_memory.authority_relations
      WHERE project_id=$1
      ORDER BY recorded_at ASC, id ASC
    `, [projectId]);
    return result.rows.map(row => {
      const relation = rowToRelation(row);
      assertRelationHash(relation);
      return relation;
    });
  }
}

async function findRevisionByOperation<T>(
  tx: PostgresTransaction,
  operationKey: string,
): Promise<AuthorityMemoryRevision<T> | null> {
  const result = await tx.query<AuthorityMemoryRevisionRow>(
    'SELECT * FROM cos_memory.authority_revisions WHERE operation_key=$1',
    [operationKey],
  );
  if (!result.rowCount) return null;
  const revision = rowToRevision<T>(result.rows[0]);
  assertRevisionHash(revision);
  return revision;
}

async function findRelationByOperation(
  tx: PostgresTransaction,
  operationKey: string,
): Promise<AuthorityMemoryRelation | null> {
  const result = await tx.query<AuthorityMemoryRelationRow>(
    'SELECT * FROM cos_memory.authority_relations WHERE operation_key=$1',
    [operationKey],
  );
  if (!result.rowCount) return null;
  const relation = rowToRelation(result.rows[0]);
  assertRelationHash(relation);
  return relation;
}

function resolveRevisionRetry<T>(
  existing: AuthorityMemoryRevision<T>,
  incoming: AuthorityMemoryRevision<T>,
): AuthorityMemoryAppendResult<T> {
  if (existing.contentHash !== incoming.contentHash
    || existing.memoryId !== incoming.memoryId
    || existing.revisionId !== incoming.revisionId) {
    throw new Error(`MEMORY_IDEMPOTENCY_CONFLICT key=${incoming.operationKey}`);
  }
  return { revision: cloneRevision(existing), appended: false };
}

function resolveRelationRetry(
  existing: AuthorityMemoryRelation,
  incoming: AuthorityMemoryRelation,
): AuthorityMemoryRelationAppendResult {
  if (existing.contentHash !== incoming.contentHash || existing.id !== incoming.id) {
    throw new Error(`MEMORY_RELATION_IDEMPOTENCY_CONFLICT key=${incoming.operationKey}`);
  }
  return { relation: cloneRelation(existing), appended: false };
}

function rowToRevision<T>(row: AuthorityMemoryRevisionRow): AuthorityMemoryRevision<T> {
  return {
    revisionId: row.revision_id,
    memoryId: row.memory_id,
    operationKey: row.operation_key,
    revision: Number(row.revision),
    projectId: row.project_id,
    identityKey: row.identity_key,
    layer: row.layer,
    content: cloneJson(parseJson<T>(row.content)),
    epistemicType: row.epistemic_type,
    confidence: Number(row.confidence),
    sensitivity: row.sensitivity,
    baseStatus: row.base_status,
    validFrom: toIso(row.valid_from),
    validUntil: row.valid_until === null ? null : toIso(row.valid_until),
    observedAt: toIso(row.observed_at),
    systemFrom: toIso(row.system_from),
    provenance: cloneJson(parseJson<AuthorityMemoryRevision['provenance']>(row.provenance)),
    source: row.source,
    tags: cloneJson(parseJson<string[]>(row.tags)),
    importance: Number(row.importance),
    lastVerifiedAt: row.last_verified_at === null ? null : toIso(row.last_verified_at),
    metadata: cloneJson(parseJson<Record<string, unknown>>(row.metadata)),
    supersedesRevisionId: row.supersedes_revision_id,
    contentHash: row.content_hash,
  };
}

function rowToRelation(row: AuthorityMemoryRelationRow): AuthorityMemoryRelation {
  return {
    id: row.id,
    operationKey: row.operation_key,
    projectId: row.project_id,
    type: row.relation_type,
    fromMemoryId: row.from_memory_id,
    toMemoryId: row.to_memory_id,
    identityKey: row.identity_key,
    confidence: Number(row.confidence),
    sensitivity: row.sensitivity,
    provenance: cloneJson(parseJson<AuthorityMemoryRelation['provenance']>(row.provenance)),
    recordedAt: toIso(row.recorded_at),
    metadata: cloneJson(parseJson<Record<string, unknown>>(row.metadata)),
    contentHash: row.content_hash,
  };
}

function assertRevisionHash(revision: AuthorityMemoryRevision): void {
  const { contentHash, ...base } = revision;
  const actual = stableHash128(base);
  if (actual !== contentHash) {
    throw new Error(`MEMORY_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
}

function assertRelationHash(relation: AuthorityMemoryRelation): void {
  const { contentHash, ...base } = relation;
  const actual = stableHash128(base);
  if (actual !== contentHash) {
    throw new Error(`MEMORY_RELATION_HASH_MISMATCH id=${relation.id}`);
  }
}

function parseJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function cloneRevision<T>(revision: AuthorityMemoryRevision<T>): AuthorityMemoryRevision<T> {
  return {
    ...revision,
    content: cloneJson(revision.content),
    provenance: cloneJson(revision.provenance),
    tags: [...revision.tags],
    metadata: cloneJson(revision.metadata),
  };
}

function cloneRelation(relation: AuthorityMemoryRelation): AuthorityMemoryRelation {
  return {
    ...relation,
    provenance: cloneJson(relation.provenance),
    metadata: cloneJson(relation.metadata),
  };
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
