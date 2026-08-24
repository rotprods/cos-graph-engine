import { generateId } from '@cos/core';

export interface BidirectionalCSRNode {
  id: string;
  [key: string]: unknown;
}

export interface BidirectionalCSRCell {
  id?: string;
  source: string;
  target: string;
  type?: string;
  weight?: number;
  [key: string]: unknown;
}

interface CSRProjection {
  indices: string[];
  edgeIds: string[];
  indptr: number[];
}

/**
 * Parallel-edge-safe CSR graph with both forward and reverse projections.
 *
 * Design guarantees:
 * - edge identity is independent from source/target pairs
 * - parallel/typed edges between the same nodes are preserved
 * - reverse-neighbor traversal is O(in-degree), never O(E)
 * - projections are rebuildable from canonical node/edge maps
 * - mutation is validated before canonical state changes
 * - traversal returns unique neighboring node IDs while edge APIs retain
 *   multiplicity
 *
 * This class is the authority-grade successor to the legacy CSRGraph. The
 * legacy API remains available during migration to avoid a destructive cutover.
 */
export class BidirectionalCSRGraph<
  N extends BidirectionalCSRNode = BidirectionalCSRNode,
  E extends BidirectionalCSRCell = BidirectionalCSRCell,
> {
  private readonly nodes = new Map<string, N>();
  private readonly edges = new Map<string, E & { id: string }>();
  private nodeIds: string[] = [];
  private nodeIndex = new Map<string, number>();
  private forward: CSRProjection = { indices: [], edgeIds: [], indptr: [0] };
  private reverse: CSRProjection = { indices: [], edgeIds: [], indptr: [0] };
  private dirty = false;

  addNode(node: N): void {
    const id = node.id.trim();
    if (!id) throw new Error('CSR node id must not be empty');
    if (this.nodes.has(id)) throw new Error(`Duplicate CSR node id '${id}'`);
    this.nodes.set(id, { ...node, id });
    this.nodeIds.push(id);
    this.nodeIndex.set(id, this.nodeIds.length - 1);
    this.dirty = true;
  }

  upsertNode(node: N): void {
    const id = node.id.trim();
    if (!id) throw new Error('CSR node id must not be empty');
    if (!this.nodes.has(id)) {
      this.addNode(node);
      return;
    }
    this.nodes.set(id, { ...node, id });
  }

  getNode(id: string): N | undefined {
    const node = this.nodes.get(id);
    return node ? ({ ...node } as N) : undefined;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  addEdge(source: string, target: string, data?: Omit<Partial<E>, 'source' | 'target'>): string {
    if (!this.nodes.has(source)) throw new Error(`Source node '${source}' does not exist`);
    if (!this.nodes.has(target)) throw new Error(`Target node '${target}' does not exist`);

    const proposedId = typeof data?.id === 'string' ? data.id.trim() : '';
    const id = proposedId || String(generateId());
    if (this.edges.has(id)) throw new Error(`Duplicate CSR edge id '${id}'`);

    const edge = {
      ...(data || {}),
      id,
      source,
      target,
      weight: typeof data?.weight === 'number' ? data.weight : 1,
    } as E & { id: string };

    if (!Number.isFinite(edge.weight)) throw new Error(`Invalid edge weight for '${id}'`);
    this.edges.set(id, edge);
    this.dirty = true;
    return id;
  }

  updateEdge(id: string, updates: Partial<E>): void {
    const current = this.edges.get(id);
    if (!current) throw new Error(`CSR edge '${id}' not found`);

    const source = updates.source ?? current.source;
    const target = updates.target ?? current.target;
    if (!this.nodes.has(source)) throw new Error(`Source node '${source}' does not exist`);
    if (!this.nodes.has(target)) throw new Error(`Target node '${target}' does not exist`);
    if (updates.id && updates.id !== id) throw new Error('CSR edge identity is immutable');

    const next = { ...current, ...updates, id, source, target } as E & { id: string };
    if (!Number.isFinite(next.weight ?? 1)) throw new Error(`Invalid edge weight for '${id}'`);
    this.edges.set(id, next);
    this.dirty = true;
  }

  getEdgeById(id: string): (E & { id: string }) | undefined {
    const edge = this.edges.get(id);
    return edge ? ({ ...edge } as E & { id: string }) : undefined;
  }

  getEdges(source: string, target?: string, type?: string): Array<E & { id: string }> {
    this.ensureProjection();
    const index = this.nodeIndex.get(source);
    if (index === undefined) return [];
    const out: Array<E & { id: string }> = [];
    for (let i = this.forward.indptr[index]; i < this.forward.indptr[index + 1]; i += 1) {
      const edge = this.edges.get(this.forward.edgeIds[i]);
      if (!edge) throw new Error(`CSR invariant violated: missing edge '${this.forward.edgeIds[i]}'`);
      if (target && edge.target !== target) continue;
      if (type && edge.type !== type) continue;
      out.push({ ...edge } as E & { id: string });
    }
    return out;
  }

  hasEdge(source: string, target: string, type?: string): boolean {
    return this.getEdges(source, target, type).length > 0;
  }

  removeEdgeById(id: string): boolean {
    if (!this.edges.delete(id)) return false;
    this.dirty = true;
    return true;
  }

  removeEdges(source: string, target: string, type?: string): number {
    const ids = this.getEdges(source, target, type).map(edge => edge.id);
    for (const id of ids) this.edges.delete(id);
    if (ids.length > 0) this.dirty = true;
    return ids.length;
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;
    const incident = Array.from(this.edges.values())
      .filter(edge => edge.source === id || edge.target === id)
      .map(edge => edge.id);
    for (const edgeId of incident) this.edges.delete(edgeId);
    this.nodes.delete(id);
    this.nodeIds = this.nodeIds.filter(nodeId => nodeId !== id);
    this.rebuildNodeIndex();
    this.dirty = true;
    return true;
  }

  neighbors(id: string): string[] {
    return this.projectedNeighbors(id, this.forward);
  }

  reverseNeighbors(id: string): string[] {
    return this.projectedNeighbors(id, this.reverse);
  }

  outgoingEdgeIds(id: string): string[] {
    return this.projectedEdgeIds(id, this.forward);
  }

  incomingEdgeIds(id: string): string[] {
    return this.projectedEdgeIds(id, this.reverse);
  }

  bfs(source: string, maxDepth = Infinity): Array<{ id: string; depth: number }> {
    if (!this.nodes.has(source)) return [];
    if (maxDepth < 0) throw new Error('maxDepth must be >= 0');

    const queue: Array<{ id: string; depth: number }> = [{ id: source, depth: 0 }];
    let head = 0;
    const visited = new Set<string>([source]);
    const result: Array<{ id: string; depth: number }> = [];

    while (head < queue.length) {
      const current = queue[head++];
      result.push(current);
      if (current.depth >= maxDepth) continue;
      for (const neighbor of this.neighbors(current.id)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push({ id: neighbor, depth: current.depth + 1 });
      }
    }
    return result;
  }

  bidirectionalShortestPath(source: string, target: string, maxDepth = 20): string[] | null {
    if (!this.nodes.has(source) || !this.nodes.has(target)) return null;
    if (source === target) return [source];
    if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error('maxDepth must be a positive integer');

    const forwardParents = new Map<string, string | null>([[source, null]]);
    const backwardParents = new Map<string, string | null>([[target, null]]);
    let forwardFrontier = new Set([source]);
    let backwardFrontier = new Set([target]);

    for (let depth = 0; depth < maxDepth && forwardFrontier.size && backwardFrontier.size; depth += 1) {
      const expandForward = forwardFrontier.size <= backwardFrontier.size;
      const frontier = expandForward ? forwardFrontier : backwardFrontier;
      const nextFrontier = new Set<string>();

      for (const current of frontier) {
        const adjacent = expandForward ? this.neighbors(current) : this.reverseNeighbors(current);
        for (const neighbor of adjacent) {
          const ownParents = expandForward ? forwardParents : backwardParents;
          const otherParents = expandForward ? backwardParents : forwardParents;
          if (ownParents.has(neighbor)) continue;
          ownParents.set(neighbor, current);
          if (otherParents.has(neighbor)) {
            return this.reconstructPath(neighbor, forwardParents, backwardParents);
          }
          nextFrontier.add(neighbor);
        }
      }

      if (expandForward) forwardFrontier = nextFrontier;
      else backwardFrontier = nextFrontier;
    }
    return null;
  }

  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }

  validate(): string[] {
    this.ensureProjection();
    const errors: string[] = [];

    if (this.forward.indptr.length !== this.nodeIds.length + 1) errors.push('forward indptr length mismatch');
    if (this.reverse.indptr.length !== this.nodeIds.length + 1) errors.push('reverse indptr length mismatch');
    if (this.forward.indices.length !== this.edges.size) errors.push('forward edge projection count mismatch');
    if (this.reverse.indices.length !== this.edges.size) errors.push('reverse edge projection count mismatch');

    for (const [id, edge] of this.edges) {
      if (!this.nodes.has(edge.source)) errors.push(`edge '${id}' has dangling source '${edge.source}'`);
      if (!this.nodes.has(edge.target)) errors.push(`edge '${id}' has dangling target '${edge.target}'`);
      if (!this.forward.edgeIds.includes(id)) errors.push(`edge '${id}' missing from forward projection`);
      if (!this.reverse.edgeIds.includes(id)) errors.push(`edge '${id}' missing from reverse projection`);
    }
    return errors;
  }

  toJSON(): { nodes: N[]; edges: Array<E & { id: string }> } {
    return {
      nodes: Array.from(this.nodes.values(), node => ({ ...node } as N)),
      edges: Array.from(this.edges.values(), edge => ({ ...edge } as E & { id: string })),
    };
  }

  static fromJSON<N extends BidirectionalCSRNode, E extends BidirectionalCSRCell>(
    data: { nodes: N[]; edges: Array<E & { id: string }> },
  ): BidirectionalCSRGraph<N, E> {
    const graph = new BidirectionalCSRGraph<N, E>();
    for (const node of data.nodes) graph.addNode(node);
    for (const edge of data.edges) {
      const { source, target, ...rest } = edge;
      graph.addEdge(source, target, rest as Omit<Partial<E>, 'source' | 'target'>);
    }
    return graph;
  }

  private ensureProjection(): void {
    if (!this.dirty) return;
    this.rebuildProjection();
  }

  private rebuildProjection(): void {
    const outgoing = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
    const incoming = new Map<string, Array<{ neighbor: string; edgeId: string }>>();

    for (const [edgeId, edge] of this.edges) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      if (!incoming.has(edge.target)) incoming.set(edge.target, []);
      outgoing.get(edge.source)!.push({ neighbor: edge.target, edgeId });
      incoming.get(edge.target)!.push({ neighbor: edge.source, edgeId });
    }

    // Stable edge-id ordering makes serialization/traversal deterministic for
    // the same canonical edge set regardless of insertion timing.
    for (const list of outgoing.values()) list.sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    for (const list of incoming.values()) list.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

    this.forward = this.buildCSR(outgoing);
    this.reverse = this.buildCSR(incoming);
    this.dirty = false;
  }

  private buildCSR(source: Map<string, Array<{ neighbor: string; edgeId: string }>>): CSRProjection {
    const projection: CSRProjection = { indices: [], edgeIds: [], indptr: [0] };
    for (const nodeId of this.nodeIds) {
      const entries = source.get(nodeId) || [];
      for (const entry of entries) {
        projection.indices.push(entry.neighbor);
        projection.edgeIds.push(entry.edgeId);
      }
      projection.indptr.push(projection.indices.length);
    }
    return projection;
  }

  private projectedNeighbors(id: string, projection: CSRProjection): string[] {
    this.ensureProjection();
    const index = this.nodeIndex.get(id);
    if (index === undefined) return [];
    return Array.from(new Set(projection.indices.slice(projection.indptr[index], projection.indptr[index + 1])));
  }

  private projectedEdgeIds(id: string, projection: CSRProjection): string[] {
    this.ensureProjection();
    const index = this.nodeIndex.get(id);
    if (index === undefined) return [];
    return projection.edgeIds.slice(projection.indptr[index], projection.indptr[index + 1]);
  }

  private rebuildNodeIndex(): void {
    this.nodeIndex.clear();
    this.nodeIds.forEach((id, index) => this.nodeIndex.set(id, index));
  }

  private reconstructPath(
    meeting: string,
    forwardParents: Map<string, string | null>,
    backwardParents: Map<string, string | null>,
  ): string[] {
    const left: string[] = [];
    let cursor: string | null = meeting;
    while (cursor !== null) {
      left.unshift(cursor);
      cursor = forwardParents.get(cursor) ?? null;
    }

    const right: string[] = [];
    cursor = backwardParents.get(meeting) ?? null;
    while (cursor !== null) {
      right.push(cursor);
      cursor = backwardParents.get(cursor) ?? null;
    }
    return [...left, ...right];
  }
}
