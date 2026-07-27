import { EntityId, Timestamp } from '@cos/core';
export type BioNodeType = 'neuron' | 'synapse' | 'protein' | 'gene' | 'cell' | 'receptor' | 'neurotransmitter';
export type BioEdgeType = 'connects_to' | 'activates' | 'inhibits' | 'expresses' | 'binds_to' | 'regulates';
export interface BiologicalNode {
    id: EntityId;
    name: string;
    type: BioNodeType;
    weight?: number;
    threshold?: number;
    firingRate?: number;
    concentration?: number;
    location?: string;
    createdAt: Timestamp;
}
export interface BiologicalEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: BioEdgeType;
    strength: number;
    plasticity?: number;
    createdAt: Timestamp;
}
export interface BiologicalGraph {
    id: EntityId;
    name: string;
    createdAt: Timestamp;
    nodes: BiologicalNode[];
    edges: BiologicalEdge[];
}
export declare class BiologicalGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<BiologicalNode, 'id' | 'createdAt'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: BioEdgeType, strength?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): BiologicalNode | undefined;
    getNodes(): BiologicalNode[];
    getEdges(): BiologicalEdge[];
    buildNeuralCircuit(): void;
    buildProteinNetwork(): void;
    simulateFiring(startNodeId: EntityId, iterations?: number): BiologicalNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        neuronCount: number;
        avgStrength: number;
        inhibitoryEdges: number;
    };
    toJSON(): BiologicalGraph;
    static fromJSON(data: BiologicalGraph): BiologicalGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level18-biological.d.ts.map