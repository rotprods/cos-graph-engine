export interface EmbeddingNode {
    id: string;
    label: string;
    vector: number[];
    metadata?: Record<string, unknown>;
    clusterId?: number;
}
export interface EmbeddingEdge {
    id: string;
    source: string;
    target: string;
    similarity: number;
    distance: number;
}
export declare class EmbeddingGraph {
    nodes: EmbeddingNode[];
    edges: EmbeddingEdge[];
    private adj;
    private buildAdjacency;
    addNode(n: EmbeddingNode): string;
    removeNode(nodeId: string): void;
    addEdge(e: EmbeddingEdge): void;
    removeEdge(edgeId: string): void;
    getNode(nodeId: string): EmbeddingNode | undefined;
    static distance(a: number[], b: number[]): number;
    static cosine(a: number[], b: number[]): number;
    buildKNN(k?: number): void;
    buildEpsilon(epsilon?: number): void;
    cluster(k?: number, seed?: number): Map<number, EmbeddingNode[]>;
    buildAIModelGraph(): void;
    toMermaid(): string;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(): {
        nodes: EmbeddingNode[];
        edges: EmbeddingEdge[];
    };
    static fromJSON(data: {
        nodes: EmbeddingNode[];
        edges: EmbeddingEdge[];
    }): EmbeddingGraph;
}
//# sourceMappingURL=level10-embedding.d.ts.map