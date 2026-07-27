import { KnowledgeGraphEngine, KGEntity, KGRelation } from './level8-knowledge';
import { SemanticGraph } from './level9-semantic';
import { EmbeddingGraph } from './level10-embedding';
import { GraphRAGEngine, Chunk, GraphRAGConfig } from './level11-graphrag';
export interface QueryIntent {
    text: string;
    entities?: string[];
    embedding?: number[];
    topK?: number;
    walkDepth?: number;
}
export interface PipelineKGtoRAGResult {
    query: string;
    knowledgeGraph: KnowledgeGraphEngine;
    semanticGraph: SemanticGraph;
    embeddingGraph: EmbeddingGraph;
    ragResult: {
        chunks: Chunk[];
        entities: string[];
        relations: Array<{
            source: string;
            target: string;
            relation: string;
        }>;
        context: string;
        answer: string;
        confidence: number;
        trace: string[];
    };
    metrics: {
        l8: {
            nodeCount: number;
            edgeCount: number;
            density: number;
        };
        l9: {
            nodeCount: number;
            edgeCount: number;
            density: number;
        };
        l10: {
            nodeCount: number;
            edgeCount: number;
            avgDegree: number;
        };
        l11: {
            entityCount: number;
            chunkCount: number;
            relationCount: number;
        };
    };
}
export interface PipelineKGtoRAGOptions {
    /** Embedding dimension for vector conversion */
    embeddingDim?: number;
    /** KNN parameter for embedding graph */
    knnK?: number;
    /** Default GraphRAG config */
    graphRAGConfig?: Partial<GraphRAGConfig>;
    /** Auto-build demo data if empty */
    autoBuildDemo?: boolean;
}
export declare class PipelineL8L9L10L11 {
    knowledgeGraph: KnowledgeGraphEngine;
    semanticGraph: SemanticGraph;
    embeddingGraph: EmbeddingGraph;
    graphRAG: GraphRAGEngine;
    private options;
    constructor(options?: PipelineKGtoRAGOptions);
    /** Step 1: Build Knowledge Graph from entity/relation seed data */
    buildKnowledgeGraph(entities: KGEntity[], relations: KGRelation[]): void;
    /** Step 2: Convert KG entities into a Semantic taxonomy */
    knowledgeToSemantic(): SemanticGraph;
    /** Step 3: Convert Semantic nodes into an Embedding vector space */
    semanticToEmbedding(): EmbeddingGraph;
    /** Step 4: Build GraphRAG from KG + Embeddings */
    embeddingToGraphRAG(queryIntent?: QueryIntent): PipelineKGtoRAGResult['ragResult'];
    /** End-to-end: seed data -> KG -> Semantic -> Embedding -> GraphRAG */
    runPipeline(entities: KGEntity[], relations: KGRelation[], query?: QueryIntent): PipelineKGtoRAGResult;
    /** Build demo data and run full pipeline */
    buildDemo(): PipelineKGtoRAGResult;
    /** Answer a query through the full pipeline */
    answerQuery(query: QueryIntent): Promise<PipelineKGtoRAGResult['ragResult']>;
    /** Access underlying engines */
    getKnowledgeGraph(): KnowledgeGraphEngine;
    getSemanticGraph(): SemanticGraph;
    getEmbeddingGraph(): EmbeddingGraph;
    getGraphRAG(): GraphRAGEngine;
    /** Validate all four graphs */
    validate(): {
        l8: string[];
        l9: string[];
        l10: string[];
        l11: string[];
    };
    /** Metrics for all four graphs */
    metrics(): {
        l8: {
            nodeCount: number;
            edgeCount: number;
            avgDegree: number;
            density: number;
        };
        l9: {
            nodeCount: number;
            edgeCount: number;
            avgDegree: number;
            density: number;
        };
        l10: {
            nodeCount: number;
            edgeCount: number;
            avgDegree: number;
            density: number;
        };
        l11: {
            entityCount: number;
            relationCount: number;
            chunkCount: number;
            avgDegree: number;
            density: number;
        };
    };
    private nameToVector;
    private mapRelationType;
    private findRelatedEntities;
    private getEntityDescriptions;
    private findMatchingEntityId;
}
//# sourceMappingURL=pipeline-l8l9l10l11.d.ts.map