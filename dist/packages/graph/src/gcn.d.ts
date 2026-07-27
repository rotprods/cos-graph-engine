/**
 * Graph Neural Networks — Fase 15 (T-15.2)
 *
 * GCN (Graph Convolutional Network) sobre L8-L11:
 * 1. Node classification: clasificar nodos por su estructura de grafo
 * 2. Link prediction: predecir edges faltantes
 * 3. Graph classification: clasificar grafos completos
 *
 * Zero dependencias externas.
 */
import { KnowledgeGraphEngine } from './level8-knowledge';
import { EmbeddingGraph } from './level10-embedding';
export interface GCNConfig {
    hiddenDim: number;
    numLayers: number;
    learningRate: number;
    dropout: number;
}
export interface NodeClassificationResult {
    nodeId: string;
    label: string;
    predictedClass: number;
    confidence: number;
    probabilities: number[];
}
export interface LinkPredictionResult {
    source: string;
    target: string;
    score: number;
    isPredicted: boolean;
}
export interface GraphClassificationResult {
    graphLevel: string;
    predictedClass: number;
    confidence: number;
    features: number[];
}
/**
 * Una capa de convolucion de grafo simple.
 * Agrega features de vecinos con normalizacion, aplica transformacion lineal y activacion.
 */
export declare class GCNLayer {
    private weights;
    private bias;
    private inputDim;
    private outputDim;
    private activation;
    constructor(inputDim: number, outputDim: number, activation?: 'relu' | 'tanh' | 'sigmoid');
    /**
     * Forward pass: propaga features a traves de la estructura del grafo.
     * H = activation(A_norm * X * W + b)
     * donde A_norm es la matriz de adyacencia normalizada.
     */
    forward(features: number[][], adjacencyMatrix: number[][]): number[][];
    private activate;
    getWeights(): number[];
    getBias(): number;
}
/**
 * Red convolucional de grafos completa.
 * Soporta node classification, link prediction, y graph classification.
 */
export declare class GCN {
    private layers;
    private config;
    constructor(config?: Partial<GCNConfig>);
    /**
     * Construye la red con las dimensiones especificadas.
     */
    build(inputDim: number, numClasses: number): void;
    /**
     * Forward pass completo a traves de todas las capas.
     */
    forward(features: number[][], adjacencyMatrix: number[][]): number[][];
    /**
     * Predice clases para nodos basado en features y estructura de grafo.
     */
    predictNodeClasses(features: number[][], adjacencyMatrix: number[][]): number[];
    /**
     * Calcula softmax para obtener probabilidades.
     */
    softmax(logits: number[][]): number[][];
    /**
     * Clasifica nodos de un KnowledgeGraphEngine (L8).
     * Extrae features de cada nodo: tipo, conexiones entrantes, conexiones salientes.
     */
    classifyNodesKG(kg: KnowledgeGraphEngine): NodeClassificationResult[];
    /**
     * Clasifica nodos de un EmbeddingGraph (L10).
     */
    classifyNodesEmbedding(eg: EmbeddingGraph): NodeClassificationResult[];
    /**
     * Predice edges faltantes en un grafo basado en features de nodos.
     * Usa producto punto de features normalizados como score de conexion.
     */
    predictLinks(features: number[][], adjacencyMatrix: number[][]): LinkPredictionResult[];
    /**
     * Clasifica un grafo completo basado en features globales.
     */
    classifyGraph(nodes: number, edges: number, avgDegree: number, density: number, avgFeature: number): GraphClassificationResult;
}
export declare class GCNPipeline {
    private gcn;
    constructor(config?: Partial<GCNConfig>);
    /**
     * Run node classification on KnowledgeGraph (L8).
     */
    runNodeClassification(kg: KnowledgeGraphEngine): NodeClassificationResult[];
    /**
     * Run node classification on EmbeddingGraph (L10).
     */
    runNodeClassificationEmbedding(eg: EmbeddingGraph): NodeClassificationResult[];
    /**
     * Run link prediction on a feature matrix.
     */
    runLinkPrediction(features: number[][], adj: number[][]): LinkPredictionResult[];
    /**
     * Run graph classification from metrics.
     */
    runGraphClassification(nodes: number, edges: number, avgDegree: number, density: number, avgFeature: number): GraphClassificationResult;
}
//# sourceMappingURL=gcn.d.ts.map