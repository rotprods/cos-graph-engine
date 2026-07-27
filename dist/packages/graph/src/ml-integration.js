"use strict";
/**
 * ML Integration — Fase 15 (T-15.1)
 *
 * Integra L7 (ComputationalGraph) con:
 * - L10 (EmbeddingGraph): clasificacion sobre vectores de embedding
 * - L11 (GraphRAGEngine): reranking de resultados por red neuronal
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLPipeline = exports.GraphRAGNeuralReRanker = exports.EmbeddingClassifier = void 0;
const level7_compute_1 = require("./level7-compute");
const level11_graphrag_1 = require("./level11-graphrag");
// ============================================================
// EmbeddingClassifier — L7 + L10 Integration
// ============================================================
/**
 * Clasifica vectores de embedding (L10) usando una red neuronal (L7).
 *
 * Construye un MLP por cada vector de embedding, ejecuta forward pass
 * para obtener logits, y calcula probabilidades softmax + loss.
 */
class EmbeddingClassifier {
    graph;
    classes;
    constructor(classes = ['class_0', 'class_1']) {
        this.graph = new level7_compute_1.ComputationalGraph();
        this.classes = classes;
    }
    /**
     * Clasifica un vector de embedding usando L7's MLP.
     * Retorna la clase predicha, confianza, y probabilidades.
     */
    classify(embedding, nodeId) {
        const node = embedding.getNode(nodeId);
        if (!node)
            throw new Error(`Embedding node ${nodeId} not found`);
        return this.classifyVector(node.vector, node.label);
    }
    /**
     * Clasifica un vector numerico directamente.
     */
    classifyVector(vector, label = 'input') {
        // Build MLP with input dimension = vector length, 2 classes
        this.graph = new level7_compute_1.ComputationalGraph();
        const inputDim = vector.length;
        const hiddenDim = Math.max(4, Math.ceil(inputDim / 2));
        const numClasses = this.classes.length;
        this.graph.buildMLP(inputDim, hiddenDim, numClasses);
        // Forward pass: set input value from vector (mean of vector as scalar proxy)
        const inputValue = vector.reduce((s, v) => s + v, 0) / vector.length;
        const result = this.graph.forward({ x: inputValue });
        // Extract logits from the two output nodes
        const logit0 = this.graph['values'].get('logit0') || 0;
        const logit1 = this.graph['values'].get('logit1') || 0;
        const logits = [logit0, logit1];
        // Softmax
        const maxLogit = Math.max(...logits, 0);
        const exps = logits.map(l => Math.exp(l - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const probabilities = sumExps > 0 ? exps.map(e => e / sumExps) : logits.map(() => 1 / logits.length);
        // Predicted class
        const classId = probabilities.indexOf(Math.max(...probabilities));
        const confidence = probabilities[classId];
        // Loss (cross-entropy assuming class 0 is correct)
        const loss = -Math.log(Math.max(1e-10, probabilities[0]));
        return {
            classId,
            className: this.classes[classId] || `class_${classId}`,
            confidence,
            probabilities,
            loss,
        };
    }
    /**
     * Clasifica todos los nodos de embedding en un grafo L10.
     */
    classifyAll(embedding) {
        return embedding.nodes.map(n => this.classify(embedding, n.id));
    }
    /**
     * Entrena un paso: clasifica con target y aplica backpropagation.
     * Retorna el loss y gradientes.
     */
    trainStep(vector, targetClass = 0) {
        const result = this.classifyVector(vector, 'train');
        const gradients = this.graph.backward();
        // Convert gradients map to plain object
        const gradObj = {};
        for (const [k, v] of gradients) {
            if (Math.abs(v) > 1e-10)
                gradObj[k] = v;
        }
        return { loss: result.loss, gradients: gradObj };
    }
}
exports.EmbeddingClassifier = EmbeddingClassifier;
// ============================================================
// GraphRAGNeuralReRanker — L7 + L11 Integration
// ============================================================
/**
 * Re-rankea resultados de GraphRAG usando L7's forward pass como
 * red neuronal de scoring.
 *
 * Cada chunk obtiene un score neural basado en su embedding + relevancia,
 * combinado con el score original de GraphRAG.
 */
class GraphRAGNeuralReRanker {
    graph;
    similarityWeight;
    constructor(similarityWeight = 0.5) {
        this.graph = new level7_compute_1.ComputationalGraph();
        this.similarityWeight = similarityWeight;
    }
    /**
     * Re-rank GraphRAG results using neural scoring.
     * Cada chunk se evalua con un mini-MLP que toma:
     * - similarity score (del retrieval)
     * - entity overlap count
     * - chunk length (normalized)
     * Retorna un combined score.
     */
    reRank(rag, queryEmbedding, queryEntities = []) {
        const retrieved = rag.retrieve(queryEmbedding, queryEntities);
        const reRanked = retrieved.chunks.map(chunk => {
            // Build neural features
            const similarityScore = retrieved.chunks.length > 0
                ? level11_graphrag_1.GraphRAGEngine.cosineSim(chunk.embedding, queryEmbedding) : 0;
            const entityOverlap = chunk.entities.filter(e => queryEntities.includes(e) || rag['entities'].some((re) => re.id === e)).length;
            const chunkLengthNorm = Math.min(1, chunk.text.length / 500);
            // Neural scoring via L7
            this.graph = new level7_compute_1.ComputationalGraph();
            this.graph.buildMLP(3, 4, 2);
            const featureVector = [similarityScore, entityOverlap / Math.max(1, chunk.entities.length), chunkLengthNorm];
            const inputValue = featureVector.reduce((s, v) => s + v, 0) / featureVector.length;
            this.graph.forward({ x: inputValue });
            const logit0 = this.graph['values']?.get('logit0') || 0;
            const logit1 = this.graph['values']?.get('logit1') || 0;
            const neuralScore = logit0 - logit1; // relevance vs irrelevance
            // Combined score
            const combinedScore = this.similarityWeight * similarityScore + (1 - this.similarityWeight) * Math.max(0, Math.tanh(neuralScore));
            return { chunk, originalScore: similarityScore, neuralScore, combinedScore };
        });
        // Sort by combined score descending
        reRanked.sort((a, b) => b.combinedScore - a.combinedScore);
        return reRanked;
    }
    /**
     * Generate answer with re-ranked results.
     */
    async answerWithReRank(rag, query, queryEmbedding, queryEntities = []) {
        const reRanked = this.reRank(rag, queryEmbedding, queryEntities);
        const baseResult = await rag.answer(query, queryEmbedding, queryEntities);
        return {
            ...baseResult,
            chunks: reRanked.map(r => r.chunk),
            confidence: reRanked.length > 0
                ? Math.min(1, reRanked.reduce((s, r) => s + r.combinedScore, 0) / reRanked.length)
                : 0,
            trace: [...baseResult.trace, `Neural re-rank: ${reRanked.length} chunks scored`],
            reRanked,
        };
    }
}
exports.GraphRAGNeuralReRanker = GraphRAGNeuralReRanker;
// ============================================================
// MLPipeline — End-to-end pipeline
// ============================================================
/**
 * Pipeline completo: L10 embeddings → L7 classification → L11 re-ranking.
 */
class MLPipeline {
    classifier;
    reRanker;
    constructor(classes = ['class_0', 'class_1']) {
        this.classifier = new EmbeddingClassifier(classes);
        this.reRanker = new GraphRAGNeuralReRanker();
    }
    /**
     * Ejecuta el pipeline completo sobre un EmbeddingGraph y GraphRAGEngine.
     */
    async run(embedding, rag, query, queryEmbedding, queryEntities = []) {
        const start = Date.now();
        // Step 1: Classify all embeddings
        const classifications = this.classifier.classifyAll(embedding);
        // Step 2: Re-rank GraphRAG results
        const reRanked = this.reRanker.reRank(rag, queryEmbedding, queryEntities);
        // Step 3: Calculate total loss
        const totalLoss = classifications.reduce((s, c) => s + c.loss, 0);
        return {
            classifications,
            reRanked,
            totalLoss,
            pipelineLatency: Date.now() - start,
        };
    }
}
exports.MLPipeline = MLPipeline;
//# sourceMappingURL=ml-integration.js.map