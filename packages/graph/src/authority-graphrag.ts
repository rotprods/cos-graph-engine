import { stableHash128 } from '@cos/core';
import type {
  Chunk,
  GraphRAGEntity,
  GraphRAGRelation,
  RankedChunk,
  RetrievalScope,
  RetrievalSensitivity,
} from './level11-graphrag';

export interface AuthorityGraphEntity extends GraphRAGEntity {
  provenanceRef: string;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphRelation extends GraphRAGRelation {
  id: string;
  provenanceRef: string;
  confidence?: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphChunk extends Chunk {
  provenanceRef: string;
  authority: number;
  sensitivity: RetrievalSensitivity;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphProjection {
  version: number;
  entities: AuthorityGraphEntity[];
  relations: AuthorityGraphRelation[];
  chunks: AuthorityGraphChunk[];
  sourceCursor?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityGraphSnapshot extends AuthorityGraphProjection {
  projectionHash: string;
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

export interface ScopedGraphRetrieval {
  chunks: Chunk[];
  rankedChunks: RankedChunk[];
  entities: string[];
  relations: GraphRAGRelation[];
}

export interface ScopedGraphRetriever {
  retrieveScoped(
    queryEmbedding: number[],
    queryEntities?: string[],
    scope?: RetrievalScope,
  ): ScopedGraphRetrieval;
}

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

/**
 * Deterministic authority-grade GraphRAG projection.
 *
 * The legacy L11 engine remains available for compatibility. This class is the
 * authority path: projection replacement is atomic, IDs are supplied or derived
 * deterministically, relations never dangle, provenance is mandatory and all
 * scope/temporal filtering occurs before ranking/context construction.
 */
export class AuthorityGraphRAGIndex implements ScopedGraphRetriever {
  private entityById = new Map<string, AuthorityGraphEntity>();
  private relationById = new Map<string, AuthorityGraphRelation>();
  private chunkById = new Map<string, AuthorityGraphChunk>();
  private outgoing = new Map<string, Set<string>>();
  private incoming = new Map<string, Set<string>>();
  private version = 0;
  private hash = stableHash128({ version: 0, entities: [], relations: [], chunks: [] });
  private sourceCursor?: string;
  private metadata: Record<string, unknown> = {};
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
    if (!Number.isInteger(this.config.topK) || this.config.topK < 1 || this.config.topK > 10_000) {
      throw new Error('Authority GraphRAG topK must be an integer in [1,10000]');
    }
    if (!Number.isInteger(this.config.walkDepth) || this.config.walkDepth < 0 || this.config.walkDepth > 8) {
      throw new Error('Authority GraphRAG walkDepth must be an integer in [0,8]');
    }
    if (!Number.isInteger(this.config.candidateMultiplier) || this.config.candidateMultiplier < 1 || this.config.candidateMultiplier > 100) {
      throw new Error('Authority GraphRAG candidateMultiplier must be an integer in [1,100]');
    }
  }

  get projectionVersion(): number { return this.version; }
  get projectionHash(): string { return this.hash; }

  replaceProjection(
    projection: AuthorityGraphProjection,
    expectedCurrentVersion = this.version,
  ): AuthorityGraphSnapshot {
    if (!Number.isInteger(expectedCurrentVersion) || expectedCurrentVersion < 0) {
      throw new Error('expectedCurrentVersion must be a non-negative integer');
    }
    if (expectedCurrentVersion !== this.version) {
      throw new Error(`STALE_GRAPH_PROJECTION expected=${expectedCurrentVersion} current=${this.version}`);
    }
    if (!Number.isInteger(projection.version) || projection.version < 1) {
      throw new Error('Authority projection version must be a positive integer');
    }

    const nextEntities = new Map<string, AuthorityGraphEntity>();
    const nextRelations = new Map<string, AuthorityGraphRelation>();
    const nextChunks = new Map<string, AuthorityGraphChunk>();
    const nextOutgoing = new Map<string, Set<string>>();
    const nextIncoming = new Map<string, Set<string>>();

    for (const entity of projection.entities) {
      this.validateEntity(entity);
      if (nextEntities.has(entity.id)) throw new Error(`Duplicate authority entity ID: ${entity.id}`);
      nextEntities.set(entity.id, cloneEntity(entity));
      nextOutgoing.set(entity.id, new Set());
      nextIncoming.set(entity.id, new Set());
    }

    for (const relation of projection.relations) {
      this.validateRelation(relation);
      if (nextRelations.has(relation.id)) throw new Error(`Duplicate authority relation ID: ${relation.id}`);
      if (!nextEntities.has(relation.source)) throw new Error(`Dangling authority relation source: ${relation.source}`);
      if (!nextEntities.has(relation.target)) throw new Error(`Dangling authority relation target: ${relation.target}`);
      nextRelations.set(relation.id, cloneRelation(relation));
      nextOutgoing.get(relation.source)!.add(relation.id);
      nextIncoming.get(relation.target)!.add(relation.id);
    }

    let embeddingDimensions: number | null = null;
    for (const chunk of projection.chunks) {
      this.validateChunk(chunk);
      if (nextChunks.has(chunk.id)) throw new Error(`Duplicate authority chunk ID: ${chunk.id}`);
      for (const entityId of chunk.entities) {
        if (!nextEntities.has(entityId)) throw new Error(`Chunk ${chunk.id} references missing entity ${entityId}`);
      }
      if (embeddingDimensions === null) embeddingDimensions = chunk.embedding.length;
      if (chunk.embedding.length !== embeddingDimensions) {
        throw new Error(`Authority chunk embedding dimensions differ: ${chunk.id}`);
      }
      nextChunks.set(chunk.id, cloneChunk(chunk));
    }

    const canonical = canonicalProjection({
      ...projection,
      entities: Array.from(nextEntities.values()),
      relations: Array.from(nextRelations.values()),
      chunks: Array.from(nextChunks.values()),
    });
    const nextHash = stableHash128(canonical);

    if (projection.version < this.version) {
      throw new Error(`Projection version regression current=${this.version} incoming=${projection.version}`);
    }
    if (projection.version === this.version) {
      if (nextHash !== this.hash) {
        throw new Error(`PROJECTION_VERSION_COLLISION version=${projection.version}`);
      }
      return this.snapshot();
    }

    // Atomic commit after all validation/index construction has succeeded.
    this.entityById = nextEntities;
    this.relationById = nextRelations;
    this.chunkById = nextChunks;
    this.outgoing = nextOutgoing;
    this.incoming = nextIncoming;
    this.version = projection.version;
    this.hash = nextHash;
    this.sourceCursor = projection.sourceCursor;
    this.metadata = structuredClone(projection.metadata || {});
    return this.snapshot();
  }

  snapshot(): AuthorityGraphSnapshot {
    return {
      version: this.version,
      sourceCursor: this.sourceCursor,
      metadata: structuredClone(this.metadata),
      entities: Array.from(this.entityById.values(), cloneEntity).sort((a, b) => a.id.localeCompare(b.id)),
      relations: Array.from(this.relationById.values(), cloneRelation).sort((a, b) => a.id.localeCompare(b.id)),
      chunks: Array.from(this.chunkById.values(), cloneChunk).sort((a, b) => a.id.localeCompare(b.id)),
      projectionHash: this.hash,
    };
  }

  retrieveScoped(
    queryEmbedding: number[],
    queryEntities: string[] = [],
    scope: RetrievalScope = {},
  ): ScopedGraphRetrieval {
    this.validateQueryEmbedding(queryEmbedding);
    const permission = scope.permission ?? 'internal';
    const allowGlobal = scope.allowGlobal ?? true;
    const asOf = parseAsOf(scope.asOf);
    const minScore = scope.minScore ?? 0;
    if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) throw new Error('minScore must be in [0,1]');

    const readableEntities = new Map(
      Array.from(this.entityById.values())
        .filter(entity => this.visible(entity, scope.projectId, permission, allowGlobal, asOf))
        .map(entity => [entity.id, entity]),
    );
    const readableRelations = new Map(
      Array.from(this.relationById.values())
        .filter(relation =>
          readableEntities.has(relation.source)
          && readableEntities.has(relation.target)
          && this.visible(relation, scope.projectId, permission, allowGlobal, asOf),
        )
        .map(relation => [relation.id, relation]),
    );
    const readableChunks = Array.from(this.chunkById.values())
      .filter(chunk =>
        this.visible(chunk, scope.projectId, permission, allowGlobal, asOf)
        && chunk.entities.every(entityId => readableEntities.has(entityId)),
      );

    if (readableChunks.length > 0 && queryEmbedding.length !== readableChunks[0].embedding.length) {
      throw new Error(
        `QUERY_EMBEDDING_DIMENSION_MISMATCH query=${queryEmbedding.length} index=${readableChunks[0].embedding.length}`,
      );
    }

    const maxCandidates = Math.min(
      readableChunks.length,
      Math.max(this.config.topK, this.config.topK * this.config.candidateMultiplier),
    );
    const vectorCandidates = readableChunks
      .map(chunk => ({ chunk, similarity: cosineSimilarity(chunk.embedding, queryEmbedding) }))
      .sort((a, b) => b.similarity - a.similarity || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, maxCandidates);

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [];
    for (const id of [...queryEntities, ...vectorCandidates.flatMap(candidate => candidate.chunk.entities)]) {
      if (!visited.has(id) && readableEntities.has(id)) queue.push({ id, depth: 0 });
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

    const rankedChunks: RankedChunk[] = vectorCandidates
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
          components: { similarity: candidate.similarity, entityOverlap, authority, provenance },
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
      chunks: rankedChunks.map(candidate => candidate.chunk),
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
      if (!this.entityById.has(relation.source)) errors.push(`Dangling relation source ${relation.id}: ${relation.source}`);
      if (!this.entityById.has(relation.target)) errors.push(`Dangling relation target ${relation.id}: ${relation.target}`);
      if (!relation.provenanceRef) errors.push(`Relation ${relation.id} has no provenance`);
    }
    for (const chunk of this.chunkById.values()) {
      if (!chunk.provenanceRef) errors.push(`Chunk ${chunk.id} has no provenance`);
      for (const entityId of chunk.entities) {
        if (!this.entityById.has(entityId)) errors.push(`Chunk ${chunk.id} references missing entity ${entityId}`);
      }
    }
    return errors.sort();
  }

  private visible(
    value: {
      projectId?: string;
      sensitivity?: RetrievalSensitivity;
      validFrom?: string;
      validUntil?: string | null;
    },
    projectId: string | undefined,
    permission: RetrievalSensitivity,
    allowGlobal: boolean,
    asOf: number,
  ): boolean {
    if (projectId) {
      if (value.projectId !== projectId && !(allowGlobal && value.projectId === undefined)) return false;
    }
    if (SENSITIVITY_ORDER[value.sensitivity ?? 'internal'] > SENSITIVITY_ORDER[permission]) return false;
    if (value.validFrom && Date.parse(value.validFrom) > asOf) return false;
    if (value.validUntil && Date.parse(value.validUntil) <= asOf) return false;
    return true;
  }

  private validateEntity(entity: AuthorityGraphEntity): void {
    if (!entity.id.trim() || !entity.name.trim() || !entity.type.trim()) throw new Error('Authority entity id/name/type must not be empty');
    if (!entity.provenanceRef.trim()) throw new Error(`Authority entity ${entity.id} requires provenanceRef`);
    validateTemporal(entity.validFrom, entity.validUntil, entity.recordedAt);
  }

  private validateRelation(relation: AuthorityGraphRelation): void {
    if (!relation.id.trim() || !relation.source.trim() || !relation.target.trim() || !relation.type.trim()) {
      throw new Error('Authority relation id/source/target/type must not be empty');
    }
    if (!relation.provenanceRef.trim()) throw new Error(`Authority relation ${relation.id} requires provenanceRef`);
    if (relation.confidence !== undefined && (!Number.isFinite(relation.confidence) || relation.confidence < 0 || relation.confidence > 1)) {
      throw new Error(`Authority relation ${relation.id} confidence must be in [0,1]`);
    }
    validateTemporal(relation.validFrom, relation.validUntil, relation.recordedAt);
  }

  private validateChunk(chunk: AuthorityGraphChunk): void {
    if (!chunk.id.trim() || !chunk.text.trim() || !chunk.source.trim()) throw new Error('Authority chunk id/text/source must not be empty');
    if (!chunk.provenanceRef.trim()) throw new Error(`Authority chunk ${chunk.id} requires provenanceRef`);
    if (!Number.isFinite(chunk.authority) || chunk.authority < 0 || chunk.authority > 1) {
      throw new Error(`Authority chunk ${chunk.id} authority must be in [0,1]`);
    }
    if (!chunk.embedding.length || chunk.embedding.some(value => !Number.isFinite(value))) {
      throw new Error(`Authority chunk ${chunk.id} embedding must contain finite values`);
    }
    if (!Number.isFinite(Date.parse(chunk.recordedAt))) throw new Error(`Authority chunk ${chunk.id} has invalid recordedAt`);
    validateTemporal(chunk.validFrom, chunk.validUntil, chunk.recordedAt);
  }

  private validateQueryEmbedding(embedding: number[]): void {
    if (!embedding.length || embedding.some(value => !Number.isFinite(value))) {
      throw new Error('Query embedding must contain finite values');
    }
  }
}

function parseAsOf(value?: string): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid retrieval asOf timestamp: ${value}`);
  return parsed;
}

function validateTemporal(validFrom?: string, validUntil?: string | null, recordedAt?: string): void {
  for (const [name, value] of [['validFrom', validFrom], ['validUntil', validUntil], ['recordedAt', recordedAt]] as const) {
    if (value !== undefined && value !== null && !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name}: ${value}`);
  }
  if (validFrom && validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error('validUntil must be strictly after validFrom');
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function canonicalProjection(projection: AuthorityGraphProjection): AuthorityGraphProjection {
  return {
    version: projection.version,
    sourceCursor: projection.sourceCursor,
    metadata: structuredClone(projection.metadata || {}),
    entities: projection.entities.map(cloneEntity).sort((a, b) => a.id.localeCompare(b.id)),
    relations: projection.relations.map(cloneRelation).sort((a, b) => a.id.localeCompare(b.id)),
    chunks: projection.chunks.map(cloneChunk).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function cloneEntity(entity: AuthorityGraphEntity): AuthorityGraphEntity {
  return { ...entity, metadata: structuredClone(entity.metadata || {}) };
}

function cloneRelation(relation: AuthorityGraphRelation): AuthorityGraphRelation {
  return { ...relation, metadata: structuredClone(relation.metadata || {}) };
}

function cloneChunk(chunk: AuthorityGraphChunk): AuthorityGraphChunk {
  return {
    ...chunk,
    entities: [...chunk.entities],
    embedding: [...chunk.embedding],
    metadata: structuredClone(chunk.metadata || {}),
  };
}
