import { EntityId, Timestamp } from '@cos/core';
export type ToolType = 'api' | 'function' | 'database' | 'storage' | 'ai' | 'communication' | 'compute';
export type ToolEdgeType = 'depends_on' | 'triggers' | 'provides_data_for' | 'authenticates_via' | 'fallback_to';
export interface ToolNode {
    id: EntityId;
    name: string;
    type: ToolType;
    description: string;
    requiredCapabilities: string[];
    rateLimit: number;
    latency: number;
    costPerCall: number;
    enabled: boolean;
    createdAt: Timestamp;
}
export interface ToolEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: ToolEdgeType;
    priority: number;
    createdAt: Timestamp;
}
export interface ToolGraph {
    id: EntityId;
    name: string;
    createdAt: Timestamp;
    nodes: ToolNode[];
    edges: ToolEdge[];
}
export declare class ToolGraphEngine {
    private graph;
    private adj;
    constructor(name?: string);
    private buildAdjacency;
    addNode(n: Omit<ToolNode, 'id' | 'createdAt'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: ToolEdgeType, priority?: number): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): ToolNode | undefined;
    getNodes(): ToolNode[];
    getEdges(): ToolEdge[];
    buildToolEcosystem(): void;
    route(fromCapability: string, toTool: string): ToolNode[];
    findDisabled(): ToolNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        toolTypes: number;
        avgLatency: number;
        disabledCount: number;
    };
    toJSON(): ToolGraph;
    static fromJSON(data: ToolGraph): ToolGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level14-tool.d.ts.map