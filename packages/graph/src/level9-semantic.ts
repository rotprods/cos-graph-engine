// LEVEL 9: SEMANTIC GRAPH
// Taxonomies, hypernyms, LCA, semantic similarity
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

export type SemanticRelation =
  | 'is_a' | 'has_property' | 'related_to' | 'part_of' | 'opposite_of' | 'causes' | 'requires'
  | 'similar' | 'dissimilar';

export interface SemanticNode {
  id: string;
  /** Canonical API. */
  concept: string;
  type: 'entity' | 'class' | 'attribute' | 'relation';
  definition?: string;
  examples?: string[];
  embedding?: number[];
  /** Backward-compatible aliases used by historical callers. */
  name?: string;
  concepts?: string[];
}

export interface LegacySemanticNode {
  id: string;
  name: string;
  concepts?: string[];
  definition?: string;
  embedding?: number[];
  type?: 'entity' | 'class' | 'attribute' | 'relation';
}

export interface SemanticEdge {
  id: string; source: string; target: string;
  relation: SemanticRelation;
  strength: number;
}

export interface LegacySemanticEdge {
  id: string; source: string; target: string;
  type: SemanticRelation;
  weight: number;
}

function edgeRelation(edge: SemanticEdge): SemanticRelation { return edge.relation; }

export class SemanticGraph {
  nodes: SemanticNode[] = []; edges: SemanticEdge[] = [];
  private adj: Map<string, string[]> = new Map();
  private adjRev: Map<string, string[]> = new Map();

  private buildAdjacency(): void {
    this.adj.clear(); this.adjRev.clear();
    for (const n of this.nodes) { this.adj.set(n.id, []); this.adjRev.set(n.id, []); }
    for (const e of this.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adjRev.has(e.target)) this.adjRev.get(e.target)!.push(e.source);
    }
  }

  addNode(n: SemanticNode | LegacySemanticNode): string {
    if (this.nodes.some(x => x.id === n.id)) throw new Error(`Duplicate semantic node ID: ${n.id}`);
    const normalized: SemanticNode = 'concept' in n
      ? { ...n, name: n.name ?? n.concept }
      : {
          id: n.id,
          concept: n.name,
          name: n.name,
          concepts: n.concepts ? [...n.concepts] : [],
          type: n.type ?? 'entity',
          definition: n.definition,
          embedding: n.embedding ? [...n.embedding] : undefined,
        };
    this.nodes.push(normalized); this.buildAdjacency(); return normalized.id;
  }

  removeNode(nodeId: string): void {
    const idx = this.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(e: SemanticEdge | LegacySemanticEdge): void {
    if (!this.nodes.some(n => n.id === e.source)) throw new Error(`Edge source ${e.source} not found`);
    if (!this.nodes.some(n => n.id === e.target)) throw new Error(`Edge target ${e.target} not found`);
    if (this.edges.some(existing => existing.id === e.id)) throw new Error(`Duplicate semantic edge ID: ${e.id}`);
    const normalized: SemanticEdge = 'relation' in e
      ? { ...e }
      : { id: e.id, source: e.source, target: e.target, relation: e.type, strength: e.weight };
    this.edges.push(normalized); this.buildAdjacency();
  }

  removeEdge(edgeId: string): void {
    const idx = this.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: string): SemanticNode | undefined { return this.nodes.find(n => n.id === nodeId); }
  getEdge(edgeId: string): SemanticEdge | undefined { return this.edges.find(e => e.id === edgeId); }

  buildAnimalTaxonomy() {
    this.addNode({ id: 'animal', concept: 'Animal', type: 'class', definition: 'Living organism' });
    this.addNode({ id: 'mammal', concept: 'Mammal', type: 'class', definition: 'Warm-blooded' });
    this.addNode({ id: 'bird', concept: 'Bird', type: 'class', definition: 'Has feathers' });
    this.addNode({ id: 'dog', concept: 'Dog', type: 'entity', examples: ['Canis familiaris'] });
    this.addNode({ id: 'cat', concept: 'Cat', type: 'entity', examples: ['Felis catus'] });
    this.addNode({ id: 'eagle', concept: 'Eagle', type: 'entity', examples: ['Aquila'] });
    this.addEdge({ id: generateId(), source: 'mammal', target: 'animal', relation: 'is_a', strength: 1.0 });
    this.addEdge({ id: generateId(), source: 'bird', target: 'animal', relation: 'is_a', strength: 1.0 });
    this.addEdge({ id: generateId(), source: 'dog', target: 'mammal', relation: 'is_a', strength: 0.9 });
    this.addEdge({ id: generateId(), source: 'cat', target: 'mammal', relation: 'is_a', strength: 0.9 });
    this.addEdge({ id: generateId(), source: 'eagle', target: 'bird', relation: 'is_a', strength: 0.9 });
  }

  /**
   * Backward-compatible nearest semantic neighbours.
   * Scores direct similar/dissimilar edges, concept-tag overlap, embedding cosine and taxonomy similarity.
   */
  findSimilar(nodeId: string, limit: number = 5): SemanticNode[] {
    const source = this.getNode(nodeId);
    if (!source) return [];
    const sourceTags = new Set((source.concepts ?? source.examples ?? []).map(v => v.toLowerCase()));

    const scored = this.nodes
      .filter(node => node.id !== nodeId)
      .map(node => {
        let score = 0;
        const direct = this.edges.filter(e =>
          (e.source === nodeId && e.target === node.id) || (e.target === nodeId && e.source === node.id)
        );
        for (const edge of direct) {
          if (edgeRelation(edge) === 'similar') score = Math.max(score, edge.strength);
          if (edgeRelation(edge) === 'dissimilar') score = Math.min(score, -Math.abs(edge.strength));
          if (edgeRelation(edge) === 'related_to') score = Math.max(score, edge.strength * 0.7);
        }

        const tags = new Set((node.concepts ?? node.examples ?? []).map(v => v.toLowerCase()));
        if (sourceTags.size || tags.size) {
          const intersection = [...sourceTags].filter(t => tags.has(t)).length;
          const union = new Set([...sourceTags, ...tags]).size;
          if (union > 0) score = Math.max(score, intersection / union);
        }

        if (source.embedding && node.embedding && source.embedding.length && node.embedding.length) {
          const dot = source.embedding.reduce((s, v, i) => s + v * (node.embedding![i] ?? 0), 0);
          const na = Math.sqrt(source.embedding.reduce((s, v) => s + v * v, 0));
          const nb = Math.sqrt(node.embedding.reduce((s, v) => s + v * v, 0));
          if (na && nb) score = Math.max(score, dot / (na * nb));
        }

        score = Math.max(score, this.similarity(nodeId, node.id));
        return { node, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));

    return scored.slice(0, Math.max(0, limit)).map(item => item.node);
  }

  /** Undirected semantic path for inspection/navigation. */
  findPath(fromId: string, toId: string): SemanticNode[] {
    if (!this.getNode(fromId) || !this.getNode(toId)) return [];
    const queue: string[][] = [[fromId]];
    const visited = new Set<string>([fromId]);
    while (queue.length) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === toId) return path.map(id => this.getNode(id)!).filter(Boolean);
      const neighbours = new Set<string>();
      for (const edge of this.edges) {
        if (edge.source === current) neighbours.add(edge.target);
        if (edge.target === current) neighbours.add(edge.source);
      }
      for (const next of neighbours) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push([...path, next]);
      }
    }
    return [];
  }

  /**
   * Lowest common ancestor for child -> parent `is_a` edges.
   * Previous implementation traversed incoming child edges and therefore inverted the taxonomy.
   */
  lca(id1: string, id2: string): SemanticNode | null {
    if (!this.getNode(id1) || !this.getNode(id2)) return null;
    const distances = (start: string): Map<string, number> => {
      const result = new Map<string, number>([[start, 0]]);
      const queue = [start];
      while (queue.length) {
        const id = queue.shift()!;
        const d = result.get(id)!;
        for (const edge of this.edges.filter(e => e.source === id && edgeRelation(e) === 'is_a')) {
          if (!result.has(edge.target)) {
            result.set(edge.target, d + 1);
            queue.push(edge.target);
          }
        }
      }
      return result;
    };
    const a = distances(id1); const b = distances(id2);
    const shared = [...a.keys()].filter(id => b.has(id));
    if (!shared.length) return null;
    shared.sort((x, y) => (a.get(x)! + b.get(x)!) - (a.get(y)! + b.get(y)!) || x.localeCompare(y));
    return this.getNode(shared[0]) ?? null;
  }

  similarity(id1: string, id2: string): number {
    if (id1 === id2) return 1;
    const ancestor = this.lca(id1, id2);
    if (!ancestor) return 0;
    const distanceToAncestor = (start: string, target: string): number => {
      if (start === target) return 0;
      const queue: Array<{ id: string; distance: number }> = [{ id: start, distance: 0 }];
      const visited = new Set<string>();
      while (queue.length) {
        const { id, distance } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const edge of this.edges.filter(e => e.source === id && edgeRelation(e) === 'is_a')) {
          if (edge.target === target) return distance + 1;
          queue.push({ id: edge.target, distance: distance + 1 });
        }
      }
      return Number.POSITIVE_INFINITY;
    };
    const d1 = distanceToAncestor(id1, ancestor.id);
    const d2 = distanceToAncestor(id2, ancestor.id);
    if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 0;
    return 1 / (1 + d1 + d2);
  }

  toMermaid(): string {
    let m = 'graph TD\n';
    for (const n of this.nodes) m += `    ${n.id}["${n.concept ?? n.name ?? n.id}"]\n`;
    for (const e of this.edges) m += `    ${e.source} -->|"${e.relation}"| ${e.target}\n`;
    return m;
  }

  validate(): string[] {
    const errors: string[] = [];
    const edgeIds = new Set<string>();
    for (const e of this.edges) {
      if (edgeIds.has(e.id)) errors.push(`Duplicate semantic edge ID: ${e.id}`);
      edgeIds.add(e.id);
      if (!this.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!this.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics(): { nodeCount: number; edgeCount: number; avgDegree: number; density: number } {
    const n = this.nodes.length; const e = this.edges.length;
    this.buildAdjacency();
    const deg = this.nodes.map(no => (this.adj.get(no.id)?.length || 0) + (this.adjRev.get(no.id)?.length || 0));
    const avgDegree = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree, density };
  }

  toJSON() { return { nodes: this.nodes, edges: this.edges }; }

  static fromJSON(data: { nodes: SemanticNode[]; edges: SemanticEdge[] }): SemanticGraph {
    const g = new SemanticGraph(); g.nodes = data.nodes; g.edges = data.edges; g.buildAdjacency(); return g;
  }
}