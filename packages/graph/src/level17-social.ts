// LEVEL 17: SOCIAL GRAPH
// Social networks, influence, recommendations, mutual friends
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type SocialNodeType = 'person' | 'company' | 'event' | 'group' | 'page' | 'influencer';
export type SocialEdgeType = 'friend_of' | 'follows' | 'works_at' | 'attended' | 'likes' | 'family_of' | 'mentions';

export interface SocialNode {
  id: EntityId; name: string; type: SocialNodeType; verified: boolean;
  followers?: number; influence?: number; interests?: string[];
  location?: string; createdAt: Timestamp;
}

export interface SocialEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: SocialEdgeType; strength: number; createdAt: Timestamp;
}

export interface SocialGraph { id: EntityId; name: string; createdAt: Timestamp; nodes: SocialNode[]; edges: SocialEdge[]; }

export class SocialGraphEngine {
  private graph: SocialGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Social Network') {
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

  addNode(n: Omit<SocialNode, 'id' | 'joinedAt'>): EntityId {
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

  addEdge(source: EntityId, target: EntityId, type: SocialEdgeType, strength: number = 0.5): EntityId {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, strength, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeEdge(edgeId: EntityId): void {
    const idx = this.graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: EntityId): SocialNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }
  getNodes(): SocialNode[] { return this.graph.nodes; }
  getEdge(edgeId: EntityId): SocialEdge | undefined { return this.graph.edges.find(e => e.id === edgeId); }
  getEdges(): SocialEdge[] { return this.graph.edges; }

  buildTechNetwork() {
    const alice = this.addNode({ name: 'Alice', type: 'person', verified: true, followers: 1500, influence: 0.7, interests: ['AI', 'startups'], location: 'SF' });
    const bob = this.addNode({ name: 'Bob', type: 'person', verified: false, followers: 300, influence: 0.4, interests: ['engineering'], location: 'NYC' });
    const carol = this.addNode({ name: 'Carol', type: 'influencer', verified: true, followers: 50000, influence: 0.9, interests: ['AI', 'tech'], location: 'SF' });
    const acme = this.addNode({ name: 'Acme Corp', type: 'company', verified: true, interests: ['B2B', 'SaaS'] });
    const summit = this.addNode({ name: 'AI Summit 2025', type: 'event', verified: true, interests: ['AI', 'conference'], location: 'SF' });
    this.addEdge(alice, bob, 'friend_of', 0.8);
    this.addEdge(alice, carol, 'follows', 0.6);
    this.addEdge(bob, carol, 'follows', 0.5);
    this.addEdge(alice, acme, 'works_at', 0.9);
    this.addEdge(bob, acme, 'works_at', 0.7);
    this.addEdge(alice, summit, 'attended', 0.8);
    this.addEdge(carol, summit, 'attended', 0.9);
    this.addEdge(carol, acme, 'mentions', 0.4);
  }

  mutualFriends(personA: EntityId, personB: EntityId): SocialNode[] {
    this.buildAdjacency();
    const friendsA = this.adj.get(personA) || [];
    const friendsB = this.adj.get(personB) || [];
    const setB = new Set(friendsB);
    return friendsA.filter(id => setB.has(id)).map(id => this.graph.nodes.find(n => n.id === id)).filter(Boolean) as SocialNode[];
  }

  mostInfluential(): SocialNode | undefined {
    return this.graph.nodes.reduce((best, n) => ((n.influence || 0) > (best?.influence || 0) ? n : best), undefined as SocialNode | undefined);
  }

  recommendFriends(personId: EntityId): SocialNode[] {
    this.buildAdjacency();
    const friendsSet = new Set(this.adj.get(personId) || []);
    friendsSet.add(personId);
    const scores = new Map<EntityId, number>();
    for (const friendId of this.adj.get(personId) || []) {
      for (const friendOfFriend of this.adj.get(friendId) || []) {
        if (!friendsSet.has(friendOfFriend)) {
          scores.set(friendOfFriend, (scores.get(friendOfFriend) || 0) + 1);
        }
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => this.graph.nodes.find(n => n.id === id))
      .filter(Boolean) as SocialNode[];
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
    const deg = this.graph.nodes.map(no => this.adj.get(no.id)?.length || 0);
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const avgInfluence = this.graph.nodes.filter(no => no.influence).reduce((s, no) => s + (no.influence || 0), 0) / Math.max(1, this.graph.nodes.filter(no => no.influence).length);
    return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, avgInfluence, verifiedCount: this.graph.nodes.filter(no => no.verified).length };
  }

  toJSON(): SocialGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: SocialGraph): SocialGraphEngine { const g = new SocialGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph LR\n';
    for (const n of this.graph.nodes) {
      const verified = n.verified ? ' ✓' : '';
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name}${verified}"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      m += `    ${s} -->|"${e.type}"| ${t}\n`;
    }
    return m;
  }
}