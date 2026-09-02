// LEVEL 11: GraphRAG
// Hybrid retrieval: vector similarity + KG traversal + re-ranking
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

/** Canonical stored chunk shape. */
export interface Chunk {
  id: string;
  text: string;
  source: string;
  embedding: number[];
  entities: string[];
}

/** Historical/minimal ingestion shape retained for compatibility. */
export interface LegacyChunk {
  id: string;
  text: string;
  embedding: number[];
  source?: string;
  entities?: string[];
}

export interface GraphRAGConfig {
  topK: number;
  walkDepth: number;
  similarityWeight: number;
}

export interface GraphRAGResult {
  query: string;
  chunks: Chunk[];
  entities: string[];
  relationships: Array<{ source: string; target: string; relation: string }>;
  context: string;
  answer: string;
  confidence: number;
  trace: string[];
}

function normalizeChunk(input: Chunk | LegacyChunk): Chunk {
  if (!Array.isArray(input.embedding) || input.embedding.length === 0) {
    throw new Error(`Chunk ${input.id} has an empty embedding`);
  }
  return {
    id: input.id,
    text: input.text,
    source: input.source ?? 'unknown',
    embedding: [...input.embedding],
    entities: input.entities ? [...input.entities] : [],
  };
}

export class GraphRAGEngine {
  chunks: Chunk[] = [];
  entities: Array<{ id: string; name: string; type: string }> = [];
  relations: Array<{ id: string; source: string; target: string; type: string }> = [];
  config: GraphRAGConfig;
  private adj: Map<string, string[]> = new Map();
  private adjRev: Map<string, string[]> = new Map();

  constructor(config?: Partial<GraphRAGConfig>) {
    this.config = {
      topK: config?.topK ?? 5,
      walkDepth: config?.walkDepth ?? 2,
      similarityWeight: config?.similarityWeight ?? 0.6,
    };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    this.adjRev.clear();
    for (const e of this.entities) {
      this.adj.set(e.id, []);
      this.adjRev.set(e.id, []);
    }
    for (const r of this.relations) {
      if (this.adj.has(r.source)) this.adj.get(r.source)!.push(r.target);
      if (this.adjRev.has(r.target)) this.adjRev.get(r.target)!.push(r.source);
    }
  }

  addChunk(c: Chunk | LegacyChunk): void {
    if (this.chunks.some(x => x.id === c.id)) throw new Error(`Duplicate chunk ID: ${c.id}`);
    this.chunks.push(normalizeChunk(c));
  }

  addEntity(id: string, name: string, type: string = 'concept'): void {
    if (this.entities.some(e => e.id === id)) throw new Error(`Duplicate entity ID: ${id}`);
    this.entities.push({ id, name, type });
    this.buildAdjacency();
  }

  removeEntity(entityId: string): void {
    const idx = this.entities.findIndex(e => e.id === entityId);
    if (idx === -1) throw new Error(`Entity ${entityId} not found`);
    this.entities.splice(idx, 1);
    this.relations = this.relations.filter(r => r.source !== entityId && r.target !== entityId);
    this.buildAdjacency();
  }

  addRelation(source: string, target: string, type: string = 'related_to'): void {
    if (!this.entities.some(e => e.id === source)) throw new Error(`Relation source ${source} not found`);
    if (!this.entities.some(e => e.id === target)) throw new Error(`Relation target ${target} not found`);
    if (this.relations.some(r => r.source === source && r.target === target && r.type === type)) {
      throw new Error(`Duplicate relation: ${source} -[${type}]-> ${target}`);
    }
    this.relations.push({ id: generateId(), source, target, type });
    this.buildAdjacency();
  }

  removeRelation(relationId: string): void {
    const idx = this.relations.findIndex(r => r.id === relationId);
    if (idx === -1) throw new Error(`Relation ${relationId} not found`);
    this.relations.splice(idx, 1);
    this.buildAdjacency();
  }

  getEntity(entityId: string) { return this.entities.find(e => e.id === entityId); }

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
    this.addChunk({ id: 'c1', text: 'COS has a 12-layer memory system with TTL and consolidation', source: 'docs', embedding: [0.1, 0.2, 0.3], entities: ['cos', 'memory'] });
    this.addChunk({ id: 'c2', text: 'The reasoning engine supports forward and backward chaining', source: 'docs', embedding: [0.2, 0.3, 0.1], entities: ['reasoning'] });
    this.addChunk({ id: 'c3', text: 'Knowledge graphs enable structured RAG with multi-hop retrieval', source: 'docs', embedding: [0.3, 0.1, 0.2], entities: ['knowledge', 'cos'] });
  }

  static cosineSim(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < dim; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      dot += av * bv;
      aa += av * av;
      bb += bv * bv;
    }
    const na = Math.sqrt(aa);
    const nb = Math.sqrt(bb);
    return na * nb > 0 ? dot / (na * nb) : 0;
  }

  retrieve(queryEmbedding: number[], queryEntities: string[] = []) {
    if (!queryEmbedding.length) return { chunks: [] as Chunk[], entities: [] as string[], relations: [] as typeof this.relations };

    // Vector similarity
    const scored = this.chunks.map(c => ({ chunk: c, score: GraphRAGEngine.cosineSim(c.embedding, queryEmbedding) }));
    scored.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
    const topChunks = scored.slice(0, this.config.topK).map(s => s.chunk);

    // KG traversal uses entity IDs internally.
    const visitedEntities = new Set<string>();
    const walkQueue = [...queryEntities, ...topChunks.flatMap(c => c.entities)];
    for (const eid of walkQueue) {
      const dfs = (id: string, depth: number) => {
        if (depth > this.config.walkDepth || visitedEntities.has(id)) return;
        visitedEntities.add(id);
        for (const nb of this.adj.get(id) || []) dfs(nb, depth + 1);
        for (const nb of this.adjRev.get(id) || []) dfs(nb, depth + 1);
      };
      dfs(eid, 0);
    }

    // Re-rank
    const hybrid: Array<{ chunk: Chunk; score: number }> = topChunks.map(c => {
      const entityOverlap = c.entities.filter(e => visitedEntities.has(e)).length / Math.max(1, c.entities.length);
      const semanticScore = scored.find(s => s.chunk.id === c.id)?.score ?? 0;
      return {
        chunk: c,
        score: this.config.similarityWeight * semanticScore + (1 - this.config.similarityWeight) * entityOverlap,
      };
    });
    hybrid.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));

    const resultEntities = Array.from(visitedEntities)
      .map(id => this.entities.find(e => e.id === id))
      .filter(Boolean) as typeof this.entities;

    return {
      chunks: hybrid.map(h => h.chunk),
      // Preserve historical external contract: entity names are returned.
      entities: resultEntities.map(e => e.name),
      relations: this.relations.filter(r => visitedEntities.has(r.source) && visitedEntities.has(r.target)),
    };
  }

  async answer(query: string, queryEmbedding: number[], queryEntities: string[] = []): Promise<GraphRAGResult> {
    const retrieved = this.retrieve(queryEmbedding, queryEntities);
    const context = retrieved.chunks.map(c => c.text).join('\n');
    const confidence = retrieved.chunks.length > 0 ? Math.min(1, retrieved.chunks.length / 10) : 0;
    return {
      query,
      chunks: retrieved.chunks,
      entities: retrieved.entities,
      relationships: retrieved.relations.map(r => ({ source: r.source, target: r.target, relation: r.type })),
      context,
      answer: `Based on ${retrieved.chunks.length} relevant chunks and ${retrieved.entities.length} entities.`,
      confidence,
      trace: [
        `Vector similarity: top ${this.config.topK}`,
        `KG traversal: depth ${this.config.walkDepth}`,
        `Re-ranked: ${this.config.similarityWeight} weight`,
      ],
    };
  }

  toMermaid(): string {
    let m = 'graph LR\n';
    for (const e of this.entities) m += `    ${e.id}["${e.name}"]\n`;
    for (const r of this.relations) m += `    ${r.source} -->|"${r.type}"| ${r.target}\n`;
    return m;
  }

  validate(): string[] {
    const errors: string[] = [];
    const chunkIds = new Set<string>();
    const relationIds = new Set<string>();

    for (const chunk of this.chunks) {
      if (chunkIds.has(chunk.id)) errors.push(`Duplicate chunk ID: ${chunk.id}`);
      chunkIds.add(chunk.id);
      if (!chunk.embedding.length) errors.push(`Chunk ${chunk.id} has empty embedding`);
    }
    for (const r of this.relations) {
      if (relationIds.has(r.id)) errors.push(`Duplicate relation ID: ${r.id}`);
      relationIds.add(r.id);
      if (!this.entities.some(e => e.id === r.source)) errors.push(`Dangling relation source: ${r.source}`);
      if (!this.entities.some(e => e.id === r.target)) errors.push(`Dangling relation target: ${r.target}`);
    }
    return errors;
  }

  metrics(): { entityCount: number; relationCount: number; chunkCount: number; avgDegree: number; density: number } {
    const n = this.entities.length;
    const e = this.relations.length;
    this.buildAdjacency();
    const deg = this.entities.map(en => (this.adj.get(en.id)?.length || 0) + (this.adjRev.get(en.id)?.length || 0));
    const avgDegree = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { entityCount: n, relationCount: e, chunkCount: this.chunks.length, avgDegree, density };
  }

  toJSON() {
    return {
      chunks: this.chunks.map(chunk => ({ ...chunk, embedding: [...chunk.embedding], entities: [...chunk.entities] })),
      entities: this.entities.map(entity => ({ ...entity })),
      relations: this.relations.map(relation => ({ ...relation })),
      config: { ...this.config },
    };
  }

  static fromJSON(data: {
    chunks: Array<Chunk | LegacyChunk>;
    entities: Array<{ id: string; name: string; type: string }>;
    relations: Array<{ id: string; source: string; target: string; type: string }>;
    config: GraphRAGConfig;
  }): GraphRAGEngine {
    const g = new GraphRAGEngine(data.config);
    for (const chunk of data.chunks) g.addChunk(chunk);
    g.entities = data.entities.map(entity => ({ ...entity }));
    g.relations = data.relations.map(relation => ({ ...relation }));
    g.buildAdjacency();
    return g;
  }
}
