// LEVEL 10: EMBEDDING GRAPH
// Vector space, KNN, epsilon graphs, K-means clustering
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

export interface EmbeddingNode {
  id: string; label: string; vector: number[];
  metadata?: Record<string, unknown>; clusterId?: number;
}

export interface EmbeddingEdge {
  id: string; source: string; target: string; similarity: number; distance: number;
}

export class EmbeddingGraph {
  nodes: EmbeddingNode[] = []; edges: EmbeddingEdge[] = [];
  private adj: Map<string, string[]> = new Map();

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.nodes) this.adj.set(n.id, []);
    for (const e of this.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adj.has(e.target)) this.adj.get(e.target)!.push(e.source);
    }
  }

  addNode(n: EmbeddingNode): string {
    if (this.nodes.some(x => x.id === n.id)) throw new Error(`Duplicate embedding node ID: ${n.id}`);
    this.nodes.push(n); this.buildAdjacency(); return n.id;
  }

  removeNode(nodeId: string): void {
    const idx = this.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(e: EmbeddingEdge): void {
    if (!this.nodes.some(n => n.id === e.source)) throw new Error(`Edge source ${e.source} not found`);
    if (!this.nodes.some(n => n.id === e.target)) throw new Error(`Edge target ${e.target} not found`);
    this.edges.push(e); this.buildAdjacency();
  }

  removeEdge(edgeId: string): void {
    const idx = this.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: string): EmbeddingNode | undefined { return this.nodes.find(n => n.id === nodeId); }

  static distance(a: number[], b: number[]): number {
    if (!a || !a.length || !b || !b.length) return Infinity;
    return Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] || 0)) ** 2, 0));
  }

  static cosine(a: number[], b: number[]): number {
    if (!a || !a.length || !b || !b.length) return 0;
    const dot = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
    const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return na * nb > 0 ? dot / (na * nb) : 0;
  }

  buildKNN(k: number = 3): void {
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].vector || !this.nodes[i].vector.length) continue;
      const dists = this.nodes.map((n, j) => ({ idx: j, dist: EmbeddingGraph.distance(this.nodes[i].vector, n.vector) }));
      dists.sort((a, b) => a.dist - b.dist);
      for (let j = 1; j <= Math.min(k, dists.length - 1); j++) {
        const target = this.nodes[dists[j].idx];
        this.edges.push({ id: generateId(), source: this.nodes[i].id, target: target.id, similarity: 1 / (1 + dists[j].dist), distance: dists[j].dist });
      }
    }
    this.buildAdjacency();
  }

  buildEpsilon(epsilon: number = 0.5): void {
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].vector || !this.nodes[i].vector.length) continue;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dist = EmbeddingGraph.distance(this.nodes[i].vector, this.nodes[j].vector);
        if (dist < epsilon) {
          this.edges.push({ id: generateId(), source: this.nodes[i].id, target: this.nodes[j].id, similarity: 1 / (1 + dist), distance: dist });
        }
      }
    }
    this.buildAdjacency();
  }

  cluster(k: number = 3, seed?: number): Map<number, EmbeddingNode[]> {
    const vecNodes = this.nodes.filter(n => n.vector && n.vector.length);
    if (vecNodes.length === 0) return new Map();
    const n = vecNodes.length;
    const dim = vecNodes[0].vector.length;
    let centroids: number[][];
    centroids = [vecNodes[Math.floor((seed || Date.now()) % n)].vector.slice()];
    for (let c = 1; c < k; c++) {
      const dists = vecNodes.map(nv => Math.min(...centroids.map(cent => EmbeddingGraph.distance(nv.vector, cent))));
      const totalDist = dists.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalDist;
      for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { centroids.push(vecNodes[i].vector.slice()); break; } }
    }
    let assignments = new Array(n).fill(0);
    for (let iter = 0; iter < 50; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let minDist = Infinity; let bestK = 0;
        for (let c = 0; c < centroids.length; c++) {
          const d = EmbeddingGraph.distance(vecNodes[i].vector, centroids[c]);
          if (d < minDist) { minDist = d; bestK = c; }
        }
        if (assignments[i] !== bestK) { assignments[i] = bestK; changed = true; }
      }
      if (!changed) break;
      centroids = centroids.map(() => new Array(dim).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < n; i++) {
        for (let d = 0; d < dim; d++) centroids[assignments[i]][d] += vecNodes[i].vector[d];
        counts[assignments[i]]++;
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) for (let d = 0; d < dim; d++) centroids[c][d] /= counts[c];
      }
    }
    const result = new Map<number, EmbeddingNode[]>();
    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i];
      vecNodes[i].clusterId = clusterId;
      if (!result.has(clusterId)) result.set(clusterId, []);
      result.get(clusterId)!.push(vecNodes[i]);
    }
    return result;
  }

  buildAIModelGraph() {
    this.nodes = [];
    this.addNode({ id: 'gpt4', label: 'GPT-4', vector: [0.9, 0.85, 0.95, 0.8, 0.9] });
    this.addNode({ id: 'gpt35', label: 'GPT-3.5', vector: [0.7, 0.65, 0.75, 0.6, 0.7] });
    this.addNode({ id: 'claude3', label: 'Claude 3', vector: [0.85, 0.9, 0.8, 0.85, 0.88] });
    this.addNode({ id: 'gemini', label: 'Gemini', vector: [0.8, 0.75, 0.85, 0.9, 0.85] });
    this.addNode({ id: 'llama3', label: 'Llama 3', vector: [0.75, 0.7, 0.8, 0.7, 0.75] });
    this.addNode({ id: 'mistral', label: 'Mistral', vector: [0.7, 0.8, 0.7, 0.75, 0.7] });
    this.buildKNN(2);
  }

  toMermaid(): string {
    let m = 'graph LR\n';
    for (const n of this.nodes) {
      const cid = n.clusterId !== undefined ? ` [C${n.clusterId}]` : '';
      m += `    ${n.id}["${n.label}${cid}"]\n`;
    }
    for (const e of this.edges) {
      m += `    ${e.source} -.->|"${e.similarity.toFixed(2)}"| ${e.target}\n`;
    }
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
    const deg = this.nodes.map(no => this.adj.get(no.id)?.length || 0);
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
  }

  toJSON() { return { nodes: this.nodes, edges: this.edges }; }

  static fromJSON(data: { nodes: EmbeddingNode[]; edges: EmbeddingEdge[] }): EmbeddingGraph {
    const g = new EmbeddingGraph(); g.nodes = data.nodes; g.edges = data.edges; g.buildAdjacency(); return g;
  }
}