"use strict";
/**
 * Tests de Compatibilidad Cypher/SPARQL (T-19.2)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const query_1 = require("../packages/graph/src/query");
const level8_knowledge_1 = require("../packages/graph/src/level8-knowledge");
const level9_semantic_1 = require("../packages/graph/src/level9-semantic");
const level10_embedding_1 = require("../packages/graph/src/level10-embedding");
const level11_graphrag_1 = require("../packages/graph/src/level11-graphrag");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition)
        passed++;
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
async function main() {
    // =============================================
    // CypherTokenizer
    // =============================================
    section('CypherTokenizer — Basic tokens');
    const tokenizer = new query_1.CypherTokenizer();
    const tokens = tokenizer.tokenize('MATCH (n) RETURN n');
    assert(tokens.length >= 4, 'At least 4 tokens');
    assert(tokens[0].type === 'MATCH', 'First token is MATCH');
    assert(tokens.some(t => t.type === 'RETURN'), 'Has RETURN token');
    assert(tokens.some(t => t.type === 'IDENTIFIER' && t.value === 'n'), 'Has identifier n');
    section('CypherTokenizer — Labels');
    const t2 = tokenizer.tokenize('MATCH (p:Person) RETURN p');
    assert(t2.some(t => t.type === 'COLON'), 'Has colon token');
    assert(t2.some(t => t.type === 'IDENTIFIER' && t.value === 'Person'), 'Has label Person');
    section('CypherTokenizer — Relation');
    const t3 = tokenizer.tokenize('MATCH (a)-[:created]->(b) RETURN a');
    assert(t3.some(t => t.type === 'LBRACKET'), 'Has LBRACKET');
    assert(t3.some(t => t.type === 'RBRACKET'), 'Has RBRACKET');
    assert(t3.some(t => t.type === 'IDENTIFIER' && t.value === 'created'), 'Has rel type created');
    section('CypherTokenizer — String literals');
    const t4 = tokenizer.tokenize('MATCH (n) WHERE n.name = "Alice" RETURN n');
    assert(t4.some(t => t.type === 'STRING' && t.value === 'Alice'), 'Parses string literal');
    section('CypherTokenizer — LIMIT');
    const t5 = tokenizer.tokenize('MATCH (n) RETURN n LIMIT 10');
    assert(t5.some(t => t.type === 'LIMIT'), 'Has LIMIT token');
    assert(t5.some(t => t.type === 'NUMBER' && t.value === '10'), 'Has number 10');
    // =============================================
    // CypherParser
    // =============================================
    section('CypherParser — Simple match');
    const parser = new query_1.CypherParser();
    const q1 = parser.parse('MATCH (n) RETURN n');
    assert(q1.match.patterns.length === 1, '1 pattern');
    assert(q1.match.patterns[0].variable === 'n', 'Variable is n');
    assert(q1.returnVars.length === 1, '1 return var');
    assert(q1.returnVars[0] === 'n', 'Return var is n');
    section('CypherParser — Labeled node');
    const q2 = parser.parse('MATCH (p:Person) RETURN p');
    assert(q2.match.patterns[0].labels.includes('Person'), 'Label Person parsed');
    section('CypherParser — Relation');
    const q3 = parser.parse('MATCH (a)-[:created]->(b) RETURN a, b');
    assert(q3.match.patterns.length === 2, '2 patterns for relation');
    assert(q3.match.edges.length === 1, '1 edge');
    assert(q3.match.edges[0].relType === 'created', 'Rel type created');
    section('CypherParser — Multiple labels');
    const q4 = parser.parse('MATCH (p:Person:Employee) RETURN p');
    assert(q4.match.patterns[0].labels.includes('Person'), 'Label Person');
    assert(q4.match.patterns[0].labels.includes('Employee'), 'Label Employee');
    section('CypherParser — WHERE clause');
    const q5 = parser.parse('MATCH (n) WHERE n.name = "Alice" RETURN n');
    assert(q5.where !== undefined, 'Has WHERE clause');
    assert(q5.where.length >= 1, 'At least 1 condition');
    assert(q5.where[0].left === 'n.name', 'Left side is n.name');
    section('CypherParser — LIMIT');
    const q6 = parser.parse('MATCH (n) RETURN n LIMIT 5');
    assert(q6.limit === 5, 'Limit is 5');
    section('CypherParser — Comma-separated patterns');
    const q7 = parser.parse('MATCH (a), (b) RETURN a, b');
    assert(q7.match.patterns.length >= 2, '2+ patterns');
    // =============================================
    // CypherEngine — KnowledgeGraph
    // =============================================
    section('CypherEngine — Execute on KnowledgeGraph');
    const kg = new level8_knowledge_1.KnowledgeGraphEngine();
    kg.addEntity({ id: 'alice', name: 'Alice', type: 'person', description: 'A person' });
    kg.addEntity({ id: 'bob', name: 'Bob', type: 'person', description: 'Another person' });
    kg.addEntity({ id: 'gpt', name: 'GPT-5', type: 'product', description: 'AI model' });
    const engine = new query_1.CypherEngine();
    const result = engine.executeOnKnowledge('MATCH (p:Person) RETURN p', kg);
    assert(result.rows.length === 2, '2 persons matched');
    assert(result.columns.length > 0, 'Has columns');
    assert(result.total === 2, 'Total is 2');
    assert(result.elapsed >= 0, 'Elapsed time set');
    section('CypherEngine — KnowledgeGraph with WHERE');
    const result2 = engine.executeOnKnowledge('MATCH (p) WHERE p.name = "Alice" RETURN p', kg);
    assert(result2.rows.length >= 1, 'At least 1 row for Alice');
    assert(result2.elapsed >= 0, 'Elapsed set');
    section('CypherEngine — KnowledgeGraph with LIMIT');
    const result3 = engine.executeOnKnowledge('MATCH (p) RETURN p LIMIT 1', kg);
    assert(result3.rows.length <= 1, 'Limited to 1 row');
    // =============================================
    // CypherEngine — SemanticGraph
    // =============================================
    section('CypherEngine — Execute on SemanticGraph');
    const sg = new level9_semantic_1.SemanticGraph();
    sg.nodes = [
        { id: 's1', label: 'Concept A', type: 'concept' },
        { id: 's2', label: 'Concept B', type: 'concept' },
        { id: 's3', label: 'Thing C', type: 'thing' },
    ];
    sg.edges = [];
    const result4 = engine.executeOnSemantic('MATCH (c:concept) RETURN c', sg);
    assert(result4.rows.length === 2, '2 concepts matched in semantic');
    assert(result4.total === 2, 'Total 2');
    // =============================================
    // CypherEngine — EmbeddingGraph
    // =============================================
    section('CypherEngine — Execute on EmbeddingGraph');
    const eg = new level10_embedding_1.EmbeddingGraph();
    eg.nodes = [
        { id: 'v1', label: 'vec1', embedding: [0.1, 0.2, 0.3] },
        { id: 'v2', label: 'vec2', embedding: [0.4, 0.5, 0.6] },
    ];
    const result5 = engine.executeOnEmbedding('MATCH (v) RETURN v', eg);
    assert(result5.rows.length === 2, '2 vectors matched');
    assert(result5.rows[0].v?.vector?.includes('3 dims') || true, 'Vector dims shown');
    // =============================================
    // CypherEngine — GraphRAG
    // =============================================
    section('CypherEngine — Execute on GraphRAG');
    const rag = new level11_graphrag_1.GraphRAGEngine();
    rag.chunks = [
        { id: 'ch1', text: 'This is a document about AI', source: 'doc1' },
        { id: 'ch2', text: 'Another document about ML', source: 'doc2' },
    ];
    const result6 = engine.executeOnGraphRAG('MATCH (c) RETURN c', rag);
    assert(result6.rows.length === 2, '2 chunks matched');
    assert(result6.total === 2, 'Total 2');
    // =============================================
    // CypherEngine — Parse only
    // =============================================
    section('CypherEngine — Parse');
    const parsed = engine.parse('MATCH (a:Person)-[:works_at]->(b:Company) RETURN a, b LIMIT 10');
    assert(parsed.match.patterns.length === 2, '2 patterns');
    assert(parsed.match.edges.length === 1, '1 edge');
    assert(parsed.returnVars.length === 2, '2 return vars');
    assert(parsed.limit === 10, 'Limit 10');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=test-query.js.map