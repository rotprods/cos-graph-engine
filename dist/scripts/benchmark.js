"use strict";
/**
 * Benchmark Suite — COS Graph Engine v2.1 Fase 1.3
 *
 * 7 benchmarks (B1-B7) midiendo throughput, speedup CSR vs Map,
 * pruning ratio, y perfil de memoria.
 *
 * Componentes:
 *   GraphGenerator   — 6 tipos de grafos sinteticos
 *   Measurer         — time, memory, warmup
 *   BenchmarkRunner  — orquestacion + 7 benchmarks
 *   ReportExporter   — JSON / Markdown / HTML / thresholds
 *
 * Zero dependencias externas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BENCHMARK_DEFINITIONS = exports.ReportExporter = exports.BenchmarkRunner = exports.Measurer = exports.GraphGenerator = void 0;
const csr_1 = require("../packages/graph/src/csr");
// ============================================================
// GraphGenerator
// ============================================================
class GraphGenerator {
    static chain(n) {
        if (n < 0)
            throw new Error('n must be >= 0');
        const graph = new csr_1.CSRGraph();
        for (let i = 0; i < n; i++) {
            graph.addNode({ id: `n${i}` });
        }
        for (let i = 0; i < n - 1; i++) {
            graph.addEdge(`n${i}`, `n${i + 1}`);
        }
        return graph;
    }
    static grid(rows, cols) {
        if (rows <= 0 || cols <= 0)
            throw new Error('rows and cols must be > 0');
        const graph = new csr_1.CSRGraph();
        const id = (r, c) => `r${r}_c${c}`;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                graph.addNode({ id: id(r, c) });
            }
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (c + 1 < cols)
                    graph.addEdge(id(r, c), id(r, c + 1));
                if (r + 1 < rows)
                    graph.addEdge(id(r, c), id(r + 1, c));
            }
        }
        return graph;
    }
    static social(n, degree) {
        if (n <= 0)
            throw new Error('n must be > 0');
        if (degree % 2 !== 0)
            throw new Error('degree must be even');
        const graph = new csr_1.CSRGraph();
        const k = Math.floor(degree / 2);
        const id = (i) => `s${i}`;
        for (let i = 0; i < n; i++)
            graph.addNode({ id: id(i) });
        // Ring lattice: each node connects to k neighbors on each side
        for (let i = 0; i < n; i++) {
            for (let j = 1; j <= k; j++) {
                const target = (i + j) % n;
                graph.addEdge(id(i), id(target));
                graph.addEdge(id(target), id(i));
            }
        }
        // Rewire with probability 0.1 (Watts-Strogatz)
        for (let i = 0; i < n; i++) {
            for (let j = 1; j <= k; j++) {
                const target = (i + j) % n;
                if (Math.random() < 0.1) {
                    graph.removeEdge(id(i), id(target));
                    graph.removeEdge(id(target), id(i));
                    let newTarget;
                    do {
                        newTarget = Math.floor(Math.random() * n);
                    } while (newTarget === i || graph.hasEdge(id(i), id(newTarget)));
                    graph.addEdge(id(i), id(newTarget));
                    graph.addEdge(id(newTarget), id(i));
                }
            }
        }
        return graph;
    }
    static random(n, edgeProb) {
        if (n < 0)
            throw new Error('n must be >= 0');
        if (edgeProb < 0 || edgeProb > 1)
            throw new Error('edgeProb must be in [0, 1]');
        const graph = new csr_1.CSRGraph();
        const id = (i) => `r${i}`;
        for (let i = 0; i < n; i++)
            graph.addNode({ id: id(i) });
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (Math.random() < edgeProb) {
                    graph.addEdge(id(i), id(j));
                }
            }
        }
        return graph;
    }
    static tree(depth, branching) {
        if (depth < 0)
            throw new Error('depth must be >= 0');
        if (branching <= 0)
            throw new Error('branching must be > 0');
        const graph = new csr_1.CSRGraph();
        if (depth === 0) {
            graph.addNode({ id: 'root' });
            return graph;
        }
        // Total nodes: sum_{d=0}^{depth} branching^d = (branching^{depth+1} - 1) / (branching - 1)
        const totalNodes = Math.floor((Math.pow(branching, depth + 1) - 1) / (branching - 1));
        const id = (i) => `t${i}`;
        for (let i = 0; i < totalNodes; i++)
            graph.addNode({ id: id(i) });
        // For each node i, children are at branching*i+1 to branching*i+branching
        for (let i = 0; i < totalNodes; i++) {
            for (let b = 1; b <= branching; b++) {
                const child = branching * i + b;
                if (child < totalNodes) {
                    graph.addEdge(id(i), id(child));
                }
            }
        }
        return graph;
    }
    static knowledge(n, clusters) {
        if (n <= 0)
            throw new Error('n must be > 0');
        if (clusters <= 0)
            throw new Error('clusters must be > 0');
        const graph = new csr_1.CSRGraph();
        const clusterSize = Math.max(1, Math.floor(n / clusters));
        const actualClusters = Math.ceil(n / clusterSize);
        const id = (i) => `k${i}`;
        for (let i = 0; i < n; i++)
            graph.addNode({ id: id(i) });
        // Assign each node to a cluster
        const nodeCluster = [];
        for (let i = 0; i < n; i++) {
            nodeCluster.push(Math.min(Math.floor(i / clusterSize), actualClusters - 1));
        }
        // Intra-cluster edges (density 0.3)
        for (let c = 0; c < actualClusters; c++) {
            const clusterNodes = [];
            for (let i = 0; i < n; i++) {
                if (nodeCluster[i] === c)
                    clusterNodes.push(i);
            }
            for (let a = 0; a < clusterNodes.length; a++) {
                for (let b = a + 1; b < clusterNodes.length; b++) {
                    if (Math.random() < 0.3) {
                        graph.addEdge(id(clusterNodes[a]), id(clusterNodes[b]));
                    }
                }
            }
        }
        // Inter-cluster edges (density 0.01)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (nodeCluster[i] !== nodeCluster[j] && Math.random() < 0.01) {
                    graph.addEdge(id(i), id(j));
                }
            }
        }
        return graph;
    }
}
exports.GraphGenerator = GraphGenerator;
// ============================================================
// Measurer
// ============================================================
class Measurer {
    static time(fn, iterations) {
        if (iterations < 1)
            throw new Error('iterations must be >= 1');
        // Cold run: primera ejecucion (JIT compilation, cache miss)
        fn();
        // Warm measured iterations
        const start = performance.now();
        let result = undefined;
        for (let i = 0; i < iterations; i++) {
            result = fn();
        }
        const end = performance.now();
        return {
            result,
            timeMs: (end - start) / iterations,
        };
    }
    static memory(fn) {
        // Force GC if available (Node --expose-gc)
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }
        const before = process.memoryUsage().heapUsed;
        const result = fn();
        const after = process.memoryUsage().heapUsed;
        const heapDelta = Math.max(0, after - before);
        return { result, heapDelta };
    }
    static measure(fn, iterations) {
        if (iterations < 1)
            throw new Error('iterations must be >= 1');
        // Cold run (JIT warmup)
        fn();
        // Force GC before memory measurement
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }
        const memBefore = process.memoryUsage().heapUsed;
        // Warm measured iterations
        const start = performance.now();
        let result = undefined;
        for (let i = 0; i < iterations; i++) {
            result = fn();
        }
        const end = performance.now();
        const memAfter = process.memoryUsage().heapUsed;
        const timeMs = (end - start) / iterations;
        const memoryBytes = Math.max(0, memAfter - memBefore);
        // Extract metadata from result
        const { nodes, edges, pruningRatio } = Measurer.extractMetadata(result);
        return {
            timeMs,
            memoryBytes,
            heapUsedMB: memoryBytes / (1024 * 1024),
            nodesProcessed: nodes,
            edgesProcessed: edges,
            nodesPerMs: timeMs > 0 ? nodes / timeMs : 0,
            pruningRatio,
        };
    }
    static extractMetadata(result) {
        if (!result || typeof result !== 'object')
            return { nodes: 0, edges: 0, pruningRatio: 0 };
        const r = result;
        // CSRGraph duck-typing: has nodeCount() and edgeCount() methods
        if (typeof r.nodeCount === 'function' && typeof r.edgeCount === 'function') {
            return {
                nodes: r.nodeCount(),
                edges: r.edgeCount(),
                pruningRatio: 0,
            };
        }
        // Plain object with nodes/edges/pruningRatio properties
        return {
            nodes: typeof r.nodes === 'number' ? r.nodes : 0,
            edges: typeof r.edges === 'number' ? r.edges : 0,
            pruningRatio: typeof r.pruningRatio === 'number' ? r.pruningRatio : 0,
        };
    }
    static warmup(fn, iterations) {
        if (iterations < 1)
            return;
        for (let i = 0; i < iterations; i++) {
            fn();
        }
    }
}
exports.Measurer = Measurer;
// ============================================================
// BenchmarkRunner
// ============================================================
class BenchmarkRunner {
    benchmarks = new Map();
    define(b) {
        if (this.benchmarks.has(b.id)) {
            throw new Error(`Benchmark already defined: ${b.id}`);
        }
        this.benchmarks.set(b.id, b);
    }
    run(id) {
        const b = this.benchmarks.get(id);
        if (!b)
            throw new Error(`Benchmark not found: ${id}`);
        // Setup
        b.setup();
        // Measure
        const metrics = Measurer.measure(() => b.run(b.graph), 5);
        // Determine status
        const speedup = b.baseline.nodesPerMs > 0
            ? metrics.nodesPerMs / b.baseline.nodesPerMs
            : 1;
        const memoryReduction = b.baseline.memoryMB > 0
            ? `${((1 - metrics.heapUsedMB / b.baseline.memoryMB) * 100).toFixed(0)}%`
            : 'N/A';
        const threshold = b.threshold;
        let status = 'pass';
        if (threshold.speedup && speedup < threshold.speedup)
            status = 'fail';
        if (threshold.maxMemoryMB && metrics.heapUsedMB > threshold.maxMemoryMB)
            status = 'fail';
        if (threshold.minPruningRatio && metrics.pruningRatio < threshold.minPruningRatio)
            status = 'fail';
        if (threshold.maxMemoryRatio && b.baseline.memoryMB > 0 && metrics.heapUsedMB / b.baseline.memoryMB > threshold.maxMemoryRatio)
            status = 'fail';
        if (threshold.maxNodesVisitedPercent && metrics.nodesPerMs > 0 && b.graph.nodeCount() > 0) {
            const visitedPercent = (metrics.nodesProcessed / b.graph.nodeCount()) * 100;
            if (visitedPercent > threshold.maxNodesVisitedPercent)
                status = 'fail';
        }
        return {
            id: b.id,
            name: b.name,
            status,
            metrics,
            baseline: b.baseline,
            speedup,
            memoryReduction,
            details: {},
        };
    }
    runAll() {
        const results = [];
        for (const id of this.benchmarks.keys()) {
            try {
                results.push(this.run(id));
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                results.push({
                    id,
                    name: id,
                    status: 'fail',
                    metrics: { timeMs: 0, memoryBytes: 0, heapUsedMB: 0, nodesProcessed: 0, edgesProcessed: 0, nodesPerMs: 0, pruningRatio: 0 },
                    baseline: { nodesPerMs: 0, memoryMB: 0 },
                    speedup: 0,
                    memoryReduction: 'N/A',
                    details: { error: msg },
                });
            }
        }
        return results;
    }
    compare(results, baseline) {
        const overallSpeedup = baseline.nodesPerMs > 0
            ? results.reduce((acc, r) => acc + (r.metrics.nodesPerMs / baseline.nodesPerMs), 0) / results.length
            : 0;
        const passCount = results.filter(r => r.status === 'pass').length;
        const failCount = results.filter(r => r.status === 'fail').length;
        return {
            results,
            overallSpeedup,
            passCount,
            failCount,
            summary: `${passCount}/${results.length} benchmarks passed. Overall speedup: ${overallSpeedup.toFixed(2)}x`,
        };
    }
}
exports.BenchmarkRunner = BenchmarkRunner;
// ============================================================
// ReportExporter
// ============================================================
class ReportExporter {
    static toJSON(report) {
        return JSON.stringify(report, null, 2);
    }
    static toMarkdown(report) {
        const lines = [];
        lines.push('# Benchmark Report');
        lines.push('');
        lines.push(`**Summary**: ${report.summary}`);
        lines.push('');
        lines.push('| ID | Name | Status | Time (ms) | Memory (MB) | Nodes/ms | Speedup |');
        lines.push('|----|------|--------|-----------|-------------|----------|---------|');
        for (const r of report.results) {
            lines.push(`| ${r.id} | ${r.name} | ${r.status} | ${r.metrics.timeMs.toFixed(2)} | ${r.metrics.heapUsedMB.toFixed(3)} | ${r.metrics.nodesPerMs.toFixed(1)} | ${r.speedup.toFixed(2)}x |`);
        }
        lines.push('');
        lines.push(`**${report.passCount} passed, ${report.failCount} failed**`);
        return lines.join('\n');
    }
    static toHTML(report) {
        const rows = report.results.map(r => `
      <tr class="${r.status}">
        <td>${r.id}</td>
        <td>${r.name}</td>
        <td><span class="badge badge-${r.status}">${r.status}</span></td>
        <td>${r.metrics.timeMs.toFixed(2)}</td>
        <td>${r.metrics.heapUsedMB.toFixed(3)}</td>
        <td>${r.metrics.nodesPerMs.toFixed(1)}</td>
        <td>${r.speedup.toFixed(2)}x</td>
      </tr>`).join('');
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Benchmark Report — COS Graph Engine</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f7fa; color:#1a1a2e; padding:2rem; }
  .container { max-width:960px; margin:0 auto; }
  h1 { font-size:1.75rem; margin-bottom:0.25rem; }
  .subtitle { color:#64748b; margin-bottom:1.5rem; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1); }
  th { background:#1a1a2e; color:#fff; padding:12px 16px; text-align:left; font-weight:600; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em; }
  td { padding:10px 16px; border-bottom:1px solid #e2e8f0; font-size:0.9rem; }
  .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; text-transform:uppercase; }
  .badge-pass { background:#dcfce7; color:#166534; }
  .badge-fail { background:#fef2f2; color:#991b1b; }
  tr.pass { background:#fafefa; }
  tr.fail { background:#fefaf5; }
  .summary { display:flex; gap:1rem; margin-bottom:2rem; }
  .stat { background:#fff; border-radius:8px; padding:1rem 1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.1); flex:1; text-align:center; }
  .stat-value { font-size:1.5rem; font-weight:700; }
  .stat-label { font-size:0.8rem; color:#64748b; text-transform:uppercase; margin-top:0.25rem; }
  .stat-pass .stat-value { color:#166534; }
  .stat-fail .stat-value { color:#991b1b; }
</style>
</head>
<body>
<div class="container">
  <h1>Benchmark Report</h1>
  <p class="subtitle">COS Graph Engine v2.1</p>
  <div class="summary">
    <div class="stat stat-pass">
      <div class="stat-value">${report.passCount}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat stat-fail">
      <div class="stat-value">${report.failCount}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.overallSpeedup.toFixed(2)}x</div>
      <div class="stat-label">Overall Speedup</div>
    </div>
  </div>
  <table>
    <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Time (ms)</th><th>Memory (MB)</th><th>Nodes/ms</th><th>Speedup</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:1rem;color:#64748b;font-size:0.8rem;">${report.summary}</p>
</div>
</body>
</html>`;
    }
    static validateThresholds(report) {
        return report.results.every(r => r.status === 'pass');
    }
}
exports.ReportExporter = ReportExporter;
// ============================================================
// Benchmark Definitions (B1-B7)
// ============================================================
// Nota: estos benchmarks se instancian con sus grafos en el Runner.
// Los grafos se generan via GraphGenerator (a implementar en T-1.3a).
// Los thresholds se definen aqui como referencia de diseno.
exports.BENCHMARK_DEFINITIONS = [
    {
        id: 'B1',
        name: 'bfs-chain-10k',
        description: 'BFS en cadena lineal de 10K nodos. Mide throughput puro de CSR.',
        baseline: { nodesPerMs: 1420, memoryMB: 4.2 },
        threshold: { speedup: 1.5, maxMemoryMB: 10 },
    },
    {
        id: 'B2',
        name: 'bfs-grid-100x100',
        description: 'BFS en grid 100x100 (10K nodos). Mide throughput en grafo 2D.',
        baseline: { nodesPerMs: 2100, memoryMB: 6.8 },
        threshold: { speedup: 1.5, maxMemoryMB: 15 },
    },
    {
        id: 'B3',
        name: 'bfs-social-5k',
        description: 'BFS small-world 5K nodos. Compara CSR vs Map<string, string[]>.',
        baseline: { nodesPerMs: 800, memoryMB: 3.5 },
        threshold: { speedup: 1.5, maxMemoryMB: 8 },
    },
    {
        id: 'B4',
        name: 'shortest-path-tree-1k',
        description: 'Bidirectional BFS en arbol de 10 niveles. Mide eficiencia de poda.',
        baseline: { nodesPerMs: 500, memoryMB: 2.0 },
        threshold: { maxNodesVisitedPercent: 30 },
    },
    {
        id: 'B5',
        name: 'pruning-beam-10k',
        description: 'Beam pruning (K=50) en random 10K. Mide pruning ratio.',
        baseline: { nodesPerMs: 300, memoryMB: 5.0 },
        threshold: { minPruningRatio: 0.4 },
    },
    {
        id: 'B6',
        name: 'pruning-landmark-5k',
        description: 'Landmark pruning (L=5) + EarlyExit en knowledge 5K. Mide pruning ratio.',
        baseline: { nodesPerMs: 250, memoryMB: 4.0 },
        threshold: { minPruningRatio: 0.35 },
    },
    {
        id: 'B7',
        name: 'memory-profile',
        description: 'Perfil de memoria CSR vs Map para N=1K, 10K, 100K.',
        baseline: { nodesPerMs: 0, memoryMB: 0 },
        threshold: { maxMemoryRatio: 0.5 },
    },
];
// ============================================================
// CLI entry point
// ============================================================
if (require.main === module) {
    const args = process.argv.slice(2);
    const suiteIndex = args.indexOf('--suite');
    const suite = suiteIndex >= 0 ? args[suiteIndex + 1] : 'all';
    const outputIndex = args.indexOf('--output');
    const output = outputIndex >= 0 ? args[outputIndex + 1] : 'json';
    const validate = args.includes('--validate');
    console.log(`COS Benchmark Suite v2.1`);
    console.log(`Suite: ${suite}, Output: ${output}, Validate: ${validate}`);
    console.log(`\nNOTA: Los componentes aun no estan implementados.`);
    console.log(`Ejecute 'npx tsx scripts/test-benchmark.ts' para ver los tests.`);
}
//# sourceMappingURL=benchmark.js.map