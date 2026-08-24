import {
  stableHash128,
  type EntityId,
  type MemoryEntry,
  type MemoryLayer,
} from '@cos/core';
import type { PostgresExecutor, PostgresTransaction } from '@cos/runtime';
import { MemoryManager } from './memory-manager';

export type MemoryEpistemicType =
  | 'observation'
  | 'claim'
  | 'fact'
  | 'decision'
  | 'procedure'
  | 'hypothesis'
  | 'preference'
  | 'episode';

export type MemorySensitivity = 'public' | 'internal' | 'private' | 'restricted';

const SENSITIVITY_ORDER: Record<MemorySensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface TemporalMemoryEnvelopeInput {
  memoryId: EntityId;
  projectId?: string;
  sensitivity?: MemorySensitivity;
  epistemicType: MemoryEpistemicType;
  confidence: number;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  recordedAt?: string;
  supersedes?: EntityId;
  contradicts?: EntityId[];
  sourceRevision?: string;
  metadata?: Record<string, unknown>;
}

export interface TemporalMemoryEnvelope {
  schemaVersion: 1;
  memoryId: EntityId;
  projectId?: string;
  sensitivity: MemorySensitivity;
  epistemicType: MemoryEpistemicType;
  confidence: number;
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  observedAt?: string;
  recordedAt: string;
  supersedes?: EntityId;
  contradicts: EntityId[];
  sourceRevision?: string;
  metadata: Record<string, unknown>;
}

export interface VersionedTemporalMemoryEnvelope {
  envelope: TemporalMemoryEnvelope;
  revision: number;
  contentHash: string;
}

export interface TemporalMemoryQuery {
  projectId?: string;
  maxSensitivity?: MemorySensitivity;
  epistemicTypes?: MemoryEpistemicType[];
  validAt?: string;
  knownAt?: string;
  currentOnly?: boolean;
  limit?: number;
}

export interface ITemporalMemoryIndex {
  add(input: TemporalMemoryEnvelopeInput): Promise<VersionedTemporalMemoryEnvelope>;
  get(memoryId: EntityId): Promise<VersionedTemporalMemoryEnvelope | null>;
  update(
    memoryId: EntityId,
    expectedRevision: number,
    updates: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>>,
  ): Promise<VersionedTemporalMemoryEnvelope>;
  remove(memoryId: EntityId, expectedRevision?: number): Promise<void>;
  query(query?: TemporalMemoryQuery): Promise<VersionedTemporalMemoryEnvelope[]>;
  projectionHash(query?: TemporalMemoryQuery): Promise<string>;
}

/** Reference temporal index with explicit revision CAS. */
export class InMemoryTemporalMemoryIndex implements ITemporalMemoryIndex {
  private readonly records = new Map<EntityId, VersionedTemporalMemoryEnvelope>();

  async add(input: TemporalMemoryEnvelopeInput): Promise<VersionedTemporalMemoryEnvelope> {
    if (this.records.has(input.memoryId)) {
      throw new Error(`TEMPORAL_MEMORY_ALREADY_EXISTS id=${String(input.memoryId)}`);
    }
    const envelope = normalizeEnvelope(input);
    const record = versioned(envelope, 1);
    this.records.set(input.memoryId, record);
    return cloneRecord(record);
  }

  async get(memoryId: EntityId): Promise<VersionedTemporalMemoryEnvelope | null> {
    const record = this.records.get(memoryId);
    return record ? cloneRecord(record) : null;
  }

  async update(
    memoryId: EntityId,
    expectedRevision: number,
    updates: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>>,
  ): Promise<VersionedTemporalMemoryEnvelope> {
    const current = this.records.get(memoryId);
    if (!current) throw new Error(`TEMPORAL_MEMORY_NOT_FOUND id=${String(memoryId)}`);
    assertExpectedRevision(expectedRevision, current.revision);
    const next = normalizeEnvelope({
      ...current.envelope,
      ...updates,
      memoryId,
      contradicts: updates.contradicts
        ? [...updates.contradicts]
        : [...current.envelope.contradicts],
      metadata: updates.metadata
        ? structuredClone(updates.metadata)
        : structuredClone(current.envelope.metadata),
      recordedAt: current.envelope.recordedAt,
    });
    const record = versioned(next, current.revision + 1);
    this.records.set(memoryId, record);
    return cloneRecord(record);
  }

  async remove(memoryId: EntityId, expectedRevision?: number): Promise<void> {
    const current = this.records.get(memoryId);
    if (!current) return;
    if (expectedRevision !== undefined) assertExpectedRevision(expectedRevision, current.revision);
    this.records.delete(memoryId);
  }

  async query(query: TemporalMemoryQuery = {}): Promise<VersionedTemporalMemoryEnvelope[]> {
    const maxSensitivity = SENSITIVITY_ORDER[query.maxSensitivity || 'internal'];
    const validAt = parseOptionalTime(query.validAt, 'validAt');
    const knownAt = parseOptionalTime(query.knownAt, 'knownAt');
    const limit = query.limit ?? 1000;
    if (!Number.isInteger(limit) || limit < 0 || limit > 100_000) {
      throw new Error('Temporal memory limit must be an integer in [0,100000]');
    }

    return Array.from(this.records.values())
      .filter(record => {
        const envelope = record.envelope;
        if (query.projectId && envelope.projectId !== query.projectId) return false;
        if (SENSITIVITY_ORDER[envelope.sensitivity] > maxSensitivity) return false;
        if (query.epistemicTypes?.length && !query.epistemicTypes.includes(envelope.epistemicType)) return false;
        if (validAt !== null && !validAtTime(envelope, validAt)) return false;
        if (knownAt !== null && Date.parse(envelope.recordedAt) > knownAt) return false;
        if (query.currentOnly && envelope.validUntil) return false;
        return true;
      })
      .sort((a, b) =>
        a.envelope.recordedAt.localeCompare(b.envelope.recordedAt)
        || String(a.envelope.memoryId).localeCompare(String(b.envelope.memoryId)),
      )
      .slice(0, limit)
      .map(cloneRecord);
  }

  async projectionHash(query: TemporalMemoryQuery = {}): Promise<string> {
    return stableHash128(await this.query(query));
  }
}

export interface StoreTemporalMemoryOptions {
  tags?: string[];
  importance?: number;
  ttl?: number | null;
  source?: EntityId;
  memoryMetadata?: Record<string, unknown>;
  envelope: Omit<TemporalMemoryEnvelopeInput, 'memoryId'>;
}

export interface TemporalMemoryRecord {
  entry: MemoryEntry;
  temporal: VersionedTemporalMemoryEnvelope;
}

/**
 * Coordinates semantic memory content with a separate authority envelope.
 *
 * The two stores are not falsely presented as one database transaction. The
 * service uses compensating deletion on create and an explicit saga on
 * supersession; durable event logging should record these steps in production.
 */
export class TemporalMemoryService {
  constructor(
    private readonly memory: MemoryManager,
    private readonly temporal: ITemporalMemoryIndex,
  ) {}

  async store(
    content: unknown,
    layer: MemoryLayer,
    options: StoreTemporalMemoryOptions,
  ): Promise<TemporalMemoryRecord> {
    const memoryId = await this.memory.store(content, layer, {
      tags: options.tags,
      importance: options.importance,
      ttl: options.ttl,
      source: options.source,
      metadata: options.memoryMetadata,
    });

    try {
      const temporal = await this.temporal.add({
        ...options.envelope,
        memoryId,
      });
      const entry = await this.memory.retrieve(memoryId);
      if (!entry) throw new Error(`Memory ${String(memoryId)} disappeared after store`);
      return { entry, temporal };
    } catch (error) {
      try {
        await this.memory.delete(memoryId);
      } catch (compensationError) {
        throw new Error(
          `TEMPORAL_MEMORY_CREATE_AND_COMPENSATION_FAILED create=${errorMessage(error)} compensation=${errorMessage(compensationError)}`,
        );
      }
      throw error;
    }
  }

  async get(memoryId: EntityId): Promise<TemporalMemoryRecord | null> {
    const [entry, temporal] = await Promise.all([
      this.memory.retrieve(memoryId),
      this.temporal.get(memoryId),
    ]);
    if (!entry && !temporal) return null;
    if (!entry || !temporal) {
      throw new Error(`TEMPORAL_MEMORY_DIVERGENCE id=${String(memoryId)} content=${Boolean(entry)} envelope=${Boolean(temporal)}`);
    }
    return { entry, temporal };
  }

  async supersede(
    currentId: EntityId,
    expectedTemporalRevision: number,
    replacementContent: unknown,
    layer: MemoryLayer,
    options: StoreTemporalMemoryOptions,
  ): Promise<TemporalMemoryRecord> {
    const current = await this.get(currentId);
    if (!current) throw new Error(`TEMPORAL_MEMORY_NOT_FOUND id=${String(currentId)}`);
    if (current.temporal.revision !== expectedTemporalRevision) {
      throw new Error(
        `STALE_TEMPORAL_MEMORY_REVISION expected=${expectedTemporalRevision} current=${current.temporal.revision}`,
      );
    }
    if (current.temporal.envelope.validUntil) {
      throw new Error(`TEMPORAL_MEMORY_ALREADY_RETIRED id=${String(currentId)}`);
    }

    const now = options.envelope.recordedAt || new Date().toISOString();
    const replacement = await this.store(replacementContent, layer, {
      ...options,
      envelope: {
        ...options.envelope,
        supersedes: currentId,
        recordedAt: now,
      },
    });

    try {
      await this.temporal.update(currentId, expectedTemporalRevision, {
        validUntil: options.envelope.validFrom || now,
      });
      return replacement;
    } catch (error) {
      try {
        await this.temporal.remove(replacement.entry.id, replacement.temporal.revision);
        await this.memory.delete(replacement.entry.id);
      } catch (compensationError) {
        throw new Error(
          `TEMPORAL_MEMORY_SUPERSESSION_DIVERGED original=${String(currentId)} replacement=${String(replacement.entry.id)} failure=${errorMessage(error)} compensation=${errorMessage(compensationError)}`,
        );
      }
      throw error;
    }
  }

  async query(query: TemporalMemoryQuery = {}): Promise<TemporalMemoryRecord[]> {
    const temporalRecords = await this.temporal.query(query);
    const result: TemporalMemoryRecord[] = [];
    for (const temporal of temporalRecords) {
      const entry = await this.memory.retrieve(temporal.envelope.memoryId);
      if (!entry) {
        throw new Error(`TEMPORAL_MEMORY_DIVERGENCE id=${String(temporal.envelope.memoryId)} content=false envelope=true`);
      }
      result.push({ entry, temporal });
    }
    return result;
  }
}

interface TemporalEnvelopeRow {
  memory_id: string;
  schema_version: number | string;
  project_id: string | null;
  sensitivity: MemorySensitivity;
  epistemic_type: MemoryEpistemicType;
  confidence: number | string;
  provenance_ref: string;
  valid_from: string | Date | null;
  valid_until: string | Date | null;
  observed_at: string | Date | null;
  recorded_at: string | Date;
  supersedes_id: string | null;
  contradicts: string[];
  source_revision: string | null;
  metadata: Record<string, unknown>;
  revision: number | string;
  content_hash: string;
}

export const POSTGRES_TEMPORAL_MEMORY_DDL = `
CREATE SCHEMA IF NOT EXISTS cos_memory;

CREATE TABLE IF NOT EXISTS cos_memory.temporal_envelopes (
  memory_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  project_id TEXT,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('public','internal','private','restricted')),
  epistemic_type TEXT NOT NULL CHECK (epistemic_type IN ('observation','claim','fact','decision','procedure','hypothesis','preference','episode')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  provenance_ref TEXT NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  observed_at TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL,
  supersedes_id TEXT,
  contradicts TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  source_revision TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  content_hash TEXT NOT NULL,
  CONSTRAINT cos_memory_temporal_window CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS cos_memory_temporal_project_idx
  ON cos_memory.temporal_envelopes(project_id, epistemic_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS cos_memory_temporal_valid_idx
  ON cos_memory.temporal_envelopes(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS cos_memory_temporal_contradicts_gin_idx
  ON cos_memory.temporal_envelopes USING GIN(contradicts);
`;

export class PostgresTemporalMemoryIndex implements ITemporalMemoryIndex {
  constructor(private readonly db: PostgresExecutor) {}

  async ensureSchema(): Promise<void> {
    await this.db.query(POSTGRES_TEMPORAL_MEMORY_DDL);
  }

  async add(input: TemporalMemoryEnvelopeInput): Promise<VersionedTemporalMemoryEnvelope> {
    const envelope = normalizeEnvelope(input);
    const record = versioned(envelope, 1);
    const result = await this.db.query<TemporalEnvelopeRow>(`
      INSERT INTO cos_memory.temporal_envelopes (
        memory_id, schema_version, project_id, sensitivity, epistemic_type,
        confidence, provenance_ref, valid_from, valid_until, observed_at,
        recorded_at, supersedes_id, contradicts, source_revision, metadata,
        revision, content_hash
      ) VALUES (
        $1,1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,
        $10::timestamptz,$11,$12::text[],$13,$14::jsonb,1,$15
      )
      RETURNING *
    `, envelopeParams(envelope, record.contentHash));
    return rowToRecord(result.rows[0]);
  }

  async get(memoryId: EntityId): Promise<VersionedTemporalMemoryEnvelope | null> {
    const result = await this.db.query<TemporalEnvelopeRow>(
      'SELECT * FROM cos_memory.temporal_envelopes WHERE memory_id=$1',
      [String(memoryId)],
    );
    return result.rowCount ? rowToRecord(result.rows[0]) : null;
  }

  async update(
    memoryId: EntityId,
    expectedRevision: number,
    updates: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>>,
  ): Promise<VersionedTemporalMemoryEnvelope> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      throw new Error('expectedRevision must be a positive safe integer');
    }
    return this.db.transaction(async transaction => {
      const currentResult = await transaction.query<TemporalEnvelopeRow>(
        'SELECT * FROM cos_memory.temporal_envelopes WHERE memory_id=$1 FOR UPDATE',
        [String(memoryId)],
      );
      if (!currentResult.rowCount) throw new Error(`TEMPORAL_MEMORY_NOT_FOUND id=${String(memoryId)}`);
      const current = rowToRecord(currentResult.rows[0]);
      assertExpectedRevision(expectedRevision, current.revision);
      const envelope = normalizeEnvelope({
        ...current.envelope,
        ...updates,
        memoryId,
        recordedAt: current.envelope.recordedAt,
      });
      const nextRevision = current.revision + 1;
      const contentHash = stableHash128(envelope);
      const params = envelopeParams(envelope, contentHash);
      const result = await transaction.query<TemporalEnvelopeRow>(`
        UPDATE cos_memory.temporal_envelopes SET
          project_id=$2, sensitivity=$3, epistemic_type=$4, confidence=$5,
          provenance_ref=$6, valid_from=$7::timestamptz,
          valid_until=$8::timestamptz, observed_at=$9::timestamptz,
          recorded_at=$10::timestamptz, supersedes_id=$11,
          contradicts=$12::text[], source_revision=$13, metadata=$14::jsonb,
          revision=$16, content_hash=$15
        WHERE memory_id=$1 AND revision=$17
        RETURNING *
      `, [...params, nextRevision, expectedRevision]);
      if (result.rowCount !== 1) {
        throw new Error(`STALE_TEMPORAL_MEMORY_REVISION expected=${expectedRevision}`);
      }
      return rowToRecord(result.rows[0]);
    });
  }

  async remove(memoryId: EntityId, expectedRevision?: number): Promise<void> {
    const params: unknown[] = [String(memoryId)];
    const revisionClause = expectedRevision === undefined ? '' : ' AND revision=$2';
    if (expectedRevision !== undefined) params.push(expectedRevision);
    const result = await this.db.query<{ memory_id: string }>(`
      DELETE FROM cos_memory.temporal_envelopes
      WHERE memory_id=$1${revisionClause}
      RETURNING memory_id
    `, params);
    if (expectedRevision !== undefined && result.rowCount !== 1) {
      throw new Error(`STALE_TEMPORAL_MEMORY_REVISION expected=${expectedRevision}`);
    }
  }

  async query(query: TemporalMemoryQuery = {}): Promise<VersionedTemporalMemoryEnvelope[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => { params.push(value); return `$${params.length}`; };
    if (query.projectId) where.push(`project_id=${param(query.projectId)}`);
    const maxSensitivity = SENSITIVITY_ORDER[query.maxSensitivity || 'internal'];
    where.push(`CASE sensitivity WHEN 'public' THEN 0 WHEN 'internal' THEN 1 WHEN 'private' THEN 2 ELSE 3 END <= ${param(maxSensitivity)}`);
    if (query.epistemicTypes?.length) where.push(`epistemic_type = ANY(${param(query.epistemicTypes)}::text[])`);
    if (query.validAt) {
      const validAt = requireTime(query.validAt, 'validAt');
      where.push(`(valid_from IS NULL OR valid_from <= ${param(validAt)}::timestamptz)`);
      where.push(`(valid_until IS NULL OR valid_until > ${param(validAt)}::timestamptz)`);
    }
    if (query.knownAt) where.push(`recorded_at <= ${param(requireTime(query.knownAt, 'knownAt'))}::timestamptz`);
    if (query.currentOnly) where.push('valid_until IS NULL');
    const limit = query.limit ?? 1000;
    if (!Number.isInteger(limit) || limit < 0 || limit > 100_000) throw new Error('Temporal memory limit must be in [0,100000]');
    params.push(limit);
    const result = await this.db.query<TemporalEnvelopeRow>(`
      SELECT * FROM cos_memory.temporal_envelopes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY recorded_at ASC, memory_id ASC
      LIMIT $${params.length}
    `, params);
    return result.rows.map(rowToRecord);
  }

  async projectionHash(query: TemporalMemoryQuery = {}): Promise<string> {
    return stableHash128(await this.query(query));
  }
}

function normalizeEnvelope(input: TemporalMemoryEnvelopeInput): TemporalMemoryEnvelope {
  if (!String(input.memoryId).trim()) throw new Error('Temporal memory memoryId must not be empty');
  const provenanceRef = input.provenanceRef.trim();
  if (!provenanceRef) throw new Error('Temporal memory provenanceRef must not be empty');
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Temporal memory confidence must be in [0,1]');
  }
  validateTimes(input.validFrom, input.validUntil, input.observedAt, input.recordedAt);
  const contradicts = Array.from(new Set((input.contradicts || []).map(String)))
    .filter(id => id !== String(input.memoryId))
    .sort()
    .map(id => id as EntityId);
  return {
    schemaVersion: 1,
    memoryId: input.memoryId,
    projectId: input.projectId?.trim() || undefined,
    sensitivity: input.sensitivity || 'internal',
    epistemicType: input.epistemicType,
    confidence: input.confidence,
    provenanceRef,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    observedAt: input.observedAt,
    recordedAt: input.recordedAt || new Date().toISOString(),
    supersedes: input.supersedes,
    contradicts,
    sourceRevision: input.sourceRevision?.trim() || undefined,
    metadata: structuredClone(input.metadata || {}),
  };
}

function versioned(envelope: TemporalMemoryEnvelope, revision: number): VersionedTemporalMemoryEnvelope {
  return {
    envelope,
    revision,
    contentHash: stableHash128(envelope),
  };
}

function cloneRecord(record: VersionedTemporalMemoryEnvelope): VersionedTemporalMemoryEnvelope {
  return {
    envelope: {
      ...record.envelope,
      contradicts: [...record.envelope.contradicts],
      metadata: structuredClone(record.envelope.metadata),
    },
    revision: record.revision,
    contentHash: record.contentHash,
  };
}

function assertExpectedRevision(expected: number, current: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1) throw new Error('expectedRevision must be a positive safe integer');
  if (expected !== current) {
    throw new Error(`STALE_TEMPORAL_MEMORY_REVISION expected=${expected} current=${current}`);
  }
}

function validateTimes(
  validFrom?: string,
  validUntil?: string | null,
  observedAt?: string,
  recordedAt?: string,
): void {
  for (const [name, value] of [
    ['validFrom', validFrom],
    ['validUntil', validUntil],
    ['observedAt', observedAt],
    ['recordedAt', recordedAt],
  ] as const) {
    if (value !== undefined && value !== null) requireTime(value, name);
  }
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be after validFrom');
  }
}

function parseOptionalTime(value: string | undefined, name: string): number | null {
  return value === undefined ? null : Date.parse(requireTime(value, name));
}

function requireTime(value: string, name: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
  return value;
}

function validAtTime(envelope: TemporalMemoryEnvelope, at: number): boolean {
  if (envelope.validFrom && Date.parse(envelope.validFrom) > at) return false;
  if (envelope.validUntil && Date.parse(envelope.validUntil) <= at) return false;
  return true;
}

function envelopeParams(envelope: TemporalMemoryEnvelope, contentHash: string): unknown[] {
  return [
    String(envelope.memoryId),
    envelope.projectId || null,
    envelope.sensitivity,
    envelope.epistemicType,
    envelope.confidence,
    envelope.provenanceRef,
    envelope.validFrom || null,
    envelope.validUntil || null,
    envelope.observedAt || null,
    envelope.recordedAt,
    envelope.supersedes ? String(envelope.supersedes) : null,
    envelope.contradicts.map(String),
    envelope.sourceRevision || null,
    JSON.stringify(envelope.metadata),
    contentHash,
  ];
}

function rowToRecord(row: TemporalEnvelopeRow): VersionedTemporalMemoryEnvelope {
  const toIso = (value: string | Date | null): string | undefined => {
    if (value === null) return undefined;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  };
  const envelope: TemporalMemoryEnvelope = {
    schemaVersion: 1,
    memoryId: row.memory_id as EntityId,
    projectId: row.project_id || undefined,
    sensitivity: row.sensitivity,
    epistemicType: row.epistemic_type,
    confidence: Number(row.confidence),
    provenanceRef: row.provenance_ref,
    validFrom: toIso(row.valid_from),
    validUntil: toIso(row.valid_until),
    observedAt: toIso(row.observed_at),
    recordedAt: toIso(row.recorded_at)!,
    supersedes: row.supersedes_id ? row.supersedes_id as EntityId : undefined,
    contradicts: (row.contradicts || []).map(id => id as EntityId),
    sourceRevision: row.source_revision || undefined,
    metadata: structuredClone(row.metadata || {}),
  };
  const record = versioned(envelope, Number(row.revision));
  if (record.contentHash !== row.content_hash) {
    throw new Error(`TEMPORAL_MEMORY_HASH_MISMATCH id=${row.memory_id}`);
  }
  return record;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}