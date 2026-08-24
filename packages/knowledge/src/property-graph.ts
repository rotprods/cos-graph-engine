import {
  GraphNode, GraphEdge, GraphQuery, GraphPath, GraphStats,
  IPropertyGraph, EntityId,
} from '@cos/core';
import { generateId } from '@cos/core';

/**
 * In-memory property graph with transaction-like mutation semantics.
 *
 * The primary maps and every secondary index are updated as one logical
 * operation. Mutations never silently change canonical IDs, never create
 * dangling edges, and never leave stale type/tag/adjacency indexes behind.
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
    const stored: GraphNode = {
      ...node,
      id,
      createdAt: node.createdAt || now,
      updatedAt: now,
      version: node.version || { major: 1, minor: 0, patch: 0 },
    };

    this.nodes.set(id, stored);
    this.indexNode(stored);
    return id;
  }

  async getNode(id: EntityId): Promise<GraphNode | null> {
    return this.nodes.get(id) || null;
  }

  async updateNode(id: EntityId, updates: Partial<GraphNode>): Promise<void> {
    const current = this.nodes.get(id);
    if (!current) throw new Error(`Node ${id} not found`);
    if (updates.id !== undefined && updates.id !== id) {
      throw new Error(`Node identity is immutable: ${id} cannot become ${updates.id}`);
    }

    const next: GraphNode = {
      ...current,
      ...updates,
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      version: {
        ...current.version,
        patch: current.version.patch + 1,
      },
    };

    // Commit primary object + derived indexes as one logical mutation.
    this.unindexNode(current);
    try {
      this.nodes.set(id, next);
      this.indexNode(next);
    } catch (error) {
      // Best-effort rollback keeps this in-memory implementation coherent even
      // if a future index implementation throws.
      this.nodes.set(id, current);
      this.unindexNode(next);
      this.indexNode(current);
      throw error;
    }
  }

  async deleteNode(id: EntityId): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) return;

    // Snapshot before mutation so self-loops and bidirectional references are
    // deleted exactly once.
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
    const stored: GraphEdge = {
      ...edge,
      id,
      createdAt: edge.createdAt || now,
      updatedAt: now,
    };

    this.edges.set(id, stored);
    this.indexEdge(stored);
    return id;
  }

  async getEdge(id: EntityId): Promise<GraphEdge | null> {
    return this.edges.get(id) || null;
  }

  async updateEdge(id: EntityId, updates: Partial<GraphEdge>): Promise<void> {
    const current = this.edges.get(id);
    if (!current) throw new Error(`Edge ${id} not found`);
    if (updates.id !== undefined && updates.id !== id) {
      throw new Error(`Edge identity is immutable: ${id} cannot become ${updates.id}`);
    }

    const next: GraphEdge = {
      ...current,
      ...updates,
      id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };

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
    // Start from the narrowest available secondary index instead of scanning
    // the entire graph whenever type/tags can reduce the candidate set.
    let candidateIds: Set<EntityId> | null = null;

    if (q.type) {
      candidateIds = new Set(this.typeNodeIndex.get(q.type) || []);
    }

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
      : Array.from(candidateIds, id => this.nodes.get(id)).filter((n): n is GraphNode => n !== undefined);

    if (q.label) {
      const needle = q.label.toLowerCase();
      results = results.filter(n => n.label.toLowerCase().includes(needle));
    }

    if (q.limit !== undefined) results = results.slice(0, Math.max(0, q.limit));
    return results;
  }

  async queryEdges(q: GraphQuery): Promise<GraphEdge[]> {
    let results = q.type
      ? Array.from(this.typeEdgeIndex.get(q.type) || [], id => this.edges.get(id))
          .filter((e): e is GraphEdge => e !== undefined)
      : Array.from(this.edges.values());

    if (q.label) {
      const needle = q.label.toLowerCase();
      results = results.filter(e => e.label.toLowerCase().includes(needle));
    }

    if (q.limit !== undefined) results = results.slice(0, Math.max(0, q.limit));
    return results;
  }

  async traverse(
    start: EntityId,
    edgeTypes: string[],
    depth: number,
  ): Promise<GraphPath[]> {
    if (depth < 0 || !Number.isFinite(depth)) {
      throw new Error(`Traversal depth must be a finite non-negative number; received ${depth}`);
    }

    const paths: GraphPath[] = [];
    const visited = new Set<EntityId>();

    const dfs = (
      currentId: EntityId,
      nodes: GraphNode[],
      edges: GraphEdge[],
      currentDepth: number,
    ) => {
      if (currentDepth > depth || visited.has(currentId)) return;

      const currentNode = this.nodes.get(currentId);
      if (!currentNode) return;

      visited.add(currentId);
      const newNodes = [...nodes, currentNode];

      const emitAndContinue = (edge: GraphEdge, nextId: EntityId): void => {
        const newEdges = [...edges, edge];
        paths.push({
          nodes: newNodes,
          edges: newEdges,
          totalCost: newEdges.reduce((sum, e) => sum + e.weight, 0),
          totalConfidence: newEdges.reduce((sum, e) => sum + e.confidence, 0) / newEdges.length,
        });
        dfs(nextId, newNodes, newEdges, currentDepth + 1);
      };

      for (const edgeId of this.outEdges.get(currentId) || []) {
        const edge = this.edges.get(edgeId);
        if (!edge || !edgeTypes.includes(edge.type)) continue;
        emitAndContinue(edge, edge.target);
      }

      // Incoming traversal now carries the actual edge in the path as well;
      // the previous implementation recursed without recording it, producing
      // structurally incomplete bidirectional paths.
      for (const edgeId of this.inEdges.get(currentId) || []) {
        const edge = this.edges.get(edgeId);
        if (!edge || !edgeTypes.includes(edge.type)) continue;
        emitAndContinue(edge, edge.source);
      }

      visited.delete(currentId);
    };

    dfs(start, [], [], 0);
    return paths.sort((a, b) => b.totalConfidence - a.totalConfidence);
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