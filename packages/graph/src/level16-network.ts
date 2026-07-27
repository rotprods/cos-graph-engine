// LEVEL 16: NETWORK GRAPH
// Infrastructure topology, CDN, shortest path, health monitoring
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type NetworkNodeType = 'server' | 'router' | 'cdn' | 'client' | 'load_balancer' | 'pod' | 'service' | 'gateway' | 'database' | 'cache';
export type NetworkEdgeType = 'routes_to' | 'load_balanced_by' | 'proxies_to' | 'depends_on' | 'replicates_to' | 'connects_to';

export interface NetworkNode {
  id: EntityId; name: string; type: NetworkNodeType; healthy: boolean;
  ip?: string; region?: string; latency?: number; throughput?: number;
  cpu?: number; memory?: number; replicas?: number; createdAt: Timestamp;
}

export interface NetworkEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: NetworkEdgeType; bandwidth?: number; createdAt: Timestamp;
}

export interface NetworkGraph { id: EntityId; name: string; createdAt: Timestamp; nodes: NetworkNode[]; edges: NetworkEdge[]; }

export class NetworkGraphEngine {
  private graph: NetworkGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Network Topology') {
    this.graph = { id: generateId(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adj.has(e.target)) this.adj.get(e.target)!.push(e.source);
    }
  }

  addNode(n: Omit<NetworkNode, 'id' | 'createdAt'>): EntityId {
    const id = generateId();
    this.graph.nodes.push({ ...n, id, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeNode(nodeId: EntityId): void {
    const idx = this.graph.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.graph.nodes.splice(idx, 1);
    this.graph.edges = this.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(source: EntityId, target: EntityId, type: NetworkEdgeType, bandwidth?: number): EntityId {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, bandwidth, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeEdge(edgeId: EntityId): void {
    const idx = this.graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: EntityId): NetworkNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }
  getNodes(): NetworkNode[] { return this.graph.nodes; }
  getEdges(): NetworkEdge[] { return this.graph.edges; }

  buildInfrastructure() {
    const client = this.addNode({ name: 'Client', type: 'client', healthy: true, region: 'global' });
    const cloudflare = this.addNode({ name: 'Cloudflare CDN', type: 'cdn', healthy: true, region: 'global', latency: 10, replicas: 200 });
    const lb = this.addNode({ name: 'Load Balancer', type: 'load_balancer', healthy: true, region: 'us-east-1', latency: 5 });
    const router = this.addNode({ name: 'Router', type: 'router', healthy: true, region: 'us-east-1' });
    const gateway = this.addNode({ name: 'API Gateway', type: 'gateway', healthy: true, region: 'us-east-1', latency: 15 });
    const app = this.addNode({ name: 'App Server', type: 'server', healthy: true, region: 'us-east-1', cpu: 65, memory: 70, replicas: 4 });
    const db = this.addNode({ name: 'PostgreSQL', type: 'database', healthy: true, region: 'us-east-1', latency: 2 });
    const cache = this.addNode({ name: 'Redis Cache', type: 'cache', healthy: true, region: 'us-east-1', latency: 1 });
    this.addEdge(client, cloudflare, 'routes_to', 10000);
    this.addEdge(cloudflare, lb, 'load_balanced_by', 10000);
    this.addEdge(lb, router, 'routes_to');
    this.addEdge(router, gateway, 'routes_to');
    this.addEdge(gateway, app, 'proxies_to');
    this.addEdge(app, db, 'depends_on');
    this.addEdge(app, cache, 'depends_on');
    this.addEdge(db, cache, 'replicates_to', 1000);
  }

  shortestPath(fromId: EntityId, toId: EntityId): NetworkNode[] {
    this.buildAdjacency();
    const visited = new Set<EntityId>(); const prev = new Map<EntityId, EntityId | null>(); const queue: EntityId[] = [fromId];
    visited.add(fromId); prev.set(fromId, null);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === toId) break;
      for (const nb of this.adj.get(cur) || []) {
        if (!visited.has(nb)) { visited.add(nb); prev.set(nb, cur); queue.push(nb); }
      }
    }
    const path: NetworkNode[] = []; let cur: EntityId | null = toId;
    while (cur) { const node = this.graph.nodes.find(n => n.id === cur); if (node) path.unshift(node); cur = prev.get(cur) || null; }
    return path;
  }

  findUnhealthy(): NetworkNode[] { return this.graph.nodes.filter(n => !n.healthy); }

  validate(): string[] {
    const errors: string[] = [];
    for (const e of this.graph.edges) {
      if (!this.graph.nodes.some(n => n.id === e.source)) errors.push(`Dangling edge source: ${e.source}`);
      if (!this.graph.nodes.some(n => n.id === e.target)) errors.push(`Dangling edge target: ${e.target}`);
    }
    return errors;
  }

  metrics() {
    const n = this.graph.nodes.length; const e = this.graph.edges.length;
    const regions = [...new Set(this.graph.nodes.map(n => n.region).filter(Boolean))];
    const avgLatency = this.graph.nodes.filter(n => n.latency).reduce((s, n) => s + (n.latency || 0), 0) / Math.max(1, this.graph.nodes.filter(n => n.latency).length);
    return { nodeCount: n, edgeCount: e, unhealthyCount: this.findUnhealthy().length, avgLatency, regionCount: regions.length };
  }

  toJSON(): NetworkGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: NetworkGraph): NetworkGraphEngine { const g = new NetworkGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph LR\n  title: "Network Topology"\n';
    for (const n of this.graph.nodes) {
      const health = n.healthy ? '' : ' [DOWN]';
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name}${health}"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      m += `    ${s} -->|"${e.type}"| ${t}\n`;
    }
    return m;
  }
}