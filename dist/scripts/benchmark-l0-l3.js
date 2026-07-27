"use strict";
// COS Graph Engine — Fase 7: Benchmarks L0-L3
// T-7.1: Mide rendimiento de los 4 niveles base
// Output: benchmark-results.json (append)
Object.defineProperty(exports, "__esModule", { value: true });
const level0_visual_1 = require("../packages/graph/src/level0-visual");
const level1_execution_1 = require("../packages/graph/src/level1-execution");
const level2_state_1 = require("../packages/graph/src/level2-state");
const level3_dependency_1 = require("../packages/graph/src/level3-dependency");
const fs_1 = require("fs");
const path_1 = require("path");
const RESULTS_PATH = (0, path_1.join)(__dirname, '..', 'benchmark-results.json');
function now() { return performance.now(); }
function measure(label, level, n, fn, iterations = 5) {
    for (let i = 0; i < iterations; i++)
        fn(); // warmup
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
function generateNodes(n) {
    const nodes = [];
    for (let i = 0; i < n; i++)
        nodes.push({ id: `n${i}`, name: `Node${i}` });
    return nodes;
}
function generateEdges(nodes, density = 2) {
    const edges = [];
    for (let i = 1; i < nodes.length; i++) {
        const target = nodes[Math.floor(Math.random() * i)];
        edges.push({ id: `e${i}`, source: nodes[i].id, target: target.id });
        if (i % density === 0 && i > 1) {
            const target2 = nodes[Math.floor(Math.random() * i)];
            if (target2.id !== nodes[i].id)
                edges.push({ id: `e${i}b`, source: nodes[i].id, target: target2.id });
        }
    }
    return edges;
}
function main() {
    console.log('═'.repeat(60));
    console.log('  FASE 7 — BENCHMARKS L0-L3');
    console.log('═'.repeat(60));
    console.log('');
    const results = [];
    // ===== L0: VISUAL GRAPH =====
    console.log('📊 L0 Visual Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = generateNodes(n);
        const edges = generateEdges(nodes, 2);
        results.push(measure('L0 addNode', 'L0', n, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
        }));
        results.push(measure('L0 addEdge', 'L0', edges.length, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
            for (const e of edges)
                g.addEdge(e.source, e.target);
        }));
        results.push(measure('L0 toMermaid', 'L0', n, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
            for (const e of edges)
                g.addEdge(e.source, e.target);
            g.toMermaid();
        }));
        results.push(measure('L0 validate', 'L0', n, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
            for (const e of edges)
                g.addEdge(e.source, e.target);
            g.validate();
        }));
        results.push(measure('L0 serialization', 'L0', n, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
            for (const e of edges)
                g.addEdge(e.source, e.target);
            const json = g.toJSON();
            level0_visual_1.VisualGraphEngine.fromJSON(json);
        }));
        results.push(measure('L0 removeNode (half)', 'L0', n, () => {
            const g = new level0_visual_1.VisualGraphEngine();
            for (const nd of nodes)
                g.addNode({ id: nd.id, label: nd.name, type: 'default' });
            for (const e of edges)
                g.addEdge(e.source, e.target);
            const half = Math.floor(n / 2);
            for (let i = 0; i < half; i++)
                g.removeNode(nodes[i].id);
        }));
    }
    // ===== L1: EXECUTION GRAPH =====
    console.log('\n📊 L1 Execution Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = generateNodes(n);
        const edges = generateEdges(nodes, 1);
        results.push(measure('L1 createGraph', 'L1', n, () => {
            const g = new level1_execution_1.ExecutionGraphEngine();
            g.createGraph('bench', nodes.map(nd => ({ id: nd.id, name: nd.name, type: 'function', fn: async (i) => i })), edges.map(e => ({ source: e.source, target: e.target })));
        }));
        results.push(measure('L1 getGraph', 'L1', n, () => {
            const g = new level1_execution_1.ExecutionGraphEngine();
            const gid = g.createGraph('bench', nodes.map(nd => ({ id: nd.id, name: nd.name, type: 'function', fn: async (i) => i })), edges.map(e => ({ source: e.source, target: e.target })));
            g.getGraph(gid);
        }));
    }
    // ===== L2: STATE MACHINE =====
    console.log('\n📊 L2 State Machine');
    for (const n of [10, 100, 500]) {
        const states = generateNodes(n);
        results.push(measure('L2 addState', 'L2', n, () => {
            const sm = new level2_state_1.StateMachine('bench', [], [], states[0]?.id);
            for (const s of states)
                sm.addState({ id: s.id, label: s.name });
        }));
        results.push(measure('L2 addTransition', 'L2', n, () => {
            const sm = new level2_state_1.StateMachine('bench', [], [], states[0]?.id);
            for (const s of states)
                sm.addState({ id: s.id, label: s.name });
            for (let i = 1; i < states.length; i++)
                sm.addTransition({ from: states[i - 1].id, to: states[i].id, event: `ev${i}` });
        }));
        results.push(measure('L2 validate', 'L2', n, () => {
            const sm = new level2_state_1.StateMachine('bench', [], [], states[0]?.id);
            for (const s of states)
                sm.addState({ id: s.id, label: s.name });
            for (let i = 1; i < states.length; i++)
                sm.addTransition({ from: states[i - 1].id, to: states[i].id, event: `ev${i}` });
            sm.validate();
        }));
    }
    // ===== L3: DEPENDENCY GRAPH =====
    console.log('\n📊 L3 Dependency Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = generateNodes(n);
        const edges = generateEdges(nodes, 2);
        results.push(measure('L3 addNode', 'L3', n, () => {
            const g = new level3_dependency_1.DependencyResolver();
            const gid = g.createGraph('Benchmark', [], []);
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name });
        }));
        results.push(measure('L3 addEdge+tsort', 'L3', n, () => {
            const g = new level3_dependency_1.DependencyResolver();
            const gid = g.createGraph('Benchmark', [], []);
            for (const nd of nodes)
                g.addNode(gid, { id: nd.id, name: nd.name });
            for (const e of edges)
                g.addEdge(gid, { source: e.source, target: e.target });
            g.topologicalSort(gid);
        }));
    }
    // ===== SAVE RESULTS =====
    const output = {
        phase: 'F7',
        label: 'L0-L3 Benchmarks',
        generated: new Date().toISOString(),
        results
    };
    (0, fs_1.writeFileSync)(RESULTS_PATH.replace('.json', '-f7.json'), JSON.stringify(output, null, 2));
    console.log(`\n📝 Resultados guardados en benchmark-results-f7.json (${results.length} mediciones)`);
    console.log(`\n✅✅✅ L0-L3 BENCHMARKED`);
}
main();
//# sourceMappingURL=benchmark-l0-l3.js.map