import { stableHash128, stableSerialize } from '@cos/core';
import type {
  Chunk,
  GraphRAGConfig,
  GraphRAGEntity,
  GraphRAGRelation,
  RankedChunk,
  RetrievalScope,
  RetrievalSensitivity,
} from './level11-graphrag';

export interface AuthorityGraphRAGRelation extends GraphRAGRelation {
  confidence: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt: string;
}

export interface AuthorityGraphRAGSnapshot {
  schemaVersion: 1;
  projectionVersion: number;
  chunks: Chunk[];
  entities: GraphRAGEntity[];
  relations: AuthorityGraphRAGRelation[];
  projectionHash: string;
}

export interface AuthorityRelationInput {
  source: string;
  target: string;
  type?: string;
  projectId?: string;
  sensitivity?: RetrievalSensitivity;
  provenanceRef: string;
  confidence?: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
}

export interface AuthorityRetrievalResult {
  chunks: Chunk[];
  rankedChunks: RankedChunk[];
  entities: string[];
  relations: AuthorityGraphRAGRelation[];
}

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

/**
 * Deterministic GraphRAG projection for authority-grade context compilation.
 *
 * The legacy L11 engine remains available for compatibility. This engine makes
 * relation identity, mutation semantics, scope filtering and projection hashes
 * explicit so replaying the same source graph produces the same retrieval graph.
 */
export class AuthorityGraphRAGEngine {
  readonly config: GraphRAGConfig;

  private readonly chunks = new Map<string, Chunk>();
  private readonly entities = new Map<string, GraphRAGEntity>();
  private readonly relations = new Map<string, AuthorityGraphRAGRelation>();
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();
  private projectionVersion = 0;

  constructor(config: Partial<GraphRAGConfig> = {}) {
    const similarityWeight = config.similarityWeight ?? 0.55;
    const entityWeight = config.entityWeight ?? 0.20;
    const authorityWeight = config.authorityWeight ?? 0.15;
    const provenanceWeight = config.provenanceWeight ?? 0.10;
    const total = similarityWeight + entityWeight + authorityWeight + provenanceWeight;
    if (Math.abs(total - 1) > 1e-9) {
      throw new Error(`GraphRAG ranking weights must sum to 1; received ${total}`);
    }

    this.config = {
      topK: config.topK ?? 5,
      walkDepth: config.walkDepth ?? 2,
      similarityWeight,
      entityWeight,
      authorityWeight,
      provenanceWeight,
    };
    if (!Number.isInteger(this.config.topK) || this.config.topK <= 0 || this.config.topK > 1000) {
      throw new Error('topK must be an integer in [1,1000]');
    }
    if (!Number.isInteger(this.config.walkDepth) || this.config.walkDepth < 0 || this.config.walkDepth > 8) {
      throw new Error('walkDepth must be an integer in [0,8]');
    }
  }

  getProjectionVersion(): number {
    return this.projectionVersion;
  }

  addEntity(entity: GraphRAGEntity): GraphRAGEntity {
    const normalized = this.normalizeEntity(entity);
    const existing = this.entities.get(normalized.id);
    if (existing) {
      if (stableSerialize(existing) !== stableSerialize(normalized)) {
        throw new Error(`ENTITY_ID_CONFLICT id=${normalized.id}`);
      }
      return cloneEntity(existing);
    }
    this.entities.set(normalized.id, normalized);
    this.outgoing.set(normalized.id, new Set());
    this.incoming.set(normalized.id, new Set());
    this.bumpProjection();
    return cloneEntity(normalized);
  }

  upsertChunk(chunk: Chunk): Chunk {
    const normalized = this.normalizeChunk(chunk);
    const existing = this.chunks.get(normalized.id);
    if (existing && stableSerialize(existing) === stableSerialize(normalized)) {
      return cloneChunk(existing);
    }
    this.chunks.set(normalized.id, normalized);
    this.bumpProjection();
    return cloneChunk(normalized);
  }

  removeChunk(chunkId: string): boolean {
    const removed = this.chunks.delete(chunkId);
    if (removed) this.bumpProjection();
    return removed;
  }

  addRelation(input: AuthorityRelationInput): AuthorityGraphRAGRelation {
    if (!this.entities.has(input.source)) throw new Error(`Relation source ${input.source} not found`);
    if (!this.entities.has(input.target)) throw new Error(`Relation target ${input.target} not found`);
    const provenanceRef = input.provenanceRef.trim();
    if (!provenanceRef) throw new Error('Authority relation requires provenanceRef');
    const type = (input.type || 'related_to').trim();
    if (!type) throw new Error('Relation type must not be empty');
    const confidence = input.confidence ?? 1;
    assertUnitInterval(confidence, 'relation confidence');
    validateTemporal(input.validFrom, input.validUntil, input.recordedAt);

    const relation: AuthorityGraphRAGRelation = {
      id: `grrel_${stableHash128({
        source: input.source,
        target: input.target,
        type,
        projectId: input.projectId || null,
        sensitivity: input.sensitivity || 'internal',
        provenanceRef,
        validFrom: input.validFrom || null,
      })}`,
      source: input.source,
      target: input.target,
      type,
      projectId: input.projectId,
      sensitivity: input.sensitivity || maxSensitivity(
        this.entities.get(input.source)?.sensitivity || 'internal',
        this.entities.get(input.target)?.sensitivity || 'internal',
      ),
      provenanceRef,
      confidence,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      recordedAt: input.recordedAt || new Date().toISOString(),
    };

    const existing = this.relations.get(relation.id);
    if (existing) {
      if (stableSerialize(existing) !== stableSerialize(relation)) {
        throw new Error(`RELATION_ID_CONFLICT id=${relation.id}`);
      }
      return cloneRelation(existing);
    }

    this.relations.set(relation.id, relation);
    indexAdd(this.outgoing, relation.source, relation.id);
    indexAdd(this.incoming, relation.target, relation.id);
    this.bumpProjection();
    return cloneRelation(relation);
  }

  removeRelation(relationId: string): boolean {
    const relation = this.relations.get(relationId);
    if (!relation) return false;
    this.relations.delete(relationId);
    indexDelete(this.outgoing, relation.source, relationId);
    indexDelete(this.incoming, relation.target, relationId);
    this.bumpProjection();
    return true;
  }

  removeEntity(entityId: string): boolean {
    if (!this.entities.has(entityId)) return false;
    const relationIds = new Set([
      ...(this.outgoing.get(entityId) || []),
      ...(this.incoming.get(entityId) || []),
    ]);
    for (const relationId of relationIds) this.removeRelation(relationId);
    this.entities.delete(entityId);
    this.outgoing.delete(entityId);
    this.incoming.delete(entityId);
    for (const chunk of Array.from(this.chunks.values())) {
      if (!chunk.entities.includes(entityId)) continue;
      this.chunks.set(chunk.id, {
        ...chunk,
        entities: chunk.entities.filter(id => id !== entityId),
      });
    }
    this.bumpProjection();
    return true;
  }

  getEntity(entityId: string): GraphRAGEntity | null {
    const entity = this.entities.get(entityId);
    return entity ? cloneEntity(entity) : null;
  }

  getRelation(relationId: string): AuthorityGraphRAGRelation | null {
    const relation = this.relations.get(relationId);
    return relation ? cloneRelation(relation) : null;
  }

  retrieveScoped(
    queryEmbedding: number[],
    queryEntities: string[] = [],
    scope: RetrievalScope = {},
  ): AuthorityRetrievalResult {
    assertEmbedding(queryEmbedding, 'query embedding');
    const permission = scope.permission ?? 'internal';
    const allowGlobal = scope.allowGlobal ?? true;
    const asOf = parseAsOf(scope.asOf);

    const readableChunks = Array.from(this.chunks.values()).filter(chunk =>
      scopeMatches(chunk.projectId, scope.projectId, allowGlobal)
      && canRead(chunk.sensitivity, permission)
      && temporallyValid(chunk, asOf),
    );

    const candidateCount = Math.max(this.config.topK * 3, this.config.topK);
    const vectorScored = readableChunks
      .map(chunk => ({ chunk, similarity: cosineSimilarity(chunk.embedding, queryEmbedding) }))
      .sort((a, b) => b.similarity - a.similarity || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, candidateCount);

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = Array.from(new Set([
      ...queryEntities,
      ...vectorScored.flatMap(candidate => candidate.chunk.entities),
    ])).map(id => ({ id, depth: 0 }));
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      if (visited.has(current.id) || current.depth > this.config.walkDepth) continue;
      const entity = this.entities.get(current.id);
      if (!entity) continue;
      if (!scopeMatches(entity.projectId, scope.projectId, allowGlobal)) continue;
      if (!canRead(entity.sensitivity, permission)) continue;
      visited.add(current.id);
      if (current.depth >= this.config.walkDepth) continue;

      const relationIds = new Set([
        ...(this.outgoing.get(current.id) || []),
        ...(this.incoming.get(current.id) || []),
      ]);
      for (const relationId of relationIds) {
        const relation = this.relations.get(relationId);
        if (!relation) continue;
        if (!scopeMatches(relation.projectId, scope.projectId, allowGlobal)) continue;
        if (!canRead(relation.sensitivity, permission)) continue;
        if (!temporallyValid(relation, asOf)) continue;
        const next = relation.source === current.id ? relation.target : relation.source;
        if (!visited.has(next)) queue.push({ id: next, depth: current.depth + 1 });
      }
    }

    const rankedChunks: RankedChunk[] = vectorScored
      .map(candidate => {
        const entityOverlap = candidate.chunk.entities.filter(id => visited.has(id)).length
          / Math.max(1, candidate.chunk.entities.length);
        const authority = candidate.chunk.authority ?? 0.5;
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
      .filter(candidate => candidate.score >= (scope.minScore ?? 0))
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, this.config.topK);

    const relations = Array.from(this.relations.values())
      .filter(relation =>
        visited.has(relation.source)
        && visited.has(relation.target)
        && scopeMatches(relation.projectId, scope.projectId, allowGlobal)
        && canRead(relation.sensitivity, permission)
        && temporallyValid(relation, asOf),
      )
      .map(cloneRelation)
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      chunks: rankedChunks.map(candidate => cloneChunk(candidate.chunk)),
      rankedChunks,
      entities: Array.from(visited)
        .map(id => this.entities.get(id))
        .filter((entity): entity is GraphRAGEntity => Boolean(entity))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(entity => entity.name),
      relations,
    };
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const relation of this.relations.values()) {
      if (!this.entities.has(relation.source)) errors.push(`Dangling relation source: ${relation.id}`);
      if (!this.entities.has(relation.target)) errors.push(`Dangling relation target: ${relation.id}`);
      const expected = `grrel_${stableHash128({
        source: relation.source,
        target: relation.target,
        type: relation.type,
        projectId: relation.projectId || null,
        sensitivity: relation.sensitivity || 'internal',
        provenanceRef: relation.provenanceRef || '',
        validFrom: relation.validFrom || null,
      })}`;
      if (expected !== relation.id) errors.push(`Non-deterministic relation ID: ${relation.id}`);
    }
    for (const chunk of this.chunks.values()) {
      if (!chunk.provenanceRef) errors.push(`Chunk without provenance: ${chunk.id}`);
      for (const entityId of chunk.entities) {
        if (!this.entities.has(entityId)) errors.push(`Chunk ${chunk.id} references missing entity ${entityId}`);
      }
    }
    return errors.sort();
  }

  projectionHash(): string {
    return stableHash128({
      chunks: this.listChunks(),
      entities: this.listEntities(),
      relations: this.listRelations(),
    });
  }

  snapshot(): AuthorityGraphRAGSnapshot {
    return {
      schemaVersion: 1,
      projectionVersion: this.projectionVersion,
      chunks: this.listChunks(),
      entities: this.listEntities(),
      relations: this.listRelations(),
      projectionHash: this.projectionHash(),
    };
  }

  listChunks(): Chunk[] {
    return Array.from(this.chunks.values(), cloneChunk).sort((a, b) => a.id.localeCompare(b.id));
  }

  listEntities(): GraphRAGEntity[] {
    return Array.from(this.entities.values(), cloneEntity).sort((a, b) => a.id.localeCompare(b.id));
  }

  listRelations(): AuthorityGraphRAGRelation[] {
    return Array.from(this.relations.values(), cloneRelation).sort((a, b) => a.id.localeCompare(b.id));
  }

  clear(): void {
    if (this.chunks.size === 0 && this.entities.size === 0 && this.relations.size === 0) return;
    this.chunks.clear();
    this.entities.clear();
    this.relations.clear();
    this.outgoing.clear();
    this.incoming.clear();
    this.bumpProjection();
  }

  private normalizeEntity(entity: GraphRAGEntity): GraphRAGEntity {
    const id = entity.id.trim();
    const name = entity.name.trim();
    const type = entity.type.trim();
    if (!id || !name || !type) throw new Error('Entity id/name/type must not be empty');
    return {
      ...entity,
      id,
      name,
      type,
      sensitivity: entity.sensitivity || 'internal',
    };
  }

  private normalizeChunk(chunk: Chunk): Chunk {
    const id = chunk.id.trim();
    const source = chunk.source.trim();
    const text = chunk.text.trim();
    const provenanceRef = chunk.provenanceRef?.trim();
    if (!id || !source || !text) throw new Error('Chunk id/source/text must not be empty');
    if (!provenanceRef) throw new Error(`AUTHORITY_CHUNK_REQUIRES_PROVENANCE chunk=${id}`);
    assertEmbedding(chunk.embedding, `chunk ${id} embedding`);
    if (chunk.authority !== undefined) assertUnitInterval(chunk.authority, `chunk ${id} authority`);
    validateTemporal(chunk.validFrom, chunk.validUntil, chunk.recordedAt);
    return {
      ...chunk,
      id,
      source,
      text,
      provenanceRef,
      sensitivity: chunk.sensitivity || 'internal',
      entities: Array.from(new Set(chunk.entities)).sort(),
      embedding: [...chunk.embedding],
    };
  }

  private bumpProjection(): void {
    this.projectionVersion += 1;
  }
}

function cloneChunk(chunk: Chunk): Chunk {
  return { ...chunk, embedding: [...chunk.embedding], entities: [...chunk.entities] };
}

function cloneEntity(entity: GraphRAGEntity): GraphRAGEntity {
  return { ...entity };
}

function cloneRelation(relation: AuthorityGraphRAGRelation): AuthorityGraphRAGRelation {
  return { ...relation };
}

function indexAdd(index: Map<string, Set<string>>, key: string, value: string): void {
  let bucket = index.get(key);
  if (!bucket) {
    bucket = new Set();
    index.set(key, bucket);
  }
  bucket.add(value);
}

function indexDelete(index: Map<string, Set<string>>, key: string, value: string): void {
  const bucket = index.get(key);
  if (!bucket) return;
  bucket.delete(value);
  if (bucket.size === 0) index.delete(key);
}

function assertEmbedding(embedding: number[], name: string): void {
  if (!Array.isArray(embedding) || embedding.length === 0) throw new Error(`${name} must not be empty`);
  if (embedding.length > 65536) throw new Error(`${name} exceeds 65536 dimensions`);
  if (embedding.some(value => !Number.isFinite(value))) throw new Error(`${name} contains non-finite values`);
}

function assertUnitInterval(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be in [0,1]`);
}

function validateTemporal(validFrom?: string, validUntil?: string | null, recordedAt?: string): void {
  for (const [name, value] of [['validFrom', validFrom], ['validUntil', validUntil], ['recordedAt', recordedAt]] as const) {
    if (value !== undefined && value !== null && !Number.isFinite(Date.parse(value))) {
      throw new Error(`Invalid ${name}: ${value}`);
    }
  }
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be after validFrom');
  }
}

function parseAsOf(value?: string): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid asOf timestamp: ${value}`);
  return parsed;
}

function temporallyValid(value: { validFrom?: string; validUntil?: string | null }, asOf: number): boolean {
  if (value.validFrom && Date.parse(value.validFrom) > asOf) return false;
  if (value.validUntil && Date.parse(value.validUntil) <= asOf) return false;
  return true;
}

function scopeMatches(candidateProject: string | undefined, requestedProject: string | undefined, allowGlobal: boolean): boolean {
  if (!requestedProject) return true;
  return candidateProject === requestedProject || (allowGlobal && !candidateProject);
}

function canRead(candidate: RetrievalSensitivity | undefined, permission: RetrievalSensitivity): boolean {
  return SENSITIVITY_ORDER[candidate || 'internal'] <= SENSITIVITY_ORDER[permission];
}

function maxSensitivity(a: RetrievalSensitivity, b: RetrievalSensitivity): RetrievalSensitivity {
  return SENSITIVITY_ORDER[a] >= SENSITIVITY_ORDER[b] ? a : b;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    const left = a[index] || 0;
    const right = b[index] || 0;
    dot += left * right;
    normA += left * left;
    normB += right * right;
  }
  return normA > 0 && normB > 0 ? dot / Math.sqrt(normA * normB) : 0;
}