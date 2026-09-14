// LEVEL 8: KNOWLEDGE GRAPH
// Ontologies, entities, relationships, SPARQL queries, transitive inference
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

export type EntityType = 'concept' | 'person' | 'org' | 'product' | 'tech' | 'event' | 'place' | 'system';
export type RelationType = 'created' | 'uses' | 'part_of' | 'subclass_of' | 'located_in' | 'produced_by' | 'has' | 'related_to';

export interface KGEntity {
  id: string; name: string; type: EntityType;
  aliases?: string[]; description?: string; properties?: Record<string, string>;
}

export interface KGRelation {
  id: string; source: string; target: string; type: RelationType;
  confidence?: number; sourceDoc?: string; properties?: Record<string, string>;
}

export interface SPARQLQuery {
  select: string[]; where: Array<{ subject: string; predicate: string; object: string }>; limit?: number;
}

export interface KGMetrics {
  /** Current canonical names. */
  nodeCount: number;
  edgeCount: number;
  /** Backward-compatible aliases used by historical callers/tests. */
  entityCount: number;
  relationCount: number;
  avgDegree: number;
  density: number;
}

export class KnowledgeGraphEngine {
  entities: KGEntity[] = []; relations: KGRelation[] = [];
  private adj: Map<string, string[]> = new Map();
  private adjRev: Map<string, string[]> = new Map();

  private buildAdjacency(): void {
    this.adj.clear(); this.adjRev.clear();
    for (const e of this.entities) { this.adj.set(e.id, []); this.adjRev.set(e.id, []); }
    for (const r of this.relations) {
      if (this.adj.has(r.source)) this.adj.get(r.source)!.push(r.target);
      if (this.adjRev.has(r.target)) this.adjRev.get(r.target)!.push(r.source);
    }
  }

  addEntity(e: KGEntity): string {
    if (this.entities.some(x => x.id === e.id)) throw new Error(`Duplicate entity ID: ${e.id}`);
    this.entities.push(e); this.buildAdjacency(); return e.id;
  }

  removeEntity(entityId: string): void {
    const idx = this.entities.findIndex(e => e.id === entityId);
    if (idx === -1) throw new Error(`Entity ${entityId} not found`);
    this.entities.splice(idx, 1);
    this.relations = this.relations.filter(r => r.source !== entityId && r.target !== entityId);
    this.buildAdjacency();
  }

  addRelation(r: KGRelation): void {
    if (!this.entities.some(e => e.id === r.source)) throw new Error(`Relation source ${r.source} not found`);
    if (!this.entities.some(e => e.id === r.target)) throw new Error(`Relation target ${r.target} not found`);
    if (this.relations.some(existing => existing.id === r.id)) throw new Error(`Duplicate relation ID: ${r.id}`);
    this.relations.push(r); this.buildAdjacency();
  }

  removeRelation(relationId: string): void {
    const idx = this.relations.findIndex(r => r.id === relationId);
    if (idx === -1) throw new Error(`Relation ${relationId} not found`);
    this.relations.splice(idx, 1); this.buildAdjacency();
  }

  getEntity(entityId: string): KGEntity | undefined { return this.entities.find(e => e.id === entityId); }
  getRelation(relationId: string): KGRelation | undefined { return this.relations.find(r => r.id === relationId); }

  getRelations(entityId: string): KGRelation[] {
    return this.relations.filter(r => r.source === entityId || r.target === entityId);
  }

  buildAIEcosystem() {
    this.addEntity({ id: 'openai', name: 'OpenAI', type: 'org', description: 'AI research company' });
    this.addEntity({ id: 'gpt5', name: 'GPT-5', type: 'product', description: 'Large language model' });
    this.addEntity({ id: 'transformer', name: 'Transformer', type: 'tech', description: 'Neural network architecture' });
    this.addEntity({ id: 'llm', name: 'LLM', type: 'concept', description: 'Large Language Model' });
    this.addEntity({ id: 'rag', name: 'RAG', type: 'tech', description: 'Retrieval Augmented Generation' });
    this.addEntity({ id: 'embedding', name: 'Embedding', type: 'tech', description: 'Vector representation' });
    this.addRelation({ id: generateId(), source: 'openai', target: 'gpt5', type: 'created' });
    this.addRelation({ id: generateId(), source: 'gpt5', target: 'transformer', type: 'uses' });
    this.addRelation({ id: generateId(), source: 'gpt5', target: 'llm', type: 'subclass_of' });
    this.addRelation({ id: generateId(), source: 'rag', target: 'llm', type: 'uses' });
    this.addRelation({ id: generateId(), source: 'rag', target: 'embedding', type: 'uses' });
  }

  /**
   * Demo mirrors the documented COS architecture rather than a truncated six-node subset.
   * Adding Runtime and Governance restores the architecture contract while keeping IDs stable.
   */
  buildCOS() {
    this.addEntity({ id: 'cos', name: 'Cognitive OS', type: 'system' });
    this.addEntity({ id: 'cos-memory', name: 'Memory', type: 'concept' });
    this.addEntity({ id: 'cos-reasoning', name: 'Reasoning', type: 'concept' });
    this.addEntity({ id: 'cos-knowledge', name: 'Knowledge', type: 'concept' });
    this.addEntity({ id: 'cos-execution', name: 'Execution', type: 'concept' });
    this.addEntity({ id: 'cos-orch', name: 'Orchestration', type: 'concept' });
    this.addEntity({ id: 'cos-runtime', name: 'Runtime', type: 'system' });
    this.addEntity({ id: 'cos-governance', name: 'Governance', type: 'concept' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-memory', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-reasoning', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-knowledge', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-execution', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-orch', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-runtime', type: 'has' });
    this.addRelation({ id: generateId(), source: 'cos', target: 'cos-governance', type: 'has' });
  }

  sparql(query: SPARQLQuery): Array<Record<string, KGEntity>> {
    const results: Array<Record<string, KGEntity>> = [];
    for (const entity of this.entities) {
      let match = true;
      for (const pattern of query.where) {
        if (pattern.subject.startsWith('?')) {
          if (pattern.predicate !== 'type' || entity.type !== pattern.object) { match = false; break; }
        } else if (pattern.object.startsWith('?')) {
          if (!this.relations.some(r => r.source === pattern.subject && r.target === entity.id && r.type === (pattern.predicate as RelationType))) { match = false; break; }
        } else {
          if (!this.relations.some(r => r.source === pattern.subject && r.target === pattern.object && r.type === (pattern.predicate as RelationType))) {
            match = false; break;
          }
        }
      }
      if (match) {
        const binding: Record<string, KGEntity> = {};
        for (const v of query.select) binding[v] = entity;
        results.push(binding);
        if (query.limit && results.length >= query.limit) break;
      }
    }
    return results;
  }

  query(sourceId: string, relation?: RelationType, maxDepth: number = 2): KGEntity[] {
    const visited = new Set<string>(); const results: KGEntity[] = [];
    const dfs = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      const entity = this.entities.find(e => e.id === id);
      if (entity && id !== sourceId) results.push(entity);
      for (const r of this.relations) {
        if (r.source === id && (!relation || r.type === relation)) dfs(r.target, depth + 1);
        if (r.target === id && (!relation || r.type === relation)) dfs(r.source, depth + 1);
      }
    };
    dfs(sourceId, 0);
    return results;
  }

  inferTransitive(): KGRelation[] {
    const inferred: KGRelation[] = [];
    for (const r1 of this.relations) {
      for (const r2 of this.relations) {
        if (r1.target === r2.source && r1.type === r2.type) {
          if (!this.relations.some(r => r.source === r1.source && r.target === r2.target)) {
            inferred.push({ id: generateId(), source: r1.source, target: r2.target, type: r1.type, confidence: (r1.confidence || 0.5) * (r2.confidence || 0.5) * 0.9 });
          }
        }
      }
    }
    return inferred;
  }

  toMermaid(): string {
    let m = 'graph LR\n';
    for (const e of this.entities) m += `    ${e.id}["${e.name}"]\n`;
    for (const r of this.relations) m += `    ${r.source} -->|"${r.type}"| ${r.target}\n`;
    return m;
  }

  validate(): string[] {
    const errors: string[] = [];
    const relationIds = new Set<string>();
    for (const r of this.relations) {
      if (relationIds.has(r.id)) errors.push(`Duplicate relation ID: ${r.id}`);
      relationIds.add(r.id);
      if (!this.entities.some(e => e.id === r.source)) errors.push(`Dangling relation source: ${r.source}`);
      if (!this.entities.some(e => e.id === r.target)) errors.push(`Dangling relation target: ${r.target}`);
    }
    return errors;
  }

  metrics(): KGMetrics {
    const n = this.entities.length; const e = this.relations.length;
    this.buildAdjacency();
    const deg = this.entities.map(en => (this.adj.get(en.id)?.length || 0) + (this.adjRev.get(en.id)?.length || 0));
    const avgDegree = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, entityCount: n, relationCount: e, avgDegree, density };
  }

  toJSON() { return { entities: this.entities, relations: this.relations }; }

  static fromJSON(data: { entities: KGEntity[]; relations: KGRelation[] }): KnowledgeGraphEngine {
    const g = new KnowledgeGraphEngine(); g.entities = data.entities; g.relations = data.relations; g.buildAdjacency(); return g;
  }
}