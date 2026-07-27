"use strict";
// COS Graph Engine — Fase 7: Benchmarks L4-L11
// T-7.2: Mide rendimiento de niveles 4-11
// Output: benchmark-results-f7-2.json
Object.defineProperty(exports, "__esModule", { value: true });
const level4_call_1 = require("../packages/graph/src/level4-call");
const level5_cfg_1 = require("../packages/graph/src/level5-cfg");
const level6_dataflow_1 = require("../packages/graph/src/level6-dataflow");
const level8_knowledge_1 = require("../packages/graph/src/level8-knowledge");
const level9_semantic_1 = require("../packages/graph/src/level9-semantic");
const level10_embedding_1 = require("../packages/graph/src/level10-embedding");
const level11_graphrag_1 = require("../packages/graph/src/level11-graphrag");
const fs_1 = require("fs");
const path_1 = require("path");
const RESULTS_PATH = (0, path_1.join)(__dirname, '..', 'benchmark-results-f7-2.json');
function now() { return performance.now(); }
function measure(label, level, n, fn, iterations = 5) {
    for (let i = 0; i < iterations; i++)
        fn();
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = now();
        fn();
        const end = now();
        times.push(end - start);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const ops = mean > 0 ? Math.round(1000 / mean) : 0;
    const r = { phase: 'F7', level, name: label, n, meanMs: Math.round(mean * 100) / 100, minMs: Math.round(min * 100) / 100, maxMs: Math.round(max * 100) / 100, ops, unit: 'ms' };
    console.log(`  ${label.padEnd(40)} n=${String(n).padEnd(5)} ${mean.toFixed(2).padStart(8)} ms  ${ops.toFixed(0).padStart(6)} ops/s`);
    return r;
}
function genNodes(n) {
    const a = [];
    for (let i = 0; i < n; i++)
        a.push({ id: `n${i}`, name: `Node${i}` });
    return a;
}
function genEdges(nodes, density = 2) {
    const e = [];
    for (let i = 1; i < nodes.length; i++) {
        e.push({ source: nodes[i].id, target: nodes[Math.floor(Math.random() * i)].id });
        if (i % density === 0 && i > 1) {
            const t = nodes[Math.floor(Math.random() * i)];
            if (t.id !== nodes[i].id)
                e.push({ source: nodes[i].id, target: t.id });
        }
    }
    return e;
}
function main() {
    console.log('═'.repeat(60));
    console.log('  FASE 7 — BENCHMARKS L4-L11');
    console.log('═'.repeat(60));
    console.log('');
    const results = [];
    // ===== L4: CALL GRAPH =====
    console.log('📊 L4 Call Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        // createGraph
        results.push(measure('L4 createGraph', 'L4', n, () => {
            const g = new level4_call_1.CallGraphBuilder();
            g.createGraph('bench');
        }));
        // addNode
        results.push(measure('L4 addNode', 'L4', n, () => {
            const g = new level4_call_1.CallGraphBuilder();
            const gid = g.createGraph('bench');
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name, type: 'function' });
        }));
        // addEdge
        results.push(measure('L4 addEdge', 'L4', edges.length, () => {
            const g = new level4_call_1.CallGraphBuilder();
            const gid = g.createGraph('bench');
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name, type: 'function' });
            for (const e of edges)
                g.addEdge(gid, { id: `e_${e.source}_${e.target}`, source: e.source, target: e.target, callCount: 1 });
        }));
        // validate
        results.push(measure('L4 validate', 'L4', n, () => {
            const g = new level4_call_1.CallGraphBuilder();
            const gid = g.createGraph('bench');
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name, type: 'function' });
            for (const e of edges)
                g.addEdge(gid, { id: `e_${e.source}_${e.target}`, source: e.source, target: e.target, callCount: 1 });
            g.validate(gid);
        }));
        // serialization
        results.push(measure('L4 serialization', 'L4', n, () => {
            const g = new level4_call_1.CallGraphBuilder();
            const gid = g.createGraph('bench');
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name, type: 'function' });
            for (const e of edges)
                g.addEdge(gid, { id: `e_${e.source}_${e.target}`, source: e.source, target: e.target, callCount: 1 });
            const json = g.toJSON(gid);
            if (json)
                level4_call_1.CallGraphBuilder.fromJSON(json);
        }));
    }
    // ===== L5: CFG =====
    console.log('\n📊 L5 CFG');
    for (const n of [10, 100, 1000]) {
        // createCFG already creates entry + exit, so we add n-2 basic blocks
        const blockCount = n;
        // createCFG
        results.push(measure('L5 createCFG', 'L5', blockCount, () => {
            const g = new level5_cfg_1.CFGBuilder();
            g.createCFG('bench');
        }));
        // addBlock
        results.push(measure('L5 addBlock', 'L5', blockCount, () => {
            const g = new level5_cfg_1.CFGBuilder();
            const gid = g.createCFG('bench');
            for (let i = 0; i < blockCount; i++)
                g.addBlock(gid, `block${i}`, 'basic');
        }));
        // addEdge (linear chain between user blocks)
        results.push(measure('L5 addEdge', 'L5', blockCount, () => {
            const g = new level5_cfg_1.CFGBuilder();
            const gid = g.createCFG('bench');
            const ids = [];
            for (let i = 0; i < blockCount; i++)
                ids.push(g.addBlock(gid, `block${i}`, 'basic'));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(gid, ids[i - 1], ids[i], 'fallthrough');
        }));
        // validate
        results.push(measure('L5 validate', 'L5', blockCount, () => {
            const g = new level5_cfg_1.CFGBuilder();
            const gid = g.createCFG('bench');
            for (let i = 0; i < blockCount; i++)
                g.addBlock(gid, `block${i}`, 'basic');
            g.validate(gid);
        }));
        // serialization
        results.push(measure('L5 serialization', 'L5', blockCount, () => {
            const g = new level5_cfg_1.CFGBuilder();
            const gid = g.createCFG('bench');
            for (let i = 0; i < blockCount; i++)
                g.addBlock(gid, `block${i}`, 'basic');
            const json = g.toJSON(gid);
            if (json)
                level5_cfg_1.CFGBuilder.fromJSON(json);
        }));
    }
    // ===== L6: DATA FLOW =====
    console.log('\n📊 L6 Data Flow');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L6 addNode', 'L6', n, () => {
            const g = new level6_dataflow_1.DataFlowGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, name: nd.name, type: 'transform' });
        }));
        results.push(measure('L6 addEdge', 'L6', edges.length, () => {
            const g = new level6_dataflow_1.DataFlowGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, name: nd.name, type: 'transform' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, dataType: 'any' });
        }));
        results.push(measure('L6 validate', 'L6', n, () => {
            const g = new level6_dataflow_1.DataFlowGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, name: nd.name, type: 'transform' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, dataType: 'any' });
            g.validate();
        }));
        results.push(measure('L6 serialization', 'L6', n, () => {
            const g = new level6_dataflow_1.DataFlowGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, name: nd.name, type: 'transform' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, dataType: 'any' });
            const json = g.toJSON();
            level6_dataflow_1.DataFlowGraph.fromJSON(json);
        }));
    }
    // ===== L8: KNOWLEDGE GRAPH =====
    console.log('\n📊 L8 Knowledge Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L8 addEntity', 'L8', n, () => {
            const g = new level8_knowledge_1.KnowledgeGraphEngine();
            for (const nd of nodes)
                g.addEntity({ id: nd.id, name: nd.name, type: 'concept' });
        }));
        results.push(measure('L8 addRelation', 'L8', edges.length, () => {
            const g = new level8_knowledge_1.KnowledgeGraphEngine();
            for (const nd of nodes)
                g.addEntity({ id: nd.id, name: nd.name, type: 'concept' });
            for (const e of edges)
                g.addRelation({ id: `r_${e.source}`, source: e.source, target: e.target, type: 'related_to' });
        }));
        results.push(measure('L8 validate', 'L8', n, () => {
            const g = new level8_knowledge_1.KnowledgeGraphEngine();
            for (const nd of nodes)
                g.addEntity({ id: nd.id, name: nd.name, type: 'concept' });
            for (const e of edges)
                g.addRelation({ id: `r_${e.source}`, source: e.source, target: e.target, type: 'related_to' });
            g.validate();
        }));
        results.push(measure('L8 serialization', 'L8', n, () => {
            const g = new level8_knowledge_1.KnowledgeGraphEngine();
            for (const nd of nodes)
                g.addEntity({ id: nd.id, name: nd.name, type: 'concept' });
            for (const e of edges)
                g.addRelation({ id: `r_${e.source}`, source: e.source, target: e.target, type: 'related_to' });
            const json = g.toJSON();
            level8_knowledge_1.KnowledgeGraphEngine.fromJSON(json);
        }));
    }
    // ===== L9: SEMANTIC GRAPH =====
    console.log('\n📊 L9 Semantic Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L9 addNode', 'L9', n, () => {
            const g = new level9_semantic_1.SemanticGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, concept: nd.name, type: 'entity' });
        }));
        results.push(measure('L9 addEdge', 'L9', edges.length, () => {
            const g = new level9_semantic_1.SemanticGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, concept: nd.name, type: 'entity' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, relation: 'related_to', strength: 1 });
        }));
        results.push(measure('L9 validate', 'L9', n, () => {
            const g = new level9_semantic_1.SemanticGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, concept: nd.name, type: 'entity' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, relation: 'related_to', strength: 1 });
            g.validate();
        }));
        results.push(measure('L9 serialization', 'L9', n, () => {
            const g = new level9_semantic_1.SemanticGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, concept: nd.name, type: 'entity' });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, relation: 'related_to', strength: 1 });
            const json = g.toJSON();
            level9_semantic_1.SemanticGraph.fromJSON(json);
        }));
    }
    // ===== L10: EMBEDDING GRAPH =====
    console.log('\n📊 L10 Embedding Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L10 addNode', 'L10', n, () => {
            const g = new level10_embedding_1.EmbeddingGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, vector: [0.1, 0.2, 0.3] });
        }));
        results.push(measure('L10 addEdge', 'L10', edges.length, () => {
            const g = new level10_embedding_1.EmbeddingGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, vector: [0.1, 0.2, 0.3] });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, similarity: 0.5, distance: 0.1 });
        }));
        results.push(measure('L10 validate', 'L10', n, () => {
            const g = new level10_embedding_1.EmbeddingGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, vector: [0.1, 0.2, 0.3] });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, similarity: 0.5, distance: 0.1 });
            g.validate();
        }));
        results.push(measure('L10 serialization', 'L10', n, () => {
            const g = new level10_embedding_1.EmbeddingGraph();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, vector: [0.1, 0.2, 0.3] });
            for (const e of edges)
                g.addEdge({ id: `e_${e.source}`, source: e.source, target: e.target, similarity: 0.5, distance: 0.1 });
            const json = g.toJSON();
            level10_embedding_1.EmbeddingGraph.fromJSON(json);
        }));
    }
    // ===== L11: GraphRAG =====
    console.log('\n📊 L11 GraphRAG');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L11 addChunk', 'L11', n, () => {
            const g = new level11_graphrag_1.GraphRAGEngine();
            for (const nd of nodes)
                g.addChunk({ id: nd.id, text: nd.name, source: 'bench', embedding: [0.1, 0.2, 0.3], entities: [] });
        }));
        results.push(measure('L11 addEntity+rel', 'L11', n, () => {
            const g = new level11_graphrag_1.GraphRAGEngine();
            for (const nd of nodes)
                g.addEntity(nd.id, nd.name);
            for (const e of edges)
                g.addRelation(e.source, e.target, 'related_to');
        }));
        results.push(measure('L11 validate', 'L11', n, () => {
            const g = new level11_graphrag_1.GraphRAGEngine();
            for (const nd of nodes)
                g.addEntity(nd.id, nd.name);
            for (const e of edges)
                g.addRelation(e.source, e.target, 'related_to');
            g.validate();
        }));
        results.push(measure('L11 serialization', 'L11', n, () => {
            const g = new level11_graphrag_1.GraphRAGEngine();
            for (const nd of nodes)
                g.addEntity(nd.id, nd.name);
            for (const e of edges)
                g.addRelation(e.source, e.target, 'related_to');
            const json = g.toJSON();
            level11_graphrag_1.GraphRAGEngine.fromJSON(json);
        }));
    }
    // ===== SAVE =====
    const output = {
        phase: 'F7', label: 'L4-L11 Benchmarks',
        generated: new Date().toISOString(), results
    };
    (0, fs_1.writeFileSync)(RESULTS_PATH, JSON.stringify(output, null, 2));
    console.log(`\n📝 Resultados guardados en benchmark-results-f7-2.json (${results.length} mediciones)`);
    console.log(`\n✅✅✅ L4-L11 BENCHMARKED`);
}
main();
//# sourceMappingURL=benchmark-l4-l11.js.map