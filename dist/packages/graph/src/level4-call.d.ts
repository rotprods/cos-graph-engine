import { EntityId, Timestamp } from '@cos/core';
export type CallNodeType = 'function' | 'method' | 'api' | 'async' | 'external' | 'root';
export interface CallNode {
    id: EntityId;
    name: string;
    module?: string;
    type: CallNodeType;
    line?: number;
    column?: number;
    selfTime?: number;
    totalTime?: number;
    callCount?: number;
    depth?: number;
}
export interface CallEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    callCount: number;
    avgDuration?: number;
    totalDuration?: number;
    async?: boolean;
    args?: string[];
}
export interface CallGraph {
    id: EntityId;
    name: string;
    nodes: CallNode[];
    edges: CallEdge[];
    createdAt: Timestamp;
    totalTime: number;
}
export declare class CallGraphBuilder {
    private graphs;
    private activeSpan;
    private adj;
    private adjRev;
    private buildAdjacency;
    createGraph(name: string): EntityId;
    addNode(graphId: EntityId, node: CallNode): void;
    removeNode(graphId: EntityId, nodeId: EntityId): void;
    addEdge(graphId: EntityId, edge: CallEdge): void;
    removeEdge(graphId: EntityId, edgeId: EntityId): void;
    getNode(graphId: EntityId, nodeId: EntityId): CallNode | undefined;
    getEdge(graphId: EntityId, edgeId: EntityId): CallEdge | undefined;
    getGraph(id: EntityId): CallGraph | undefined;
    enterCall(graphId: EntityId, name: string, type?: CallNodeType, module?: string): EntityId;
    exitCall(graphId: EntityId, nodeId: EntityId): void;
    analyzeStackTrace(graphId: EntityId, stack: string[]): void;
    findHotPaths(graphId: EntityId, minCalls?: number): CallEdge[];
    computeDepth(graphId: EntityId): Map<EntityId, number>;
    toFlameData(graphId: EntityId): Array<{
        name: string;
        value: number;
        children: any[];
    }>;
    toMermaid(graphId: EntityId): string;
    validate(graphId: EntityId): string[];
    metrics(graphId: EntityId): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(graphId: EntityId): CallGraph | undefined;
    static fromJSON(data: CallGraph): CallGraphBuilder;
}
//# sourceMappingURL=level4-call.d.ts.map