// LEVEL 14: TOOL GRAPH
// Tool ecosystem, routing, fallbacks, capability discovery
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type ToolType = 'api' | 'function' | 'database' | 'storage' | 'ai' | 'communication' | 'compute';
export type ToolEdgeType = 'depends_on' | 'triggers' | 'provides_data_for' | 'authenticates_via' | 'fallback_to';

export interface ToolNode {
  id: EntityId; name: string; type: ToolType; description: string;
  requiredCapabilities: string[]; rateLimit: number; latency: number;
  costPerCall: number; enabled: boolean; createdAt: Timestamp;
}

export interface ToolEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: ToolEdgeType; priority: number; createdAt: Timestamp;
}

export interface ToolGraph { id: EntityId; name: string; createdAt: Timestamp; nodes: ToolNode[]; edges: ToolEdge[]; }

export class ToolGraphEngine {
  private graph: ToolGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Tool Ecosystem') {
    this.graph = { id: generateId(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
    }
  }

  addNode(n: Omit<ToolNode, 'id' | 'createdAt'>): EntityId {
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

  addEdge(source: EntityId, target: EntityId, type: ToolEdgeType, priority: number = 5): EntityId {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, priority, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeEdge(edgeId: EntityId): void {
    const idx = this.graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: EntityId): ToolNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }
  getNodes(): ToolNode[] { return this.graph.nodes; }
  getEdges(): ToolEdge[] { return this.graph.edges; }

  buildToolEcosystem() {
    const claude = this.addNode({ name: 'Claude API', type: 'ai', description: 'Anthropic AI assistant', requiredCapabilities: ['llm'], rateLimit: 100, latency: 1500, costPerCall: 0.03, enabled: true });
    const github = this.addNode({ name: 'GitHub API', type: 'api', description: 'GitHub REST API', requiredCapabilities: ['git', 'ci'], rateLimit: 5000, latency: 200, costPerCall: 0, enabled: true });
    const docker = this.addNode({ name: 'Docker Engine', type: 'compute', description: 'Container runtime', requiredCapabilities: ['container'], rateLimit: 1000, latency: 100, costPerCall: 0, enabled: true });
    const supabase = this.addNode({ name: 'Supabase DB', type: 'database', description: 'PostgreSQL + Realtime', requiredCapabilities: ['storage', 'sql'], rateLimit: 1000, latency: 50, costPerCall: 0.001, enabled: true });
    const stripe = this.addNode({ name: 'Stripe API', type: 'api', description: 'Payment processing', requiredCapabilities: ['payments'], rateLimit: 100, latency: 300, costPerCall: 0.02, enabled: true });
    this.addEdge(claude, supabase, 'provides_data_for', 7);
    this.addEdge(github, docker, 'triggers', 6);
    this.addEdge(supabase, stripe, 'provides_data_for', 5);
    this.addEdge(claude, github, 'depends_on', 4);
    this.addEdge(docker, supabase, 'depends_on', 3);
  }

  route(fromCapability: string, toTool: string): ToolNode[] {
    this.buildAdjacency();
    const targetNode = this.graph.nodes.find(n => n.name === toTool);
    if (!targetNode) return [];
    let bestPath: ToolNode[] = []; let bestCost = Infinity;
    const dfs = (id: EntityId, path: ToolNode[], cost: number) => {
      if (id === targetNode.id) { if (cost < bestCost) { bestPath = [...path, targetNode]; bestCost = cost; } return; }
      const node = this.graph.nodes.find(n => n.id === id);
      if (!node || path.includes(node)) return;
      if (!node.requiredCapabilities.some(c => c.toLowerCase().includes(fromCapability.toLowerCase())) && path.length > 0) return;
      for (const nb of this.adj.get(id) || []) {
        const edge = this.graph.edges.find(e => e.source === id && e.target === nb);
        if (edge) dfs(nb, [...path, node], cost + 1);
      }
    };
    for (const n of this.graph.nodes) {
      if (n.requiredCapabilities.some(c => c.toLowerCase().includes(fromCapability.toLowerCase()))) dfs(n.id, [], 0);
    }
    return bestPath;
  }

  findDisabled(): ToolNode[] { return this.graph.nodes.filter(n => !n.enabled); }

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
    const types = [...new Set(this.graph.nodes.map(n => n.type))];
    const avgLatency = n > 0 ? this.graph.nodes.reduce((s, n) => s + n.latency, 0) / n : 0;
    return { nodeCount: n, edgeCount: e, toolTypes: types.length, avgLatency, disabledCount: this.findDisabled().length };
  }

  toJSON(): ToolGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: ToolGraph): ToolGraphEngine { const g = new ToolGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph LR\n  title: "Tool Graph"\n';
    for (const n of this.graph.nodes) {
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name}"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      m += `    ${s} -->|"${e.type}"| ${t}\n`;
    }
    return m;
  }
}