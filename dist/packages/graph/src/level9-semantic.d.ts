export interface SemanticNode {
    id: string;
    concept: string;
    type: 'entity' | 'class' | 'attribute' | 'relation';
    definition?: string;
    examples?: string[];
    embedding?: number[];
}
export interface SemanticEdge {
    id: string;
    source: string;
    target: string;
    relation: 'is_a' | 'has_property' | 'related_to' | 'part_of' | 'opposite_of' | 'causes' | 'requires';
    strength: number;
}
export declare class SemanticGraph {
    nodes: SemanticNode[];
    edges: SemanticEdge[];
    private adj;
    private adjRev;
    private buildAdjacency;
    addNode(n: SemanticNode): string;
    removeNode(nodeId: string): void;
    addEdge(e: SemanticEdge): void;
    removeEdge(edgeId: string): void;
    getNode(nodeId: string): SemanticNode | undefined;
    getEdge(edgeId: string): SemanticEdge | undefined;
    buildAnimalTaxonomy(): void;
    lca(id1: string, id2: string): SemanticNode | null;
    similarity(id1: string, id2: string): number;
    toMermaid(): string;
    validate(): string[];
    metrics(): {
        nodeCount: number;
        edgeCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(): {
        nodes: SemanticNode[];
        edges: SemanticEdge[];
    };
    static fromJSON(data: {
        nodes: SemanticNode[];
        edges: SemanticEdge[];
    }): SemanticGraph;
}
//# sourceMappingURL=level9-semantic.d.ts.map