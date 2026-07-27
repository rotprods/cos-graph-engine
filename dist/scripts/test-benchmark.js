"use strict";
/**
 * Tests de Benchmark Suite — COS v2.1 Fase 1.3
 * 30 tests: 8 unit + 4 unit + 12 integration + 6 E2E
 *
 * Cada seccion tiene su propio TODO para implementacion incremental.
 * Los tests fallan con "Not implemented" hasta que el componente
 * correspondiente se implemente.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const benchmark_1 = require("./benchmark");
const csr_1 = require("../packages/graph/src/csr");
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
function assertThrows(fn, msg) {
    try {
        fn();
        failed++;
        console.error(`  FAIL: ${msg} — expected error`);
    }
    catch {
        passed++;
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
(async () => {
    // =============================================
    // Unit: GraphGenerator (8 tests)
    // =============================================
    section('Unit: GraphGenerator');
    // Test 1: chain(0) — empty
    {
        const g = benchmark_1.GraphGenerator.chain(0);
        assert(g.nodeCount() === 0, 'chain(0): 0 nodes');
        assert(g.edgeCount() === 0, 'chain(0): 0 edges');
    }
    // Test 2: chain(100) — 100 nodes, 99 edges
    {
        const g = benchmark_1.GraphGenerator.chain(100);
        assert(g.nodeCount() === 100, 'chain(100): 100 nodes');
        assert(g.edgeCount() === 99, 'chain(100): 99 edges');
        // Verify linear structure
        const bfs = g.bfs('n0');
        assert(bfs.length === 100, 'chain(100): BFS visits all nodes');
        assert(bfs[bfs.length - 1].id === 'n99', 'chain(100): last node is n99');
        assert(bfs[bfs.length - 1].depth === 99, 'chain(100): max depth 99');
    }
    // Test 3: grid(1,1) — single node
    {
        const g = benchmark_1.GraphGenerator.grid(1, 1);
        assert(g.nodeCount() === 1, 'grid(1,1): 1 node');
        assert(g.edgeCount() === 0, 'grid(1,1): 0 edges');
    }
    // Test 4: grid(10,10) — 100 nodes, 180 edges
    {
        const g = benchmark_1.GraphGenerator.grid(10, 10);
        assert(g.nodeCount() === 100, 'grid(10,10): 100 nodes');
        const expectedEdges = 10 * 9 + 9 * 10; // horizontal + vertical
        assert(g.edgeCount() === expectedEdges, `grid(10,10): ${expectedEdges} edges`);
        // Verify center node has right+down outgoing edges in directed grid
        const nbrs = g.neighbors('r5_c5');
        assert(nbrs.length === 2, 'grid(10,10): center node has 2 outgoing neighbors (right+down)');
        assert(nbrs.includes('r5_c6'), 'grid(10,10): right neighbor');
        assert(nbrs.includes('r6_c5'), 'grid(10,10): down neighbor');
    }
    // Test 5: social(100, 3) error — degree must be even
    {
        assertThrows(() => benchmark_1.GraphGenerator.social(100, 3), 'social(100,3): odd degree throws');
    }
    // Test 5b: social(100, 4) — 100 nodes, avg degree > 0
    {
        const g = benchmark_1.GraphGenerator.social(100, 4);
        assert(g.nodeCount() === 100, 'social(100,4): 100 nodes');
        // Each node should have degree ~4 after rewiring
        const sampleNode = g.neighbors('s0');
        assert(sampleNode.length >= 1, 'social(100,4): node has at least 1 neighbor');
    }
    // Test 6: random(100, 0) — zero edges
    {
        const g = benchmark_1.GraphGenerator.random(100, 0);
        assert(g.nodeCount() === 100, 'random(100,0): 100 nodes');
        assert(g.edgeCount() === 0, 'random(100,0): 0 edges');
    }
    // Test 7: tree(5, 2) — 63 nodes, 62 edges (binary tree, depth 5)
    {
        const g = benchmark_1.GraphGenerator.tree(5, 2);
        // Total: 2^6 - 1 = 63
        assert(g.nodeCount() === 63, 'tree(5,2): 63 nodes');
        assert(g.edgeCount() === 62, 'tree(5,2): 62 edges');
        // Verify root has 2 children
        const rootNbrs = g.neighbors('t0');
        assert(rootNbrs.length === 2, 'tree(5,2): root has 2 children');
    }
    // Test 8: knowledge(100, 5) — 100 nodes, >5 edges
    {
        const g = benchmark_1.GraphGenerator.knowledge(100, 5);
        assert(g.nodeCount() === 100, 'knowledge(100,5): 100 nodes');
        assert(g.edgeCount() > 5, 'knowledge(100,5): more than 5 edges');
    }
    // =============================================
    // Unit: Measurer (4 tests)
    // =============================================
    section('Unit: Measurer');
    // Test 9: time(fast-fn, 100) — timeMs > 0, returns result
    {
        const { result, timeMs } = benchmark_1.Measurer.time(() => 42, 100);
        assert(result === 42, 'Measurer.time: returns correct result');
        assert(timeMs > 0, 'Measurer.time: timeMs > 0');
        assert(timeMs < 100, 'Measurer.time: timeMs < 100ms (fast function)');
    }
    // Test 10: memory(fast-fn) — heapDelta >= 0, returns result
    {
        const { result, heapDelta } = benchmark_1.Measurer.memory(() => 42);
        assert(result === 42, 'Measurer.memory: returns correct result');
        assert(heapDelta >= 0, 'Measurer.memory: heapDelta >= 0');
        // heapDelta should be reasonable for a primitive (GC may vary, but < 1MB)
        assert(heapDelta < 1024 * 1024, 'Measurer.memory: heapDelta < 1MB for primitive');
    }
    // Test 11: measure(fast-fn, 10) — Metrics with timeMs > 0, nodes=0, edges=0
    {
        const m = benchmark_1.Measurer.measure(() => 42, 10);
        assert(m.timeMs > 0, 'Measurer.measure: timeMs > 0');
        assert(m.heapUsedMB >= 0, 'Measurer.measure: heapUsedMB >= 0');
        assert(m.nodesProcessed === 0, 'Measurer.measure: nodes=0 for primitive');
        assert(m.edgesProcessed === 0, 'Measurer.measure: edges=0 for primitive');
        assert(m.pruningRatio === 0, 'Measurer.measure: pruningRatio=0 default');
    }
    // Test 12: warmup(fast-fn, 10) — no error
    {
        benchmark_1.Measurer.warmup(() => 42, 10);
        assert(true, 'Measurer.warmup: no error with 10 iterations');
    }
    // Test 12b: warmup(fast-fn, 0) — no-op
    {
        benchmark_1.Measurer.warmup(() => 42, 0);
        assert(true, 'Measurer.warmup: no error with 0 iterations');
    }
    // Smoke test: measure with CSRGraph (duck-typing)
    {
        const g = benchmark_1.GraphGenerator.chain(100);
        const m = benchmark_1.Measurer.measure(() => g, 10);
        assert(m.nodesProcessed === 100, 'Measurer.measure CSR: nodes=100');
        assert(m.edgesProcessed === 99, 'Measurer.measure CSR: edges=99');
        assert(m.nodesPerMs > 0, 'Measurer.measure CSR: nodesPerMs > 0');
    }
    // =============================================
    // Integration: Benchmarks (12 tests)
    // =============================================
    section('Integration: Benchmarks');
    // Test 13: B1 bfs-chain-10k — via runner.define + runner.run
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.chain(10000);
        runner.define({
            id: 'B1', name: 'bfs-chain-10k', description: 'Chain BFS',
            graph: g, setup: () => { }, run: (gr) => { gr.bfs('n0'); return gr; },
            baseline: { nodesPerMs: 1420, memoryMB: 4.2 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B1');
        assert(result.id === 'B1', 'B1: result id matches');
        assert(result.metrics.timeMs > 0, 'B1: timeMs > 0');
    }
    // Test 14: B2 bfs-grid-100x100 — runner with grid
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.grid(100, 100);
        runner.define({
            id: 'B2', name: 'bfs-grid-100x100', description: 'Grid BFS',
            graph: g, setup: () => { }, run: (gr) => { gr.bfs('r50_c50'); return gr; },
            baseline: { nodesPerMs: 2100, memoryMB: 6.8 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B2');
        assert(result.metrics.timeMs > 0, 'B2: timeMs > 0');
    }
    // Test 15: B3 bfs-social-5k — speedup vs Map
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.social(500, 4);
        runner.define({
            id: 'B3', name: 'bfs-social-5k', description: 'Social BFS',
            graph: g, setup: () => { }, run: (gr) => { gr.bfs('s0'); return gr; },
            baseline: { nodesPerMs: 800, memoryMB: 3.5 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B3');
        assert(result.metrics.timeMs > 0, 'B3: timeMs > 0');
    }
    // Test 16: B4 shortest-path-tree-1k
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.tree(10, 3);
        runner.define({
            id: 'B4', name: 'shortest-path-tree-1k', description: 'Tree shortest path',
            graph: g, setup: () => { }, run: (gr) => { gr.bidirectionalBFS('t0', 't29523'); return gr; },
            baseline: { nodesPerMs: 500, memoryMB: 2.0 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B4');
        assert(result.metrics.timeMs > 0, 'B4: timeMs > 0');
    }
    // Test 17: B5 pruning-beam-10k
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.random(1000, 0.05);
        runner.define({
            id: 'B5', name: 'pruning-beam-10k', description: 'Beam pruning',
            graph: g, setup: () => { }, run: (gr) => {
                const { PruningExecutor, BeamPruning, VisitedPruning, createPruningState } = require('../packages/graph/src/pruning');
                const executor = new PruningExecutor([new BeamPruning(50), new VisitedPruning()]);
                const state = createPruningState('r0', undefined, 10);
                const visited = new Set();
                const queue = [{ id: 'r0', depth: 0 }];
                executor.startTimer();
                while (queue.length > 0) {
                    const cur = queue.shift();
                    if (visited.has(cur.id) || executor.shouldPrune(cur.id, cur.depth, state))
                        continue;
                    visited.add(cur.id);
                    state.currentNode = cur.id;
                    state.depth = cur.depth;
                    executor.onExpand(cur.id, cur.depth, state);
                    if (cur.depth >= 10)
                        continue;
                    for (const nid of gr.neighbors(cur.id)) {
                        if (!visited.has(nid))
                            queue.push({ id: nid, depth: cur.depth + 1 });
                    }
                }
                return gr;
            },
            baseline: { nodesPerMs: 300, memoryMB: 5.0 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B5');
        assert(result.metrics.timeMs > 0, 'B5: timeMs > 0');
    }
    // Test 18: B6 pruning-landmark-5k
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.knowledge(500, 5);
        runner.define({
            id: 'B6', name: 'pruning-landmark-5k', description: 'Landmark pruning',
            graph: g, setup: () => { }, run: (gr) => {
                const { PruningExecutor, LandmarkPruning, EarlyExitPruning, VisitedPruning, createPruningState } = require('../packages/graph/src/pruning');
                const landmarks = ['k0', 'k100', 'k200', 'k300', 'k400'];
                const executor = new PruningExecutor([new LandmarkPruning(gr, landmarks, 3), new EarlyExitPruning(), new VisitedPruning()]);
                const state = createPruningState('k0', undefined, 10);
                const visited = new Set();
                const queue = [{ id: 'k0', depth: 0 }];
                executor.startTimer();
                while (queue.length > 0) {
                    const cur = queue.shift();
                    if (visited.has(cur.id) || executor.shouldPrune(cur.id, cur.depth, state))
                        continue;
                    visited.add(cur.id);
                    state.currentNode = cur.id;
                    state.depth = cur.depth;
                    executor.onExpand(cur.id, cur.depth, state);
                    if (cur.depth >= 10)
                        continue;
                    for (const nid of gr.neighbors(cur.id)) {
                        if (!visited.has(nid))
                            queue.push({ id: nid, depth: cur.depth + 1 });
                    }
                }
                return gr;
            },
            baseline: { nodesPerMs: 250, memoryMB: 4.0 },
            threshold: { speedup: 1.0 },
        });
        const result = runner.run('B6');
        assert(result.metrics.timeMs > 0, 'B6: timeMs > 0');
    }
    // Test 19: B7 memory-profile
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.chain(1000);
        runner.define({
            id: 'B7', name: 'memory-profile', description: 'Memory profile',
            graph: g, setup: () => { }, run: (gr) => {
                const mem = benchmark_1.Measurer.memory(() => {
                    const csr = new csr_1.CSRGraph();
                    for (let i = 0; i < 1000; i++)
                        csr.addNode({ id: `n${i}` });
                    return csr;
                });
                return gr;
            },
            baseline: { nodesPerMs: 0, memoryMB: 0 },
            threshold: { maxMemoryRatio: 0.5 },
        });
        const result = runner.run('B7');
        assert(result.metrics.timeMs > 0, 'B7: timeMs > 0');
    }
    // Test 20: runAll produces results
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.chain(100);
        runner.define({ id: 'T1', name: 'test', description: 'test', graph: g, setup: () => { }, run: (gr) => gr.bfs('n0'), baseline: { nodesPerMs: 1000, memoryMB: 1 }, threshold: {} });
        const results = runner.runAll();
        assert(results.length === 1, 'runAll: 1 result');
    }
    // Test 21: run with invalid id throws error
    {
        const runner = new benchmark_1.BenchmarkRunner();
        try {
            runner.run('INVALID');
            assert(false, 'run(INVALID): should throw');
        }
        catch (e) {
            assert(true, 'run(INVALID): throws error');
        }
    }
    // Test 22: define with duplicate id throws error
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const g = benchmark_1.GraphGenerator.chain(10);
        runner.define({ id: 'D1', name: 'dup', description: 'dup', graph: g, setup: () => { }, run: (gr) => gr.bfs('n0'), baseline: { nodesPerMs: 1, memoryMB: 1 }, threshold: {} });
        try {
            runner.define({ id: 'D1', name: 'dup', description: 'dup', graph: g, setup: () => { }, run: (gr) => gr.bfs('n0'), baseline: { nodesPerMs: 1, memoryMB: 1 }, threshold: {} });
            assert(false, 'define duplicate: should throw');
        }
        catch (e) {
            assert(true, 'define duplicate: throws error');
        }
    }
    // =============================================
    // E2E: Report (6 tests)
    // =============================================
    section('E2E: Report');
    // Test 23: toJSON produces valid JSON
    {
        const json = benchmark_1.ReportExporter.toJSON({
            results: [], overallSpeedup: 1.0, passCount: 0, failCount: 0, summary: 'test',
        });
        const parsed = JSON.parse(json);
        assert(typeof parsed === 'object', 'toJSON: valid JSON');
        assert(parsed.summary === 'test', 'toJSON: content preserved');
    }
    // Test 24: toMarkdown produces table
    {
        const md = benchmark_1.ReportExporter.toMarkdown({
            results: [], overallSpeedup: 1.0, passCount: 0, failCount: 0, summary: 'test',
        });
        assert(md.includes('| ID |'), 'toMarkdown: contains table header');
        assert(md.includes('test'), 'toMarkdown: contains summary');
    }
    // Test 25: toHTML produces page
    {
        const html = benchmark_1.ReportExporter.toHTML({
            results: [], overallSpeedup: 1.0, passCount: 0, failCount: 0, summary: 'test',
        });
        assert(html.includes('<!DOCTYPE html>'), 'toHTML: contains doctype');
        assert(html.includes('</html>'), 'toHTML: contains closing html');
    }
    // Test 26: validateThresholds pass — all pass
    {
        const valid = benchmark_1.ReportExporter.validateThresholds({
            results: [
                { id: 'B1', name: 'b1', status: 'pass', metrics: { timeMs: 1, memoryBytes: 0, heapUsedMB: 0, nodesProcessed: 0, edgesProcessed: 0, nodesPerMs: 0, pruningRatio: 0 }, baseline: { nodesPerMs: 0, memoryMB: 0 }, speedup: 1, memoryReduction: '0%', details: {} },
            ], overallSpeedup: 1.0, passCount: 1, failCount: 0, summary: 'pass',
        });
        assert(valid === true, 'validateThresholds: returns true when all pass');
    }
    // Test 27: validateThresholds fail — one fail
    {
        const valid = benchmark_1.ReportExporter.validateThresholds({
            results: [
                { id: 'B1', name: 'b1', status: 'fail', metrics: { timeMs: 0, memoryBytes: 0, heapUsedMB: 0, nodesProcessed: 0, edgesProcessed: 0, nodesPerMs: 0, pruningRatio: 0 }, baseline: { nodesPerMs: 0, memoryMB: 0 }, speedup: 0, memoryReduction: 'N/A', details: {} },
            ], overallSpeedup: 0, passCount: 0, failCount: 1, summary: 'fail',
        });
        assert(valid === false, 'validateThresholds: returns false when any fail');
    }
    // Test 28: compare produces diff
    {
        const runner = new benchmark_1.BenchmarkRunner();
        const result = {
            id: 'B1', name: 'b1', status: 'pass', metrics: { timeMs: 1, memoryBytes: 0, heapUsedMB: 0, nodesProcessed: 100, edgesProcessed: 99, nodesPerMs: 100, pruningRatio: 0 },
            baseline: { nodesPerMs: 50, memoryMB: 1 }, speedup: 2, memoryReduction: '50%', details: {},
        };
        const diff = runner.compare([result], { nodesPerMs: 50 });
        assert(diff.overallSpeedup > 0, 'compare: overallSpeedup > 0');
        assert(diff.passCount === 1, 'compare: 1 pass');
        assert(diff.failCount === 0, 'compare: 0 fail');
    }
    // Test 30: BENCHMARK_DEFINITIONS validation
    assert(benchmark_1.BENCHMARK_DEFINITIONS.length === 7, 'BENCHMARK_DEFINITIONS has 7 items');
    const allValid = benchmark_1.BENCHMARK_DEFINITIONS.every(b => typeof b.id === 'string' && b.id.length > 0 &&
        typeof b.name === 'string' && b.name.length > 0 &&
        typeof b.description === 'string' && b.description.length > 0 &&
        typeof b.baseline === 'object' && b.baseline !== null &&
        typeof b.threshold === 'object' && b.threshold !== null);
    assert(allValid, 'All 7 BENCHMARK_DEFINITIONS are valid');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
})();
//# sourceMappingURL=test-benchmark.js.map