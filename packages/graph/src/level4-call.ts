// ================================================================
// LEVEL 4: CALL GRAPH
// Dynamic tracing, static analysis, flame graphs, profiling
// Refactored: mutation API, adjacency maps, serialization, validation
// ================================================================

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type CallNodeType = 'function' | 'method' | 'api' | 'async' | 'external' | 'root';

export interface CallNode {
  id: EntityId; name: string; module?: string; type: CallNodeType;
  line?: number; column?: number;
  selfTime?: number; totalTime?: number; callCount?: number; depth?: number;
}

export interface CallEdge {
  id: EntityId; source: EntityId; target: EntityId; callCount: number;
  avgDuration?: number; totalDuration?: number; async?: boolean; args?: string[];
}

export interface CallGraph {
  id: EntityId; name: string;
  nodes: CallNode[]; edges: CallEdge[];
  createdAt: Timestamp; totalTime: number;
}

export class CallGraphBuilder {
  private graphs: Map<EntityId, CallGraph> = new Map();
  private activeSpan: Map<string, { start: number; nodeId: EntityId; parentId?: EntityId }> = new Map();
  private adj: Map<EntityId, EntityId[]> = new Map();
  private adjRev: Map<EntityId, EntityId[]> = new Map();

  private buildAdjacency(graph: CallGraph): void {
    this.adj.clear(); this.adjRev.clear();
    for (const n of graph.nodes) { this.adj.set(n.id, []); this.adjRev.set(n.id, []); }
    for (const e of graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adjRev.has(e.target)) this.adjRev.get(e.target)!.push(e.source);
    }
  }

  createGraph(name: string): EntityId {
    const id = generateId();
    this.graphs.set(id, { id, name, nodes: [], edges: [], createdAt: new Date().toISOString(), totalTime: 0 });
    return id;
  }

  addNode(graphId: EntityId, node: CallNode): void {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    if (graph.nodes.some(n => n.id === node.id)) throw new Error(`Duplicate node ID: ${node.id}`);
    graph.nodes.push(node);
    this.buildAdjacency(graph);
  }

  removeNode(graphId: EntityId, nodeId: EntityId): void {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    const idx = graph.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    graph.nodes.splice(idx, 1);
    graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency(graph);
  }

  addEdge(graphId: EntityId, edge: CallEdge): void {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    if (!graph.nodes.some(n => n.id === edge.source)) throw new Error(`Edge source ${edge.source} not found`);
    if (!graph.nodes.some(n => n.id === edge.target)) throw new Error(`Edge target ${edge.target} not found`);
    graph.edges.push(edge);
    this.buildAdjacency(graph);
  }

  removeEdge(graphId: EntityId, edgeId: EntityId): void {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    const idx = graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    graph.edges.splice(idx, 1);
    this.buildAdjacency(graph);
  }

  getNode(graphId: EntityId, nodeId: EntityId): CallNode | undefined {
    return this.graphs.get(graphId)?.nodes.find(n => n.id === nodeId);
  }

  getEdge(graphId: EntityId, edgeId: EntityId): CallEdge | undefined {
    return this.graphs.get(graphId)?.edges.find(e => e.id === edgeId);
  }

  getGraph(id: EntityId): CallGraph | undefined { return this.graphs.get(id); }

  enterCall(graphId: EntityId, name: string, type: CallNodeType = 'function', module?: string): EntityId {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    const nodeId = generateId();
    const existing = graph.nodes.find(n => n.name === name && n.module === module && n.type === type);
    if (existing) {
      existing.callCount = (existing.callCount || 0) + 1;
      const traceId = `${name}_${Date.now()}`;
      this.activeSpan.set(traceId, { start: Date.now(), nodeId: existing.id });
      return existing.id;
    }
    const depth = this.activeSpan.size;
    const node: CallNode = { id: nodeId, name, module, type, depth, selfTime: 0, totalTime: 0, callCount: 1 };
    graph.nodes.push(node);
    if (this.activeSpan.size > 0) {
      const parentEntry = Array.from(this.activeSpan.values()).pop()!;
      const edgeId = generateId();
      graph.edges.push({ id: edgeId, source: parentEntry.nodeId, target: nodeId, callCount: 1 });
    }
    const traceId = `${name}_${Date.now()}`;
    this.activeSpan.set(traceId, { start: Date.now(), nodeId });
    this.buildAdjacency(graph);
    return nodeId;
  }

  exitCall(graphId: EntityId, nodeId: EntityId): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;
    for (const [key, span] of this.activeSpan) {
      if (span.nodeId === nodeId) {
        const duration = Date.now() - span.start;
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node) { node.selfTime = (node.selfTime || 0) + duration; node.totalTime = (node.totalTime || 0) + duration; graph.totalTime += duration; }
        this.activeSpan.delete(key); return;
      }
    }
  }

  analyzeStackTrace(graphId: EntityId, stack: string[]): void {
    const graph = this.graphs.get(graphId);
    if (!graph) throw new Error(`Graph ${graphId} not found`);
    let prevId: EntityId | null = null;
    for (const line of stack) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (!match) continue;
      const name = match[1]; const module = match[2]; const lineNum = parseInt(match[3]);
      let node = graph.nodes.find(n => n.name === name && n.module === module);
      if (!node) { const id = generateId(); node = { id, name, module, type: 'function', line: lineNum, callCount: 1 }; graph.nodes.push(node); }
      else { node.callCount = (node.callCount || 0) + 1; }
      if (prevId && node) { graph.edges.push({ id: generateId(), source: prevId, target: node!.id, callCount: 1 }); }
      prevId = node?.id || null;
    }
    this.buildAdjacency(graph);
  }

  findHotPaths(graphId: EntityId, minCalls: number = 5): CallEdge[] {
    const graph = this.graphs.get(graphId);
    if (!graph) return [];
    return graph.edges.filter(e => e.callCount >= minCalls).sort((a, b) => b.callCount - a.callCount);
  }

  computeDepth(graphId: EntityId): Map<EntityId, number> {
    const graph = this.graphs.get(graphId);
    if (!graph) return new Map();
    this.buildAdjacency(graph);
    const depth = new Map<EntityId, number>();
    const roots = graph.nodes.filter(n => !this.adjRev.get(n.id)?.length);
    for (const root of roots) { depth.set(root.id, 0); }
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of graph.nodes) {
        const d = depth.get(n.id);
        if (d === undefined) continue;
        for (const nb of this.adj.get(n.id) || []) {
          if (depth.get(nb) === undefined || depth.get(nb)! < d + 1) { depth.set(nb, d + 1); changed = true; }
        }
      }
    }
    return depth;
  }

  toFlameData(graphId: EntityId): Array<{ name: string; value: number; children: any[] }> {
    const graph = this.graphs.get(graphId);
    if (!graph) return [];
    this.buildAdjacency(graph);
    const roots = graph.nodes.filter(n => !this.adjRev.get(n.id)?.length);
    function buildTree(adj: Map<EntityId, EntityId[]>, nodes: CallNode[], nid: EntityId): any {
      const node = nodes.find(n => n.id === nid); if (!node) return null;
      const children = (adj.get(nid) || []).map(c => buildTree(adj, nodes, c)).filter(Boolean);
      return { name: node.name, value: node.selfTime || 1, children };
    }
    return roots.map(r => buildTree(this.adj, graph.nodes, r.id)).filter(Boolean);
  }

  toMermaid(graphId: EntityId): string {
    const graph = this.graphs.get(graphId);
    if (!graph) return 'graph TD\n  title: "Call Graph"';
    let m = `graph TD\n  title: "${graph.name}"\n`;
    for (const node of graph.nodes) {
      const label = `${node.name}${node.selfTime ? ` [${node.selfTime}ms]` : ''}`;
      m += `    ${node.id.replace(/[^a-zA-Z0-9]/g, '_')}["${label}"]\n`;
    }
    for (const edge of graph.edges) {
      const s = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
      m += `    ${s} -->|${edge.callCount}x| ${t}\n`;
    }
    return m;
  }

  validate(graphId: EntityId): string[] {
    const graph = this.graphs.get(graphId);
    if (!graph) return ['Graph not found'];
    const errors: string[] = [];
    for (const e of graph.edges) {
      if (!graph.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!graph.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics(graphId: EntityId): { nodeCount: number; edgeCount: number; avgDegree: number; density: number } {
    const graph = this.graphs.get(graphId);
    if (!graph) return { nodeCount: 0, edgeCount: 0, avgDegree: 0, density: 0 };
    const n = graph.nodes.length; const e = graph.edges.length;
    this.buildAdjacency(graph);
    const deg = graph.nodes.map(n => (this.adj.get(n.id)?.length || 0) + (this.adjRev.get(n.id)?.length || 0));
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
  }

  toJSON(graphId: EntityId): CallGraph | undefined {
    const graph = this.graphs.get(graphId);
    return graph ? JSON.parse(JSON.stringify(graph)) : undefined;
  }

  static fromJSON(data: CallGraph): CallGraphBuilder {
    const builder = new CallGraphBuilder();
    builder.graphs.set(data.id, data);
    return builder;
  }
}