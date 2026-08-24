import {
  stableHash128,
  assertAuthorityMemoryRecord,
  assertAuthorityMemoryRelation,
  authorityMemoryMatches,
  type AuthorityMemoryQuery,
  type AuthorityMemoryRecord,
  type AuthorityMemoryRelation,
  type AuthorityMemoryRelationType,
  type AuthorityMemoryStatus,
  type AuthoritySensitivity,
  type BitemporalWindow,
  type EntityId,
  type EpistemicType,
  type MemoryLayer,
  type ProvenanceRef,
  type Timestamp,
} from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';

export interface AuthorityMemoryAppendInput<T = unknown> {
  id?: EntityId;
  projectId: string;
  layer: MemoryLayer;
  content: T;
  temporal: BitemporalWindow;
  provenance: ProvenanceRef[];
  epistemicType: EpistemicType;
  confidence: number;
  sensitivity?: AuthoritySensitivity;
  source: EntityId;
  tags?: string[];
  importance: number;
  lastVerifiedAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
  supersedes?: EntityId | null;
}

export interface AuthorityMemorySupersedeInput<T = unknown> {
  currentId: EntityId;
  replacementId?: EntityId;
  content: T;
  at: Timestamp;
  validFrom?: Timestamp;
  observedAt?: Timestamp;
  provenance: ProvenanceRef[];
  epistemicType?: EpistemicType;
  confidence?: number;
  sensitivity?: AuthoritySensitivity;
  source?: EntityId;
  tags?: string[];
  importance?: number;
  lastVerifiedAt?: Timestamp | null;
  metadata?: Record<string, unknown>;
}

export interface AuthorityMemoryRelationInput {
  id?: EntityId;
  projectId: string;
  type: AuthorityMemoryRelationType;
  from: EntityId;
  to: EntityId;
  confidence?: number;
  provenance: ProvenanceRef[];
  recordedAt?: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface IAuthorityMemoryStore {
  append<T = unknown>(input: AuthorityMemoryAppendInput<T>): Promise<AuthorityMemoryRecord<T>>;
  get<T = unknown>(id: EntityId): Promise<AuthorityMemoryRecord<T> | null>;
  query<T = unknown>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryRecord<T>[]>;
  supersede<T = unknown>(input: AuthorityMemorySupersedeInput<T>): Promise<{
    previous: AuthorityMemoryRecord;
    replacement: AuthorityMemoryRecord<T>;
  }>;
  retract(id: EntityId, at: Timestamp, provenance: ProvenanceRef[]): Promise<AuthorityMemoryRecord>;
  relate(input: AuthorityMemoryRelationInput): Promise<AuthorityMemoryRelation>;
  listRelations(projectId: string, recordId?: EntityId): Promise<AuthorityMemoryRelation[]>;
  projectionHash(projectId: string): Promise<string>;
}

/**
 * Append-oriented reference implementation. Closing a temporal window updates
 * the stored revision in place, but no record is physically deleted and every
 * replacement keeps an explicit `supersedes` link.
 */
export class InMemoryAuthorityMemoryStore implements IAuthorityMemoryStore {
  private records = new Map<EntityId, AuthorityMemoryRecord>();
  private relations = new Map<EntityId, AuthorityMemoryRelation>();

  async append<T>(input: AuthorityMemoryAppendInput<T>): Promise<AuthorityMemoryRecord<T>> {
    const record = buildRecord(input);
    const existing = this.records.get(record.id);
    if (existing) {
      if (recordFingerprint(existing) !== recordFingerprint(record)) {
        throw new Error(`Authority memory ID collision: ${String(record.id)}`);
      }
      return cloneRecord(existing) as AuthorityMemoryRecord<T>;
    }
    this.records.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  async get<T>(id: EntityId): Promise<AuthorityMemoryRecord<T> | null> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) as AuthorityMemoryRecord<T> : null;
  }

  async query<T>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryRecord<T>[]> {
    validateQuery(query);
    const offset = Math.max(0, query.offset || 0);
    const limit = query.limit === undefined ? 1000 : Math.max(0, Math.min(100_000, query.limit));
    return Array.from(this.records.values())
      .filter(record => authorityMemoryMatches(record, query))
      .sort(compareRecords)
      .slice(offset, offset + limit)
      .map(record => cloneRecord(record) as AuthorityMemoryRecord<T>);
  }

  async supersede<T>(input: AuthorityMemorySupersedeInput<T>): Promise<{
    previous: AuthorityMemoryRecord;
    replacement: AuthorityMemoryRecord<T>;
  }> {
    const current = this.records.get(input.currentId);
    if (!current) throw new Error(`Authority memory ${String(input.currentId)} not found`);
    const pair = supersedeRecord(current, input);
    if (this.records.has(pair.replacement.id)) throw new Error(`Replacement memory ${String(pair.replacement.id)} already exists`);

    // Commit only after both revisions pass validation.
    this.records.set(pair.previous.id, cloneRecord(pair.previous));
    this.records.set(pair.replacement.id, cloneRecord(pair.replacement));
    return { previous: cloneRecord(pair.previous), replacement: cloneRecord(pair.replacement) };
  }

  async retract(id: EntityId, at: Timestamp, provenance: ProvenanceRef[]): Promise<AuthorityMemoryRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Authority memory ${String(id)} not found`);
    if (current.status !== 'active') throw new Error(`Authority memory ${String(id)} is not active`);
    requireInstant(at, 'retraction timestamp');
    if (!provenance.length) throw new Error('Retraction requires provenance');

    const retracted: AuthorityMemoryRecord = {
      ...cloneRecord(current),
      status: 'retracted',
      temporal: {
        ...current.temporal,
        validUntil: at,
        supersededAt: at,
      },
      provenance: mergeProvenance(current.provenance, provenance),
    };
    assertAuthorityMemoryRecord({ ...retracted, status: 'superseded' });
    // `retracted` is semantically closed like superseded; core validator keeps
    // the stricter active/superseded invariants while this store preserves type.
    this.records.set(id, cloneRecord(retracted));
    return cloneRecord(retracted);
  }

  async relate(input: AuthorityMemoryRelationInput): Promise<AuthorityMemoryRelation> {
    const relation = buildRelation(input);
    const from = this.records.get(relation.from);
    const to = this.records.get(relation.to);
    if (!from || !to) throw new Error('Authority memory relation requires both records to exist');
    if (from.projectId !== relation.projectId || to.projectId !== relation.projectId) {
      throw new Error('Cross-project authority memory relation is forbidden');
    }
    const existing = this.relations.get(relation.id);
    if (existing) {
      if (relationFingerprint(existing) !== relationFingerprint(relation)) {
        throw new Error(`Authority memory relation ID collision: ${String(relation.id)}`);
      }
      return cloneRelation(existing);
    }
    this.relations.set(relation.id, cloneRelation(relation));
    return cloneRelation(relation);
  }

  async listRelations(projectId: string, recordId?: EntityId): Promise<AuthorityMemoryRelation[]> {
    const project = projectId.trim();
    if (!project) throw new Error('projectId must not be empty');
    return Array.from(this.relations.values())
      .filter(relation => relation.projectId === project && (!recordId || relation.from === recordId || relation.to === recordId))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map(cloneRelation);
  }

  async projectionHash(projectId: string): Promise<string> {
    const records = Array.from(this.records.values())
      .filter(record => record.projectId === projectId)
      .sort(compareRecords)
      .map(record => canonicalRecord(record));
    const relations = await this.listRelations(projectId);
    return stableHash128({ records, relations: relations.map(canonicalRelation) });
  }
}

interface AuthorityMemoryRow {
  id: string;
  project_id: string;
  layer: MemoryLayer;
  content: unknown;
  status: AuthorityMemoryStatus;
  sensitivity: AuthoritySensitivity;
  epistemic_type: EpistemicType;
  confidence: number | string;
  importance: number | string;
  valid_from: string | Date;
  valid_until: string | Date | null;
  observed_at: string | Date;
  recorded_at: string | Date;
  superseded_at: string | Date | null;
  supersedes_id: string | null;
  source_id: string;
  tags: string[];
  provenance: ProvenanceRef[];
  last_verified_at: string | Date | null;
  metadata: Record<string, unknown>;
  revision: number | string;
  record_hash: string;
}

interface AuthorityRelationRow {
  id: string;
  project_id: string;
  relation_type: AuthorityMemoryRelationType;
  from_id: string;
  to_id: string;
  confidence: number | string;
  provenance: ProvenanceRef[];
  recorded_at: string | Date;
  metadata: Record<string, unknown>;
  relation_hash: string;
}

export const POSTGRES_AUTHORITY_MEMORY_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_memory;

CREATE TABLE IF NOT EXISTS cos_memory.authority_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  epistemic_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  importance DOUBLE PRECISION NOT NULL CHECK (importance >= 0 AND importance <= 1),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  superseded_at TIMESTAMPTZ,
  supersedes_id TEXT REFERENCES cos_memory.authority_records(id),
  source_id TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  provenance JSONB NOT NULL,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  record_hash TEXT NOT NULL,
  CONSTRAINT authority_valid_window CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT authority_system_window CHECK (superseded_at IS NULL OR superseded_at >= recorded_at)
);

CREATE TABLE IF NOT EXISTS cos_memory.authority_relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  from_id TEXT NOT NULL REFERENCES cos_memory.authority_records(id),
  to_id TEXT NOT NULL REFERENCES cos_memory.authority_records(id),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  relation_hash TEXT NOT NULL,
  CONSTRAINT authority_relation_no_self CHECK (from_id <> to_id)
);

CREATE INDEX IF NOT EXISTS authority_memory_project_status_idx
  ON cos_memory.authority_records(project_id, status, layer);
CREATE INDEX IF NOT EXISTS authority_memory_validity_idx
  ON cos_memory.authority_records(project_id, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS authority_memory_known_idx
  ON cos_memory.authority_records(project_id, recorded_at, superseded_at);
CREATE INDEX IF NOT EXISTS authority_memory_tags_gin_idx
  ON cos_memory.authority_records USING GIN(tags);
CREATE INDEX IF NOT EXISTS authority_memory_provenance_gin_idx
  ON cos_memory.authority_records USING GIN(provenance);
CREATE INDEX IF NOT EXISTS authority_memory_rel_from_idx
  ON cos_memory.authority_relations(project_id, from_id, relation_type);
CREATE INDEX IF NOT EXISTS authority_memory_rel_to_idx
  ON cos_memory.authority_relations(project_id, to_id, relation_type);
`;

/** Durable Postgres/Supabase implementation with row-level CAS on supersession. */
export class PostgresAuthorityMemoryStore implements IAuthorityMemoryStore {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_AUTHORITY_MEMORY_DDL);
  }

  async append<T>(input: AuthorityMemoryAppendInput<T>): Promise<AuthorityMemoryRecord<T>> {
    const record = buildRecord(input);
    const hash = recordFingerprint(record);
    const inserted = await this.db.query<AuthorityMemoryRow>(`
      INSERT INTO cos_memory.authority_records (
        id, project_id, layer, content, status, sensitivity, epistemic_type,
        confidence, importance, valid_from, valid_until, observed_at, recorded_at,
        superseded_at, supersedes_id, source_id, tags, provenance,
        last_verified_at, metadata, revision, record_hash
      ) VALUES (
        $1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,
        $12::timestamptz,$13::timestamptz,$14::timestamptz,$15,$16,$17::text[],
        $18::jsonb,$19::timestamptz,$20::jsonb,1,$21
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `, recordParams(record, hash));
    if (inserted.rowCount === 1) return rowToRecord(inserted.rows[0]) as AuthorityMemoryRecord<T>;

    const existing = await this.db.query<AuthorityMemoryRow>('SELECT * FROM cos_memory.authority_records WHERE id=$1', [String(record.id)]);
    if (!existing.rowCount || existing.rows[0].record_hash !== hash) {
      throw new Error(`Authority memory ID collision: ${String(record.id)}`);
    }
    return rowToRecord(existing.rows[0]) as AuthorityMemoryRecord<T>;
  }

  async get<T>(id: EntityId): Promise<AuthorityMemoryRecord<T> | null> {
    const result = await this.db.query<AuthorityMemoryRow>('SELECT * FROM cos_memory.authority_records WHERE id=$1', [String(id)]);
    return result.rowCount ? rowToRecord(result.rows[0]) as AuthorityMemoryRecord<T> : null;
  }

  async query<T>(query: AuthorityMemoryQuery): Promise<AuthorityMemoryRecord<T>[]> {
    validateQuery(query);
    const where = ['project_id=$1'];
    const params: unknown[] = [query.projectId];
    const param = (value: unknown) => { params.push(value); return `$${params.length}`; };

    if (query.layers?.length) where.push(`layer = ANY(${param(query.layers)}::text[])`);
    if (query.epistemicTypes?.length) where.push(`epistemic_type = ANY(${param(query.epistemicTypes)}::text[])`);
    if (query.statuses?.length) where.push(`status = ANY(${param(query.statuses)}::text[])`);
    if (query.tags?.length) where.push(`tags && ${param(query.tags)}::text[]`);
    if (query.minConfidence !== undefined) where.push(`confidence >= ${param(query.minConfidence)}`);
    if (query.minImportance !== undefined) where.push(`importance >= ${param(query.minImportance)}`);
    where.push(`CASE sensitivity WHEN 'public' THEN 0 WHEN 'internal' THEN 1 WHEN 'private' THEN 2 WHEN 'restricted' THEN 3 ELSE 99 END <= ${param(sensitivityRank(query.maxSensitivity || 'internal'))}`);
    if (query.asOf) {
      where.push(`valid_from <= ${param(query.asOf)}::timestamptz AND (valid_until IS NULL OR valid_until > ${param(query.asOf)}::timestamptz)`);
    }
    if (query.knownAt) {
      where.push(`recorded_at <= ${param(query.knownAt)}::timestamptz AND (superseded_at IS NULL OR superseded_at > ${param(query.knownAt)}::timestamptz)`);
    }

    const limit = query.limit === undefined ? 1000 : Math.max(0, Math.min(100_000, query.limit));
    const offset = Math.max(0, query.offset || 0);
    params.push(limit, offset);
    const result = await this.db.query<AuthorityMemoryRow>(`
      SELECT * FROM cos_memory.authority_records
      WHERE ${where.join(' AND ')}
      ORDER BY recorded_at DESC, id ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    return result.rows.map(row => rowToRecord(row) as AuthorityMemoryRecord<T>);
  }

  async supersede<T>(input: AuthorityMemorySupersedeInput<T>): Promise<{
    previous: AuthorityMemoryRecord;
    replacement: AuthorityMemoryRecord<T>;
  }> {
    return this.db.transaction(async tx => {
      const selected = await tx.query<AuthorityMemoryRow>(
        'SELECT * FROM cos_memory.authority_records WHERE id=$1 FOR UPDATE',
        [String(input.currentId)],
      );
      if (!selected.rowCount) throw new Error(`Authority memory ${String(input.currentId)} not found`);
      const current = rowToRecord(selected.rows[0]);
      const pair = supersedeRecord(current, input);
      const previousHash = recordFingerprint(pair.previous);
      const replacementHash = recordFingerprint(pair.replacement);
      const currentRevision = Number(selected.rows[0].revision);

      const updated = await tx.query<AuthorityMemoryRow>(`
        UPDATE cos_memory.authority_records SET
          status=$2, valid_until=$3::timestamptz, superseded_at=$4::timestamptz,
          provenance=$5::jsonb, revision=revision+1, record_hash=$6
        WHERE id=$1 AND revision=$7 AND status='active'
        RETURNING *
      `, [
        String(pair.previous.id), pair.previous.status, pair.previous.temporal.validUntil,
        pair.previous.temporal.supersededAt, JSON.stringify(pair.previous.provenance),
        previousHash, currentRevision,
      ]);
      if (updated.rowCount !== 1) throw new Error(`STALE_AUTHORITY_MEMORY_REVISION id=${String(input.currentId)}`);

      const inserted = await tx.query<AuthorityMemoryRow>(`
        INSERT INTO cos_memory.authority_records (
          id, project_id, layer, content, status, sensitivity, epistemic_type,
          confidence, importance, valid_from, valid_until, observed_at, recorded_at,
          superseded_at, supersedes_id, source_id, tags, provenance,
          last_verified_at, metadata, revision, record_hash
        ) VALUES (
          $1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,
          $12::timestamptz,$13::timestamptz,$14::timestamptz,$15,$16,$17::text[],
          $18::jsonb,$19::timestamptz,$20::jsonb,1,$21
        )
        RETURNING *
      `, recordParams(pair.replacement, replacementHash));
      return {
        previous: rowToRecord(updated.rows[0]),
        replacement: rowToRecord(inserted.rows[0]) as AuthorityMemoryRecord<T>,
      };
    });
  }

  async retract(id: EntityId, at: Timestamp, provenance: ProvenanceRef[]): Promise<AuthorityMemoryRecord> {
    requireInstant(at, 'retraction timestamp');
    if (!provenance.length) throw new Error('Retraction requires provenance');
    return this.db.transaction(async tx => {
      const selected = await tx.query<AuthorityMemoryRow>('SELECT * FROM cos_memory.authority_records WHERE id=$1 FOR UPDATE', [String(id)]);
      if (!selected.rowCount) throw new Error(`Authority memory ${String(id)} not found`);
      const current = rowToRecord(selected.rows[0]);
      if (current.status !== 'active') throw new Error(`Authority memory ${String(id)} is not active`);
      const closed: AuthorityMemoryRecord = {
        ...current,
        status: 'retracted',
        temporal: { ...current.temporal, validUntil: at, supersededAt: at },
        provenance: mergeProvenance(current.provenance, provenance),
      };
      const hash = recordFingerprint(closed);
      const updated = await tx.query<AuthorityMemoryRow>(`
        UPDATE cos_memory.authority_records SET
          status='retracted', valid_until=$2::timestamptz,
          superseded_at=$2::timestamptz, provenance=$3::jsonb,
          revision=revision+1, record_hash=$4
        WHERE id=$1 AND revision=$5 AND status='active'
        RETURNING *
      `, [String(id), at, JSON.stringify(closed.provenance), hash, Number(selected.rows[0].revision)]);
      if (updated.rowCount !== 1) throw new Error(`STALE_AUTHORITY_MEMORY_REVISION id=${String(id)}`);
      return rowToRecord(updated.rows[0]);
    });
  }

  async relate(input: AuthorityMemoryRelationInput): Promise<AuthorityMemoryRelation> {
    const relation = buildRelation(input);
    return this.db.transaction(async tx => {
      const endpoints = await tx.query<{ id: string; project_id: string }>(
        'SELECT id, project_id FROM cos_memory.authority_records WHERE id=ANY($1::text[])',
        [[String(relation.from), String(relation.to)]],
      );
      if (endpoints.rowCount !== 2 || endpoints.rows.some(row => row.project_id !== relation.projectId)) {
        throw new Error('Authority memory relation endpoints must exist in the same project');
      }
      const hash = relationFingerprint(relation);
      const inserted = await tx.query<AuthorityRelationRow>(`
        INSERT INTO cos_memory.authority_relations (
          id, project_id, relation_type, from_id, to_id, confidence,
          provenance, recorded_at, metadata, relation_hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::timestamptz,$9::jsonb,$10)
        ON CONFLICT(id) DO NOTHING
        RETURNING *
      `, relationParams(relation, hash));
      if (inserted.rowCount === 1) return rowToRelation(inserted.rows[0]);
      const existing = await tx.query<AuthorityRelationRow>('SELECT * FROM cos_memory.authority_relations WHERE id=$1', [String(relation.id)]);
      if (!existing.rowCount || existing.rows[0].relation_hash !== hash) {
        throw new Error(`Authority memory relation ID collision: ${String(relation.id)}`);
      }
      return rowToRelation(existing.rows[0]);
    });
  }

  async listRelations(projectId: string, recordId?: EntityId): Promise<AuthorityMemoryRelation[]> {
    const params: unknown[] = [projectId];
    const filter = recordId ? 'AND (from_id=$2 OR to_id=$2)' : '';
    if (recordId) params.push(String(recordId));
    const result = await this.db.query<AuthorityRelationRow>(`
      SELECT * FROM cos_memory.authority_relations
      WHERE project_id=$1 ${filter}
      ORDER BY id ASC
    `, params);
    return result.rows.map(rowToRelation);
  }

  async projectionHash(projectId: string): Promise<string> {
    const records = await this.db.query<AuthorityMemoryRow>(
      'SELECT * FROM cos_memory.authority_records WHERE project_id=$1 ORDER BY id ASC',
      [projectId],
    );
    const relations = await this.db.query<AuthorityRelationRow>(
      'SELECT * FROM cos_memory.authority_relations WHERE project_id=$1 ORDER BY id ASC',
      [projectId],
    );
    return stableHash128({
      records: records.rows.map(row => canonicalRecord(rowToRecord(row))),
      relations: relations.rows.map(row => canonicalRelation(rowToRelation(row))),
    });
  }
}

function buildRecord<T>(input: AuthorityMemoryAppendInput<T>): AuthorityMemoryRecord<T> {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error('Authority memory projectId must not be empty');
  const record: AuthorityMemoryRecord<T> = {
    id: input.id || `amem_${stableHash128({
      projectId,
      layer: input.layer,
      source: String(input.source),
      recordedAt: input.temporal.recordedAt,
      content: input.content,
      provenance: input.provenance,
    })}` as EntityId,
    projectId,
    layer: input.layer,
    content: structuredClone(input.content),
    temporal: { ...input.temporal },
    provenance: input.provenance.map(item => ({ ...item })),
    epistemicType: input.epistemicType,
    confidence: input.confidence,
    sensitivity: input.sensitivity || 'internal',
    status: 'active',
    supersedes: input.supersedes || null,
    source: input.source,
    tags: [...(input.tags || [])],
    importance: input.importance,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    metadata: structuredClone(input.metadata || {}),
  };
  assertAuthorityMemoryRecord(record);
  return record;
}

function supersedeRecord<T>(
  current: AuthorityMemoryRecord,
  input: AuthorityMemorySupersedeInput<T>,
): { previous: AuthorityMemoryRecord; replacement: AuthorityMemoryRecord<T> } {
  if (current.status !== 'active') throw new Error(`Authority memory ${String(current.id)} is not active`);
  requireInstant(input.at, 'supersession timestamp');
  const validFrom = input.validFrom || input.at;
  const observedAt = input.observedAt || input.at;
  requireInstant(validFrom, 'replacement validFrom');
  requireInstant(observedAt, 'replacement observedAt');
  if (!input.provenance.length) throw new Error('Supersession requires provenance');

  const previous: AuthorityMemoryRecord = {
    ...cloneRecord(current),
    status: 'superseded',
    temporal: {
      ...current.temporal,
      validUntil: validFrom,
      supersededAt: input.at,
    },
  };
  const replacement = buildRecord({
    id: input.replacementId || `amem_${stableHash128({
      previous: String(current.id),
      at: input.at,
      content: input.content,
      provenance: input.provenance,
    })}` as EntityId,
    projectId: current.projectId,
    layer: current.layer,
    content: input.content,
    temporal: {
      validFrom,
      validUntil: null,
      observedAt,
      recordedAt: input.at,
      supersededAt: null,
    },
    provenance: input.provenance,
    epistemicType: input.epistemicType || current.epistemicType,
    confidence: input.confidence ?? current.confidence,
    sensitivity: input.sensitivity || current.sensitivity,
    source: input.source || current.source,
    tags: input.tags || current.tags,
    importance: input.importance ?? current.importance,
    lastVerifiedAt: input.lastVerifiedAt ?? current.lastVerifiedAt,
    metadata: input.metadata || current.metadata,
    supersedes: current.id,
  });
  assertAuthorityMemoryRecord(previous);
  assertAuthorityMemoryRecord(replacement);
  return { previous, replacement };
}

function buildRelation(input: AuthorityMemoryRelationInput): AuthorityMemoryRelation {
  const relation: AuthorityMemoryRelation = {
    id: input.id || `amrel_${stableHash128({
      projectId: input.projectId,
      type: input.type,
      from: String(input.from),
      to: String(input.to),
      provenance: input.provenance,
    })}` as EntityId,
    projectId: input.projectId.trim(),
    type: input.type,
    from: input.from,
    to: input.to,
    confidence: input.confidence ?? 1,
    provenance: input.provenance.map(item => ({ ...item })),
    recordedAt: input.recordedAt || new Date().toISOString(),
    metadata: structuredClone(input.metadata || {}),
  };
  assertAuthorityMemoryRelation(relation);
  return relation;
}

function validateQuery(query: AuthorityMemoryQuery): void {
  if (!query.projectId.trim()) throw new Error('Authority memory query projectId must not be empty');
  for (const [name, value] of [['asOf', query.asOf], ['knownAt', query.knownAt]] as const) {
    if (value && !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
  }
  for (const [name, value] of [['minConfidence', query.minConfidence], ['minImportance', query.minImportance]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error(`${name} must be in [0,1]`);
  }
}

function recordParams(record: AuthorityMemoryRecord, hash: string): unknown[] {
  return [
    String(record.id), record.projectId, record.layer, JSON.stringify(record.content),
    record.status, record.sensitivity, record.epistemicType, record.confidence,
    record.importance, record.temporal.validFrom, record.temporal.validUntil,
    record.temporal.observedAt, record.temporal.recordedAt, record.temporal.supersededAt,
    record.supersedes ? String(record.supersedes) : null, String(record.source), record.tags,
    JSON.stringify(record.provenance), record.lastVerifiedAt, JSON.stringify(record.metadata), hash,
  ];
}

function relationParams(relation: AuthorityMemoryRelation, hash: string): unknown[] {
  return [
    String(relation.id), relation.projectId, relation.type, String(relation.from), String(relation.to),
    relation.confidence, JSON.stringify(relation.provenance), relation.recordedAt,
    JSON.stringify(relation.metadata), hash,
  ];
}

function rowToRecord(row: AuthorityMemoryRow): AuthorityMemoryRecord {
  const record: AuthorityMemoryRecord = {
    id: row.id as EntityId,
    projectId: row.project_id,
    layer: row.layer,
    content: structuredClone(row.content),
    temporal: {
      validFrom: toIso(row.valid_from)!,
      validUntil: toIso(row.valid_until),
      observedAt: toIso(row.observed_at)!,
      recordedAt: toIso(row.recorded_at)!,
      supersededAt: toIso(row.superseded_at),
    },
    provenance: structuredClone(row.provenance || []),
    epistemicType: row.epistemic_type,
    confidence: Number(row.confidence),
    sensitivity: row.sensitivity,
    status: row.status,
    supersedes: row.supersedes_id as EntityId | null,
    source: row.source_id as EntityId,
    tags: [...(row.tags || [])],
    importance: Number(row.importance),
    lastVerifiedAt: toIso(row.last_verified_at),
    metadata: structuredClone(row.metadata || {}),
  };
  if (record.status === 'active' || record.status === 'superseded') assertAuthorityMemoryRecord(record);
  return record;
}

function rowToRelation(row: AuthorityRelationRow): AuthorityMemoryRelation {
  const relation: AuthorityMemoryRelation = {
    id: row.id as EntityId,
    projectId: row.project_id,
    type: row.relation_type,
    from: row.from_id as EntityId,
    to: row.to_id as EntityId,
    confidence: Number(row.confidence),
    provenance: structuredClone(row.provenance || []),
    recordedAt: toIso(row.recorded_at)!,
    metadata: structuredClone(row.metadata || {}),
  };
  assertAuthorityMemoryRelation(relation);
  return relation;
}

function toIso(value: string | Date | null): Timestamp | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function recordFingerprint(record: AuthorityMemoryRecord): string {
  return stableHash128(canonicalRecord(record));
}

function relationFingerprint(relation: AuthorityMemoryRelation): string {
  return stableHash128(canonicalRelation(relation));
}

function canonicalRecord(record: AuthorityMemoryRecord): unknown {
  return {
    ...cloneRecord(record),
    tags: [...record.tags].sort(),
    provenance: record.provenance.map(item => ({ ...item })).sort((a, b) => a.source.localeCompare(b.source)),
  };
}

function canonicalRelation(relation: AuthorityMemoryRelation): unknown {
  return {
    ...cloneRelation(relation),
    provenance: relation.provenance.map(item => ({ ...item })).sort((a, b) => a.source.localeCompare(b.source)),
  };
}

function cloneRecord<T = unknown>(record: AuthorityMemoryRecord<T>): AuthorityMemoryRecord<T> {
  return {
    ...record,
    content: structuredClone(record.content),
    temporal: { ...record.temporal },
    provenance: record.provenance.map(item => ({ ...item })),
    tags: [...record.tags],
    metadata: structuredClone(record.metadata),
  };
}

function cloneRelation(relation: AuthorityMemoryRelation): AuthorityMemoryRelation {
  return {
    ...relation,
    provenance: relation.provenance.map(item => ({ ...item })),
    metadata: structuredClone(relation.metadata),
  };
}

function mergeProvenance(a: ProvenanceRef[], b: ProvenanceRef[]): ProvenanceRef[] {
  const map = new Map<string, ProvenanceRef>();
  for (const item of [...a, ...b]) {
    map.set(stableHash128(item), { ...item });
  }
  return Array.from(map.values()).sort((left, right) => left.source.localeCompare(right.source));
}

function compareRecords(a: AuthorityMemoryRecord, b: AuthorityMemoryRecord): number {
  return b.temporal.recordedAt.localeCompare(a.temporal.recordedAt) || String(a.id).localeCompare(String(b.id));
}

function requireInstant(value: Timestamp, name: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
}

function sensitivityRank(value: AuthoritySensitivity): number {
  return { public: 0, internal: 1, private: 2, restricted: 3 }[value];
}
