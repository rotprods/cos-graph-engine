import { EntityId, CellContext, Cost, Confidence, Timestamp } from '@cos/core';
export type ExecNodeType = 'function' | 'tool' | 'subgraph' | 'condition' | 'transform' | 'sleep';
export interface ExecNode {
    id: EntityId;
    name: string;
    type: ExecNodeType;
    fn?: (input: unknown, context: CellContext) => Promise<unknown>;
    toolName?: string;
    toolInput?: unknown;
    config?: Record<string, unknown>;
    timeout?: number;
    retries?: number;
}
export interface ExecEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    dataMap?: (input: unknown) => unknown;
    condition?: (output: unknown) => boolean;
}
export interface ExecNodeResult {
    nodeId: EntityId;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    input: unknown;
    output: unknown;
    error?: string;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    duration: number;
    confidence: Confidence;
    cost: Cost;
}
export interface ExecutionGraph {
    id: EntityId;
    name: string;
    nodes: ExecNode[];
    edges: ExecEdge[];
    maxConcurrency: number;
    context: CellContext;
}
export declare class ExecutionGraphEngine {
    private graphs;
    private results;
    createGraph(name: string, nodes: ExecNode[], edges: ExecEdge[], options?: {
        maxConcurrency?: number;
    }): Promise<EntityId>;
    /** Add a node to an existing graph */
    addNode(graphId: EntityId, node: ExecNode): void;
    /** Remove a node and its connected edges from an existing graph */
    removeNode(graphId: EntityId, nodeId: EntityId): void;
    /** Add an edge to an existing graph */
    addEdge(graphId: EntityId, edge: ExecEdge): void;
    /** Remove an edge by id */
    removeEdge(graphId: EntityId, edgeId: EntityId): void;
    executeGraph(graphId: EntityId, input?: unknown): Promise<Map<EntityId, ExecNodeResult>>;
    private executeNodeWithRetry;
    private executeNode;
    private buildAdjacency;
    private buildInDegree;
    getResults(graphId: EntityId): Map<EntityId, ExecNodeResult> | undefined;
    getGraph(id: EntityId): ExecutionGraph | undefined;
}
//# sourceMappingURL=level1-execution.d.ts.map