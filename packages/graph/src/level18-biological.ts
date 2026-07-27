// LEVEL 18: BIOLOGICAL GRAPH
// Neural circuits, protein networks, synaptic firing simulation
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type BioNodeType = 'neuron' | 'synapse' | 'protein' | 'gene' | 'cell' | 'receptor' | 'neurotransmitter';
export type BioEdgeType = 'connects_to' | 'activates' | 'inhibits' | 'expresses' | 'binds_to' | 'regulates';

export interface BiologicalNode {
  id: EntityId; name: string; type: BioNodeType;
  weight?: number; threshold?: number; firingRate?: number;
  concentration?: number; location?: string; createdAt: Timestamp;
}

export interface BiologicalEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: BioEdgeType; strength: number; plasticity?: number; createdAt: Timestamp;
}

export interface BiologicalGraph { id: EntityId; name: string; createdAt: Timestamp; nodes: BiologicalNode[]; edges: BiologicalEdge[]; }

export class BiologicalGraphEngine {
  private graph: BiologicalGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Biological Network') {
    this.graph = { id: generateId(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
    }
  }

  addNode(n: Omit<BiologicalNode, 'id' | 'createdAt'>): EntityId {
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

  addEdge(source: EntityId, target: EntityId, type: BioEdgeType, strength: number = 0.5): EntityId {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, strength, plasticity: 0.5, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeEdge(edgeId: EntityId): void {
    const idx = this.graph.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) throw new Error(`Edge ${edgeId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getNode(nodeId: EntityId): BiologicalNode | undefined { return this.graph.nodes.find(n => n.id === nodeId); }
  getNodes(): BiologicalNode[] { return this.graph.nodes; }
  getEdges(): BiologicalEdge[] { return this.graph.edges; }

  buildNeuralCircuit() {
    const sensory = this.addNode({ name: 'Sensory Neuron', type: 'neuron', weight: 1.0, threshold: 0.5, firingRate: 10 });
    const interneuronA = this.addNode({ name: 'Interneuron A', type: 'neuron', weight: 0.8, threshold: 0.3, firingRate: 20 });
    const interneuronB = this.addNode({ name: 'Interneuron B', type: 'neuron', weight: 0.6, threshold: 0.4, firingRate: 15 });
    const motor = this.addNode({ name: 'Motor Neuron', type: 'neuron', weight: 0.9, threshold: 0.6, firingRate: 5 });
    const gaba = this.addNode({ name: 'GABA', type: 'neurotransmitter', concentration: 0.5 });
    const glutamate = this.addNode({ name: 'Glutamate', type: 'neurotransmitter', concentration: 0.8 });
    this.addEdge(sensory, interneuronA, 'connects_to', 0.8);
    this.addEdge(sensory, interneuronB, 'connects_to', 0.6);
    this.addEdge(interneuronA, motor, 'connects_to', 0.7);
    this.addEdge(interneuronB, motor, 'inhibits', 0.5);
    this.addEdge(interneuronA, gaba, 'activates', 0.4);
    this.addEdge(interneuronB, glutamate, 'activates', 0.6);
  }

  buildProteinNetwork() {
    const p53 = this.addNode({ name: 'p53', type: 'protein', concentration: 0.6 });
    const mdm2 = this.addNode({ name: 'MDM2', type: 'protein', concentration: 0.7 });
    const bax = this.addNode({ name: 'BAX', type: 'protein', concentration: 0.4 });
    const bcl2 = this.addNode({ name: 'Bcl-2', type: 'protein', concentration: 0.5 });
    const caspase3 = this.addNode({ name: 'Caspase-3', type: 'protein', concentration: 0.3 });
    this.addEdge(p53, mdm2, 'regulates', 0.8);
    this.addEdge(mdm2, p53, 'binds_to', 0.7);
    this.addEdge(p53, bax, 'activates', 0.6);
    this.addEdge(bcl2, bax, 'inhibits', 0.5);
    this.addEdge(bax, caspase3, 'activates', 0.9);
  }

  simulateFiring(startNodeId: EntityId, iterations: number = 5): BiologicalNode[] {
    this.buildAdjacency();
    const fired: BiologicalNode[] = []; const visited = new Set<EntityId>();
    let queue = [startNodeId];
    for (let iter = 0; iter < iterations && queue.length > 0; iter++) {
      const nextQueue: EntityId[] = [];
      for (const id of queue) {
        if (visited.has(id)) continue; visited.add(id);
        const node = this.graph.nodes.find(n => n.id === id);
        if (node) fired.push(node);
        for (const nb of this.adj.get(id) || []) {
          const edge = this.graph.edges.find(e => e.source === id && e.target === nb);
          if (edge && edge.strength > 0.5) nextQueue.push(nb);
        }
      }
      queue = nextQueue;
    }
    return fired;
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
    return { nodeCount: n, edgeCount: e, neuronCount: this.graph.nodes.filter(no => no.type === 'neuron').length, avgStrength: this.graph.edges.reduce((s, e) => s + e.strength, 0) / Math.max(1, e), inhibitoryEdges: this.graph.edges.filter(e => e.type === 'inhibits').length };
  }

  toJSON(): BiologicalGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: BiologicalGraph): BiologicalGraphEngine { const g = new BiologicalGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph LR\n  title: "Biological Network"\n';
    for (const n of this.graph.nodes) {
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name}"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      const style = e.type === 'inhibits' ? '-.x' : '-->';
      m += `    ${s}${style}|"${e.type}"| ${t}\n`;
    }
    return m;
  }
}