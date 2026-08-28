import { stableHash128 } from '@cos/core';
import type {
  Chunk,
  GraphRAGEntity,
  GraphRAGRelation,
  RankedChunk,
  RetrievalScope,
  RetrievalSensitivity,
} from './level11-graphrag';

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export interface AuthorityGraphEntityInput extends GraphRAGEntity {
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphRelationInput extends Omit<GraphRAGRelation, 'id'> {
  id?: string;
  identityKey?: string;
  provenanceRef: string;
  confidence?: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphChunkInput extends Chunk {
  provenanceRef: string;
  authority: number;
  sensitivity: RetrievalSensitivity;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphEntity extends AuthorityGraphEntityInput {
  sensitivity: RetrievalSensitivity;
  metadata: Record<string, unknown>;
}

export interface AuthorityGraphRelation extends GraphRAGRelation {
  id: string;
  identityKey: string;
  sensitivity: RetrievalSensitivity;
  provenanceRef: string;
  confidence: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityGraphChunk extends Chunk {
  provenanceRef: string;
  authority: number;
  sensitivity: RetrievalSensitivity;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface AuthorityGraphProjectionInput {
  version: number;
  sourceCursor?: string;
  entities: AuthorityGraphEntityInput[];
  relations: AuthorityGraphRelationInput[];
  chunks: AuthorityGraphChunkInput[];
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphSnapshot {
  schemaVersion: 1;
  version: number;
  sourceCursor?: string;
  entities: AuthorityGraphEntity[];
  relations: AuthorityGraphRelation[];
  chunks: AuthorityGraphChunk[];
  metadata: Record<string, unknown>;
  projectionHash: string;
}

export interface AuthorityGraphReplaceOptions {
  expectedCurrentVersion?: number;
  expectedCurrentHash?: string;
}

export interface AuthorityRetrievalScope extends RetrievalScope {
  /** System-knowledge cutoff. Current projection must contain the desired history. */
  knownAt?: string;
}

export interface AuthorityScopedRetrieval {
  chunks: Chunk[];
  rankedChunks: RankedChunk[];
  entities: string[];
  relations: GraphRAGRelation[];
}

export interface AuthorityScopedRetriever {
  readonly projectionVersion: number;
  readonly projectionHash: string;
  retrieveScoped(
    queryEmbedding: number[],
    queryEntities?: string[],
    scope?: AuthorityRetrievalScope,
  ): AuthorityScopedRetrieval;
}

export interface AuthorityGraphRAGConfig {
  topK: number;
  walkDepth: number;
  candidateMultiplier: number;
  similarityWeight: number;
  entityWeight: number;
  authorityWeight: number;
  provenanceWeight: number;
}

/**
 * Single canonical GraphRAG authority projection.
 *
 * The legacy mutable L11 engine remains available only for shadow/demo use. This
 * index accepts complete versioned projections atomically, derives relation and
 * chunk scope before identity/hash construction, and never mutates canonical
 * state incrementally. A failed replacement leaves the previous projection
 * untouched.
 */
export class AuthorityGraphRAGIndex implements AuthorityScopedRetriever {
  private entityById = new Map<string, AuthorityGraphEntity>();
  private relationById = new Map<string, AuthorityGraphRelation>();
  private chunkById = new Map<string, AuthorityGraphChunk>();
  private outgoing = new Map<string, Set<string>>();
  private incoming = new Map<string, Set<string>>();
  private versionValue = 0;
  private hashValue = stableHash128({ schemaVersion: 1, version: 0, entities: [], relations: [], chunks: [], metadata: {} });
  private sourceCursor?: string;
  private projectionMetadata: Record<string, unknown> = {};
  readonly config: AuthorityGraphRAGConfig;

  constructor(config: Partial<AuthorityGraphRAGConfig> = {}) {
    const similarityWeight = config.similarityWeight ?? 0.50;
    const entityWeight = config.entityWeight ?? 0.20;
    const authorityWeight = config.authorityWeight ?? 0.20;
    const provenanceWeight = config.provenanceWeight ?? 0.10;
    const total = similarityWeight + entityWeight + authorityWeight + provenanceWeight;
    if (Math.abs(total - 1) > 1e-9) {
      throw new Error(`Authority GraphRAG ranking weights must sum to 1; received ${total}`);
    }
    this.config = {
      topK: config.topK ?? 8,
      walkDepth: config.walkDepth ?? 3,
      candidateMultiplier: config.candidateMultiplier ?? 4,
      similarityWeight,
      entityWeight,
      authorityWeight,
      provenanceWeight,
    };
    if (!Number.isSafeInteger(this.config.topK) || this.config.topK < 1 || this.config.topK > 10_000) {
      throw new Error('Authority GraphRAG topK must be a safe integer in [1,10000]');
    }
    if (!Number.isSafeInteger(this.config.walkDepth) || this.config.walkDepth < 0 || this.config.walkDepth > 8) {
      throw new Error('Authority GraphRAG walkDepth must be a safe integer in [0,8]');
    }
    if (!Number.isSafeInteger(this.config.candidateMultiplier)
      || this.config.candidateMultiplier < 1
      || this.config.candidateMultiplier > 100) {
      throw new Error('Authority GraphRAG candidateMultiplier must be a safe integer in [1,100]');
    }
  }

  get projectionVersion(): number { return this.versionValue; }
  get projectionHash(): string { return this.hashValue; }

  replaceProjection(
    input: AuthorityGraphProjectionInput,
    options: AuthorityGraphReplaceOptions = {},
  ): AuthorityGraphSnapshot {
    if (options.expectedCurrentVersion !== undefined) {
      if (!Number.isSafeInteger(options.expectedCurrentVersion) || options.expectedCurrentVersion < 0) {
        throw new Error('expectedCurrentVersion must be a non-negative safe integer');
      }
      if (options.expectedCurrentVersion !== this.versionValue) {
        throw new Error(`STALE_GRAPH_PROJECTION expected=${options.expectedCurrentVersion} current=${this.versionValue}`);
      }
    }
    if (options.expectedCurrentHash !== undefined && options.expectedCurrentHash !== this.hashValue) {
      throw new Error(`STALE_GRAPH_PROJECTION_HASH expected=${options.expectedCurrentHash} current=${this.hashValue}`);
    }
    if (!Number.isSafeInteger(input.version) || input.version < 1) {
      throw new Error('Authority projection version must be a positive safe integer');
    }
    if (input.version < this.versionValue) {
      throw new Error(`GRAPH_PROJECTION_VERSION_REGRESSION incoming=${input.version} current=${this.versionValue}`);
    }
    const metadata = canonicalMetadata(input.metadata || {});
    const sourceCursor = normalizeOptionalString(input.sourceCursor);

    const nextEntities = new Map<string, AuthorityGraphEntity>();
    const nextRelations = new Map<string, AuthorityGraphRelation>();
    const nextChunks = new Map<string, AuthorityGraphChunk>();
    const nextOutgoing = new Map<string, Set<string>>();
    const nextIncoming = new Map<string, Set<string>>();

    for (const entityInput of input.entities) {
      const entity = normalizeEntity(entityInput);
      if (nextEntities.has(entity.id)) throw new Error(`Duplicate authority entity ID: ${entity.id}`);
      nextEntities.set(entity.id, entity);
      nextOutgoing.set(entity.id, new Set());
      nextIncoming.set(entity.id, new Set());
    }

    for (const relationInput of input.relations) {
      const source = nextEntities.get(relationInput.source);
      const target = nextEntities.get(relationInput.target);
      if (!source) throw new Error(`Dangling authority relation source: ${relationInput.source}`);
      if (!target) throw new Error(`Dangling authority relation target: ${relationInput.target}`);
      const relation = normalizeRelation(relationInput, source, target);
      if (nextRelations.has(relation.id)) throw new Error(`Duplicate authority relation ID: ${relation.id}`);
      nextRelations.set(relation.id, relation);
      nextOutgoing.get(relation.source)!.add(relation.id);
      nextIncoming.get(relation.target)!.add(relation.id);
    }

    let embeddingDimensions: number | null = null;
    for (const chunkInput of input.chunks) {
      const entities = chunkInput.entities.map(id => {
        const entity = nextEntities.get(id);
        if (!entity) throw new Error(`Authority chunk ${chunkInput.id} references missing entity ${id}`);
        return entity;
      });
      const chunk = normalizeChunk(chunkInput, entities);
      if (nextChunks.has(chunk.id)) throw new Error(`Duplicate authority chunk ID: ${chunk.id}`);
      if (embeddingDimensions === null) embeddingDimensions = chunk.embedding.length;
      if (chunk.embedding.length !== embeddingDimensions) {
        throw new Error(`Authority chunk embedding dimensions differ: ${chunk.id}`);
      }
      nextChunks.set(chunk.id, chunk);
    }

    const canonical = canonicalSnapshotBase({
      schemaVersion: 1,
      version: input.version,
      sourceCursor,
      entities: Array.from(nextEntities.values()),
      relations: Array.from(nextRelations.values()),
      chunks: Array.from(nextChunks.values()),
      metadata,
    });
    const nextHash = stableHash128(canonical);

    if (input.version === this.versionValue) {
      if (nextHash !== this.hashValue) {
        throw new Error(`GRAPH_PROJECTION_VERSION_COLLISION version=${input.version}`);
      }
      return this.snapshot();
    }

    this.entityById = nextEntities;
    this.relationById = nextRelations;
    this.chunkById = nextChunks;
    this.outgoing = nextOutgoing;
    this.incoming = nextIncoming;
    this.versionValue = input.version;
    this.hashValue = nextHash;
    this.sourceCursor = sourceCursor;
    this.projectionMetadata = metadata;
    return this.snapshot();
  }

  snapshot(): AuthorityGraphSnapshot {
    return {
      ...canonicalSnapshotBase({
        schemaVersion: 1,
        version: this.versionValue,
        sourceCursor: this.sourceCursor,
        entities: Array.from(this.entityById.values()),
        relations: Array.from(this.relationById.values()),
        chunks: Array.from(this.chunkById.values()),
        metadata: this.projectionMetadata,
      }),
      projectionHash: this.hashValue,
    };
  }

  retrieveScoped(
    queryEmbedding: number[],
    queryEntities: string[] = [],
    scope: AuthorityRetrievalScope = {},
  ): AuthorityScopedRetrieval {
    validateEmbedding(queryEmbedding, 'query embedding');
    const permission = scope.permission ?? 'internal';
    const allowGlobal = scope.allowGlobal ?? true;
    const asOf = scope.asOf ? canonicalInstant(scope.asOf, 'retrieval asOf') : Date.now();
    const knownAt = scope.knownAt ? canonicalInstant(scope.knownAt, 'retrieval knownAt') : Date.now();
    const minScore = scope.minScore ?? 0;
    assertUnitInterval(minScore, 'minScore');

    const readableEntities = new Map(
      Array.from(this.entityById.values())
        .filter(entity => visible(entity, scope.projectId, permission, allowGlobal, asOf, knownAt))
        .map(entity => [entity.id, entity]),
    );
    const readableRelations = new Map(
      Array.from(this.relationById.values())
        .filter(relation =>
          readableEntities.has(relation.source)
          && readableEntities.has(relation.target)
          && visible(relation, scope.projectId, permission, allowGlobal, asOf, knownAt))
        .map(relation => [relation.id, relation]),
    );
    const readableChunks = Array.from(this.chunkById.values())
      .filter(chunk =>
        visible(chunk, scope.projectId, permission, allowGlobal, asOf, knownAt)
        && chunk.entities.every(id => readableEntities.has(id)));

    if (readableChunks.length > 0 && queryEmbedding.length !== readableChunks[0].embedding.length) {
      throw new Error(
        `QUERY_EMBEDDING_DIMENSION_MISMATCH query=${queryEmbedding.length} index=${readableChunks[0].embedding.length}`,
      );
    }

    const maxCandidates = Math.min(
      readableChunks.length,
      Math.max(this.config.topK, this.config.topK * this.config.candidateMultiplier),
    );
    const candidates = readableChunks
      .map(chunk => ({ chunk, similarity: cosineSimilarity(chunk.embedding, queryEmbedding) }))
      .sort((a, b) => b.similarity - a.similarity || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, maxCandidates);

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    for (const id of [...queryEntities, ...candidates.flatMap(candidate => candidate.chunk.entities)]) {
      if (readableEntities.has(id) && !visited.has(id)) queue.push({ id, depth: 0 });
    }
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (current.depth >= this.config.walkDepth) continue;
      const relationIds = new Set([
        ...(this.outgoing.get(current.id) || []),
        ...(this.incoming.get(current.id) || []),
      ]);
      for (const relationId of relationIds) {
        const relation = readableRelations.get(relationId);
        if (!relation) continue;
        const next = relation.source === current.id ? relation.target : relation.source;
        if (!visited.has(next)) queue.push({ id: next, depth: current.depth + 1 });
      }
    }

    const rankedChunks: RankedChunk[] = candidates
      .map(candidate => {
        const entityOverlap = candidate.chunk.entities.filter(id => visited.has(id)).length
          / Math.max(1, candidate.chunk.entities.length);
        const authority = candidate.chunk.authority;
        const provenance = candidate.chunk.provenanceRef ? 1 : 0;
        const score =
          this.config.similarityWeight * Math.max(0, candidate.similarity)
          + this.config.entityWeight * entityOverlap
          + this.config.authorityWeight * authority
          + this.config.provenanceWeight * provenance;
        return {
          chunk: cloneChunk(candidate.chunk),
          score,
          components: {
            similarity: candidate.similarity,
            entityOverlap,
            authority,
            provenance,
          },
        };
      })
      .filter(candidate => candidate.score >= minScore)
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, this.config.topK);

    const selectedEntityIds = new Set<string>();
    for (const candidate of rankedChunks) for (const id of candidate.chunk.entities) selectedEntityIds.add(id);
    for (const id of visited) selectedEntityIds.add(id);

    const relations = Array.from(readableRelations.values())
      .filter(relation => selectedEntityIds.has(relation.source) && selectedEntityIds.has(relation.target))
      .map(cloneRelation)
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      chunks: rankedChunks.map(candidate => cloneChunk(candidate.chunk)),
      rankedChunks,
      entities: Array.from(selectedEntityIds)
        .map(id => readableEntities.get(id))
        .filter((entity): entity is AuthorityGraphEntity => Boolean(entity))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(entity => entity.name),
      relations,
    };
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const relation of this.relationById.values()) {
      const source = this.entityById.get(relation.source);
      const target = this.entityById.get(relation.target);
      if (!source) errors.push(`Dangling relation source ${relation.id}: ${relation.source}`);
      if (!target) errors.push(`Dangling relation target ${relation.id}: ${relation.target}`);
      if (!this.outgoing.get(relation.source)?.has(relation.id)) errors.push(`Outgoing index mismatch: ${relation.id}`);
      if (!this.incoming.get(relation.target)?.has(relation.id)) errors.push(`Incoming index mismatch: ${relation.id}`);
      if (source && target) {
        const required = maxSensitivity(source.sensitivity, target.sensitivity);
        if (SENSITIVITY_ORDER[relation.sensitivity] < SENSITIVITY_ORDER[required]) {
          errors.push(`Relation sensitivity below endpoints: ${relation.id}`);
        }
      }
    }
    for (const chunk of this.chunkById.values()) {
      for (const entityId of chunk.entities) {
        if (!this.entityById.has(entityId)) errors.push(`Chunk ${chunk.id} references missing entity ${entityId}`);
      }
    }
    const snapshot = this.snapshot();
    const { projectionHash: _projectionHash, ...base } = snapshot;
    if (stableHash128(base) !== this.hashValue) errors.push('Projection hash mismatch');
    return errors.sort();
  }
}

function normalizeEntity(input: AuthorityGraphEntityInput): AuthorityGraphEntity {
  const entity: AuthorityGraphEntity = {
    id: nonEmpty(input.id, 'entity id'),
    name: nonEmpty(input.name, 'entity name'),
    type: nonEmpty(input.type, 'entity type'),
    projectId: normalizeOptionalString(input.projectId),
    sensitivity: input.sensitivity ?? 'internal',
    provenanceRef: nonEmpty(input.provenanceRef, 'entity provenanceRef'),
    validFrom: canonicalOptionalTime(input.validFrom, 'entity validFrom'),
    validUntil: canonicalNullableTime(input.validUntil, 'entity validUntil'),
    recordedAt: canonicalTime(input.recordedAt, 'entity recordedAt'),
    metadata: canonicalMetadata(input.metadata || {}),
  };
  validateTemporal(entity.validFrom, entity.validUntil);
  return entity;
}

function normalizeRelation(
  input: AuthorityGraphRelationInput,
  source: AuthorityGraphEntity,
  target: AuthorityGraphEntity,
): AuthorityGraphRelation {
  if (source.id === target.id) throw new Error('Authority GraphRAG relation cannot self-reference');
  const projectId = deriveProjectId(input.projectId, source.projectId, target.projectId, 'relation');
  const requiredSensitivity = maxSensitivity(source.sensitivity, target.sensitivity);
  const sensitivity = input.sensitivity ?? requiredSensitivity;
  if (SENSITIVITY_ORDER[sensitivity] < SENSITIVITY_ORDER[requiredSensitivity]) {
    throw new Error(`RELATION_SENSITIVITY_DOWNGRADE required=${requiredSensitivity} requested=${sensitivity}`);
  }
  const identityKey = nonEmpty(input.identityKey ?? 'default', 'relation identityKey');
  const provenanceRef = nonEmpty(input.provenanceRef, 'relation provenanceRef');
  const validFrom = canonicalOptionalTime(input.validFrom, 'relation validFrom');
  const validUntil = canonicalNullableTime(input.validUntil, 'relation validUntil');
  validateTemporal(validFrom, validUntil);
  const confidence = input.confidence ?? 1;
  assertUnitInterval(confidence, 'relation confidence');
  const recordedAt = canonicalTime(input.recordedAt, 'relation recordedAt');
  const id = input.id?.trim() || `agr_${stableHash128({
    type: input.type,
    source: source.id,
    target: target.id,
    identityKey,
    projectId: projectId || null,
    validFrom: validFrom || null,
    provenanceRef,
  })}`;
  return {
    id: nonEmpty(id, 'relation id'),
    source: source.id,
    target: target.id,
    type: nonEmpty(input.type, 'relation type'),
    identityKey,
    projectId,
    sensitivity,
    provenanceRef,
    confidence,
    validFrom,
    validUntil,
    recordedAt,
    metadata: canonicalMetadata(input.metadata || {}),
  };
}

function normalizeChunk(
  input: AuthorityGraphChunkInput,
  entities: AuthorityGraphEntity[],
): AuthorityGraphChunk {
  const projectId = entities.reduce<string | undefined>(
    (current, entity) => deriveProjectId(current, current, entity.projectId, `chunk ${input.id}`),
    normalizeOptionalString(input.projectId),
  );
  let requiredSensitivity: RetrievalSensitivity = 'public';
  for (const entity of entities) requiredSensitivity = maxSensitivity(requiredSensitivity, entity.sensitivity);
  if (SENSITIVITY_ORDER[input.sensitivity] < SENSITIVITY_ORDER[requiredSensitivity]) {
    throw new Error(`CHUNK_SENSITIVITY_DOWNGRADE chunk=${input.id} required=${requiredSensitivity} requested=${input.sensitivity}`);
  }
  assertUnitInterval(input.authority, `chunk ${input.id} authority`);
  validateEmbedding(input.embedding, `chunk ${input.id} embedding`);
  const chunk: AuthorityGraphChunk = {
    id: nonEmpty(input.id, 'chunk id'),
    text: nonEmpty(input.text, `chunk ${input.id} text`),
    source: nonEmpty(input.source, `chunk ${input.id} source`),
    embedding: [...input.embedding],
    entities: [...input.entities],
    projectId,
    sensitivity: input.sensitivity,
    provenanceRef: nonEmpty(input.provenanceRef, `chunk ${input.id} provenanceRef`),
    authority: input.authority,
    validFrom: canonicalOptionalTime(input.validFrom, `chunk ${input.id} validFrom`),
    validUntil: canonicalNullableTime(input.validUntil, `chunk ${input.id} validUntil`),
    recordedAt: canonicalTime(input.recordedAt, `chunk ${input.id} recordedAt`),
    metadata: canonicalMetadata(input.metadata || {}),
  };
  validateTemporal(chunk.validFrom, chunk.validUntil);
  return chunk;
}

function canonicalSnapshotBase(input: Omit<AuthorityGraphSnapshot, 'projectionHash'>): Omit<AuthorityGraphSnapshot, 'projectionHash'> {
  return {
    schemaVersion: 1,
    version: input.version,
    sourceCursor: input.sourceCursor,
    entities: input.entities.map(cloneEntity).sort((a, b) => a.id.localeCompare(b.id)),
    relations: input.relations.map(cloneRelation).sort((a, b) => a.id.localeCompare(b.id)),
    chunks: input.chunks.map(cloneChunk).sort((a, b) => a.id.localeCompare(b.id)),
    metadata: canonicalMetadata(input.metadata),
  };
}

function visible(
  value: {
    projectId?: string;
    sensitivity?: RetrievalSensitivity;
    validFrom?: string;
    validUntil?: string | null;
    recordedAt: string;
  },
  projectId: string | undefined,
  permission: RetrievalSensitivity,
  allowGlobal: boolean,
  asOf: number,
  knownAt: number,
): boolean {
  if (projectId && value.projectId !== projectId && !(allowGlobal && value.projectId === undefined)) return false;
  if (SENSITIVITY_ORDER[value.sensitivity ?? 'internal'] > SENSITIVITY_ORDER[permission]) return false;
  if (value.validFrom && Date.parse(value.validFrom) > asOf) return false;
  if (value.validUntil && Date.parse(value.validUntil) <= asOf) return false;
  if (Date.parse(value.recordedAt) > knownAt) return false;
  return true;
}

function deriveProjectId(
  explicit: string | undefined,
  source: string | undefined,
  target: string | undefined,
  label: string,
): string | undefined {
  const normalized = normalizeOptionalString(explicit);
  if (source && target && source !== target) {
    throw new Error(`CROSS_PROJECT_${label.toUpperCase().replace(/[^A-Z0-9]+/g, '_')} source=${source} target=${target}`);
  }
  const derived = source || target;
  if (normalized && derived && normalized !== derived) {
    throw new Error(`${label} project scope conflicts with endpoints`);
  }
  return normalized || derived;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function validateEmbedding(embedding: number[], label: string): void {
  if (!Array.isArray(embedding) || embedding.length === 0 || embedding.some(value => !Number.isFinite(value))) {
    throw new Error(`${label} must contain finite values`);
  }
}
function validateTemporal(validFrom?: string, validUntil?: string | null): void {
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be strictly after validFrom');
  }
}
function canonicalMetadata(value: Record<string, unknown>): Record<string, unknown> {
  assertCanonicalJson(value, 'metadata');
  return structuredClone(value);
}
function cloneEntity(entity: AuthorityGraphEntity): AuthorityGraphEntity {
  return { ...entity, metadata: structuredClone(entity.metadata) };
}
function cloneRelation(relation: AuthorityGraphRelation): AuthorityGraphRelation {
  return { ...relation, metadata: structuredClone(relation.metadata) };
}
function cloneChunk(chunk: AuthorityGraphChunk): AuthorityGraphChunk {
  return {
    ...chunk,
    entities: [...chunk.entities],
    embedding: [...chunk.embedding],
    metadata: structuredClone(chunk.metadata),
  };
}
function maxSensitivity(left: RetrievalSensitivity, right: RetrievalSensitivity): RetrievalSensitivity {
  return SENSITIVITY_ORDER[left] >= SENSITIVITY_ORDER[right] ? left : right;
}
function assertUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0,1]`);
}
function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}
function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
function canonicalInstant(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}
function canonicalTime(value: string, label: string): string {
  return new Date(canonicalInstant(value, label)).toISOString();
}
function canonicalOptionalTime(value: string | undefined, label: string): string | undefined {
  return value === undefined ? undefined : canonicalTime(value, label);
}
function canonicalNullableTime(value: string | null | undefined, label: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  return canonicalTime(value, label);
}

function assertCanonicalJson(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported ${typeof value}`);
  if (seen.has(value as object)) throw new Error(`${path} contains a cycle`);
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalJson(item, `${path}[${index}]`, seen));
    seen.delete(value as object);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${path} contains a non-plain object`);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assertCanonicalJson(item, `${path}.${key}`, seen);
  }
  seen.delete(value as object);
}
