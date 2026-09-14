// LEVEL 10: EMBEDDING GRAPH
// Vector space, KNN, epsilon graphs, K-means clustering
// Refactored: mutation API, adjacency maps, serialization, validation

import { generateId } from '@cos/core';

export interface EmbeddingNode {
  id: string;
  label: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  clusterId?: number;
  /** Backward-compatible aliases retained for historical callers. */
  source?: string;
  embedding?: number[];
}

export interface LegacyEmbeddingNode {
  id: string;
  source: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  clusterId?: number;
  label?: string;
  vector?: number[];
}

export interface EmbeddingEdge {
  id: string;
  source: string;
  target: string;
  similarity: number;
  distance: number;
  /** Historical API alias. */
  type?: string;
}

export interface LegacyEmbeddingEdge {
  id: string;
  source: string;
  target: string;
  similarity: number;
  type?: string;
  distance?: number;
}

function normalizeNode(input: EmbeddingNode | LegacyEmbeddingNode): EmbeddingNode {
  const rawVector = input.vector ?? input.embedding;
  if (!rawVector || rawVector.length === 0) {
    throw new Error(`Embedding node ${input.id} has an empty vector`);
  }
  const vector = [...rawVector];
  const label = input.label ?? input.source ?? input.id;
  return {
    id: input.id,
    label,
    vector,
    source: input.source ?? label,
    embedding: [...vector],
    metadata: input.metadata,
    clusterId: input.clusterId,
  };
}

export class EmbeddingGraph {
  nodes: EmbeddingNode[] = [];
  edges: EmbeddingEdge[] = [];
  private adj: Map<string, string[]> = new Map();

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.nodes) this.adj.set(n.id, []);
    for (const e of this.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adj.has(e.target)) this.adj.get(e.target)!.push(e.source);
    }
  }

  addNode(n: EmbeddingNode | LegacyEmbeddingNode): string {
    if (this.nodes.some(x => x.id === n.id)) throw new Error(`Duplicate embedding node ID: ${n.id}`);
    const normalized = normalizeNode(n);
    this.nodes.push(normalized);
    this.buildAdjacency();
    return normalized.id;
  }

  removeNode(nodeId: string): void {
    const idx = this.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.nodes.splice(idx, 1);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(e: EmbeddingEdge | LegacyEmbeddingEdge): void {
    if (!this.nodes.some(n => n.id === e.source)) throw new Error(`Edge source ${e.source} not found`);
    if (!this.nodes.some(n => n.id === e.target)) throw new Error(`Edge target ${e.target} not found`);
    if (this.edges.some(existing => existing.id === e.id)) throw new Error(`Duplicate embedding edge ID: ${e.id}`);

    const source = this.getNode(e.source)!;
    const target = this.getNode(e.target)!;
    const distance = e.distance ?? EmbeddingGraph.distance(source.vector, target.vector);
    this.edges.push({ ...e, distance });
    this.buildAdjacency();
  }

  removeEdge(edgeId: string): void {
    const idx = this.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.edges.splice(idx, 1);
    this.buildAdjacency();
  }

  getNode(nodeId: string): EmbeddingNode | undefined { return this.nodes.find(n => n.id === nodeId); }

  static distance(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < dim; i++) sum += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
    return Math.sqrt(sum);
  }

  static cosine(a: number[], b: number[]): number {
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

  buildKNN(k: number = 3): void {
    this.edges = [];
    if (this.nodes.length <= 1 || k <= 0) {
      this.buildAdjacency();
      return;
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const dists = this.nodes
        .map((node, j) => ({ idx: j, dist: EmbeddingGraph.distance(this.nodes[i].vector, node.vector) }))
        .filter(item => item.idx !== i)
        .sort((a, b) => a.dist - b.dist || this.nodes[a.idx].id.localeCompare(this.nodes[b.idx].id));

      for (let j = 0; j < Math.min(k, dists.length); j++) {
        const target = this.nodes[dists[j].idx];
        this.edges.push({
          id: generateId(),
          source: this.nodes[i].id,
          target: target.id,
          type: 'similar',
          similarity: 1 / (1 + dists[j].dist),
          distance: dists[j].dist,
        });
      }
    }
    this.buildAdjacency();
  }

  buildEpsilon(epsilon: number = 0.5): void {
    this.edges = [];
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dist = EmbeddingGraph.distance(this.nodes[i].vector, this.nodes[j].vector);
        if (dist < epsilon) {
          this.edges.push({
            id: generateId(),
            source: this.nodes[i].id,
            target: this.nodes[j].id,
            type: 'similar',
            similarity: 1 / (1 + dist),
            distance: dist,
          });
        }
      }
    }
    this.buildAdjacency();
  }

  cluster(k: number = 3, seed?: number): Map<number, EmbeddingNode[]> {
    if (this.nodes.length === 0) return new Map();
    const n = this.nodes.length;
    const effectiveK = Math.max(1, Math.min(k, n));
    const dim = this.nodes[0].vector.length;

    const startIndex = Math.abs(seed ?? 0) % n;
    let centroids: number[][] = [this.nodes[startIndex].vector.slice()];

    while (centroids.length < effectiveK) {
      let bestIndex = 0;
      let bestDistance = -1;
      for (let i = 0; i < n; i++) {
        const distance = Math.min(...centroids.map(c => EmbeddingGraph.distance(this.nodes[i].vector, c)));
        if (distance > bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      centroids.push(this.nodes[bestIndex].vector.slice());
    }

    let assignments = new Array<number>(n).fill(-1);
    for (let iter = 0; iter < 50; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestK = 0;
        for (let c = 0; c < centroids.length; c++) {
          const d = EmbeddingGraph.distance(this.nodes[i].vector, centroids[c]);
          if (d < minDist) { minDist = d; bestK = c; }
        }
        if (assignments[i] !== bestK) { assignments[i] = bestK; changed = true; }
      }
      if (!changed) break;

      const nextCentroids = Array.from({ length: effectiveK }, () => new Array<number>(dim).fill(0));
      const counts = new Array<number>(effectiveK).fill(0);
      for (let i = 0; i < n; i++) {
        const clusterId = assignments[i];
        for (let d = 0; d < dim; d++) nextCentroids[clusterId][d] += this.nodes[i].vector[d] ?? 0;
        counts[clusterId]++;
      }
      for (let c = 0; c < effectiveK; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) nextCentroids[c][d] /= counts[c];
          centroids[c] = nextCentroids[c];
        }
      }
    }

    const result = new Map<number, EmbeddingNode[]>();
    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i] < 0 ? 0 : assignments[i];
      this.nodes[i].clusterId = clusterId;
      if (!result.has(clusterId)) result.set(clusterId, []);
      result.get(clusterId)!.push(this.nodes[i]);
    }
    return result;
  }

  buildAIModelGraph(): void {
    this.nodes = [];
    this.edges = [];
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
    for (const e of this.edges) m += `    ${e.source} -.->|"${e.similarity.toFixed(2)}"| ${e.target}\n`;
    return m;
  }

  validate(): string[] {
    const errors: string[] = [];
    const edgeIds = new Set<string>();
    for (const node of this.nodes) {
      if (!Array.isArray(node.vector) || node.vector.length === 0) errors.push(`Embedding node ${node.id} has invalid vector`);
    }
    for (const e of this.edges) {
      if (edgeIds.has(e.id)) errors.push(`Duplicate embedding edge ID: ${e.id}`);
      edgeIds.add(e.id);
      if (!this.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!this.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics(): { nodeCount: number; edgeCount: number; avgDegree: number; density: number } {
    const n = this.nodes.length;
    const e = this.edges.length;
    this.buildAdjacency();
    const deg = this.nodes.map(no => this.adj.get(no.id)?.length || 0);
    const avgDegree = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree, density };
  }

  toJSON(): { nodes: EmbeddingNode[]; edges: EmbeddingEdge[] } {
    return {
      nodes: this.nodes.map(node => ({ ...node, vector: [...node.vector], embedding: node.embedding ? [...node.embedding] : undefined })),
      edges: this.edges.map(edge => ({ ...edge })),
    };
  }

  static fromJSON(data: { nodes: Array<EmbeddingNode | LegacyEmbeddingNode>; edges: Array<EmbeddingEdge | LegacyEmbeddingEdge> }): EmbeddingGraph {
    const g = new EmbeddingGraph();
    for (const node of data.nodes) g.addNode(node);
    for (const edge of data.edges) g.addEdge(edge);
    return g;
  }
}
