#!/usr/bin/env npx tsx
"use strict";
/**
 * COS Benchmark Suite v2.1 — Runner completo
 * Ejecuta B1-B7, exporta reporte a JSON, Markdown y HTML.
 *
 * Usage: npx tsx scripts/run-benchmark-suite.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const benchmark_1 = require("./benchmark");
const csr_1 = require("../packages/graph/src/csr");
const pruning_1 = require("../packages/graph/src/pruning");
const runner = new benchmark_1.BenchmarkRunner();
// ---- B1: bfs-chain-10k ----
{
    const g = benchmark_1.GraphGenerator.chain(10000);
    runner.define({
        id: 'B1', name: 'bfs-chain-10k', description: 'BFS en cadena lineal de 10K nodos',
        graph: g, setup: () => { }, run: (gr) => { const visited = gr.bfs('n0'); return { nodes: visited.length, edges: 0 }; },
        baseline: { nodesPerMs: 1420, memoryMB: 4.2 },
        threshold: { speedup: 0.5, maxMemoryMB: 10 },
    });
}
// ---- B2: bfs-grid-100x100 ----
{
    const g = benchmark_1.GraphGenerator.grid(100, 100);
    runner.define({
        id: 'B2', name: 'bfs-grid-100x100', description: 'BFS en grid 100x100 (10K nodos)',
        graph: g, setup: () => { }, run: (gr) => { const visited = gr.bfs('r0_c0'); return { nodes: visited.length, edges: 0 }; },
        baseline: { nodesPerMs: 2100, memoryMB: 6.8 },
        threshold: { speedup: 0.5, maxMemoryMB: 15 },
    });
}
// ---- B3: bfs-social-5k ----
{
    const g = benchmark_1.GraphGenerator.social(500, 4);
    runner.define({
        id: 'B3', name: 'bfs-social-5k', description: 'BFS small-world 5K nodos',
        graph: g, setup: () => { }, run: (gr) => { const visited = gr.bfs('s0'); return { nodes: visited.length, edges: 0 }; },
        baseline: { nodesPerMs: 800, memoryMB: 3.5 },
        threshold: { speedup: 1.5, maxMemoryMB: 8 },
    });
}
// ---- B4: shortest-path-tree-1k ----
{
    const g = benchmark_1.GraphGenerator.tree(10, 3);
    runner.define({
        id: 'B4', name: 'shortest-path-tree-1k', description: 'Bidirectional BFS en arbol de 10 niveles',
        graph: g, setup: () => { }, run: (gr) => {
            const path = gr.bidirectionalBFS('t0', 't29523');
            return { nodes: path.length, edges: 0 };
        },
        baseline: { nodesPerMs: 500, memoryMB: 2.0 },
        threshold: { maxNodesVisitedPercent: 30 },
    });
}
// ---- B5: pruning-beam-10k ----
{
    const g = benchmark_1.GraphGenerator.random(1000, 0.05);
    runner.define({
        id: 'B5', name: 'pruning-beam-10k', description: 'Beam pruning (K=50) en random 10K',
        graph: g, setup: () => { }, run: (gr) => {
            const executor = new pruning_1.PruningExecutor([new pruning_1.BeamPruning(50), new pruning_1.VisitedPruning()]);
            const state = (0, pruning_1.createPruningState)('r0', undefined, 10);
            const visited = new Set();
            const queue = [{ id: 'r0', depth: 0 }];
            let totalConsidered = 0;
            while (queue.length > 0) {
                const cur = queue.shift();
                totalConsidered++;
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
            const pruningRatio = totalConsidered > 0 ? 1 - visited.size / totalConsidered : 0;
            return { nodes: visited.size, edges: 0, pruningRatio };
        },
        baseline: { nodesPerMs: 300, memoryMB: 5.0 },
        threshold: { minPruningRatio: 0.4 },
    });
}
// ---- B6: pruning-landmark-5k ----
{
    const g = benchmark_1.GraphGenerator.knowledge(500, 5);
    runner.define({
        id: 'B6', name: 'pruning-landmark-5k', description: 'Landmark pruning (L=5) + EarlyExit en knowledge 5K',
        graph: g, setup: () => { }, run: (gr) => {
            const landmarks = ['k0', 'k100', 'k200', 'k300', 'k400'];
            const executor = new pruning_1.PruningExecutor([new pruning_1.LandmarkPruning(gr, landmarks, 3), new pruning_1.EarlyExitPruning(), new pruning_1.VisitedPruning()]);
            const state = (0, pruning_1.createPruningState)('k0', undefined, 10);
            const visited = new Set();
            const queue = [{ id: 'k0', depth: 0 }];
            let totalConsidered = 0;
            while (queue.length > 0) {
                const cur = queue.shift();
                totalConsidered++;
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
            const pruningRatio = totalConsidered > 0 ? 1 - visited.size / totalConsidered : 0;
            return { nodes: visited.size, edges: 0, pruningRatio };
        },
        baseline: { nodesPerMs: 250, memoryMB: 4.0 },
        threshold: { minPruningRatio: 0.35 },
    });
}
// ---- B7: memory-profile ----
{
    const g = benchmark_1.GraphGenerator.chain(1000);
    runner.define({
        id: 'B7', name: 'memory-profile', description: 'Perfil de memoria CSR vs Map para N=1K',
        graph: g, setup: () => { }, run: (gr) => {
            const mem = benchmark_1.Measurer.memory(() => {
                const csr = new csr_1.CSRGraph();
                for (let i = 0; i < 1000; i++)
                    csr.addNode({ id: `n${i}` });
                return csr;
            });
            return { nodes: 1000, edges: 0, memoryBytes: mem.heapDelta };
        },
        baseline: { nodesPerMs: 0, memoryMB: 1.0 },
        threshold: { maxMemoryRatio: 0.95 },
    });
}
// ===== Run all =====
const results = runner.runAll();
const diff = runner.compare(results, { nodesPerMs: 1000 });
console.log('\n=== COS Benchmark Suite v2.1 ===\n');
console.log(`Overall speedup: ${diff.overallSpeedup.toFixed(2)}x`);
console.log(`Pass: ${diff.passCount}, Fail: ${diff.failCount}`);
console.log(`Summary: ${diff.summary}\n`);
console.log('Results:');
for (const r of results) {
    console.log(`  ${r.id} ${r.name.padEnd(25)} ${r.status.padEnd(6)} ${r.metrics.timeMs.toFixed(2)}ms ${r.metrics.nodesPerMs.toFixed(0)}n/ms speedup=${r.speedup.toFixed(2)}x`);
}
// ---- Export ----
const jsonPath = 'benchmarks/benchmark-report.json';
const mdPath = 'benchmarks/benchmark-report.md';
const htmlPath = 'benchmarks/benchmark-report.html';
const fs = require('fs');
fs.mkdirSync('benchmarks', { recursive: true });
fs.writeFileSync(jsonPath, benchmark_1.ReportExporter.toJSON(diff));
fs.writeFileSync(mdPath, benchmark_1.ReportExporter.toMarkdown(diff));
fs.writeFileSync(htmlPath, benchmark_1.ReportExporter.toHTML(diff));
console.log(`\nReportes exportados:`);
console.log(`  JSON  → ${jsonPath}`);
console.log(`  MD    → ${mdPath}`);
console.log(`  HTML  → ${htmlPath}`);
// Validate
const isValid = benchmark_1.ReportExporter.validateThresholds(diff);
console.log(`\nThresholds: ${isValid ? 'PASS' : 'FAIL'}`);
process.exit(isValid ? 0 : 1);
//# sourceMappingURL=run-benchmark-suite.js.map