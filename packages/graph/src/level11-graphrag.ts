// LEVEL 11: GraphRAG
// Hybrid retrieval: vector similarity + scoped KG traversal + evidence-aware re-ranking

import { generateId } from '@cos/core';

export type RetrievalSensitivity = 'public' | 'internal' | 'private' | 'restricted';

export interface Chunk {
  id: string;
  text: string;
  source: string;
  embedding: number[];
  entities: string[];
  projectId?: string;
  sensitivity?: RetrievalSensitivity;
  provenanceRef?: string;
  authority?: number;
  validFrom?: string;
  validUntil?: string | null;
  recordedAt?: string;
}

export interface GraphRAGEntity {
  id: string;
  name: string;
  type: string;
  projectId?: string;
  sensitivity?: RetrievalSensitivity;
}

export interface GraphRAGRelation {
  id: string;
  source: string;
  target: string;
  type: string;
  projectId?: string;
  sensitivity?: RetrievalSensitivity;
  provenanceRef?: string;
}

export interface GraphRAGConfig {
  topK: number;
  walkDepth: number;
  similarityWeight: number;
  entityWeight: number;
  authorityWeight: number;
  provenanceWeight: number;
}

export interface RetrievalScope {
  projectId?: string;
  permission?: RetrievalSensitivity;
  asOf?: string;
  /** Global corpus entries (no projectId) may be shared into a scoped project. */
  allowGlobal?: boolean;
  minScore?: number;
}

export interface RankedChunk {
  chunk: Chunk;
  score: number;
  components: {
    similarity: number;
    entityOverlap: number;
    authority: number;
    provenance: number;
  };
}

export interface GraphRAGResult {
  query: string;
  chunks: Chunk[];
  entities: string[];
  relationships: Array<{ source: string; target: string; relation: string; provenanceRef?: string }>;
  context: string;
  answer: string;
  confidence: number;
  trace: string[];
  provenance: string[];
}

const SENSITIVITY_ORDER: Record<RetrievalSensitivity, number> = {
  public: 0,
  internal: 1,
  private: 2,
  restricted: 3,
};

export class GraphRAGEngine {
  chunks: Chunk[] = [];
  entities: GraphRAGEntity[] = [];
  relations: GraphRAGRelation[] = [];
  config: GraphRAGConfig;
  private outRelations: Map<string, string[]> = new Map();
  private inRelations: Map<string, string[]> = new Map();

  constructor(config?: Partial<GraphRAGConfig>) {
    const similarityWeight = config?.similarityWeight ?? 0.55;
    const entityWeight = config?.entityWeight ?? 0.20;
    const authorityWeight = config?.authorityWeight ?? 0.15;
    const provenanceWeight = config?.provenanceWeight ?? 0.10;
    const total = similarityWeight + entityWeight + authorityWeight + provenanceWeight;
    if (Math.abs(total - 1) > 1e-9) throw new Error(`GraphRAG ranking weights must sum to 1; received ${total}`);

    this.config = {
      topK: config?.topK ?? 5,
      walkDepth: config?.walkDepth ?? 2,
      similarityWeight,
      entityWeight,
      authorityWeight,
      provenanceWeight,
    };
    if (!Number.isInteger(this.config.topK) || this.config.topK <= 0) throw new Error('topK must be a positive integer');
    if (!Number.isInteger(this.config.walkDepth) || this.config.walkDepth < 0 || this.config.walkDepth > 8) {
      throw new Error('walkDepth must be an integer in [0,8]');
    }
  }

  private buildAdjacency(): void {
    this.outRelations.clear();
    this.inRelations.clear();
    for (const entity of this.entities) {
      this.outRelations.set(entity.id, []);
      this.inRelations.set(entity.id, []);
    }
    for (const relation of this.relations) {
      this.outRelations.get(relation.source)?.push(relation.id);
      this.inRelations.get(relation.target)?.push(relation.id);
    }
  }

  addChunk(chunk: Chunk): void {
    if (this.chunks.some(existing => existing.id === chunk.id)) throw new Error(`Duplicate chunk ID: ${chunk.id}`);
    if (chunk.embedding.some(value => !Number.isFinite(value))) throw new Error(`Chunk ${chunk.id} has a non-finite embedding`);
    if (chunk.authority !== undefined && (chunk.authority < 0 || chunk.authority > 1)) throw new Error('Chunk authority must be in [0,1]');
    this.chunks.push({ ...chunk, entities: [...chunk.entities], embedding: [...chunk.embedding] });
  }

  addEntity(
    id: string,
    name: string,
    type: string = 'concept',
    options: Pick<GraphRAGEntity, 'projectId' | 'sensitivity'> = {},
  ): void {
    if (this.entities.some(entity => entity.id === id)) throw new Error(`Duplicate entity ID: ${id}`);
    this.entities.push({ id, name, type, ...options });
    this.buildAdjacency();
  }

  removeEntity(entityId: string): void {
    const idx = this.entities.findIndex(entity => entity.id === entityId);
    if (idx === -1) throw new Error(`Entity ${entityId} not found`);
    this.entities.splice(idx, 1);
    this.relations = this.relations.filter(relation => relation.source !== entityId && relation.target !== entityId);
    this.buildAdjacency();
  }

  addRelation(
    source: string,
    target: string,
    type: string = 'related_to',
    options: Pick<GraphRAGRelation, 'projectId' | 'sensitivity' | 'provenanceRef'> = {},
  ): void {
    if (!this.entities.some(entity => entity.id === source)) throw new Error(`Relation source ${source} not found`);
    if (!this.entities.some(entity => entity.id === target)) throw new Error(`Relation target ${target} not found`);
    const id = String(generateId());
    this.relations.push({ id, source, target, type, ...options });
    this.buildAdjacency();
  }

  removeRelation(relationId: string): void {
    const idx = this.relations.findIndex(relation => relation.id === relationId);
    if (idx === -1) throw new Error(`Relation ${relationId} not found`);
    this.relations.splice(idx, 1);
    this.buildAdjacency();
  }

  getEntity(entityId: string): GraphRAGEntity | undefined {
    return this.entities.find(entity => entity.id === entityId);
  }

  buildDemo(): void {
    this.addEntity('cos', 'Cognitive OS', 'system');
    this.addEntity('memory', 'Memory System', 'concept');
    this.addEntity('reasoning', 'Reasoning Engine', 'concept');
    this.addEntity('knowledge', 'Knowledge Graph', 'concept');
    this.addEntity('execution', 'Execution Engine', 'concept');
    this.addRelation('cos', 'memory', 'has');
    this.addRelation('cos', 'reasoning', 'has');
    this.addRelation('cos', 'knowledge', 'has');
    this.addRelation('cos', 'execution', 'has');
    this.addChunk({ id: 'c1', text: 'COS has a 12-layer memory system with TTL and consolidation', source: 'docs', provenanceRef: 'docs:c1', authority: 0.8, embedding: [0.1, 0.2, 0.3], entities: ['cos', 'memory'] });
    this.addChunk({ id: 'c2', text: 'The reasoning engine supports forward and backward chaining', source: 'docs', provenanceRef: 'docs:c2', authority: 0.8, embedding: [0.2, 0.3, 0.1], entities: ['reasoning'] });
    this.addChunk({ id: 'c3', text: 'Knowledge graphs enable structured RAG with multi-hop retrieval', source: 'docs', provenanceRef: 'docs:c3', authority: 0.8, embedding: [0.3, 0.1, 0.2], entities: ['knowledge', 'cos'] });
  }

  static cosineSim(a: number[], b: number[]): number {
    const dot = a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
    const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
    return normA * normB > 0 ? dot / (normA * normB) : 0;
  }

  /** Backwards-compatible unrestricted retrieval. */
  retrieve(queryEmbedding: number[], queryEntities: string[] = []) {
    return this.retrieveScoped(queryEmbedding, queryEntities, { permission: 'restricted' });
  }

  retrieveScoped(
    queryEmbedding: number[],
    queryEntities: string[] = [],
    scope: RetrievalScope = {},
  ): { chunks: Chunk[]; rankedChunks: RankedChunk[]; entities: string[]; relations: GraphRAGRelation[] } {
    const permission = scope.permission ?? 'internal';
    const allowGlobal = scope.allowGlobal ?? true;
    const asOf = scope.asOf ? Date.parse(scope.asOf) : Date.now();
    if (!Number.isFinite(asOf)) throw new Error(`Invalid retrieval asOf timestamp: ${scope.asOf}`);

    const readableChunks = this.chunks.filter(chunk =>
      this.scopeMatches(chunk.projectId, scope.projectId, allowGlobal)
      && this.canRead(chunk.sensitivity, permission)
      && this.temporallyValid(chunk, asOf),
    );

    const vectorScored = readableChunks
      .map(chunk => ({ chunk, similarity: GraphRAGEngine.cosineSim(chunk.embedding, queryEmbedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.max(this.config.topK * 3, this.config.topK));

    const visitedEntities = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [
      ...queryEntities,
      ...vectorScored.flatMap(candidate => candidate.chunk.entities),
    ].map(id => ({ id, depth: 0 }));

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth > this.config.walkDepth || visitedEntities.has(current.id)) continue;
      const entity = this.getEntity(current.id);
      if (!entity || !this.scopeMatches(entity.projectId, scope.projectId, allowGlobal) || !this.canRead(entity.sensitivity, permission)) continue;
      visitedEntities.add(current.id);
      if (current.depth === this.config.walkDepth) continue;

      for (const relationId of [
        ...(this.outRelations.get(current.id) || []),
        ...(this.inRelations.get(current.id) || []),
      ]) {
        const relation = this.relations.find(item => item.id === relationId);
        if (!relation) continue;
        if (!this.scopeMatches(relation.projectId, scope.projectId, allowGlobal) || !this.canRead(relation.sensitivity, permission)) continue;
        const next = relation.source === current.id ? relation.target : relation.source;
        if (!visitedEntities.has(next)) queue.push({ id: next, depth: current.depth + 1 });
      }
    }

    const rankedChunks: RankedChunk[] = vectorScored.map(candidate => {
      const entityOverlap = candidate.chunk.entities.filter(entity => visitedEntities.has(entity)).length / Math.max(1, candidate.chunk.entities.length);
      const authority = candidate.chunk.authority ?? 0.5;
      const provenance = candidate.chunk.provenanceRef ? 1 : 0;
      const score =
        this.config.similarityWeight * Math.max(0, candidate.similarity)
        + this.config.entityWeight * entityOverlap
        + this.config.authorityWeight * authority
        + this.config.provenanceWeight * provenance;
      return {
        chunk: candidate.chunk,
        score,
        components: { similarity: candidate.similarity, entityOverlap, authority, provenance },
      };
    })
      .filter(candidate => candidate.score >= (scope.minScore ?? 0))
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id))
      .slice(0, this.config.topK);

    const resultEntities = Array.from(visitedEntities)
      .map(id => this.getEntity(id))
      .filter((entity): entity is GraphRAGEntity => Boolean(entity));
    const relations = this.relations.filter(relation =>
      visitedEntities.has(relation.source)
      && visitedEntities.has(relation.target)
      && this.scopeMatches(relation.projectId, scope.projectId, allowGlobal)
      && this.canRead(relation.sensitivity, permission),
    );

    return {
      chunks: rankedChunks.map(candidate => candidate.chunk),
      rankedChunks,
      entities: resultEntities.map(entity => entity.name),
      relations,
    };
  }

  async answer(query: string, queryEmbedding: number[], queryEntities: string[] = []): Promise<GraphRAGResult> {
    return this.answerScoped(query, queryEmbedding, queryEntities, { permission: 'restricted' });
  }

  async answerScoped(
    query: string,
    queryEmbedding: number[],
    queryEntities: string[] = [],
    scope: RetrievalScope = {},
  ): Promise<GraphRAGResult> {
    const retrieved = this.retrieveScoped(queryEmbedding, queryEntities, scope);
    const context = retrieved.rankedChunks
      .map(candidate => `[${candidate.chunk.provenanceRef || candidate.chunk.source}] ${candidate.chunk.text}`)
      .join('\n');
    const confidence = retrieved.rankedChunks.length === 0
      ? 0
      : Math.min(1, retrieved.rankedChunks.reduce((sum, candidate) => sum + candidate.score, 0) / retrieved.rankedChunks.length);
    const provenance = Array.from(new Set(retrieved.chunks.map(chunk => chunk.provenanceRef).filter((ref): ref is string => Boolean(ref))));

    return {
      query,
      chunks: retrieved.chunks,
      entities: retrieved.entities,
      relationships: retrieved.relations.map(relation => ({
        source: relation.source,
        target: relation.target,
        relation: relation.type,
        provenanceRef: relation.provenanceRef,
      })),
      context,
      answer: `Retrieved ${retrieved.chunks.length} scoped evidence chunks across ${retrieved.entities.length} entities.`,
      confidence,
      trace: [
        `scope: project=${scope.projectId || '*'} permission=${scope.permission || 'internal'} asOf=${scope.asOf || 'now'}`,
        `vector candidates: ${Math.max(this.config.topK * 3, this.config.topK)}`,
        `graph traversal: depth ${this.config.walkDepth}`,
        `ranking weights: sim=${this.config.similarityWeight} entity=${this.config.entityWeight} authority=${this.config.authorityWeight} provenance=${this.config.provenanceWeight}`,
      ],
      provenance,
    };
  }

  toMermaid(): string {
    let mermaid = 'graph LR\n';
    for (const entity of this.entities) mermaid += `    ${entity.id}["${entity.name}"]\n`;
    for (const relation of this.relations) mermaid += `    ${relation.source} -->|"${relation.type}"| ${relation.target}\n`;
    return mermaid;
  }

  validate(): string[] {
    const errors: string[] = [];
    const entityIds = new Set(this.entities.map(entity => entity.id));
    for (const relation of this.relations) {
      if (!entityIds.has(relation.source)) errors.push(`Dangling relation source: ${relation.source}`);
      if (!entityIds.has(relation.target)) errors.push(`Dangling relation target: ${relation.target}`);
    }
    for (const chunk of this.chunks) {
      for (const entityId of chunk.entities) {
        if (!entityIds.has(entityId)) errors.push(`Chunk ${chunk.id} references missing entity: ${entityId}`);
      }
    }
    return errors;
  }

  metrics(): { entityCount: number; relationCount: number; chunkCount: number; avgDegree: number; density: number } {
    const n = this.entities.length;
    const e = this.relations.length;
    this.buildAdjacency();
    const degree = this.entities.map(entity => (this.outRelations.get(entity.id)?.length || 0) + (this.inRelations.get(entity.id)?.length || 0));
    const avgDegree = n > 0 ? degree.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { entityCount: n, relationCount: e, chunkCount: this.chunks.length, avgDegree, density };
  }

  toJSON() {
    return {
      chunks: this.chunks,
      entities: this.entities,
      relations: this.relations,
      config: this.config,
    };
  }

  static fromJSON(data: {
    chunks: Chunk[];
    entities: GraphRAGEntity[];
    relations: GraphRAGRelation[];
    config: GraphRAGConfig;
  }): GraphRAGEngine {
    const graph = new GraphRAGEngine(data.config);
    graph.chunks = data.chunks.map(chunk => ({ ...chunk, embedding: [...chunk.embedding], entities: [...chunk.entities] }));
    graph.entities = data.entities.map(entity => ({ ...entity }));
    graph.relations = data.relations.map(relation => ({ ...relation }));
    graph.buildAdjacency();
    return graph;
  }

  private canRead(sensitivity: RetrievalSensitivity | undefined, permission: RetrievalSensitivity): boolean {
    return SENSITIVITY_ORDER[sensitivity || 'internal'] <= SENSITIVITY_ORDER[permission];
  }

  private scopeMatches(itemProject: string | undefined, requestedProject: string | undefined, allowGlobal: boolean): boolean {
    if (!requestedProject) return true;
    return itemProject === requestedProject || (allowGlobal && itemProject === undefined);
  }

  private temporallyValid(chunk: Chunk, asOf: number): boolean {
    const validFrom = chunk.validFrom ? Date.parse(chunk.validFrom) : Number.NEGATIVE_INFINITY;
    const validUntil = chunk.validUntil ? Date.parse(chunk.validUntil) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(validFrom) && chunk.validFrom) throw new Error(`Chunk ${chunk.id} has invalid validFrom`);
    if (!Number.isFinite(validUntil) && chunk.validUntil) throw new Error(`Chunk ${chunk.id} has invalid validUntil`);
    return asOf >= validFrom && asOf < validUntil;
  }
}
