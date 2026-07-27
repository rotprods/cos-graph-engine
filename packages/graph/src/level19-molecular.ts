// LEVEL 19: MOLECULAR GRAPH
// Drug discovery, molecular fingerprints, bond types, ring detection, 3D conformers
// Refactored: mutation API, adjacency maps, serialization, validation

import { EntityId, Timestamp } from '@cos/core';
import { generateId } from '@cos/core';

export type AtomType = 'C' | 'O' | 'H' | 'N' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I' | 'generic';
export type BondType = 'single' | 'double' | 'triple' | 'aromatic' | 'ionic' | 'hydrogen';
export type MolecularNodeType = 'atom' | 'ion' | 'functional_group' | 'ring';

export interface AtomNode {
  id: EntityId; name: string; type: MolecularNodeType;
  element: AtomType; atomicNumber: number;
  charge?: number; mass?: number; hybridization?: 'sp' | 'sp2' | 'sp3';
  x?: number; y?: number; z?: number;
  implicitHydrogens?: number; metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface BondEdge {
  id: EntityId; source: EntityId; target: EntityId;
  type: BondType; order: number; length?: number; angle?: number;
  metadata?: Record<string, unknown>;
}

export interface MolecularGraph {
  id: EntityId; name: string; formula?: string; molecularWeight?: number;
  nodes: AtomNode[]; edges: BondEdge[]; createdAt: Timestamp;
}

export class MolecularGraphEngine {
  private graph: MolecularGraph;
  private adj: Map<EntityId, EntityId[]> = new Map();

  constructor(name: string = 'Molecule') {
    this.graph = { id: generateId(), name, nodes: [], edges: [], createdAt: new Date().toISOString() };
  }

  private buildAdjacency(): void {
    this.adj.clear();
    for (const n of this.graph.nodes) this.adj.set(n.id, []);
    for (const e of this.graph.edges) {
      if (this.adj.has(e.source)) this.adj.get(e.source)!.push(e.target);
      if (this.adj.has(e.target)) this.adj.get(e.target)!.push(e.source);
    }
  }

  addAtom(n: Omit<AtomNode, 'id' | 'createdAt'>): EntityId {
    const id = generateId();
    this.graph.nodes.push({ ...n, id, createdAt: new Date().toISOString() });
    this.buildAdjacency(); return id;
  }

  removeAtom(atomId: EntityId): void {
    const idx = this.graph.nodes.findIndex(n => n.id === atomId);
    if (idx === -1) throw new Error(`Atom ${atomId} not found`);
    this.graph.nodes.splice(idx, 1);
    this.graph.edges = this.graph.edges.filter(e => e.source !== atomId && e.target !== atomId);
    this.buildAdjacency();
  }

  addBond(source: EntityId, target: EntityId, type: BondType, order: number = 1): EntityId {
    if (!this.graph.nodes.some(n => n.id === source)) throw new Error(`Bond source ${source} not found`);
    if (!this.graph.nodes.some(n => n.id === target)) throw new Error(`Bond target ${target} not found`);
    const id = generateId();
    this.graph.edges.push({ id, source, target, type, order });
    this.buildAdjacency(); return id;
  }

  removeBond(bondId: EntityId): void {
    const idx = this.graph.edges.findIndex(e => e.id === bondId);
    if (idx === -1) throw new Error(`Bond ${bondId} not found`);
    this.graph.edges.splice(idx, 1); this.buildAdjacency();
  }

  getAtom(atomId: EntityId): AtomNode | undefined { return this.graph.nodes.find(n => n.id === atomId); }
  getAtoms(): AtomNode[] { return this.graph.nodes; }
  getBond(bondId: EntityId): BondEdge | undefined { return this.graph.edges.find(e => e.id === bondId); }
  getBonds(): BondEdge[] { return this.graph.edges; }

  buildWater() {
    const o = this.addAtom({ name: 'O', element: 'O', atomicNumber: 8, type: 'atom', mass: 15.999, hybridization: 'sp3', x: 0, y: 0, z: 0, implicitHydrogens: 0 });
    const h1 = this.addAtom({ name: 'H1', element: 'H', atomicNumber: 1, type: 'atom', mass: 1.008, x: 0.757, y: 0.586, z: 0, implicitHydrogens: 0 });
    const h2 = this.addAtom({ name: 'H2', element: 'H', atomicNumber: 1, type: 'atom', mass: 1.008, x: -0.757, y: 0.586, z: 0, implicitHydrogens: 0 });
    this.addBond(o, h1, 'single', 1);
    this.addBond(o, h2, 'single', 1);
    this.graph.molecularWeight = 15.999 + 1.008 + 1.008;
    this.graph.formula = 'H2O';
  }

  buildBenzene() {
    const c1 = this.addAtom({ name: 'C1', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: 1.0, y: 0, z: 0, implicitHydrogens: 0 });
    const c2 = this.addAtom({ name: 'C2', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: 0.5, y: 0.866, z: 0, implicitHydrogens: 0 });
    const c3 = this.addAtom({ name: 'C3', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: -0.5, y: 0.866, z: 0, implicitHydrogens: 0 });
    const c4 = this.addAtom({ name: 'C4', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: -1.0, y: 0, z: 0, implicitHydrogens: 0 });
    const c5 = this.addAtom({ name: 'C5', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: -0.5, y: -0.866, z: 0, implicitHydrogens: 0 });
    const c6 = this.addAtom({ name: 'C6', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', x: 0.5, y: -0.866, z: 0, implicitHydrogens: 0 });
    this.addBond(c1, c2, 'aromatic', 1.5); this.addBond(c2, c3, 'aromatic', 1.5);
    this.addBond(c3, c4, 'aromatic', 1.5); this.addBond(c4, c5, 'aromatic', 1.5);
    this.addBond(c5, c6, 'aromatic', 1.5); this.addBond(c6, c1, 'aromatic', 1.5);
    this.graph.formula = 'C6H6';
    this.graph.molecularWeight = 6 * 12.011 + 6 * 1.008;
  }

  buildAspirin() {
    // Benzene ring
    const c1 = this.addAtom({ name: 'C1', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const c2 = this.addAtom({ name: 'C2', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const c3 = this.addAtom({ name: 'C3', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const c4 = this.addAtom({ name: 'C4', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const c5 = this.addAtom({ name: 'C5', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const c6 = this.addAtom({ name: 'C6', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    this.addBond(c1, c2, 'aromatic', 1.5); this.addBond(c2, c3, 'aromatic', 1.5);
    this.addBond(c3, c4, 'aromatic', 1.5); this.addBond(c4, c5, 'aromatic', 1.5);
    this.addBond(c5, c6, 'aromatic', 1.5); this.addBond(c6, c1, 'aromatic', 1.5);
    // COOH group
    const c7 = this.addAtom({ name: 'C7', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp2', implicitHydrogens: 0 });
    const o1 = this.addAtom({ name: 'O1', element: 'O', atomicNumber: 8, type: 'atom', mass: 15.999, hybridization: 'sp2', implicitHydrogens: 0 });
    const o2 = this.addAtom({ name: 'O2', element: 'O', atomicNumber: 8, type: 'atom', mass: 15.999, hybridization: 'sp2', implicitHydrogens: 0 });
    this.addBond(c1, c7, 'single', 1); this.addBond(c7, o1, 'double', 2); this.addBond(c7, o2, 'single', 1);
    // O-CH3 group
    const o3 = this.addAtom({ name: 'O3', element: 'O', atomicNumber: 8, type: 'atom', mass: 15.999, hybridization: 'sp3', implicitHydrogens: 0 });
    const c8 = this.addAtom({ name: 'C8', element: 'C', atomicNumber: 6, type: 'atom', mass: 12.011, hybridization: 'sp3', implicitHydrogens: 0 });
    this.addBond(c2, o3, 'single', 1); this.addBond(o3, c8, 'single', 1);
    this.graph.formula = 'C9H8O4';
  }

  findRings(): EntityId[][] {
    this.buildAdjacency();
    const rings: EntityId[][] = [];
    const dfs = (start: EntityId, current: EntityId, path: EntityId[], visited: Set<string>) => {
      if (path.length >= 12) return;
      if (path.length >= 3 && current === start) {
        const key = [...path].sort().join(',');
        if (!visited.has(key)) { visited.add(key); rings.push([...path]); }
        return;
      }
      for (const nb of this.adj.get(current) || []) {
        if (nb === start && path.length >= 2) { dfs(start, nb, [...path], visited); }
        else if (!path.includes(nb)) { dfs(start, nb, [...path, nb], visited); }
      }
    };
    for (const n of this.graph.nodes) {
      dfs(n.id, n.id, [n.id], new Set());
    }
    return rings;
  }

  computeWeight(): number {
    if (this.graph.molecularWeight) return this.graph.molecularWeight;
    const massMap: Record<string, number> = { C: 12.011, O: 15.999, H: 1.008, N: 14.007, S: 32.065, P: 30.974, F: 18.998, Cl: 35.45, Br: 79.904, I: 126.904, generic: 12.011 };
    return this.graph.nodes.reduce((s, n) => s + (n.mass || massMap[n.element] || 12.011) + (n.implicitHydrogens || 0) * 1.008, 0);
  }

  validate(): string[] {
    const errors: string[] = [];
    for (const e of this.graph.edges) {
      if (!this.graph.nodes.some(n => n.id === e.source)) errors.push(`Dangling bond source: ${e.source}`);
      if (!this.graph.nodes.some(n => n.id === e.target)) errors.push(`Dangling bond target: ${e.target}`);
    }
    // Carbon valence check
    for (const n of this.graph.nodes) {
      if (n.element === 'C') {
        const bondCount = this.graph.edges.filter(e => e.source === n.id || e.target === n.id).length;
        if (bondCount > 4) errors.push(`Carbon ${n.id} has ${bondCount} bonds (max 4)`);
      }
    }
    return errors;
  }

  metrics() {
    const n = this.graph.nodes.length; const e = this.graph.edges.length;
    this.buildAdjacency();
    const deg = this.graph.nodes.map(no => this.adj.get(no.id)?.length || 0);
    const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
    const atomTypes = [...new Set(this.graph.nodes.map(no => no.element))];
    const bondTypes = [...new Set(this.graph.edges.map(ed => ed.type))];
    return { atomCount: n, bondCount: e, atomTypes, molecularWeight: this.computeWeight(), bondTypes, ringCount: this.findRings().length };
  }

  toJSON(): MolecularGraph { return JSON.parse(JSON.stringify(this.graph)); }
  static fromJSON(data: MolecularGraph): MolecularGraphEngine { const g = new MolecularGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }

  toMermaid(): string {
    let m = 'graph TD\n  title: "Molecular Graph"\n';
    for (const n of this.graph.nodes) {
      const label = `${n.element}${n.id.replace(/[^0-9]/g, '') || ''}`;
      m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${label}"]\n`;
    }
    for (const e of this.graph.edges) {
      const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
      const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
      const style = e.type === 'aromatic' ? '-.->' : '---';
      m += `    ${s}${style}${t}\n`;
    }
    return m;
  }
}