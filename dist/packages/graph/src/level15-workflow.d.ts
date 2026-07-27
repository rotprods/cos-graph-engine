import { EntityId, Timestamp } from '@cos/core';
export type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'transform' | 'webhook' | 'notification' | 'delay' | 'end';
export type WorkflowEdgeType = 'on_success' | 'on_failure' | 'on_condition_true' | 'on_condition_false' | 'timeout';
export interface WorkflowNode {
    id: EntityId;
    name: string;
    type: WorkflowNodeType;
    service?: string;
    config?: Record<string, unknown>;
    retries?: number;
    timeout?: number;
    createdAt: Timestamp;
}
export interface WorkflowEdge {
    id: EntityId;
    source: EntityId;
    target: EntityId;
    type: WorkflowEdgeType;
    condition?: string;
    createdAt: Timestamp;
}
export interface WorkflowGraph {
    id: EntityId;
    name: string;
    description?: string;
    enabled: boolean;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    createdAt: Timestamp;
}
export declare class WorkflowGraphEngine {
    private graph;
    private adj;
    private adjRev;
    constructor(name: string, description?: string);
    private buildAdjacency;
    addNode(n: Omit<WorkflowNode, 'id' | 'createdAt'>): EntityId;
    removeNode(nodeId: EntityId): void;
    addEdge(source: EntityId, target: EntityId, type: WorkflowEdgeType, condition?: string): EntityId;
    removeEdge(edgeId: EntityId): void;
    getNode(nodeId: EntityId): WorkflowNode | undefined;
    getNodes(): WorkflowNode[];
    getEdges(): WorkflowEdge[];
    getEnabled(): boolean;
    setEnabled(enabled: boolean): void;
    buildSupportWorkflow(): void;
    topologicalSort(): EntityId[];
    detectCycle(): EntityId[] | null;
    execute(initialData?: Record<string, unknown>): WorkflowNode[];
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        actionCount: number;
        triggerCount: number;
    };
    toJSON(): WorkflowGraph;
    static fromJSON(data: WorkflowGraph): WorkflowGraphEngine;
    toMermaid(): string;
}
//# sourceMappingURL=level15-workflow.d.ts.map