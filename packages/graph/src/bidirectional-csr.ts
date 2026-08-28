import { canonicalHash128, canonicalSerialize } from '@cos/core';

export interface BidirectionalCSRNode {
  id: string;
  [key: string]: unknown;
}

export interface BidirectionalCSRCell {
  id?: string;
  source: string;
  target: string;
  type?: string;
  identityKey?: string;
  weight?: number;
  [key: string]: unknown;
}

interface CSRProjection {
  indices: string[];
  edgeIds: string[];
  indptr: number[];
}

/**
 * Canonical authority CSR candidate.
 *
 * Guarantees:
 * - parallel edges are preserved through stable edge identity/identityKey;
 * - default edge IDs are deterministic, never random;
 * - both forward and reverse CSR projections are materialized;
 * - reverse traversal is O(in-degree);
 * - canonical node/edge values are strict JSON-like and copy-safe;
 * - projection ordering/hash is deterministic across insertion order;
 * - hot BFS uses a cursor rather than queue.shift();
 * - validate() checks projection cardinality, offsets, node index and endpoints.
 *
 * Legacy `CSRGraph` remains a separate compatibility surface.
 */
export class BidirectionalCSRGraph<
  N extends BidirectionalCSRNode = BidirectionalCSRNode,
  E extends BidirectionalCSRCell = BidirectionalCSRCell,
> {
  private readonly nodes = new Map<string, N>();
  private readonly edges = new Map<string, E & { id: string; identityKey: string; weight: number }>();
  private nodeIds: string[] = [];
  private nodeIndex = new Map<string, number>();
  private forward: CSRProjection = { indices: [], edgeIds: [], indptr: [0] };
  private reverse: CSRProjection = { indices: [], edgeIds: [], indptr: [0] };
  private dirty = false;

  addNode(node: N): void {
    const stored = canonicalNode(node);
    if (this.nodes.has(stored.id)) throw new Error(`Duplicate CSR node id '${stored.id}'`);
    this.nodes.set(stored.id, stored);
    this.dirty = true;
  }

  upsertNode(node: N): void {
    const stored = canonicalNode(node);
    this.nodes.set(stored.id, stored);
    this.dirty = true;
  }

  getNode(id: string): N | undefined {
    const node = this.nodes.get(normalizeId(id, 'node id'));
    return node ? clone(node) : undefined;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(normalizeId(id, 'node id'));
  }

  addEdge(source: string, target: string, data: Omit<Partial<E>, 'source' | 'target'> = {}): string {
    const sourceId = normalizeId(source, 'source node id');
    const targetId = normalizeId(target, 'target node id');
    if (!this.nodes.has(sourceId)) throw new Error(`Source node '${sourceId}' does not exist`);
    if (!this.nodes.has(targetId)) throw new Error(`Target node '${targetId}' does not exist`);

    const detached = clone(data);
    const type = normalizeOptional(detached.type, 'edge type');
    const identityKey = normalizeOptional(detached.identityKey, 'edge identityKey') ?? 'default';
    const proposedId = typeof detached.id === 'string' ? normalizeId(detached.id, 'edge id') : '';
    const id = proposedId || deterministicEdgeId(sourceId, targetId, type, identityKey);
    if (this.edges.has(id)) {
      throw new Error(
        `Duplicate CSR edge id '${id}'. Use a distinct identityKey for intentional parallel edges.`,
      );
    }

    const weight = detached.weight === undefined ? 1 : detached.weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight)) throw new Error(`Invalid edge weight for '${id}'`);

    const edge = {
      ...detached,
      id,
      source: sourceId,
      target: targetId,
      identityKey,
      weight,
    } as E & { id: string; identityKey: string; weight: number };
    if (type === undefined) delete (edge as { type?: string }).type;
    else edge.type = type;
    canonicalSerialize(edge);

    this.edges.set(id, clone(edge));
    this.dirty = true;
    return id;
  }

  updateEdge(id: string, updates: Partial<E>): void {
    const edgeId = normalizeId(id, 'edge id');
    const current = this.edges.get(edgeId);
    if (!current) throw new Error(`CSR edge '${edgeId}' not found`);

    const detached = clone(updates);
    if (detached.id !== undefined && normalizeId(String(detached.id), 'edge id') !== edgeId) {
      throw new Error('CSR edge identity is immutable');
    }

    const source = detached.source === undefined ? current.source : normalizeId(detached.source, 'source node id');
    const target = detached.target === undefined ? current.target : normalizeId(detached.target, 'target node id');
    const type = Object.prototype.hasOwnProperty.call(detached, 'type')
      ? normalizeOptional(detached.type, 'edge type')
      : current.type;
    const identityKey = Object.prototype.hasOwnProperty.call(detached, 'identityKey')
      ? normalizeOptional(detached.identityKey, 'edge identityKey') ?? 'default'
      : current.identityKey;

    if (!this.nodes.has(source)) throw new Error(`Source node '${source}' does not exist`);
    if (!this.nodes.has(target)) throw new Error(`Target node '${target}' does not exist`);

    // If this edge uses the deterministic authority ID, its identity-bearing
    // fields are immutable. Topology replacement is remove + add with a new ID.
    if (current.id === deterministicEdgeId(current.source, current.target, current.type, current.identityKey)) {
      if (source !== current.source || target !== current.target || type !== current.type || identityKey !== current.identityKey) {
        throw new Error(`CSR_DETERMINISTIC_IDENTITY_IMMUTABLE edge=${edgeId}`);
      }
    }

    const weight = detached.weight === undefined ? current.weight : detached.weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight)) throw new Error(`Invalid edge weight for '${edgeId}'`);

    const next = {
      ...current,
      ...detached,
      id: edgeId,
      source,
      target,
      identityKey,
      weight,
    } as E & { id: string; identityKey: string; weight: number };
    if (type === undefined) delete (next as { type?: string }).type;
    else next.type = type;
    canonicalSerialize(next);

    this.edges.set(edgeId, clone(next));
    this.dirty = true;
  }

  getEdgeById(id: string): (E & { id: string; identityKey: string; weight: number }) | undefined {
    const edge = this.edges.get(normalizeId(id, 'edge id'));
    return edge ? clone(edge) : undefined;
  }

  getEdges(source: string, target?: string, type?: string): Array<E & { id: string; identityKey: string; weight: number }> {
    this.ensureProjection();
    const sourceId = normalizeId(source, 'source node id');
    const targetId = target === undefined ? undefined : normalizeId(target, 'target node id');
    const normalizedType = type === undefined ? undefined : normalizeOptional(type, 'edge type');
    const index = this.nodeIndex.get(sourceId);
    if (index === undefined) return [];

    const out: Array<E & { id: string; identityKey: string; weight: number }> = [];
    for (let offset = this.forward.indptr[index]; offset < this.forward.indptr[index + 1]; offset += 1) {
      const edgeId = this.forward.edgeIds[offset];
      const edge = this.edges.get(edgeId);
      if (!edge) throw new Error(`CSR invariant violated: missing edge '${edgeId}'`);
      if (targetId !== undefined && edge.target !== targetId) continue;
      if (normalizedType !== undefined && edge.type !== normalizedType) continue;
      out.push(clone(edge));
    }
    return out;
  }

  hasEdge(source: string, target: string, type?: string): boolean {
    return this.getEdges(source, target, type).length > 0;
  }

  removeEdgeById(id: string): boolean {
    const removed = this.edges.delete(normalizeId(id, 'edge id'));
    if (removed) this.dirty = true;
    return removed;
  }

  removeEdges(source: string, target: string, type?: string): number {
    const ids = this.getEdges(source, target, type).map(edge => edge.id);
    for (const id of ids) this.edges.delete(id);
    if (ids.length) this.dirty = true;
    return ids.length;
  }

  removeNode(id: string): boolean {
    const nodeId = normalizeId(id, 'node id');
    if (!this.nodes.has(nodeId)) return false;
    const incident = Array.from(this.edges.values())
      .filter(edge => edge.source === nodeId || edge.target === nodeId)
      .map(edge => edge.id);
    for (const edgeId of incident) this.edges.delete(edgeId);
    this.nodes.delete(nodeId);
    this.dirty = true;
    return true;
  }

  neighbors(id: string): string[] {
    return this.projectedNeighbors(normalizeId(id, 'node id'), this.forward);
  }

  reverseNeighbors(id: string): string[] {
    return this.projectedNeighbors(normalizeId(id, 'node id'), this.reverse);
  }

  outgoingEdgeIds(id: string): string[] {
    return this.projectedEdgeIds(normalizeId(id, 'node id'), this.forward);
  }

  incomingEdgeIds(id: string): string[] {
    return this.projectedEdgeIds(normalizeId(id, 'node id'), this.reverse);
  }

  bfs(source: string, maxDepth: number = Number.POSITIVE_INFINITY): Array<{ id: string; depth: number }> {
    const sourceId = normalizeId(source, 'source node id');
    if (!this.nodes.has(sourceId)) return [];
    assertDepth(maxDepth, true, 'maxDepth');

    const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];
    let head = 0;
    const visited = new Set<string>([sourceId]);
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
    const sourceId = normalizeId(source, 'source node id');
    const targetId = normalizeId(target, 'target node id');
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) return null;
    if (sourceId === targetId) return [sourceId];
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 1) throw new Error('maxDepth must be a positive safe integer');

    const forwardParents = new Map<string, string | null>([[sourceId, null]]);
    const backwardParents = new Map<string, string | null>([[targetId, null]]);
    let forwardFrontier = new Set([sourceId]);
    let backwardFrontier = new Set([targetId]);

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
          if (otherParents.has(neighbor)) return this.reconstructPath(neighbor, forwardParents, backwardParents);
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

  projectionHash(): string {
    return canonicalHash128(this.toJSON());
  }

  validate(): string[] {
    this.ensureProjection();
    const errors: string[] = [];

    if (this.nodeIds.length !== this.nodes.size) errors.push('nodeIds count mismatch');
    if (this.nodeIds.join('\u0000') !== [...this.nodeIds].sort().join('\u0000')) errors.push('nodeIds are not deterministically sorted');
    if (this.nodeIndex.size !== this.nodes.size) errors.push('nodeIndex size mismatch');
    this.nodeIds.forEach((id, index) => {
      if (this.nodeIndex.get(id) !== index) errors.push(`nodeIndex mismatch for '${id}'`);
    });

    validateProjectionStructure(this.forward, this.nodeIds.length, this.edges.size, 'forward', errors);
    validateProjectionStructure(this.reverse, this.nodeIds.length, this.edges.size, 'reverse', errors);

    const forwardCounts = new Map<string, number>();
    const reverseCounts = new Map<string, number>();
    for (let nodeOffset = 0; nodeOffset < this.nodeIds.length; nodeOffset += 1) {
      const nodeId = this.nodeIds[nodeOffset];
      for (let offset = this.forward.indptr[nodeOffset]; offset < this.forward.indptr[nodeOffset + 1]; offset += 1) {
        const edgeId = this.forward.edgeIds[offset];
        const edge = this.edges.get(edgeId);
        forwardCounts.set(edgeId, (forwardCounts.get(edgeId) ?? 0) + 1);
        if (!edge) { errors.push(`forward projection references missing edge '${edgeId}'`); continue; }
        if (edge.source !== nodeId || edge.target !== this.forward.indices[offset]) {
          errors.push(`forward projection endpoint mismatch for '${edgeId}'`);
        }
      }
      for (let offset = this.reverse.indptr[nodeOffset]; offset < this.reverse.indptr[nodeOffset + 1]; offset += 1) {
        const edgeId = this.reverse.edgeIds[offset];
        const edge = this.edges.get(edgeId);
        reverseCounts.set(edgeId, (reverseCounts.get(edgeId) ?? 0) + 1);
        if (!edge) { errors.push(`reverse projection references missing edge '${edgeId}'`); continue; }
        if (edge.target !== nodeId || edge.source !== this.reverse.indices[offset]) {
          errors.push(`reverse projection endpoint mismatch for '${edgeId}'`);
        }
      }
    }

    for (const [id, edge] of this.edges) {
      if (!this.nodes.has(edge.source)) errors.push(`edge '${id}' has dangling source '${edge.source}'`);
      if (!this.nodes.has(edge.target)) errors.push(`edge '${id}' has dangling target '${edge.target}'`);
      if (forwardCounts.get(id) !== 1) errors.push(`edge '${id}' forward projection count=${forwardCounts.get(id) ?? 0}`);
      if (reverseCounts.get(id) !== 1) errors.push(`edge '${id}' reverse projection count=${reverseCounts.get(id) ?? 0}`);
      try { canonicalSerialize(edge); } catch (error) { errors.push(`edge '${id}' is non-canonical: ${message(error)}`); }
    }
    for (const [id, node] of this.nodes) {
      try { canonicalSerialize(node); } catch (error) { errors.push(`node '${id}' is non-canonical: ${message(error)}`); }
    }
    return errors.sort();
  }

  toJSON(): { nodes: N[]; edges: Array<E & { id: string; identityKey: string; weight: number }> } {
    return {
      nodes: Array.from(this.nodes.values(), clone).sort((a, b) => a.id.localeCompare(b.id)),
      edges: Array.from(this.edges.values(), clone).sort((a, b) => a.id.localeCompare(b.id)),
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
    if (this.dirty) this.rebuildProjection();
  }

  private rebuildProjection(): void {
    this.nodeIds = Array.from(this.nodes.keys()).sort();
    this.rebuildNodeIndex();

    const outgoing = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
    const incoming = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
    for (const [edgeId, edge] of this.edges) {
      if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
      if (!incoming.has(edge.target)) incoming.set(edge.target, []);
      outgoing.get(edge.source)!.push({ neighbor: edge.target, edgeId });
      incoming.get(edge.target)!.push({ neighbor: edge.source, edgeId });
    }
    for (const list of outgoing.values()) list.sort(compareProjectionEntry);
    for (const list of incoming.values()) list.sort(compareProjectionEntry);

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

function canonicalNode<N extends BidirectionalCSRNode>(node: N): N {
  const stored = clone(node);
  stored.id = normalizeId(stored.id, 'node id');
  canonicalSerialize(stored);
  return stored;
}

function deterministicEdgeId(source: string, target: string, type: string | undefined, identityKey: string): string {
  return `csr_${canonicalHash128({ source, target, type: type ?? null, identityKey })}`;
}

function normalizeId(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function normalizeOptional(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const normalized = value.normalize('NFC').trim();
  return normalized || undefined;
}

function clone<T>(value: T): T {
  try { return structuredClone(value); }
  catch (error) { throw new Error(`CSR value must be structured-cloneable: ${message(error)}`); }
}

function assertDepth(value: number, allowInfinity: boolean, label: string): void {
  if (allowInfinity && value === Number.POSITIVE_INFINITY) return;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer${allowInfinity ? ' or Infinity' : ''}`);
}

function compareProjectionEntry(
  left: { neighbor: string; edgeId: string },
  right: { neighbor: string; edgeId: string },
): number {
  return left.edgeId.localeCompare(right.edgeId) || left.neighbor.localeCompare(right.neighbor);
}

function validateProjectionStructure(
  projection: CSRProjection,
  nodeCount: number,
  edgeCount: number,
  label: string,
  errors: string[],
): void {
  if (projection.indptr.length !== nodeCount + 1) errors.push(`${label} indptr length mismatch`);
  if (projection.indices.length !== edgeCount) errors.push(`${label} indices count mismatch`);
  if (projection.edgeIds.length !== edgeCount) errors.push(`${label} edgeIds count mismatch`);
  if (projection.indptr[0] !== 0) errors.push(`${label} indptr must start at 0`);
  if (projection.indptr.at(-1) !== edgeCount) errors.push(`${label} indptr must end at edge count`);
  for (let index = 1; index < projection.indptr.length; index += 1) {
    if (projection.indptr[index] < projection.indptr[index - 1]) errors.push(`${label} indptr is not monotonic at ${index}`);
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
