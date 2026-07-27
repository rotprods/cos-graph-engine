"use strict";
/**
 * Tests de GCN (Fase 15, T-15.2)
 * Prueba: GCNLayer, GCN node classification, link prediction, graph classification
 */
Object.defineProperty(exports, "__esModule", { value: true });
const gcn_1 = require("../packages/graph/src/gcn");
const level8_knowledge_1 = require("../packages/graph/src/level8-knowledge");
const level10_embedding_1 = require("../packages/graph/src/level10-embedding");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition) {
        passed++;
    }
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
async function main() {
    // =============================================
    // GCNLayer
    // =============================================
    section('GCNLayer — Construction');
    const layer = new gcn_1.GCNLayer(4, 8, 'relu');
    assert(layer !== undefined, 'GCNLayer can be constructed');
    assert(layer.getWeights().length === 32, 'Weights = inputDim * outputDim = 4*8 = 32');
    assert(typeof layer.getBias() === 'number', 'Bias is a number');
    section('GCNLayer — Forward Pass');
    const features = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ];
    const adj = [
        [0, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [0, 0, 1, 0],
    ];
    const output = layer.forward(features, adj);
    assert(output.length === 4, 'Forward output has 4 rows');
    assert(output[0].length === 8, 'Forward output has 8 columns');
    assert(output.every(row => row.every(v => v >= 0)), 'ReLU activation: all values >= 0');
    section('GCNLayer — Different Activations');
    const tanhLayer = new gcn_1.GCNLayer(2, 3, 'tanh');
    const tanhOut = tanhLayer.forward([[1, 0], [0, 1]], [[0, 1], [1, 0]]);
    assert(tanhOut.length === 2, 'Tanh layer output has 2 rows');
    assert(tanhOut[0].length === 3, 'Tanh layer output has 3 columns');
    assert(tanhOut.every(row => row.every(v => v >= -1 && v <= 1)), 'Tanh activation: values in [-1, 1]');
    // =============================================
    // GCN
    // =============================================
    section('GCN — Construction');
    const gcn = new gcn_1.GCN({ hiddenDim: 8, numLayers: 2 });
    assert(gcn !== undefined, 'GCN can be constructed');
    assert(typeof gcn.build === 'function', 'GCN has build method');
    assert(typeof gcn.forward === 'function', 'GCN has forward method');
    section('GCN — Build and Forward');
    gcn.build(4, 3);
    const gcnOutput = gcn.forward(features, adj);
    assert(gcnOutput.length === 4, 'GCN output has 4 rows');
    assert(gcnOutput[0].length === 3, 'GCN output has 3 columns (classes)');
    section('GCN — Predict Node Classes');
    const predictions = gcn.predictNodeClasses(features, adj);
    assert(predictions.length === 4, 'Predictions for 4 nodes');
    assert(predictions.every(p => p >= 0 && p <= 2), 'Predictions in valid class range');
    section('GCN — Softmax');
    const logits = [[1, 2, 3], [0, 0, 0], [5, -5, 0]];
    const probs = gcn.softmax(logits);
    assert(probs.length === 3, 'Softmax output has 3 rows');
    assert(probs.every(row => Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-6), 'Softmax rows sum to 1');
    assert(probs[0][2] > probs[0][0], 'Softmax: highest logit has highest probability');
    assert(probs[2][0] > probs[2][1], 'Softmax: positive logit has higher prob than negative');
    // =============================================
    // Node Classification on KnowledgeGraph (L8)
    // =============================================
    section('GCN — Node Classification on KnowledgeGraph (L8)');
    const kg = new level8_knowledge_1.KnowledgeGraphEngine();
    kg.buildCOS();
    const kgResults = gcn.classifyNodesKG(kg);
    assert(kgResults.length >= 4, 'KG classification returns at least 4 results');
    assert(kgResults[0].nodeId !== undefined, 'First result has nodeId');
    assert(kgResults[0].label !== undefined, 'First result has label');
    assert(kgResults[0].predictedClass >= 0, 'First result has predictedClass');
    assert(kgResults[0].confidence >= 0, 'First result has confidence');
    assert(kgResults[0].confidence <= 1, 'First result confidence <= 1');
    assert(kgResults[0].probabilities.length >= 2, 'First result has probabilities array');
    // =============================================
    // Node Classification on EmbeddingGraph (L10)
    // =============================================
    section('GCN — Node Classification on EmbeddingGraph (L10)');
    const eg = new level10_embedding_1.EmbeddingGraph();
    eg.addNode({ id: 'a', label: 'A', vector: [0.9, 0.8, 0.7, 0.6, 0.5] });
    eg.addNode({ id: 'b', label: 'B', vector: [0.8, 0.7, 0.6, 0.5, 0.4] });
    eg.addNode({ id: 'c', label: 'C', vector: [0.1, 0.2, 0.3, 0.4, 0.5] });
    eg.addNode({ id: 'd', label: 'D', vector: [0.2, 0.1, 0.3, 0.2, 0.1] });
    eg.buildKNN(2);
    const egResults = gcn.classifyNodesEmbedding(eg);
    assert(egResults.length === 4, 'Embedding classification returns 4 results');
    assert(egResults.every(r => r.confidence >= 0), 'All results have confidence');
    // =============================================
    // Link Prediction
    // =============================================
    section('GCN — Link Prediction');
    const linkFeatures = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 0],
    ];
    const linkAdj = [
        [0, 1, 0, 0],
        [1, 0, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
    ];
    const linkPreds = gcn.predictLinks(linkFeatures, linkAdj);
    assert(linkPreds.length > 0, 'Link prediction returns results');
    assert(linkPreds[0].source !== undefined, 'First prediction has source');
    assert(linkPreds[0].target !== undefined, 'First prediction has target');
    assert(linkPreds[0].score >= 0, 'First prediction has score >= 0');
    assert(linkPreds[0].score <= 1, 'First prediction has score <= 1');
    assert(typeof linkPreds[0].isPredicted === 'boolean', 'First prediction has isPredicted flag');
    // Sorted by score descending
    for (let i = 1; i < linkPreds.length; i++) {
        assert(linkPreds[i - 1].score >= linkPreds[i].score - 1e-10, 'Sorted by score descending');
    }
    // =============================================
    // Graph Classification
    // =============================================
    section('GCN — Graph Classification');
    const sparseGraph = gcn.classifyGraph(5, 3, 1.2, 0.3, 0.5);
    assert(sparseGraph.graphLevel !== undefined, 'Graph classification has level');
    assert(sparseGraph.predictedClass >= 0, 'Graph classification has predictedClass');
    assert(sparseGraph.confidence >= 0, 'Graph classification has confidence');
    assert(sparseGraph.confidence <= 1, 'Graph classification confidence <= 1');
    assert(sparseGraph.features.length === 5, 'Graph classification has 5 features');
    const denseGraph = gcn.classifyGraph(100, 500, 10, 0.5, 0.8);
    assert(denseGraph.confidence >= 0, 'Dense graph classification has confidence');
    // =============================================
    // GCNPipeline
    // =============================================
    section('GCNPipeline — End-to-end');
    const pipeline = new gcn_1.GCNPipeline({ hiddenDim: 4, numLayers: 2 });
    assert(pipeline !== undefined, 'Pipeline can be constructed');
    const nodeResults = pipeline.runNodeClassification(kg);
    assert(nodeResults.length >= 4, 'Pipeline node classification works');
    const linkResults = pipeline.runLinkPrediction(linkFeatures, linkAdj);
    assert(linkResults.length > 0, 'Pipeline link prediction works');
    const graphResult = pipeline.runGraphClassification(10, 20, 4, 0.4, 0.6);
    assert(graphResult.predictedClass >= 0, 'Pipeline graph classification works');
    const embedResults = pipeline.runNodeClassificationEmbedding(eg);
    assert(embedResults.length === 4, 'Pipeline embedding classification works');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=test-gcn.js.map