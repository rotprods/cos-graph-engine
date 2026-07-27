export interface DataFlowNode {
    id: string;
    name: string;
    type: 'source' | 'transform' | 'sink' | 'storage' | 'filter' | 'join';
    inputShape?: string;
    outputShape?: string;
    batchSize?: number;
    throughput?: number;
    latency?: number;
    ops?: string;
    memoryMB?: number;
    params?: Record<string, unknown>;
}
export interface DataFlowEdge {
    id: string;
    source: string;
    target: string;
    dataType: string;
    shape?: string;
    sizeBytes?: number;
    compression?: string;
    partitionKey?: string;
}
export declare class DataFlowGraph {
    nodes: DataFlowNode[];
    edges: DataFlowEdge[];
    private adj;
    private adjRev;
    private buildAdjacency;
    addNode(n: DataFlowNode): string;
    removeNode(nodeId: string): void;
    addEdge(e: DataFlowEdge): void;
    removeEdge(edgeId: string): void;
    getNode(nodeId: string): DataFlowNode | undefined;
    getEdge(edgeId: string): DataFlowEdge | undefined;
    buildMLPipeline(): void;
    buildETLPipeline(): void;
    findBottlenecks(thresholdPercentile?: number): DataFlowNode[];
    criticalPath(): DataFlowNode[];
    totalLatency(): number;
    toMermaid(): string;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(): {
        nodes: DataFlowNode[];
        edges: DataFlowEdge[];
    };
    static fromJSON(data: {
        nodes: DataFlowNode[];
        edges: DataFlowEdge[];
    }): DataFlowGraph;
}
//# sourceMappingURL=level6-dataflow.d.ts.map