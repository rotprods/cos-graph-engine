import { ComputationalGraph, ComputeGraphData } from './level7-compute';
import { SMB } from './smb';
import type { EntityId } from '@cos/core';
/**
 * SMB-integrated computational graph.
 * Wraps ComputationalGraph with save/load to the Shared Memory Bus
 * and publishes events for each computation.
 */
export declare class SMBComputeGraph {
    private graph;
    private smb;
    graphId: string;
    constructor(smb: SMB, name?: string);
    /** Delegate to underlying ComputationalGraph */
    get nodes(): import("./level7-compute").ComputeNode[];
    get edges(): import("./level7-compute").ComputeEdge[];
    addNode(n: Parameters<ComputationalGraph['addNode']>[0]): string;
    addEdge(e: Parameters<ComputationalGraph['addEdge']>[0]): void;
    buildMLP(inputDim?: number, hiddenDim?: number, numClasses?: number): void;
    buildExpression(): void;
    topologicalSort(): string[];
    paramCount(): number;
    toMermaid(): string;
    /** Forward pass + publish event */
    forward(inputs: Record<string, number>): Promise<number>;
    /** Backward pass + publish event */
    backward(): Promise<Map<string, number>>;
    /** Save computation graph state to SMB */
    save(): Promise<EntityId>;
    /** Load computation graph state from SMB */
    load(): Promise<boolean>;
    /** Get the underlying graph data */
    toJSON(): ComputeGraphData;
}
//# sourceMappingURL=level7-smb.d.ts.map