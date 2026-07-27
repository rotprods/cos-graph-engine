export interface Chunk {
    id: string;
    text: string;
    source: string;
    embedding: number[];
    entities: string[];
}
export interface GraphRAGConfig {
    topK: number;
    walkDepth: number;
    similarityWeight: number;
}
export interface GraphRAGResult {
    query: string;
    chunks: Chunk[];
    entities: string[];
    relationships: Array<{
        source: string;
        target: string;
        relation: string;
    }>;
    context: string;
    answer: string;
    confidence: number;
    trace: string[];
}
export declare class GraphRAGEngine {
    chunks: Chunk[];
    entities: Array<{
        id: string;
        name: string;
        type: string;
    }>;
    relations: Array<{
        id: string;
        source: string;
        target: string;
        type: string;
    }>;
    config: GraphRAGConfig;
    private adj;
    private adjRev;
    constructor(config?: Partial<GraphRAGConfig>);
    private buildAdjacency;
    addChunk(c: Chunk): void;
    addEntity(id: string, name: string, type?: string): void;
    removeEntity(entityId: string): void;
    addRelation(source: string, target: string, type?: string): void;
    removeRelation(relationId: string): void;
    getEntity(entityId: string): {
        id: string;
        name: string;
        type: string;
    } | undefined;
    buildDemo(): void;
    static cosineSim(a: number[], b: number[]): number;
    retrieve(queryEmbedding: number[], queryEntities?: string[]): {
        chunks: Chunk[];
        entities: string[];
        relations: {
            id: string;
            source: string;
            target: string;
            type: string;
        }[];
    };
    answer(query: string, queryEmbedding: number[], queryEntities?: string[]): Promise<GraphRAGResult>;
    toMermaid(): string;
    validate(): string[];
    metrics(): {
        entityCount: number;
        relationCount: number;
        chunkCount: number;
        avgDegree: number;
        density: number;
    };
    toJSON(): {
        chunks: Chunk[];
        entities: {
            id: string;
            name: string;
            type: string;
        }[];
        relations: {
            id: string;
            source: string;
            target: string;
            type: string;
        }[];
        config: GraphRAGConfig;
    };
    static fromJSON(data: {
        chunks: Chunk[];
        entities: Array<{
            id: string;
            name: string;
            type: string;
        }>;
        relations: Array<{
            id: string;
            source: string;
            target: string;
            type: string;
        }>;
        config: GraphRAGConfig;
    }): GraphRAGEngine;
}
//# sourceMappingURL=level11-graphrag.d.ts.map