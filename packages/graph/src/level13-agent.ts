// LEVEL 13: AGENT GRAPH
// Multi-agent systems, roles, delegation chains, capability search
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type AgentRole = 'ceo' | 'planner' | 'researcher' | 'developer' | 'reviewer' | 'marketer' | 'analyst' | 'designer' | 'coordinator';
export type AgentEdgeType = 'delegates_to' | 'reports_to' | 'collaborates_with' | 'reviews' | 'approves';
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'done' | 'error';

export interface AgentNode {
  id: EntityId; name: string; role: AgentRole; status: AgentStatus;
  capabilities: string[]; tools: string[]; memoryIds: string[];
  confidence: number; createdAt: Timestamp;
}

export interface AgentEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: AgentEdgeType; priority: number; createdAt: Timestamp;
}

export interface AgentGraph { id: EntityId; name: string; createdAt: Timestamp; nodes: AgentNode[]; edges: AgentEdge[]; }

export class AgentGraphEngine {
  private graph: AgentGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Agent Swarm') {
    this.graph = { id: generateId(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
    }
  }

  addNode(n: Omit<AgentNode, 'id' | 'createdAt' | 'status'>): EntityId {
    const id = generateId();
    this.graph.nodes.push({ ...n, id, status: 'idle', createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeNode(nodeId: EntityId): void {
    const idx = this.graph.nodes.findIndex(n => n.id === nodeId);
    if (idx === -1) throw new Error(`Node ${nodeId} not found`);
    this.graph.nodes.splice(idx, 1);
    this.graph.edges = this.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(source: EntityId, target: EntityId, type: AgentEdgeType, priority: number = 5): EntityId {
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

  getNode(nodeId: EntityId): AgentNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }
  getNodes(): AgentNode[] { return this.graph.nodes; }
  getEdges(): AgentEdge[] { return this.graph.edges; }

  buildDevTeam() {
    const ceo = this.addNode({ name: 'CEO', role: 'ceo', capabilities: ['planning', 'vision'], tools: [], memoryIds: [], confidence: 0.95 });
    const planner = this.addNode({ name: 'Planner', role: 'planner', capabilities: ['scheduling', 'decomposition'], tools: [], memoryIds: [], confidence: 0.9 });
    const researcher = this.addNode({ name: 'Researcher', role: 'researcher', capabilities: ['search', 'analysis'], tools: [], memoryIds: [], confidence: 0.85 });
    const developer = this.addNode({ name: 'Developer', role: 'developer', capabilities: ['code', 'debug'], tools: [], memoryIds: [], confidence: 0.88 });
    const reviewer = this.addNode({ name: 'Reviewer', role: 'reviewer', capabilities: ['code review', 'quality'], tools: [], memoryIds: [], confidence: 0.82 });
    const marketer = this.addNode({ name: 'Marketer', role: 'marketer', capabilities: ['content', 'social'], tools: [], memoryIds: [], confidence: 0.78 });
    this.addEdge(ceo, planner, 'delegates_to', 9);
    this.addEdge(planner, researcher, 'delegates_to', 7);
    this.addEdge(planner, developer, 'delegates_to', 8);
    this.addEdge(planner, marketer, 'delegates_to', 6);
    this.addEdge(developer, reviewer, 'reviews', 7);
    this.addEdge(researcher, developer, 'collaborates_with', 5);
    this.addEdge(marketer, researcher, 'collaborates_with', 4);
  }

  delegationChain(fromId: EntityId, toId: EntityId): AgentNode[] {
    this.buildAdjacency();
    const visited = new Set<EntityId>();
    const dfs = (id: EntityId, path: AgentNode[]): AgentNode[] | null => {
      if (id === toId) return [...path, this.graph.nodes.find(n => n.id === id)!];
      if (visited.has(id)) return null; visited.add(id);
      const node = this.graph.nodes.find(n => n.id === id);
      if (!node) return null;
      for (const nb of this.adj.get(id) || []) {
        const edge = this.graph.edges.find(e => e.source === id && e.target === nb && e.type === 'delegates_to');
        if (!edge) continue;
        const result = dfs(nb, [...path, node]);
        if (result) return result;
      }
      return null;
    };
    return dfs(fromId, []) || [];
  }

  findByCapability(capability: string): AgentNode[] {
    return this.graph.nodes.filter(n => n.capabilities.some(c => c.toLowerCase().includes(capability.toLowerCase())));
  }

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
    this.buildAdjacency();
    const outDeg = this.graph.nodes.map(no => this.adj.get(no.id)?.length || 0);
    const avgOutDeg = n > 0 ? outDeg.reduce((a, b) => a + b, 0) / n : 0;
    const roles = [...new Set(this.graph.nodes.map(n => n.role))];
    return { nodeCount: n, edgeCount: e, avgOutDegree: avgOutDeg, roles: roles.length };
  }

  toJSON(): AgentGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: AgentGraph): AgentGraphEngine { const g = new AgentGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph TD\n';
    for (const n of this.graph.nodes) {
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name} (${n.role})"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      m += `    ${s} -->|"${e.type}"| ${t}\n`;
    }
    return m;
  }
}