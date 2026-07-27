/**
 * ML Integration — Fase 15 (T-15.1)
 *
 * Integra L7 (ComputationalGraph) con:
 * - L10 (EmbeddingGraph): clasificacion sobre vectores de embedding
 * - L11 (GraphRAGEngine): reranking de resultados por red neuronal
 *
 * Zero dependencias externas.
 */
import { EmbeddingGraph } from './level10-embedding';
import { GraphRAGEngine, Chunk, GraphRAGResult } from './level11-graphrag';
export interface ClassificationResult {
    classId: number;
    className: string;
    confidence: number;
    probabilities: number[];
    loss: number;
}
export interface ReRankedChunk {
    chunk: Chunk;
    originalScore: number;
    neuralScore: number;
    combinedScore: number;
}
export interface MLPipelineResult {
    classifications: ClassificationResult[];
    reRanked: ReRankedChunk[];
    totalLoss: number;
    pipelineLatency: number;
}
/**
 * Clasifica vectores de embedding (L10) usando una red neuronal (L7).
 *
 * Construye un MLP por cada vector de embedding, ejecuta forward pass
 * para obtener logits, y calcula probabilidades softmax + loss.
 */
export declare class EmbeddingClassifier {
    private graph;
    private classes;
    constructor(classes?: string[]);
    /**
     * Clasifica un vector de embedding usando L7's MLP.
     * Retorna la clase predicha, confianza, y probabilidades.
     */
    classify(embedding: EmbeddingGraph, nodeId: string): ClassificationResult;
    /**
     * Clasifica un vector numerico directamente.
     */
    classifyVector(vector: number[], label?: string): ClassificationResult;
    /**
     * Clasifica todos los nodos de embedding en un grafo L10.
     */
    classifyAll(embedding: EmbeddingGraph): ClassificationResult[];
    /**
     * Entrena un paso: clasifica con target y aplica backpropagation.
     * Retorna el loss y gradientes.
     */
    trainStep(vector: number[], targetClass?: number): {
        loss: number;
        gradients: Record<string, number>;
    };
}
/**
 * Re-rankea resultados de GraphRAG usando L7's forward pass como
 * red neuronal de scoring.
 *
 * Cada chunk obtiene un score neural basado en su embedding + relevancia,
 * combinado con el score original de GraphRAG.
 */
export declare class GraphRAGNeuralReRanker {
    private graph;
    private similarityWeight;
    constructor(similarityWeight?: number);
    /**
     * Re-rank GraphRAG results using neural scoring.
     * Cada chunk se evalua con un mini-MLP que toma:
     * - similarity score (del retrieval)
     * - entity overlap count
     * - chunk length (normalized)
     * Retorna un combined score.
     */
    reRank(rag: GraphRAGEngine, queryEmbedding: number[], queryEntities?: string[]): ReRankedChunk[];
    /**
     * Generate answer with re-ranked results.
     */
    answerWithReRank(rag: GraphRAGEngine, query: string, queryEmbedding: number[], queryEntities?: string[]): Promise<GraphRAGResult & {
        reRanked: ReRankedChunk[];
    }>;
}
/**
 * Pipeline completo: L10 embeddings → L7 classification → L11 re-ranking.
 */
export declare class MLPipeline {
    private classifier;
    private reRanker;
    constructor(classes?: string[]);
    /**
     * Ejecuta el pipeline completo sobre un EmbeddingGraph y GraphRAGEngine.
     */
    run(embedding: EmbeddingGraph, rag: GraphRAGEngine, query: string, queryEmbedding: number[], queryEntities?: string[]): Promise<MLPipelineResult>;
}
//# sourceMappingURL=ml-integration.d.ts.map