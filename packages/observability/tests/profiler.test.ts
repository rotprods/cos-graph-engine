/**
 * Tests for Profiler — T-3.2b
 *
 * 12 tests covering:
 *  - Profiler: start, snapshot, summary, multiple labels, reset, edge cases
 *  - Prometheus export: basic format, multiple metrics, empty profiler
 *  - NoopProfiler: singleton, zero overhead
 *  - ProfilingHook: CSR integration
 *  - NoopProfilingHook: singleton
 */

import { Profiler, NoopProfiler, ProfilingHookImpl, NoopProfilingHook } from '../src/profiler';
import { CSRGraph, ProfilingHook } from '../../graph/src/csr';

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;
let testCount = 0;

function assert(condition: boolean, msg: string): void {
  testCount++;
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function assertStrictEqual<T>(a: T, b: T, msg: string): void {
  testCount++;
  if (a === b) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}: expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
  }
}

function assertNear(a: number, b: number, tol: number, msg: string): void {
  testCount++;
  if (Math.abs(a - b) <= tol) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}: ${a} ≈ ${b} (tol=${tol})`);
  }
}

function section(name: string): void {
  console.log(`\n=== ${name} ===`);
}

function buildChain(n: number): CSRGraph {
  const g = new CSRGraph();
  for (let i = 0; i < n; i++) g.addNode({ id: `n${i}` });
  for (let i = 0; i < n - 1; i++) g.addEdge(`n${i}`, `n${i + 1}`);
  return g;
}

// ============================================================
// 1. Profiler — start and snapshot
// ============================================================
section('Profiler — start and snapshot');

{
  const p = new Profiler();
  assert(p.sampleCount === 0, 'initially 0 samples');

  p.start('bfs');
  // Small delay to ensure measurable elapsed time
  const sample = p.snapshot('bfs');
  assert(sample.label === 'bfs', 'label matches');
  assert(sample.elapsed >= 0, 'elapsed >= 0');
  assert(sample.timestamp > 0, 'timestamp > 0');
  assert(p.sampleCount === 1, '1 sample after snapshot');
}

// ============================================================
// 2. Profiler — multiple labels
// ============================================================
section('Profiler — multiple labels');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  p.start('dfs');
  p.snapshot('dfs');
  p.start('pagerank');
  p.snapshot('pagerank');

  assert(p.sampleCount === 3, '3 samples total');
}

// ============================================================
// 3. Profiler — summary
// ============================================================
section('Profiler — summary');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  p.start('bfs');
  p.snapshot('bfs');
  p.start('bfs');
  p.snapshot('bfs');

  const summaries = p.summary();
  assert(summaries.length === 1, '1 summary for 1 label');
  assert(summaries[0].label === 'bfs', 'label is bfs');
  assert(summaries[0].count === 3, '3 snapshots');
  assert(summaries[0].totalTime > 0, 'totalTime > 0');
  assert(summaries[0].avgTime > 0, 'avgTime > 0');
  assert(summaries[0].minTime <= summaries[0].maxTime, 'min <= max');
}

// ============================================================
// 4. Profiler — summary with multiple labels
// ============================================================
section('Profiler — summary multiple labels');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  p.start('dfs');
  p.snapshot('dfs');
  p.start('bfs');
  p.snapshot('bfs');

  const summaries = p.summary();
  assert(summaries.length === 2, '2 summaries for 2 labels');
  // Sorted by totalTime desc
  const bfsSum = summaries.find(s => s.label === 'bfs')!;
  const dfsSum = summaries.find(s => s.label === 'dfs')!;
  assert(bfsSum.count === 2, 'bfs has 2 snaps');
  assert(dfsSum.count === 1, 'dfs has 1 snap');
}

// ============================================================
// 5. Profiler — reset
// ============================================================
section('Profiler — reset');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  assert(p.sampleCount === 1, '1 sample before reset');
  p.reset();
  assert(p.sampleCount === 0, '0 samples after reset');
  assert(p.summary().length === 0, 'empty summary after reset');
}

// ============================================================
// 6. Profiler — empty profiler
// ============================================================
section('Profiler — empty');

{
  const p = new Profiler();
  assert(p.sampleCount === 0, '0 samples');
  assert(p.summary().length === 0, 'empty summary');
  const output = p.exportPrometheus();
  assert(output.includes('profiler_samples_total 0'), 'empty: samples 0');
  assert(output.includes('operation_labels 0'), 'empty: 0 operation labels');
  assert(output.endsWith('\n'), 'ends with newline');
}

// ============================================================
// 7. Prometheus export — basic format
// ============================================================
section('Prometheus export — basic format');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  p.start('bfs');
  p.snapshot('bfs', { nodesVisited: 5 });

  const output = p.exportPrometheus();
  assert(output.includes('cos_graph_profiler_samples_total'), 'has samples total');
  assert(output.includes('cos_graph_bfs_count'), 'has bfs count');
  assert(output.includes('cos_graph_bfs_duration_ms_sum'), 'has bfs duration sum');
  assert(output.includes('cos_graph_bfs_avg_ms'), 'has bfs avg');
  assert(output.includes('cos_graph_sample_duration_ms'), 'has raw samples');
  assert(output.includes('HELP'), 'has HELP lines');
  assert(output.includes('TYPE'), 'has TYPE lines');
  assert(output.endsWith('\n'), 'ends with newline');
}

// ============================================================
// 8. Prometheus export — multiple metrics
// ============================================================
section('Prometheus export — multiple metrics');

{
  const p = new Profiler();
  p.start('bfs');
  p.snapshot('bfs');
  p.start('page_rank');
  p.snapshot('page_rank');

  const output = p.exportPrometheus();
  assert(output.includes('operation="bfs"'), 'has bfs operation');
  assert(output.includes('operation="page_rank"'), 'has page_rank operation');
  assert(output.includes('cos_graph_bfs_'), 'has bfs metrics');
  assert(output.includes('cos_graph_page_rank_'), 'has page_rank metrics');
}

// ============================================================
// 9. NoopProfiler — singleton
// ============================================================
section('NoopProfiler — singleton');

{
  const a = NoopProfiler.instance;
  const b = NoopProfiler.instance;
  assert(a === b, 'singleton: same instance');
  assert(a.sampleCount === 0, 'sampleCount is 0');
  assertStrictEqual(a.exportPrometheus(), '', 'exportPrometheus empty');
  assert(a.summary().length === 0, 'summary is empty');

  // Noop operations should not throw
  a.start('bfs');
  a.snapshot('bfs');
  assert(a.sampleCount === 0, 'still 0 after noop ops');
  a.reset();
}

// ============================================================
// 10. ProfilingHookImpl — CSR integration
// ============================================================
section('ProfilingHookImpl — CSR integration');

{
  const graph = buildChain(10);
  const hook = new ProfilingHookImpl();

  graph.bfs('n0', 5, undefined, hook);
  const summaries = hook.profiler.summary();
  assert(summaries.length === 1, '1 summary after BFS');
  assert(summaries[0].label.startsWith('bfs('), 'label starts with bfs(');
  assert(summaries[0].count > 0, 'has snapshots');
}

// ============================================================
// 11. ProfilingHookImpl — multiple operations
// ============================================================
section('ProfilingHookImpl — multiple operations');

{
  const graph = buildChain(10);
  const hook = new ProfilingHookImpl();

  graph.bfs('n0', 5, undefined, hook);
  graph.dfs('n0', 5, undefined, hook);
  graph.bidirectionalBFS('n0', 'n9', 10, undefined, hook);

  const summaries = hook.profiler.summary();
  assert(summaries.length >= 1, 'has summaries');
  // Should have bfs, dfs, bidirectionalBFS
  const labels = summaries.map(s => s.label);
  assert(labels.some(l => l.startsWith('bfs(')), 'has bfs');
  assert(labels.some(l => l.startsWith('dfs(')), 'has dfs');
  assert(labels.some(l => l.startsWith('bidirectionalBFS(')), 'has bidirectionalBFS');
}

// ============================================================
// 12. NoopProfilingHook — singleton
// ============================================================
section('NoopProfilingHook — singleton');

{
  const a = NoopProfilingHook.instance;
  const b = NoopProfilingHook.instance;
  assert(a === b, 'singleton: same instance');

  // Noop operations should not throw
  a.onStart('source', 'bfs');
  a.onNodeVisit('n0', 0, 0);
  a.onComplete('bfs', 0, 0);
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);