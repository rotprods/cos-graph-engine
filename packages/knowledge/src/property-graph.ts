import {
  GraphNode, GraphEdge, GraphQuery, GraphPath, GraphStats,
  IPropertyGraph, EntityId, Timestamp, Version, Metadata,
} from '@cos/core';
import { generateId } from '@cos/core';

export class PropertyGraph implements IPropertyGraph {
  private nodes: Map<EntityId, GraphNode> = new Map();
  private edges: Map<EntityId, GraphEdge> = new Map();
  private outEdges: Map<EntityId, Set<EntityId>> = new Map();
  private inEdges: Map<EntityId, Set<EntityId>> = new Map();
  private typeNodeIndex: Map<string, Set<EntityId>> = new Map();
  private typeEdgeIndex: Map<string, Set<EntityId>> = new Map();
  private tagNodeIndex: Map<string, Set<EntityId>> = new Map();

  // ---- Node Operations ----

  async addNode(node: GraphNode): Promise<EntityId> {
    const id = node.id || generateId();
    const stored: GraphNode = {
      ...node,
      id,
      createdAt: node.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: node.version || { major: 1, minor: 0, patch: 0 },
    };

    this.nodes.set(id, stored);

    // Index by type
    if (!this.typeNodeIndex.has(stored.type)) this.typeNodeIndex.set(stored.type, new Set());
    this.typeNodeIndex.get(stored.type)!.add(id);

    // Index by tags
    for (const tag of stored.tags || []) {
      if (!this.tagNodeIndex.has(tag)) this.tagNodeIndex.set(tag, new Set());
      this.tagNodeIndex.get(tag)!.add(id);
    }

    return id;
  }

  async getNode(id: EntityId): Promise<GraphNode | null> {
    return this.nodes.get(id) || null;
  }

  async updateNode(id: EntityId, updates: Partial<GraphNode>): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Node ${id} not found`);

    Object.assign(node, updates);
    node.updatedAt = new Date().toISOString();
    node.version = {
      ...node.version,
      patch: node.version.patch + 1,
    };
  }

  async deleteNode(id: EntityId): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) return;

    // Delete all connected edges
    const outIds = this.outEdges.get(id) || new Set();
    const inIds = this.inEdges.get(id) || new Set();
    for (const edgeId of new Set([...outIds, ...inIds])) {
      await this.deleteEdge(edgeId);
    }

    // Remove from indices
    this.nodes.delete(id);
    this.typeNodeIndex.get(node.type)?.delete(id);
    for (const tag of node.tags) {
      this.tagNodeIndex.get(tag)?.delete(id);
    }
  }

  // ---- Edge Operations ----

  async addEdge(edge: GraphEdge): Promise<EntityId> {
    const id = edge.id || generateId();
    const stored: GraphEdge = {
      ...edge,
      id,
      createdAt: edge.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Verify nodes exist
    if (!this.nodes.has(stored.source)) throw new Error(`Source node ${stored.source} not found`);
    if (!this.nodes.has(stored.target)) throw new Error(`Target node ${stored.target} not found`);

    this.edges.set(id, stored);

    // Index
    if (!this.outEdges.has(stored.source)) this.outEdges.set(stored.source, new Set());
    this.outEdges.get(stored.source)!.add(id);

    if (!this.inEdges.has(stored.target)) this.inEdges.set(stored.target, new Set());
    this.inEdges.get(stored.target)!.add(id);

    if (!this.typeEdgeIndex.has(stored.type)) this.typeEdgeIndex.set(stored.type, new Set());
    this.typeEdgeIndex.get(stored.type)!.add(id);

    return id;
  }

  async getEdge(id: EntityId): Promise<GraphEdge | null> {
    return this.edges.get(id) || null;
  }

  async updateEdge(id: EntityId, updates: Partial<GraphEdge>): Promise<void> {
    const edge = this.edges.get(id);
    if (!edge) throw new Error(`Edge ${id} not found`);
    Object.assign(edge, updates);
    edge.updatedAt = new Date().toISOString();
  }

  async deleteEdge(id: EntityId): Promise<void> {
    const edge = this.edges.get(id);
    if (!edge) return;

    this.edges.delete(id);
    this.outEdges.get(edge.source)?.delete(id);
    this.inEdges.get(edge.target)?.delete(id);
    this.typeEdgeIndex.get(edge.type)?.delete(id);
  }

  // ---- Query ----

  async queryNodes(q: GraphQuery): Promise<GraphNode[]> {
    let results = Array.from(this.nodes.values());

    if (q.type) results = results.filter(n => n.type === q.type);
    if (q.label) results = results.filter(n => n.label.toLowerCase().includes(q.label!.toLowerCase()));
    if (q.tags && q.tags.length > 0) {
      results = results.filter(n => q.tags!.some(tag => n.tags.includes(tag)));
    }

    if (q.limit) results = results.slice(0, q.limit);

    return results;
  }

  async queryEdges(q: GraphQuery): Promise<GraphEdge[]> {
    let results = Array.from(this.edges.values());

    if (q.type) results = results.filter(e => e.type === q.type);
    if (q.label) results = results.filter(e => e.label.toLowerCase().includes(q.label!.toLowerCase()));

    if (q.limit) results = results.slice(0, q.limit);

    return results;
  }

  async traverse(
    start: EntityId,
    edgeTypes: string[],
    depth: number,
  ): Promise<GraphPath[]> {
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

      // Get outgoing edges
      const edgeIds = this.outEdges.get(currentId) || new Set();
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge || !edgeTypes.includes(edge.type)) continue;

        const newEdges = [...edges, edge];
        paths.push({
          nodes: newNodes,
          edges: newEdges,
          totalCost: newEdges.reduce((sum, e) => sum + e.weight, 0),
          totalConfidence: newEdges.reduce((sum, e) => sum + e.confidence, 0) / newEdges.length,
        });

        dfs(edge.target, newNodes, newEdges, currentDepth + 1);
      }

      // Get incoming edges (bidirectional)
      const inEdgeIds = this.inEdges.get(currentId) || new Set();
      for (const edgeId of inEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge || !edgeTypes.includes(edge.type)) continue;
        dfs(edge.source, nodes, edges, currentDepth + 1);
      }

      visited.delete(currentId);
    };

    dfs(start, [], [], 0);

    return paths.sort((a, b) => b.totalConfidence - a.totalConfidence);
  }

  async stats(): Promise<GraphStats> {
    const byNodeType: Record<string, number> = {};
    const byEdgeType: Record<string, number> = {};

    for (const node of this.nodes.values()) {
      byNodeType[node.type] = (byNodeType[node.type] || 0) + 1;
    }

    for (const edge of this.edges.values()) {
      byEdgeType[edge.type] = (byEdgeType[edge.type] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      byNodeType,
      byEdgeType,
    };
  }
}