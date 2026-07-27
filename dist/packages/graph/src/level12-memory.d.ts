import { EntityId, Timestamp } from '@cos/core';
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
export declare class MemoryGraphEngine {
    private graph;
    private adj;
    private adjRev;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: MemoryEdgeType, strength?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): MemoryNode | undefined;
    getNodes(): MemoryNode[];
    getEdges(): MemoryEdge[];
    accessNode(nodeId: EntityId): MemoryNode | undefined;
    buildConversation(): void;
    recall(nodeId: EntityId, maxDepth?: number, minStrength?: number): MemoryNode[];
    strongestPath(fromId: EntityId, toId: EntityId): MemoryNode[];
    forget(minConfidence?: number): number;
    consolidate(): number;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
        maxDegree: number;
    };
    toJSON(): MemoryGraph;
    static fromJSON(data: MemoryGraph): MemoryGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level12-memory.d.ts.map