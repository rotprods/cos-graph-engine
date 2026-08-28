import {
  GraphNode, GraphEdge, GraphQuery, GraphPath, GraphStats,
  IPropertyGraph, EntityId,
} from '@cos/core';
import { generateId } from '@cos/core';

/**
 * In-memory property graph with transaction-like mutation semantics.
 *
 * Canonical objects are detached on write and read. Secondary indices are
 * maintained as part of the same logical mutation, and traversal obeys edge
 * direction, exact hop depth and path node/edge consistency.
 */
export class PropertyGraph implements IPropertyGraph {
  private nodes: Map<EntityId, GraphNode> = new Map();
  private edges: Map<EntityId, GraphEdge> = new Map();
  private outEdges: Map<EntityId, Set<EntityId>> = new Map();
  private inEdges: Map<EntityId, Set<EntityId>> = new Map();
  private typeNodeIndex: Map<string, Set<EntityId>> = new Map();
  private typeEdgeIndex: Map<string, Set<EntityId>> = new Map();
  private tagNodeIndex: Map<string, Set<EntityId>> = new Map();

  // ---- Index helpers -----------------------------------------------------

  private addToIndex(index: Map<string, Set<EntityId>>, key: string, id: EntityId): void {
    let bucket = index.get(key);
    if (!bucket) {
      bucket = new Set<EntityId>();
      index.set(key, bucket);
    }
    bucket.add(id);
  }

  private removeFromIndex(index: Map<string, Set<EntityId>>, key: string, id: EntityId): void {
    const bucket = index.get(key);
    if (!bucket) return;
    bucket.delete(id);
    if (bucket.size === 0) index.delete(key);
  }

  private indexNode(node: GraphNode): void {
    this.addToIndex(this.typeNodeIndex, node.type, node.id);
    for (const tag of node.tags || []) this.addToIndex(this.tagNodeIndex, tag, node.id);
  }

  private unindexNode(node: GraphNode): void {
    this.removeFromIndex(this.typeNodeIndex, node.type, node.id);
    for (const tag of node.tags || []) this.removeFromIndex(this.tagNodeIndex, tag, node.id);
  }

  private indexEdge(edge: GraphEdge): void {
    this.addToIndex(this.outEdges, edge.source, edge.id);
    this.addToIndex(this.inEdges, edge.target, edge.id);
    this.addToIndex(this.typeEdgeIndex, edge.type, edge.id);
  }

  private unindexEdge(edge: GraphEdge): void {
    this.removeFromIndex(this.outEdges, edge.source, edge.id);
    this.removeFromIndex(this.inEdges, edge.target, edge.id);
    this.removeFromIndex(this.typeEdgeIndex, edge.type, edge.id);
  }

  private assertNodeExists(id: EntityId, role: 'source' | 'target'): void {
    if (!this.nodes.has(id)) {
      throw new Error(`${role === 'source' ? 'Source' : 'Target'} node ${id} not found`);
    }
  }

  // ---- Node Operations --------------------------------------------------

  async addNode(node: GraphNode): Promise<EntityId> {
    const id = node.id || generateId();
    if (this.nodes.has(id)) {
      throw new Error(`Node ${id} already exists; use updateNode for mutations`);
    }

    const now = new Date().toISOString();
    const stored = detachNode({
      ...node,
      id,
      createdAt: node.createdAt || now,
      updatedAt: now,
      version: node.version || { major: 1, minor: 0, patch: 0 },
    });

    this.nodes.set(id, stored);
    this.indexNode(stored);
    return id;
  }

  async getNode(id: EntityId): Promise<GraphNode | null> {
    const node = this.nodes.get(id);
    return node ? detachNode(node) : null;
  }

  async updateNode(id: EntityId, updates: Partial<GraphNode>): Promise<void> {
    const current = this.nodes.get(id);
    if (!current) throw new Error(`Node ${id} not found`);
    if (updates.id !== undefined && updates.id !== id) {
      throw new Error(`Node identity is immutable: ${id} cannot become ${updates.id}`);
    }

    const next = detachNode({
      ...current,
      ...detachPartial(updates, 'GraphNode update'),
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      version: {
        ...current.version,
        patch: current.version.patch + 1,
      },
    } as GraphNode);

    this.unindexNode(current);
    try {
      this.nodes.set(id, next);
      this.indexNode(next);
    } catch (error) {
      this.nodes.set(id, current);
      this.unindexNode(next);
      this.indexNode(current);
      throw error;
    }
  }

  async deleteNode(id: EntityId): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) return;

    const outIds = this.outEdges.get(id) || new Set<EntityId>();
    const inIds = this.inEdges.get(id) || new Set<EntityId>();
    for (const edgeId of new Set<EntityId>([...outIds, ...inIds])) {
      await this.deleteEdge(edgeId);
    }

    this.nodes.delete(id);
    this.unindexNode(node);
    this.outEdges.delete(id);
    this.inEdges.delete(id);
  }

  // ---- Edge Operations --------------------------------------------------

  async addEdge(edge: GraphEdge): Promise<EntityId> {
    const id = edge.id || generateId();
    if (this.edges.has(id)) {
      throw new Error(`Edge ${id} already exists; use updateEdge for mutations`);
    }

    this.assertNodeExists(edge.source, 'source');
    this.assertNodeExists(edge.target, 'target');

    const now = new Date().toISOString();
    const stored = detachEdge({
      ...edge,
      id,
      createdAt: edge.createdAt || now,
      updatedAt: now,
    });

    this.edges.set(id, stored);
    this.indexEdge(stored);
    return id;
  }

  async getEdge(id: EntityId): Promise<GraphEdge | null> {
    const edge = this.edges.get(id);
    return edge ? detachEdge(edge) : null;
  }

  async updateEdge(id: EntityId, updates: Partial<GraphEdge>): Promise<void> {
    const current = this.edges.get(id);
    if (!current) throw new Error(`Edge ${id} not found`);
    if (updates.id !== undefined && updates.id !== id) {
      throw new Error(`Edge identity is immutable: ${id} cannot become ${updates.id}`);
    }

    const next = detachEdge({
      ...current,
      ...detachPartial(updates, 'GraphEdge update'),
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    } as GraphEdge);

    this.assertNodeExists(next.source, 'source');
    this.assertNodeExists(next.target, 'target');

    this.unindexEdge(current);
    try {
      this.edges.set(id, next);
      this.indexEdge(next);
    } catch (error) {
      this.edges.set(id, current);
      this.unindexEdge(next);
      this.indexEdge(current);
      throw error;
    }
  }

  async deleteEdge(id: EntityId): Promise<void> {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.edges.delete(id);
    this.unindexEdge(edge);
  }

  // ---- Query ------------------------------------------------------------

  async queryNodes(q: GraphQuery): Promise<GraphNode[]> {
    let candidateIds: Set<EntityId> | null = null;

    if (q.type) candidateIds = new Set(this.typeNodeIndex.get(q.type) || []);

    if (q.tags && q.tags.length > 0) {
      const tagIds = new Set<EntityId>();
      for (const tag of q.tags) {
        for (const id of this.tagNodeIndex.get(tag) || []) tagIds.add(id);
      }
      candidateIds = candidateIds === null
        ? tagIds
        : new Set([...candidateIds].filter(id => tagIds.has(id)));
    }

    let results = candidateIds === null
      ? Array.from(this.nodes.values())
      : Array.from(candidateIds, id => this.nodes.get(id)).filter((node): node is GraphNode => node !== undefined);

    if (q.label) {
      const needle = q.label.toLowerCase();
      results = results.filter(node => node.label.toLowerCase().includes(needle));
    }
    if (q.properties) results = results.filter(node => matchesProperties(node.properties, q.properties!));

    const { offset, limit } = normalizeWindow(q.offset, q.limit);
    return results.slice(offset, limit === null ? undefined : offset + limit).map(detachNode);
  }

  async queryEdges(q: GraphQuery): Promise<GraphEdge[]> {
    let results = q.type
      ? Array.from(this.typeEdgeIndex.get(q.type) || [], id => this.edges.get(id))
          .filter((edge): edge is GraphEdge => edge !== undefined)
      : Array.from(this.edges.values());

    if (q.label) {
      const needle = q.label.toLowerCase();
      results = results.filter(edge => edge.label.toLowerCase().includes(needle));
    }
    if (q.properties) results = results.filter(edge => matchesProperties(edge.properties, q.properties!));

    const { offset, limit } = normalizeWindow(q.offset, q.limit);
    return results.slice(offset, limit === null ? undefined : offset + limit).map(detachEdge);
  }

  async traverse(start: EntityId, edgeTypes: string[], depth: number): Promise<GraphPath[]> {
    if (!Number.isSafeInteger(depth) || depth < 0) {
      throw new Error(`Traversal depth must be a non-negative safe integer; received ${depth}`);
    }
    const startNode = this.nodes.get(start);
    if (!startNode) return [];

    if (depth === 0) {
      return [{
        nodes: [detachNode(startNode)],
        edges: [],
        totalCost: 0,
        totalConfidence: 1,
      }];
    }

    const allowedTypes = new Set(edgeTypes);
    const paths: GraphPath[] = [];

    const walk = (
      currentId: EntityId,
      pathNodes: GraphNode[],
      pathEdges: GraphEdge[],
      visited: Set<EntityId>,
    ): void => {
      if (pathEdges.length >= depth) return;

      const traverseEdge = (edge: GraphEdge, nextId: EntityId): void => {
        if (!allowedTypes.has(edge.type) || visited.has(nextId)) return;
        const nextNode = this.nodes.get(nextId);
        if (!nextNode) throw new Error(`Graph invariant violation: edge ${edge.id} points to missing node ${nextId}`);

        const nextNodes = [...pathNodes, nextNode];
        const nextEdges = [...pathEdges, edge];
        paths.push(makePath(nextNodes, nextEdges));

        const nextVisited = new Set(visited);
        nextVisited.add(nextId);
        walk(nextId, nextNodes, nextEdges, nextVisited);
      };

      for (const edgeId of this.outEdges.get(currentId) || []) {
        const edge = this.edges.get(edgeId);
        if (!edge) throw new Error(`Graph invariant violation: missing outgoing edge ${edgeId}`);
        traverseEdge(edge, edge.target);
      }

      // Only undirected edges may be traversed from target back to source.
      for (const edgeId of this.inEdges.get(currentId) || []) {
        const edge = this.edges.get(edgeId);
        if (!edge) throw new Error(`Graph invariant violation: missing incoming edge ${edgeId}`);
        if (edge.directed) continue;
        traverseEdge(edge, edge.source);
      }
    };

    walk(start, [startNode], [], new Set<EntityId>([start]));
    return paths.sort((left, right) =>
      right.totalConfidence - left.totalConfidence
      || left.edges.length - right.edges.length
      || pathKey(left).localeCompare(pathKey(right)));
  }

  async stats(): Promise<GraphStats> {
    const byNodeType: Record<string, number> = {};
    const byEdgeType: Record<string, number> = {};
    for (const [type, ids] of this.typeNodeIndex) byNodeType[type] = ids.size;
    for (const [type, ids] of this.typeEdgeIndex) byEdgeType[type] = ids.size;
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      byNodeType,
      byEdgeType,
    };
  }
}

function detachNode(node: GraphNode): GraphNode {
  return detach(node, `GraphNode ${String(node.id)}`);
}

function detachEdge(edge: GraphEdge): GraphEdge {
  return detach(edge, `GraphEdge ${String(edge.id)}`);
}

function detachPartial<T>(value: T, label: string): T {
  return detach(value, label);
}

function detach<T>(value: T, label: string): T {
  try {
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be structured-cloneable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeWindow(offsetValue?: number, limitValue?: number): { offset: number; limit: number | null } {
  const offset = offsetValue ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error(`Graph query offset must be a non-negative safe integer; received ${offset}`);
  if (limitValue === undefined) return { offset, limit: null };
  if (!Number.isSafeInteger(limitValue) || limitValue < 0) throw new Error(`Graph query limit must be a non-negative safe integer; received ${limitValue}`);
  return { offset, limit: limitValue };
}

function matchesProperties(
  actual: Record<string, string | number | boolean | null>,
  expected: Record<string, string | number | boolean | null>,
): boolean {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function makePath(nodes: GraphNode[], edges: GraphEdge[]): GraphPath {
  if (nodes.length !== edges.length + 1) {
    throw new Error(`Graph path invariant violation: nodes=${nodes.length} edges=${edges.length}`);
  }
  const totalCost = edges.reduce((sum, edge) => sum + edge.weight, 0);
  const totalConfidence = edges.length === 0
    ? 1
    : edges.reduce((sum, edge) => sum + edge.confidence, 0) / edges.length;
  return {
    nodes: nodes.map(detachNode),
    edges: edges.map(detachEdge),
    totalCost,
    totalConfidence,
  };
}

function pathKey(path: GraphPath): string {
  return `${path.nodes.map(node => String(node.id)).join('>')}|${path.edges.map(edge => String(edge.id)).join('>')}`;
}
