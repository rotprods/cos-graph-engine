// LEVEL 12: MEMORY GRAPH
// Persistent memory, conversation trees, associative recall, identity-safe consolidation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type MemoryNodeType = 'conversation' | 'topic' | 'entity' | 'fact' | 'insight' | 'memory';
export type MemoryEdgeType = 'evolves_to' | 'references' | 'associates' | 'contradicts' | 'confirms' | 'led_to';

export interface MemoryNode {
  id: EntityId;
  name: string;
  type: MemoryNodeType;
  content?: string;
  confidence?: number;
  createdAt: Timestamp;
  lastAccessed: Timestamp;
  accessCount: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryEdge {
  id: EntityId;
  source: EntityId;
  target: EntityId;
  type: MemoryEdgeType;
  strength: number;
  createdAt: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface MemoryGraph {
  id: EntityId;
  name: string;
  createdAt: Timestamp;
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export interface ConsolidationReport {
  merged: number;
  skippedWithoutIdentity: number;
  canonicalGroups: number;
}

export class MemoryGraphEngine {
  private graph: MemoryGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();
  private adjRev: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Memory Graph') {
    this.graph = { id: generateId(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    this.adjRev.clear();
    for (const node of this.graph.nodes) {
      this.adj.set(node.id, []);
      this.adjRev.set(node.id, []);
    }
    for (const edge of this.graph.edges) {
      if (this.adj.has(edge.source)) this.adj.get(edge.source)!.push(edge.target);
      if (this.adjRev.has(edge.target)) this.adjRev.get(edge.target)!.push(edge.source);
    }
  }

  addNode(node: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): EntityId {
    const id = generateId();
    const now = new Date().toISOString();
    this.graph.nodes.push({ ...node, id, createdAt: now, lastAccessed: now, accessCount: 0 });
    this.buildAdjacency();
    return id;
  }

  removeNode(nodeId: EntityId): void {
    const idx = this.graph.nodes.findIndex(node => node.id === nodeId);
    if (idx === -1) throw new Error(`Node ${String(nodeId)} not found`);
    this.graph.nodes.splice(idx, 1);
    this.graph.edges = this.graph.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
    this.buildAdjacency();
  }

  addEdge(source: EntityId, target: EntityId, type: MemoryEdgeType, strength: number = 0.5): EntityId {
    if (!this.graph.nodes.some(node => node.id === source)) throw new Error(`Source node ${String(source)} not found`);
    if (!this.graph.nodes.some(node => node.id === target)) throw new Error(`Target node ${String(target)} not found`);
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('Memory edge strength must be in [0,1]');
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, strength, createdAt: new Date().toISOString() });
    this.buildAdjacency();
    return id;
  }

  removeEdge(edgeId: EntityId): void {
    const idx = this.graph.edges.findIndex(edge => edge.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${String(edgeId)} not found`);
    this.graph.edges.splice(idx, 1);
    this.buildAdjacency();
  }

  getNode(nodeId: EntityId): MemoryNode | undefined {
    return this.graph.nodes.find(node => node.id === nodeId);
  }

  getNodes(): MemoryNode[] {
    return this.graph.nodes.map(node => ({ ...node, metadata: node.metadata ? { ...node.metadata } : undefined }));
  }

  getEdges(): MemoryEdge[] {
    return this.graph.edges.map(edge => ({ ...edge, metadata: edge.metadata ? { ...edge.metadata } : undefined }));
  }

  accessNode(nodeId: EntityId): MemoryNode | undefined {
    const node = this.graph.nodes.find(item => item.id === nodeId);
    if (node) {
      node.lastAccessed = new Date().toISOString();
      node.accessCount += 1;
    }
    return node;
  }

  buildConversation(): void {
    const roberto = this.addNode({ name: 'Roberto', type: 'entity', content: 'User who builds agentic systems', metadata: { canonicalUri: 'agentic://portfolio/entity/roberto' } });
    const oculops = this.addNode({ name: 'Oculops', type: 'topic', content: 'Computer vision platform', metadata: { canonicalUri: 'agentic://portfolio/project/oculops' } });
    const supabase = this.addNode({ name: 'Supabase', type: 'entity', content: 'Open source Firebase alternative', metadata: { canonicalUri: 'custom://external/entity/supabase' } });
    const claude = this.addNode({ name: 'Claude', type: 'entity', content: 'AI assistant by Anthropic', metadata: { canonicalUri: 'custom://external/entity/claude' } });
    const agenticOS = this.addNode({ name: 'Agentic OS', type: 'insight', content: 'Cognitive Operating System vision', metadata: { canonicalUri: 'agentic://portfolio/project/agentic-systems-os' } });
    const memorySys = this.addNode({ name: 'Memory System', type: 'fact', content: '12-layer memory with TTL and consolidation' });
    this.addEdge(roberto, oculops, 'references', 0.8);
    this.addEdge(roberto, supabase, 'references', 0.7);
    this.addEdge(roberto, claude, 'references', 0.9);
    this.addEdge(oculops, agenticOS, 'led_to', 0.6);
    this.addEdge(supabase, agenticOS, 'led_to', 0.5);
    this.addEdge(claude, agenticOS, 'led_to', 0.9);
    this.addEdge(agenticOS, memorySys, 'references', 0.8);
  }

  recall(nodeId: EntityId, maxDepth: number = 2, minStrength: number = 0.3): MemoryNode[] {
    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 16) throw new Error('maxDepth must be an integer in [0,16]');
    if (!Number.isFinite(minStrength) || minStrength < 0 || minStrength > 1) throw new Error('minStrength must be in [0,1]');
    this.buildAdjacency();
    const visited = new Set<EntityId>();
    const results: MemoryNode[] = [];
    const dfs = (id: EntityId, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      const node = this.graph.nodes.find(item => item.id === id);
      if (node) results.push(node);
      for (const neighbor of this.adj.get(id) || []) {
        const edge = this.graph.edges.find(item => item.source === id && item.target === neighbor);
        if (edge && edge.strength >= minStrength) dfs(neighbor, depth + 1);
      }
      for (const neighbor of this.adjRev.get(id) || []) {
        const edge = this.graph.edges.find(item => item.target === id && item.source === neighbor);
        if (edge && edge.strength >= minStrength) dfs(neighbor, depth + 1);
      }
    };
    dfs(nodeId, 0);
    return results;
  }

  strongestPath(fromId: EntityId, toId: EntityId): MemoryNode[] {
    this.buildAdjacency();
    const visited = new Set<EntityId>();
    let bestPath: MemoryNode[] = [];
    let bestStrength = Number.NEGATIVE_INFINITY;
    const dfs = (id: EntityId, path: MemoryNode[], strength: number) => {
      const node = this.graph.nodes.find(item => item.id === id);
      if (!node || visited.has(id)) return;
      const nextPath = [...path, node];
      if (id === toId) {
        if (strength > bestStrength) {
          bestPath = nextPath;
          bestStrength = strength;
        }
        return;
      }
      visited.add(id);
      for (const neighbor of this.adj.get(id) || []) {
        const edge = this.graph.edges.find(item => item.source === id && item.target === neighbor);
        if (edge) dfs(neighbor, nextPath, strength + edge.strength);
      }
      visited.delete(id);
    };
    dfs(fromId, [], 0);
    return bestPath;
  }

  forget(minConfidence: number = 0.3): number {
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) throw new Error('minConfidence must be in [0,1]');
    const before = this.graph.nodes.length;
    this.graph.nodes = this.graph.nodes.filter(node => (node.confidence ?? 0.5) >= minConfidence);
    const validIds = new Set(this.graph.nodes.map(node => node.id));
    this.graph.edges = this.graph.edges.filter(edge => validIds.has(edge.source) && validIds.has(edge.target));
    this.buildAdjacency();
    return before - this.graph.nodes.length;
  }

  /**
   * Consolidate only records that explicitly assert the same canonical identity.
   * Similar labels are retrieval hints, never identity evidence.
   */
  consolidateWithReport(): ConsolidationReport {
    const canonicalGroups = new Map<string, MemoryNode[]>();
    let skippedWithoutIdentity = 0;

    for (const node of this.graph.nodes) {
      const canonicalUri = typeof node.metadata?.canonicalUri === 'string'
        ? node.metadata.canonicalUri.trim()
        : '';
      if (!canonicalUri) {
        skippedWithoutIdentity += 1;
        continue;
      }
      const key = `${node.type}|${canonicalUri}`;
      const group = canonicalGroups.get(key) || [];
      group.push(node);
      canonicalGroups.set(key, group);
    }

    const redirects = new Map<EntityId, EntityId>();
    let merged = 0;
    for (const group of canonicalGroups.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || String(a.id).localeCompare(String(b.id)));
      const canonical = group[0];
      for (const duplicate of group.slice(1)) {
        canonical.accessCount += duplicate.accessCount;
        canonical.confidence = Math.max(canonical.confidence ?? 0.5, duplicate.confidence ?? 0.5);
        canonical.content = canonical.content || duplicate.content;
        canonical.lastAccessed = canonical.lastAccessed > duplicate.lastAccessed ? canonical.lastAccessed : duplicate.lastAccessed;
        redirects.set(duplicate.id, canonical.id);
        merged += 1;
      }
    }

    if (redirects.size > 0) {
      this.graph.nodes = this.graph.nodes.filter(node => !redirects.has(node.id));
      const dedupe = new Map<string, MemoryEdge>();
      for (const edge of this.graph.edges) {
        const source = redirects.get(edge.source) || edge.source;
        const target = redirects.get(edge.target) || edge.target;
        if (source === target) continue;
        const key = `${String(source)}|${String(target)}|${edge.type}`;
        const existing = dedupe.get(key);
        if (!existing || edge.strength > existing.strength) {
          dedupe.set(key, { ...edge, source, target });
        }
      }
      this.graph.edges = Array.from(dedupe.values());
      this.buildAdjacency();
    }

    return { merged, skippedWithoutIdentity, canonicalGroups: canonicalGroups.size };
  }

  consolidate(): number {
    return this.consolidateWithReport().merged;
  }

  validate(): string[] {
    const errors: string[] = [];
    const nodeIds = new Set(this.graph.nodes.map(node => node.id));
    const canonicalOwners = new Map<string, EntityId>();
    for (const node of this.graph.nodes) {
      const canonicalUri = typeof node.metadata?.canonicalUri === 'string' ? node.metadata.canonicalUri.trim() : '';
      if (canonicalUri) {
        const key = `${node.type}|${canonicalUri}`;
        const owner = canonicalOwners.get(key);
        if (owner && owner !== node.id) errors.push(`Duplicate canonical identity ${key}: ${String(owner)}, ${String(node.id)}`);
        canonicalOwners.set(key, node.id);
      }
    }
    for (const edge of this.graph.edges) {
      if (!nodeIds.has(edge.source)) errors.push(`Dangling edge: source ${String(edge.source)} not found`);
      if (!nodeIds.has(edge.target)) errors.push(`Dangling edge: target ${String(edge.target)} not found`);
      if (edge.source === edge.target) errors.push(`Self-loop edge: ${String(edge.source)}`);
      if (!Number.isFinite(edge.strength) || edge.strength < 0 || edge.strength > 1) errors.push(`Invalid edge strength: ${String(edge.id)}`);
    }
    return errors;
  }

  metrics() {
    const n = this.graph.nodes.length;
    const e = this.graph.edges.length;
    this.buildAdjacency();
    const degree = this.graph.nodes.map(node => (this.adj.get(node.id)?.length || 0) + (this.adjRev.get(node.id)?.length || 0));
    const avgDegree = n > 0 ? degree.reduce((a, b) => a + b, 0) / n : 0;
    const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
    return { nodeCount: n, edgeCount: e, avgDegree, density, maxDegree: Math.max(...degree, 0) };
  }

  toJSON(): MemoryGraph {
    return JSON.parse(JSON.stringify(this.graph));
  }

  static fromJSON(data: MemoryGraph): MemoryGraphEngine {
    const graph = new MemoryGraphEngine(data.name);
    graph.graph = JSON.parse(JSON.stringify(data));
    graph.buildAdjacency();
    return graph;
  }

  toMermaid(): string {
    let mermaid = 'graph LR\n  title: "Memory Graph"\n';
    for (const node of this.graph.nodes) {
      const shape = node.type === 'entity' ? '[(' : node.type === 'insight' ? '{' : '[';
      const close = node.type === 'entity' ? ')]' : node.type === 'insight' ? '}' : ']';
      mermaid += `    ${String(node.id).replace(/[^a-zA-Z0-9]/g, '_')}${shape}"${node.name}"${close}\n`;
    }
    for (const edge of this.graph.edges) {
      const source = String(edge.source).replace(/[^a-zA-Z0-9]/g, '_');
      const target = String(edge.target).replace(/[^a-zA-Z0-9]/g, '_');
      const label = edge.strength ? `|${(edge.strength * 100).toFixed(0)}%|` : '';
      mermaid += `    ${source} -->${label}${target}\n`;
    }
    return mermaid;
  }
}
