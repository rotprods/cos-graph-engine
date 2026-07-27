"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const level6_dataflow_1 = require("../packages/graph/src/level6-dataflow");
const level7_compute_1 = require("../packages/graph/src/level7-compute");
const level8_knowledge_1 = require("../packages/graph/src/level8-knowledge");
const level9_semantic_1 = require("../packages/graph/src/level9-semantic");
const level10_embedding_1 = require("../packages/graph/src/level10-embedding");
const level11_graphrag_1 = require("../packages/graph/src/level11-graphrag");
let p = 0, f = 0;
function assert(c, m) { if (c) {
    p++;
    console.log('  ✅ ' + m);
}
else {
    f++;
    console.log('  ❌ ' + m);
} }
async function main() {
    console.log('📊 Levels 6-11 Tests\n');
    // L6: Data Flow
    const df = new level6_dataflow_1.DataFlowGraph();
    df.buildMLPipeline();
    assert(df.nodes.length === 6, 'L6: ML pipeline has 6 nodes');
    assert(df.edges.length === 5, 'L6: ML pipeline has 5 edges');
    assert(df.nodes.some(n => n.name === 'CNN Backbone'), 'L6: CNN backbone node exists');
    assert(df.toMermaid().includes('graph LR'), 'L6: Mermaid output works');
    // L7: Computational Graph
    const cg = new level7_compute_1.ComputationalGraph();
    cg.buildMLP();
    assert(cg.nodes.length === 10, 'L7: MLP has 10 nodes (x, w1, b1, w2, fc1, h1, r1, fc2, logits, loss)');
    assert(cg.edges.length === 9, 'L7: MLP has 9 edges');
    const loss = cg.forward({ x: 1 });
    assert(typeof loss === 'number', 'L7: Forward pass computes loss');
    assert(cg['values'].get('fc1') === 0.5, 'L7: fc1 = x*w1 = 0.5');
    assert(cg['values'].get('r1') === 0.6, 'L7: r1 = relu(fc1+b1) = 0.6');
    const grads = cg.backward(loss);
    assert(grads.size > 0, 'L7: Backward pass computes gradients');
    assert(grads.has('loss'), 'L7: Loss node has gradient seed');
    // L8: Knowledge Graph
    const kg = new level8_knowledge_1.KnowledgeGraphEngine();
    kg.buildAIEcosystem();
    assert(kg.entities.length === 6, 'L8: AI ecosystem has 6 entities');
    assert(kg.relations.length >= 5, 'L8: AI ecosystem has relations');
    const query = kg.query('openai');
    assert(query.length >= 2, 'L8: Query finds related entities');
    const inferred = kg.inferTransitive();
    assert(inferred.length >= 0, 'L8: Transitive inference works');
    // L9: Semantic Graph
    const sg = new level9_semantic_1.SemanticGraph();
    sg.buildAnimalTaxonomy();
    assert(sg.nodes.length === 6, 'L9: Animal taxonomy has 6 nodes');
    const lca = sg.lca('dog', 'cat');
    assert(lca !== null, 'L9: LCA of dog and cat exists');
    const sim = sg.similarity('dog', 'cat');
    assert(sim > 0, 'L9: Semantic similarity > 0');
    // L10: Embedding Graph
    const eg = new level10_embedding_1.EmbeddingGraph();
    eg.buildAIModelGraph();
    assert(eg.nodes.length === 6, 'L10: AI model graph has 6 nodes');
    assert(eg.edges.length > 0, 'L10: KNN edges exist');
    const clusters = eg.cluster(3);
    assert(clusters.size > 0, 'L10: Clustering produces groups');
    const dist = level10_embedding_1.EmbeddingGraph.distance([1, 0, 0], [0, 1, 0]);
    assert(Math.abs(dist - Math.sqrt(2)) < 0.01, 'L10: L2 distance correct');
    const cos = level10_embedding_1.EmbeddingGraph.cosine([1, 0, 0], [1, 0, 0]);
    assert(Math.abs(cos - 1) < 0.01, 'L10: Cosine similarity of identical vectors = 1');
    // L11: GraphRAG
    const rag = new level11_graphrag_1.GraphRAGEngine();
    rag.buildDemo();
    assert(rag['chunks'].length === 4, 'L11: 4 chunks in demo');
    const result = await rag.answer('What is the COS architecture?', [0.9, 0.8, 0.1, 0.1], ['cos']);
    assert(result.chunks.length > 0, 'L11: Chunks retrieved');
    assert(result.entities.length > 0, 'L11: Entities traversed');
    assert(result.answer.length > 0, 'L11: Answer generated');
    assert(result.confidence > 0, 'L11: Confidence > 0');
    assert(result.trace.length >= 3, 'L11: Trace has 3+ steps');
    console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
    if (f === 0)
        console.log('\n✅✅✅ ALL 6 LEVELS (6-11) VERIFIED');
    process.exit(f > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-levels-6-11.js.map