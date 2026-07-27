"use strict";
// T-8.2: 40+ Tests for Pipeline L8 -> L9 -> L10 -> L11
// Tests the cross-level pipeline: Knowledge -> Semantic -> Embedding -> GraphRAG
Object.defineProperty(exports, "__esModule", { value: true });
const pipeline_l8l9l10l11_1 = require("../packages/graph/src/pipeline-l8l9l10l11");
const level8_knowledge_1 = require("../packages/graph/src/level8-knowledge");
const level9_semantic_1 = require("../packages/graph/src/level9-semantic");
const level10_embedding_1 = require("../packages/graph/src/level10-embedding");
const level11_graphrag_1 = require("../packages/graph/src/level11-graphrag");
let p = 0, f = 0;
function assert(cond, msg) { if (cond) {
    p++;
}
else {
    f++;
    console.error(`  ❌ ${msg}`);
} }
// ===== Sample Data =====
const cosEntities = [
    { id: 'cos', name: 'Cognitive OS', type: 'system', description: 'Operating system for cognition' },
    { id: 'memory', name: 'Memory System', type: 'concept', description: 'Hierarchical memory with TTL' },
    { id: 'reasoning', name: 'Reasoning Engine', type: 'concept', description: 'Forward/backward chaining' },
    { id: 'knowledge', name: 'Knowledge Graph', type: 'tech', description: 'Structured RAG with entities' },
    { id: 'execution', name: 'Execution Engine', type: 'concept', description: 'Runtime execution' },
    { id: 'orchestrator', name: 'Orchestrator', type: 'system', description: 'Workflow orchestration' },
];
const cosRelations = [
    { id: 'r1', source: 'cos', target: 'memory', type: 'has', confidence: 1.0 },
    { id: 'r2', source: 'cos', target: 'reasoning', type: 'has', confidence: 1.0 },
    { id: 'r3', source: 'cos', target: 'knowledge', type: 'has', confidence: 1.0 },
    { id: 'r4', source: 'cos', target: 'execution', type: 'has', confidence: 1.0 },
    { id: 'r5', source: 'cos', target: 'orchestrator', type: 'has', confidence: 1.0 },
    { id: 'r6', source: 'knowledge', target: 'memory', type: 'uses', confidence: 0.8 },
    { id: 'r7', source: 'reasoning', target: 'knowledge', type: 'uses', confidence: 0.9 },
    { id: 'r8', source: 'execution', target: 'reasoning', type: 'uses', confidence: 0.7 },
];
// ========== TEST: Pipeline Creation ==========
(function testPipelineCreation() {
    console.log('\n=== Pipeline Creation ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    assert(pipe instanceof pipeline_l8l9l10l11_1.PipelineL8L9L10L11, 'PipelineL8L9L10L11 is instantiated');
    assert(pipe.knowledgeGraph instanceof level8_knowledge_1.KnowledgeGraphEngine, 'Has L8 KnowledgeGraph');
    assert(pipe.semanticGraph instanceof level9_semantic_1.SemanticGraph, 'Has L9 SemanticGraph');
    assert(pipe.embeddingGraph instanceof level10_embedding_1.EmbeddingGraph, 'Has L10 EmbeddingGraph');
    assert(pipe.graphRAG instanceof level11_graphrag_1.GraphRAGEngine, 'Has L11 GraphRAG');
    // With custom options
    const pipe2 = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 6, knnK: 2, autoBuildDemo: true });
    assert(pipe2 instanceof pipeline_l8l9l10l11_1.PipelineL8L9L10L11, 'Pipeline with custom options');
})();
// ========== TEST: Step 1 - Build Knowledge Graph ==========
(function testBuildKnowledgeGraph() {
    console.log('\n=== L8: Build Knowledge Graph ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    assert(pipe.knowledgeGraph.entities.length === 6, 'L8: 6 entities added');
    assert(pipe.knowledgeGraph.relations.length === 8, 'L8: 8 relations added');
    assert(pipe.knowledgeGraph.getEntity('cos')?.name === 'Cognitive OS', 'L8: Entity cos found');
    assert(pipe.knowledgeGraph.getRelation('r1')?.type === 'has', 'L8: Relation r1 found');
    // Validate
    const v = pipe.knowledgeGraph.validate();
    assert(v.length === 0, 'L8: No validation errors');
    // Metrics
    const m = pipe.knowledgeGraph.metrics();
    assert(m.nodeCount === 6, 'L8: 6 nodes in metrics');
    assert(m.edgeCount === 8, 'L8: 8 edges in metrics');
})();
// ========== TEST: Step 2 - Knowledge to Semantic ==========
(function testKnowledgeToSemantic() {
    console.log('\n=== L9: Knowledge -> Semantic ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    const sem = pipe.knowledgeToSemantic();
    assert(sem instanceof level9_semantic_1.SemanticGraph, 'L9: Returns SemanticGraph');
    assert(sem.nodes.length === 6, 'L9: 6 semantic nodes created');
    assert(sem.edges.length === 8, 'L9: 8 semantic edges created');
    // Check type mapping
    const cosNode = sem.getNode('sem_cos');
    assert(cosNode?.concept === 'Cognitive OS', 'L9: cos node name matches');
    assert(cosNode?.type === 'class', 'L9: system maps to class type');
    const memoryNode = sem.getNode('sem_memory');
    assert(memoryNode?.concept === 'Memory System', 'L9: memory node name matches');
    assert(memoryNode?.type === 'class', 'L9: concept maps to class type');
    // Validate
    const v = sem.validate();
    assert(v.length === 0, 'L9: No validation errors');
    // Metrics
    const m = sem.metrics();
    assert(m.nodeCount === 6, 'L9: 6 nodes in metrics');
    assert(m.edgeCount === 8, 'L9: 8 edges in metrics');
})();
// ========== TEST: Step 3 - Semantic to Embedding ==========
(function testSemanticToEmbedding() {
    console.log('\n=== L10: Semantic -> Embedding ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 8, knnK: 2 });
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    const emb = pipe.semanticToEmbedding();
    assert(emb instanceof level10_embedding_1.EmbeddingGraph, 'L10: Returns EmbeddingGraph');
    assert(emb.nodes.length === 6, 'L10: 6 embedding nodes created');
    assert(emb.nodes[0].vector.length === 8, 'L10: Vector dimension is 8');
    // Check edges (KNN)
    assert(emb.edges.length > 0, 'L10: KNN edges created');
    // Validate
    const v = emb.validate();
    assert(v.length === 0, 'L10: No validation errors');
})();
// ========== TEST: Step 4 - Embedding to GraphRAG ==========
(function testEmbeddingToGraphRAG() {
    console.log('\n=== L11: Embedding -> GraphRAG ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    const rag = pipe.embeddingToGraphRAG();
    assert(pipe.graphRAG instanceof level11_graphrag_1.GraphRAGEngine, 'L11: GraphRAG created');
    assert(pipe.graphRAG.entities.length === 6, 'L11: 6 entities in GraphRAG');
    assert(pipe.graphRAG.relations.length === 8, 'L11: 8 relations in GraphRAG');
    assert(pipe.graphRAG.chunks.length === 6, 'L11: 6 chunks from embeddings');
})();
// ========== TEST: End-to-End Pipeline ==========
(function testEndToEnd() {
    console.log('\n=== E2E: Full Pipeline ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 8, knnK: 2 });
    const result = pipe.runPipeline(cosEntities, cosRelations);
    assert(result.knowledgeGraph.entities.length === 6, 'E2E: 6 KG entities');
    assert(result.semanticGraph.nodes.length === 6, 'E2E: 6 semantic nodes');
    assert(result.embeddingGraph.nodes.length === 6, 'E2E: 6 embedding nodes');
    assert(result.graphRAG.entities.length === 6, 'E2E: 6 GraphRAG entities');
    // Metrics
    assert(result.metrics.l8.nodeCount === 6, 'E2E: L8 metrics nodeCount');
    assert(result.metrics.l9.nodeCount === 6, 'E2E: L9 metrics nodeCount');
    assert(result.metrics.l10.nodeCount === 6, 'E2E: L10 metrics nodeCount');
    assert(result.metrics.l11.entityCount === 6, 'E2E: L11 metrics entityCount');
})();
// ========== TEST: Pipeline with Query ==========
(function testPipelineWithQuery() {
    console.log('\n=== E2E: Pipeline with Query ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 8, knnK: 2 });
    const query = { text: 'memory system', entities: ['memory'] };
    const result = pipe.runPipeline(cosEntities, cosRelations, query);
    assert(result.query === 'memory system', 'Query: text matches');
    assert(result.ragResult.chunks.length > 0, 'Query: chunks returned');
    assert(result.ragResult.confidence > 0, 'Query: confidence > 0');
    assert(result.ragResult.trace.length > 0, 'Query: trace present');
})();
// ========== TEST: Build Demo ==========
(function testBuildDemo() {
    console.log('\n=== Demo: Build Demo Pipeline ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 8 });
    const demo = pipe.buildDemo();
    assert(demo.knowledgeGraph.entities.length > 0, 'Demo: KG entities exist');
    assert(demo.semanticGraph.nodes.length > 0, 'Demo: Semantic nodes exist');
    assert(demo.embeddingGraph.nodes.length > 0, 'Demo: Embedding nodes exist');
    assert(demo.graphRAG.chunks.length > 0, 'Demo: GraphRAG chunks exist');
    assert(demo.query === 'Tell me about AI models', 'Demo: Default query set');
    assert(demo.ragResult.answer.length > 0, 'Demo: Answer present');
    assert(demo.metrics.l8.nodeCount > 0, 'Demo: L8 metrics');
    assert(demo.metrics.l9.nodeCount > 0, 'Demo: L9 metrics');
    assert(demo.metrics.l10.nodeCount > 0, 'Demo: L10 metrics');
    assert(demo.metrics.l11.entityCount > 0, 'Demo: L11 metrics');
})();
// ========== TEST: Validate All Graphs ==========
(function testValidate() {
    console.log('\n=== Validate: All Graphs ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    pipe.embeddingToGraphRAG();
    const v = pipe.validate();
    assert(v.l8.length === 0, 'Validate: L8 clean');
    assert(v.l9.length === 0, 'Validate: L9 clean');
    assert(v.l10.length === 0, 'Validate: L10 clean');
    assert(v.l11.length === 0, 'Validate: L11 clean');
})();
// ========== TEST: Metrics ==========
(function testMetrics() {
    console.log('\n=== Metrics: All Graphs ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    pipe.embeddingToGraphRAG();
    const m = pipe.metrics();
    assert(m.l8.nodeCount === 6, 'Metrics: L8 nodes');
    assert(m.l9.nodeCount === 6, 'Metrics: L9 nodes');
    assert(m.l10.nodeCount === 6, 'Metrics: L10 nodes');
    assert(m.l11.entityCount === 6, 'Metrics: L11 entities');
    assert(m.l8.edgeCount === 8, 'Metrics: L8 edges');
    assert(m.l9.edgeCount === 8, 'Metrics: L9 edges');
})();
// ========== TEST: Empty Pipeline ==========
(function testEmptyPipeline() {
    console.log('\n=== Edge: Empty Pipeline ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    const result = pipe.runPipeline([], []);
    assert(result.knowledgeGraph.entities.length === 0, 'Empty: 0 KG entities');
    assert(result.semanticGraph.nodes.length === 0, 'Empty: 0 semantic nodes');
    assert(result.embeddingGraph.nodes.length === 0, 'Empty: 0 embedding nodes');
    assert(result.metrics.l8.nodeCount === 0, 'Empty: L8 metrics 0');
    assert(result.metrics.l9.nodeCount === 0, 'Empty: L9 metrics 0');
    assert(result.metrics.l10.nodeCount === 0, 'Empty: L10 metrics 0');
})();
// ========== TEST: Single Entity Pipeline ==========
(function testSingleEntity() {
    console.log('\n=== Edge: Single Entity ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph([{ id: 'a', name: 'Alpha', type: 'concept', description: 'First entity' }], []);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    const v = pipe.validate();
    assert(v.l8.length === 0, 'Single: L8 clean');
    assert(v.l9.length === 0, 'Single: L9 clean');
    assert(v.l10.length === 0, 'Single: L10 clean (no KNN edges for 1 node)');
    assert(pipe.embeddingGraph.edges.length === 0, 'Single: KNN has 0 edges with 1 node');
})();
// ========== TEST: Access Underlying Engines ==========
(function testAccessors() {
    console.log('\n=== Access: Engine Getters ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    assert(pipe.getKnowledgeGraph() instanceof level8_knowledge_1.KnowledgeGraphEngine, 'Access: getKnowledgeGraph');
    assert(pipe.getSemanticGraph() instanceof level9_semantic_1.SemanticGraph, 'Access: getSemanticGraph');
    assert(pipe.getEmbeddingGraph() instanceof level10_embedding_1.EmbeddingGraph, 'Access: getEmbeddingGraph');
    assert(pipe.getGraphRAG() instanceof level11_graphrag_1.GraphRAGEngine, 'Access: getGraphRAG');
})();
// ========== TEST: Answer Query Async ==========
(function testAnswerQuery() {
    console.log('\n=== Async: Answer Query ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11({ embeddingDim: 8, knnK: 2 });
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    pipe.embeddingToGraphRAG();
    const query = { text: 'reasoning', entities: ['reasoning'] };
    pipe.answerQuery(query).then(answer => {
        assert(answer.chunks.length > 0, 'Answer: chunks returned');
        assert(answer.entities.length > 0, 'Answer: entities returned');
        assert(answer.confidence > 0, 'Answer: confidence > 0');
        assert(answer.answer.length > 0, 'Answer: answer text present');
    }).catch(err => {
        console.error(`  ❌ Answer query failed: ${err}`);
        f++;
    });
})();
// ========== TEST: Relation Type Mapping ==========
(function testRelationMapping() {
    console.log('\n=== Mapping: Relation Types ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    // Test with various relation types
    const variedEntities = [
        { id: 'a', name: 'A', type: 'concept' },
        { id: 'b', name: 'B', type: 'concept' },
        { id: 'c', name: 'C', type: 'place' },
    ];
    const variedRelations = [
        { id: 'x1', source: 'a', target: 'b', type: 'created' },
        { id: 'x2', source: 'b', target: 'c', type: 'located_in' },
        { id: 'x3', source: 'c', target: 'a', type: 'related_to' },
    ];
    pipe.buildKnowledgeGraph(variedEntities, variedRelations);
    pipe.knowledgeToSemantic();
    // Check semantic edges were created
    assert(pipe.semanticGraph.edges.length === 3, 'Mapping: 3 edges created');
    const v = pipe.semanticGraph.validate();
    assert(v.length === 0, 'Mapping: No validation errors');
})();
// ========== TEST: Serialization Roundtrip ==========
(function testSerialization() {
    console.log('\n=== Serialization: Pipeline State ===');
    const pipe = new pipeline_l8l9l10l11_1.PipelineL8L9L10L11();
    pipe.buildKnowledgeGraph(cosEntities, cosRelations);
    pipe.knowledgeToSemantic();
    pipe.semanticToEmbedding();
    // Serialize each component
    const kgJSON = pipe.knowledgeGraph.toJSON();
    const semJSON = pipe.semanticGraph.toJSON();
    const embJSON = pipe.embeddingGraph.toJSON();
    assert(kgJSON.entities.length === 6, 'Serial: KG JSON has 6 entities');
    assert(semJSON.nodes.length === 6, 'Serial: Semantic JSON has 6 nodes');
    assert(embJSON.nodes.length === 6, 'Serial: Embedding JSON has 6 nodes');
    // Deserialize
    const kg2 = level8_knowledge_1.KnowledgeGraphEngine.fromJSON(kgJSON);
    const sem2 = level9_semantic_1.SemanticGraph.fromJSON(semJSON);
    const emb2 = level10_embedding_1.EmbeddingGraph.fromJSON(embJSON);
    assert(kg2.entities.length === 6, 'Serial: KG deserialized');
    assert(sem2.nodes.length === 6, 'Serial: Semantic deserialized');
    assert(emb2.nodes.length === 6, 'Serial: Embedding deserialized');
})();
// ========== REPORT ==========
console.log(`\n=== Pipeline L8-L9-L10-L11 Report ===`);
console.log(`Passed: ${p}, Failed: ${f}`);
if (f > 0)
    process.exit(1);
//# sourceMappingURL=test-pipeline-l891011.js.map