// LEVEL 9: SEMANTIC GRAPH
// Taxonomies, hypernyms, LCA, semantic similarity
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

export interface SemanticNode {
  id: string; concept: string; type: 'entity' | 'class' | 'attribute' | 'relation';
  definition?: string; examples?: string[]; embedding?: number[];
}

export interface LegacySemanticNode {
  id: string; name: string; concepts?: string[];
}

export interface SemanticEdge {
  id: string; source: string; target: string;
  relation: 'is_a' | 'has_property' | 'related_to' | 'part_of' | 'opposite_of' | 'causes' | 'requires';
  strength: number;
}

export interface LegacySemanticEdge {
  id: string; source: string; target: string; type: string; weight?: number;
}

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

  addNode(input: SemanticNode | LegacySemanticNode): string {
    const n: SemanticNode = 'concept' in input
      ? input
      : { id: input.id, concept: input.name, type: 'entity', examples: input.concepts };
    if (this.nodes.some(x => x.id === n.id)) throw new Error(`Duplicate semantic node ID: ${n.id}`);
    this.nodes.push(n); this.buildAdjacency(); return n.id;
  }

  removeNode(nodeId: string): void {
    const idx = this.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(input: SemanticEdge | LegacySemanticEdge): void {
    const relationMap: Record<string, SemanticEdge['relation']> = {
      similar: 'related_to', dissimilar: 'opposite_of', is_a: 'is_a',
      has_property: 'has_property', related_to: 'related_to', part_of: 'part_of',
      opposite_of: 'opposite_of', causes: 'causes', requires: 'requires',
    };
    const e: SemanticEdge = 'relation' in input
      ? input
      : {
          id: input.id,
          source: input.source,
          target: input.target,
          relation: relationMap[input.type] ?? 'related_to',
          strength: input.weight ?? 1,
        };
    if (!this.nodes.some(n => n.id === e.source)) throw new Error(`Edge source ${e.source} not found`);
    if (!this.nodes.some(n => n.id === e.target)) throw new Error(`Edge target ${e.target} not found`);
    this.edges.push(e); this.buildAdjacency();
  }

  removeEdge(edgeId: string): void {
    const idx = this.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: string): SemanticNode | undefined { return this.nodes.find(n => n.id === nodeId); }
  getEdge(edgeId: string): SemanticEdge | undefined { return this.edges.find(e => e.id === edgeId); }

  findSimilar(nodeId: string, limit: number = 5): SemanticNode[] {
    if (!this.getNode(nodeId) || limit <= 0) return [];
    return this.nodes
      .filter(n => n.id !== nodeId)
      .map(node => {
        const direct = this.edges
          .filter(e => (e.source === nodeId && e.target === node.id) || (e.target === nodeId && e.source === node.id))
          .reduce((best, e) => Math.max(best, e.strength), 0);
        return { node, score: Math.max(direct, this.similarity(nodeId, node.id)) };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id))
      .slice(0, limit)
      .map(x => x.node);
  }

  findPath(sourceId: string, targetId: string): SemanticNode[] {
    if (!this.getNode(sourceId) || !this.getNode(targetId)) return [];
    const queue: string[][] = [[sourceId]];
    const visited = new Set<string>([sourceId]);
    while (queue.length) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === targetId) return path.map(id => this.getNode(id)!).filter(Boolean);
      const neighbors = this.edges.flatMap(e => e.source === current ? [e.target] : e.target === current ? [e.source] : []);
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
    return [];
  }

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

  private ancestorsWithDistance(start: string): Map<string, number> {
    const distances = new Map<string, number>([[start, 0]]);
    const queue: string[] = [start];
    while (queue.length) {
      const id = queue.shift()!;
      const d = distances.get(id)!;
      for (const edge of this.edges.filter(e => e.source === id && e.relation === 'is_a')) {
        if (!distances.has(edge.target)) {
          distances.set(edge.target, d + 1);
          queue.push(edge.target);
        }
      }
    }
    return distances;
  }

  lca(id1: string, id2: string): SemanticNode | null {
    const a1 = this.ancestorsWithDistance(id1);
    const a2 = this.ancestorsWithDistance(id2);
    const common = [...a1.keys()]
      .filter(id => a2.has(id))
      .sort((x, y) => (a1.get(x)! + a2.get(x)!) - (a1.get(y)! + a2.get(y)!) || x.localeCompare(y));
    return common.length ? this.getNode(common[0]) ?? null : null;
  }

  similarity(id1: string, id2: string): number {
    if (id1 === id2) return this.getNode(id1) ? 1 : 0;
    const ancestor = this.lca(id1, id2);
    if (!ancestor) return 0;
    const a1 = this.ancestorsWithDistance(id1);
    const a2 = this.ancestorsWithDistance(id2);
    const d1 = a1.get(ancestor.id);
    const d2 = a2.get(ancestor.id);
    if (d1 === undefined || d2 === undefined) return 0;
    return 1 / (1 + d1 + d2);
  }

  toMermaid(): string {
    let m = 'graph TD\n';
    for (const n of this.nodes) m += `    ${n.id}["${n.concept}"]\n`;
    for (const e of this.edges) m += `    ${e.source} -->|"${e.relation}"| ${e.target}\n`;
    return m;
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const e of this.edges) {
      if (!this.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!this.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics(): { nodeCount: number; edgeCount: number; avgDegree: number; density: number } {
    const n = this.nodes.length; const e = this.edges.length;
    this.buildAdjacency();
    const deg = this.nodes.map(no => (this.adj.get(no.id)?.length || 0) + (this.adjRev.get(no.id)?.length || 0));
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
  }

  toJSON() { return { nodes: this.nodes, edges: this.edges }; }

  static fromJSON(data: { nodes: SemanticNode[]; edges: SemanticEdge[] }): SemanticGraph {
    const g = new SemanticGraph(); g.nodes = data.nodes; g.edges = data.edges; g.buildAdjacency(); return g;
  }
}