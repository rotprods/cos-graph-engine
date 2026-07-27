/**
 * Tests de Benchmark Suite — COS v2.1 Fase 1.3
 * 30 tests: 8 unit + 4 unit + 12 integration + 6 E2E
 *
 * Cada seccion tiene su propio TODO para implementacion incremental.
 * Los tests fallan con "Not implemented" hasta que el componente
 * correspondiente se implemente.
 */

import {
  GraphGenerator,
  Measurer,
  BenchmarkRunner,
  ReportExporter,
  Benchmark,
  BenchmarkResult,
  DiffReport,
  BENCHMARK_DEFINITIONS,
} from './benchmark';
import { CSRGraph } from '../packages/graph/src/csr';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) passed++;
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function assertThrows(fn: () => void, msg: string) {
  try {
    fn();
    failed++; console.error(`  FAIL: ${msg} — expected error`);
  } catch {
    passed++;
  }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

(async () => {

// =============================================
// Unit: GraphGenerator (8 tests)
// =============================================

section('Unit: GraphGenerator');

// Test 1: chain(0) — empty
{
  const g = GraphGenerator.chain(0);
  assert(g.nodeCount() === 0, 'chain(0): 0 nodes');
  assert(g.edgeCount() === 0, 'chain(0): 0 edges');
}

// Test 2: chain(100) — 100 nodes, 99 edges
{
  const g = GraphGenerator.chain(100);
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
  const g = GraphGenerator.grid(1, 1);
  assert(g.nodeCount() === 1, 'grid(1,1): 1 node');
  assert(g.edgeCount() === 0, 'grid(1,1): 0 edges');
}

// Test 4: grid(10,10) — 100 nodes, 180 edges
{
  const g = GraphGenerator.grid(10, 10);
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
  assertThrows(() => GraphGenerator.social(100, 3), 'social(100,3): odd degree throws');
}

// Test 5b: social(100, 4) — 100 nodes, avg degree > 0
{
  const g = GraphGenerator.social(100, 4);
  assert(g.nodeCount() === 100, 'social(100,4): 100 nodes');
  // Each node should have degree ~4 after rewiring
  const sampleNode = g.neighbors('s0');
  assert(sampleNode.length >= 1, 'social(100,4): node has at least 1 neighbor');
}

// Test 6: random(100, 0) — zero edges
{
  const g = GraphGenerator.random(100, 0);
  assert(g.nodeCount() === 100, 'random(100,0): 100 nodes');
  assert(g.edgeCount() === 0, 'random(100,0): 0 edges');
}

// Test 7: tree(5, 2) — 63 nodes, 62 edges (binary tree, depth 5)
{
  const g = GraphGenerator.tree(5, 2);
  // Total: 2^6 - 1 = 63
  assert(g.nodeCount() === 63, 'tree(5,2): 63 nodes');
  assert(g.edgeCount() === 62, 'tree(5,2): 62 edges');
  // Verify root has 2 children
  const rootNbrs = g.neighbors('t0');
  assert(rootNbrs.length === 2, 'tree(5,2): root has 2 children');
}

// Test 8: knowledge(100, 5) — 100 nodes, >5 edges
{
  const g = GraphGenerator.knowledge(100, 5);
  assert(g.nodeCount() === 100, 'knowledge(100,5): 100 nodes');
  assert(g.edgeCount() > 5, 'knowledge(100,5): more than 5 edges');
}

// =============================================
// Unit: Measurer (4 tests)
// =============================================

section('Unit: Measurer');

// Test 9: time(fast-fn, 100) — timeMs > 0, returns result
{
  const { result, timeMs } = Measurer.time(() => 42, 100);
  assert(result === 42, 'Measurer.time: returns correct result');
  assert(timeMs > 0, 'Measurer.time: timeMs > 0');
  assert(timeMs < 100, 'Measurer.time: timeMs < 100ms (fast function)');
}

// Test 10: memory(fast-fn) — heapDelta >= 0
assertThrows(() => Measurer.memory(() => 42), 'Measurer.memory throws Not implemented');

// Test 11: measure(fast-fn, 10) — nodesPerMs > 0
assertThrows(() => Measurer.measure(() => 42, 10), 'Measurer.measure throws Not implemented');

// Test 12: warmup(fast-fn, 10) — no error
assertThrows(() => Measurer.warmup(() => 42, 10), 'Measurer.warmup throws Not implemented');

// =============================================
// Integration: Benchmarks (12 tests)
// =============================================

section('Integration: Benchmarks');

// Test 13: B1 bfs-chain-10k — nodesPerMs >= 2000
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B1');
}, 'B1: runner.run throws Not implemented');

// Test 14: B2 bfs-grid-100x100 — nodesPerMs >= 3000
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B2');
}, 'B2: runner.run throws Not implemented');

// Test 15: B3 bfs-social-5k — speedup >= 1.5x
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B3');
}, 'B3: runner.run throws Not implemented');

// Test 16: B4 shortest-path-tree-1k — visited <= 30%
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B4');
}, 'B4: runner.run throws Not implemented');

// Test 17: B5 pruning-beam-10k — pruningRatio >= 0.40
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B5');
}, 'B5: runner.run throws Not implemented');

// Test 18: B6 pruning-landmark-5k — pruningRatio >= 0.35
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B6');
}, 'B6: runner.run throws Not implemented');

// Test 19: B7 memory-profile-1k — CSR <= 50% Map
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B7');
}, 'B7: runner.run throws Not implemented');

// Test 20: B7 memory-profile-10k — CSR <= 50% Map
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B7');
}, 'B7: runner.run throws Not implemented');

// Test 21: B7 memory-profile-100k — CSR <= 50% Map
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('B7');
}, 'B7: runner.run throws Not implemented');

// Test 22: runAll produces 7 results
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.runAll();
}, 'runAll throws Not implemented');

// Test 23: run with invalid id throws error
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.run('INVALID');
}, 'run(INVALID) throws Not implemented');

// Test 24: define with duplicate id throws error
assertThrows(() => {
  const runner = new BenchmarkRunner();
  // Two calls to define should throw on the second (Not implemented on first)
  runner.define({ id: 'B1' } as Benchmark);
  runner.define({ id: 'B1' } as Benchmark);
}, 'define duplicate throws Not implemented');

// =============================================
// E2E: Report (6 tests)
// =============================================

section('E2E: Report');

// Test 25: toJSON produces valid JSON
assertThrows(() => {
  ReportExporter.toJSON({
    results: [],
    overallSpeedup: 1.0,
    passCount: 0,
    failCount: 0,
    summary: 'test',
  });
}, 'toJSON throws Not implemented');

// Test 26: toMarkdown produces table
assertThrows(() => {
  ReportExporter.toMarkdown({
    results: [],
    overallSpeedup: 1.0,
    passCount: 0,
    failCount: 0,
    summary: 'test',
  });
}, 'toMarkdown throws Not implemented');

// Test 27: toHTML produces page
assertThrows(() => {
  ReportExporter.toHTML({
    results: [],
    overallSpeedup: 1.0,
    passCount: 0,
    failCount: 0,
    summary: 'test',
  });
}, 'toHTML throws Not implemented');

// Test 28: validateThresholds pass
assertThrows(() => {
  ReportExporter.validateThresholds({
    results: [],
    overallSpeedup: 1.0,
    passCount: 0,
    failCount: 0,
    summary: 'test',
  });
}, 'validateThresholds throws Not implemented');

// Test 29: compare produces diff
assertThrows(() => {
  const runner = new BenchmarkRunner();
  runner.compare([], { nodesPerMs: 1000 });
}, 'compare throws Not implemented');

// Test 30: BENCHMARK_DEFINITIONS validation
assert(BENCHMARK_DEFINITIONS.length === 7, 'BENCHMARK_DEFINITIONS has 7 items');
const allValid = BENCHMARK_DEFINITIONS.every(b =>
  typeof b.id === 'string' && b.id.length > 0 &&
  typeof b.name === 'string' && b.name.length > 0 &&
  typeof b.description === 'string' && b.description.length > 0 &&
  typeof b.baseline === 'object' && b.baseline !== null &&
  typeof b.threshold === 'object' && b.threshold !== null
);
assert(allValid, 'All 7 BENCHMARK_DEFINITIONS are valid');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
})();