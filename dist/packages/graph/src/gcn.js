"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCNPipeline = exports.GCN = exports.GCNLayer = void 0;
// ============================================================
// GCNLayer — Single graph convolution layer
// ============================================================
/**
 * Una capa de convolucion de grafo simple.
 * Agrega features de vecinos con normalizacion, aplica transformacion lineal y activacion.
 */
class GCNLayer {
    weights;
    bias;
    inputDim;
    outputDim;
    activation;
    constructor(inputDim, outputDim, activation = 'relu') {
        this.inputDim = inputDim;
        this.outputDim = outputDim;
        this.activation = activation;
        // Xavier initialization
        const scale = Math.sqrt(2.0 / (inputDim + outputDim));
        this.weights = new Array(inputDim * outputDim).fill(0).map(() => (Math.random() - 0.5) * 2 * scale);
        this.bias = 0;
    }
    /**
     * Forward pass: propaga features a traves de la estructura del grafo.
     * H = activation(A_norm * X * W + b)
     * donde A_norm es la matriz de adyacencia normalizada.
     */
    forward(features, adjacencyMatrix) {
        const n = features.length;
        const output = [];
        for (let i = 0; i < n; i++) {
            const aggregated = new Array(this.outputDim).fill(0);
            // Aggregate neighbor features (mean aggregation)
            let neighborCount = 0;
            for (let j = 0; j < n; j++) {
                if (adjacencyMatrix[i][j] > 0 && i !== j) {
                    for (let d = 0; d < this.outputDim; d++) {
                        for (let k = 0; k < this.inputDim; k++) {
                            aggregated[d] += features[j][k] * this.weights[k * this.outputDim + d];
                        }
                    }
                    neighborCount++;
                }
            }
            // Add self-loop (own features)
            for (let d = 0; d < this.outputDim; d++) {
                for (let k = 0; k < this.inputDim; k++) {
                    aggregated[d] += features[i][k] * this.weights[k * this.outputDim + d];
                }
            }
            neighborCount++;
            // Normalize by neighbor count
            if (neighborCount > 0) {
                for (let d = 0; d < this.outputDim; d++) {
                    aggregated[d] = aggregated[d] / neighborCount + this.bias;
                }
            }
            // Activation
            output.push(aggregated.map(v => this.activate(v)));
        }
        return output;
    }
    activate(x) {
        switch (this.activation) {
            case 'relu': return Math.max(0, x);
            case 'tanh': return Math.tanh(x);
            case 'sigmoid': return 1 / (1 + Math.exp(-x));
        }
    }
    getWeights() { return this.weights; }
    getBias() { return this.bias; }
}
exports.GCNLayer = GCNLayer;
// ============================================================
// GCN — Graph Convolutional Network
// ============================================================
/**
 * Red convolucional de grafos completa.
 * Soporta node classification, link prediction, y graph classification.
 */
class GCN {
    layers;
    config;
    constructor(config) {
        this.config = {
            hiddenDim: config?.hiddenDim ?? 16,
            numLayers: config?.numLayers ?? 2,
            learningRate: config?.learningRate ?? 0.01,
            dropout: config?.dropout ?? 0.2,
        };
        this.layers = [];
    }
    /**
     * Construye la red con las dimensiones especificadas.
     */
    build(inputDim, numClasses) {
        this.layers = [];
        let dim = inputDim;
        for (let i = 0; i < this.config.numLayers - 1; i++) {
            this.layers.push(new GCNLayer(dim, this.config.hiddenDim, 'relu'));
            dim = this.config.hiddenDim;
        }
        this.layers.push(new GCNLayer(dim, numClasses, 'sigmoid'));
    }
    /**
     * Forward pass completo a traves de todas las capas.
     */
    forward(features, adjacencyMatrix) {
        let h = features;
        for (const layer of this.layers) {
            h = layer.forward(h, adjacencyMatrix);
        }
        return h; // [n_nodes x n_classes] logits
    }
    /**
     * Predice clases para nodos basado en features y estructura de grafo.
     */
    predictNodeClasses(features, adjacencyMatrix) {
        const output = this.forward(features, adjacencyMatrix);
        return output.map(row => row.indexOf(Math.max(...row)));
    }
    /**
     * Calcula softmax para obtener probabilidades.
     */
    softmax(logits) {
        return logits.map(row => {
            const maxVal = Math.max(...row, 0);
            const exps = row.map(l => Math.exp(l - maxVal));
            const sum = exps.reduce((a, b) => a + b, 0);
            return sum > 0 ? exps.map(e => e / sum) : row.map(() => 1 / row.length);
        });
    }
    // ============================================================
    // Node Classification
    // ============================================================
    /**
     * Clasifica nodos de un KnowledgeGraphEngine (L8).
     * Extrae features de cada nodo: tipo, conexiones entrantes, conexiones salientes.
     */
    classifyNodesKG(kg) {
        const entities = kg.entities || [];
        if (entities.length === 0)
            return [];
        // Build features: [type_index, in_degree, out_degree, has_relations]
        const features = entities.map((e) => {
            const relations = kg.relations || [];
            const inDegree = relations.filter((r) => r.target === e.id).length;
            const outDegree = relations.filter((r) => r.source === e.id).length;
            return [
                e.type === 'system' ? 1 : e.type === 'concept' ? 0.5 : 0,
                Math.min(1, inDegree / 10),
                Math.min(1, outDegree / 10),
                inDegree + outDegree > 0 ? 1 : 0,
            ];
        });
        // Build adjacency matrix
        const n = entities.length;
        const adj = Array.from({ length: n }, () => new Array(n).fill(0));
        const relations = kg.relations || [];
        for (const r of relations) {
            const si = entities.findIndex((e) => e.id === r.source);
            const ti = entities.findIndex((e) => e.id === r.target);
            if (si >= 0 && ti >= 0) {
                adj[si][ti] = 1;
                adj[ti][si] = 1;
            }
        }
        // Build and run GCN
        const inputDim = features[0].length;
        const numClasses = 3;
        this.build(inputDim, numClasses);
        const logits = this.forward(features, adj);
        const probs = this.softmax(logits);
        const results = [];
        for (let i = 0; i < entities.length; i++) {
            const predClass = logits[i].indexOf(Math.max(...logits[i]));
            results.push({
                nodeId: entities[i].id,
                label: entities[i].name || entities[i].id,
                predictedClass: predClass,
                confidence: probs[i][predClass],
                probabilities: probs[i],
            });
        }
        return results;
    }
    /**
     * Clasifica nodos de un EmbeddingGraph (L10).
     */
    classifyNodesEmbedding(eg) {
        const nodes = eg.nodes;
        if (nodes.length === 0)
            return [];
        // Features: embedding vector + metadata
        const features = nodes.map(n => {
            const vec = n.vector;
            // Pad or truncate to uniform length 5
            const padded = new Array(5).fill(0);
            for (let i = 0; i < Math.min(vec.length, 5); i++)
                padded[i] = vec[i];
            padded.push(n.clusterId !== undefined ? n.clusterId / 10 : 0);
            return padded;
        });
        // Build adjacency from KNN edges
        const n = nodes.length;
        const adj = Array.from({ length: n }, () => new Array(n).fill(0));
        for (const e of eg.edges) {
            const si = nodes.findIndex(no => no.id === e.source);
            const ti = nodes.findIndex(no => no.id === e.target);
            if (si >= 0 && ti >= 0) {
                adj[si][ti] = 1;
                adj[ti][si] = 1;
            }
        }
        const inputDim = features[0].length;
        const numClasses = 3;
        this.build(inputDim, numClasses);
        const logits = this.forward(features, adj);
        const probs = this.softmax(logits);
        const results = [];
        for (let i = 0; i < nodes.length; i++) {
            const predClass = logits[i].indexOf(Math.max(...logits[i]));
            results.push({
                nodeId: nodes[i].id,
                label: nodes[i].label,
                predictedClass: predClass,
                confidence: probs[i][predClass],
                probabilities: probs[i],
            });
        }
        return results;
    }
    // ============================================================
    // Link Prediction
    // ============================================================
    /**
     * Predice edges faltantes en un grafo basado en features de nodos.
     * Usa producto punto de features normalizados como score de conexion.
     */
    predictLinks(features, adjacencyMatrix) {
        const n = features.length;
        const results = [];
        // Use GCN to get node embeddings
        const inputDim = features[0].length;
        this.build(inputDim, 2); // 2 classes for binary classification
        const embeddings = this.forward(features, adjacencyMatrix);
        // For each pair without existing edge, score the connection
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (adjacencyMatrix[i][j] === 0) {
                    // Score = dot product of embeddings
                    let score = 0;
                    for (let d = 0; d < embeddings[i].length; d++) {
                        score += embeddings[i][d] * embeddings[j][d];
                    }
                    score = 1 / (1 + Math.exp(-score)); // sigmoid
                    results.push({
                        source: `node_${i}`,
                        target: `node_${j}`,
                        score,
                        isPredicted: score > 0.5,
                    });
                }
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    }
    // ============================================================
    // Graph Classification
    // ============================================================
    /**
     * Clasifica un grafo completo basado en features globales.
     */
    classifyGraph(nodes, edges, avgDegree, density, avgFeature) {
        const features = [Math.min(1, nodes / 100), Math.min(1, edges / 100), avgDegree, density, avgFeature];
        const inputDim = features.length;
        const numClasses = 4; // sparse, balanced, dense, highly-connected
        this.build(inputDim, numClasses);
        const adj = [[1]]; // single node adjacency
        const logits = this.forward([features], adj);
        const probs = this.softmax(logits);
        const predClass = logits[0].indexOf(Math.max(...logits[0]));
        return {
            graphLevel: `L0-L19`,
            predictedClass: predClass,
            confidence: probs[0][predClass],
            features,
        };
    }
}
exports.GCN = GCN;
// ============================================================
// GCNPipeline — End-to-end GCN pipeline
// ============================================================
class GCNPipeline {
    gcn;
    constructor(config) {
        this.gcn = new GCN(config);
    }
    /**
     * Run node classification on KnowledgeGraph (L8).
     */
    runNodeClassification(kg) {
        return this.gcn.classifyNodesKG(kg);
    }
    /**
     * Run node classification on EmbeddingGraph (L10).
     */
    runNodeClassificationEmbedding(eg) {
        return this.gcn.classifyNodesEmbedding(eg);
    }
    /**
     * Run link prediction on a feature matrix.
     */
    runLinkPrediction(features, adj) {
        return this.gcn.predictLinks(features, adj);
    }
    /**
     * Run graph classification from metrics.
     */
    runGraphClassification(nodes, edges, avgDegree, density, avgFeature) {
        return this.gcn.classifyGraph(nodes, edges, avgDegree, density, avgFeature);
    }
}
exports.GCNPipeline = GCNPipeline;
//# sourceMappingURL=gcn.js.map