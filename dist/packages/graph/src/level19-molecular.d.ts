import { EntityId, Timestamp } from '@cos/core';
export type AtomType = 'C' | 'O' | 'H' | 'N' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I' | 'generic';
export type BondType = 'single' | 'double' | 'triple' | 'aromatic' | 'ionic' | 'hydrogen';
export type MolecularNodeType = 'atom' | 'ion' | 'functional_group' | 'ring';
export interface AtomNode {
    id: EntityId;
    name: string;
    type: MolecularNodeType;
    element: AtomType;
    atomicNumber: number;
    charge?: number;
    mass?: number;
    hybridization?: 'sp' | 'sp2' | 'sp3';
    x?: number;
    y?: number;
    z?: number;
    implicitHydrogens?: number;
    metadata?: Record<string, unknown>;
    createdAt: Timestamp;
}
export interface BondEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: BondType;
    order: number;
    length?: number;
    angle?: number;
    metadata?: Record<string, unknown>;
}
export interface MolecularGraph {
    id: EntityId;
    name: string;
    formula?: string;
    molecularWeight?: number;
    nodes: AtomNode[];
    edges: BondEdge[];
    createdAt: Timestamp;
}
export declare class MolecularGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addAtom(n: Omit<AtomNode, 'id' | 'createdAt'>): EntityId;
    removeAtom(atomId: EntityId): void;
    addBond(source: EntityId, target: EntityId, type: BondType, order?: number): EntityId;
    removeBond(bondId: EntityId): void;
    getAtom(atomId: EntityId): AtomNode | undefined;
    getAtoms(): AtomNode[];
    getBond(bondId: EntityId): BondEdge | undefined;
    getBonds(): BondEdge[];
    buildWater(): void;
    buildBenzene(): void;
    buildAspirin(): void;
    findRings(): EntityId[][];
    computeWeight(): number;
    validate(): string[];
    metrics(): {
        atomCount: number;
        bondCount: number;
        atomTypes: AtomType[];
        molecularWeight: number;
        bondTypes: BondType[];
        ringCount: number;
    };
    toJSON(): MolecularGraph;
    static fromJSON(data: MolecularGraph): MolecularGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level19-molecular.d.ts.map