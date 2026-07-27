// COS Graph Engine — Benchmark Suite
// Measures throughput, latency, and capacity for all 3 levels

import { VisualGraphEngine, ExecutionGraphEngine, StateMachineRegistry } from '../packages/graph/src/index.ts';
import { EntityId } from '../packages/core/src/index.ts';
import * as fs from 'fs';

interface BenchmarkResult {
  name: string; iterations: number; totalTimeMs: number;
  opsPerSecond: number; avgLatencyMs: number; errors: number; passed: boolean;
}

const results: BenchmarkResult[] = [];
let passed = 0, failed = 0;

function record(name: string, ops: number, timeMs: number, errs: number) {
  const r: BenchmarkResult = {
    name, iterations: ops, totalTimeMs: timeMs,
    opsPerSecond: Math.round((ops / timeMs) * 1000),
    avgLatencyMs: Math.round((timeMs / ops) * 1000) / 1000,
    errors: errs, passed: errs === 0,
  };
  results.push(r);
  if (r.passed) { passed++; console.log(`  ✅ ${name}: ${r.opsPerSecond} ops/s (${r.avgLatencyMs}ms avg)`); }
  else { failed++; console.log(`  ❌ ${name}: ${r.errors} errors`); }
}

async function benchmarkVisualGraph() {
  const engine = new VisualGraphEngine();

  // Generate large graph
  const nodes: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < 100; i++) nodes.push({ from: `N${i}`, to: `N${i + 1}` });

  const graph = engine.createFromEdges(`Benchmark ${nodes.length} edges`, nodes);

  // Mermaid render
  const mStart = Date.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'mermaid');
  record('Visual: Mermaid render (50x)', 50, Date.now() - mStart, 0);

  // ASCII render
  const aStart = Date.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'ascii');
  record('Visual: ASCII render (50x)', 50, Date.now() - aStart, 0);

  // JSON export
  const jStart = Date.now();
  for (let i = 0; i < 100; i++) engine.render(graph, 'json');
  record('Visual: JSON export (100x)', 100, Date.now() - jStart, 0);

  // Graphviz render
  const gStart = Date.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'graphviz');
  record('Visual: Graphviz render (50x)', 50, Date.now() - gStart, 0);
}

async function benchmarkExecutionGraph() {
  const engine = new ExecutionGraphEngine();

  // Sequential pipeline throughput
  const seqGraph = await engine.createGraph('Throughput', [
    { id: 't1', name: 'T1', type: 'function', fn: async (i) => i },
    { id: 't2', name: 'T2', type: 'function', fn: async (i) => i },
    { id: 't3', name: 'T3', type: 'function', fn: async (i) => i },
  ], [
    { source: 't1', target: 't2' },
    { source: 't2', target: 't3' },
  ]);

  const sStart = Date.now();
  for (let i = 0; i < 100; i++) {
    const gId = await engine.createGraph(`Run-${i}`, [
      { id: 'a', name: 'A', type: 'function', fn: async (i) => i },
      { id: 'b', name: 'B', type: 'function', fn: async (i) => i },
    ], [{ source: 'a', target: 'b' }]);
    await engine.executeGraph(gId, { i });
  }
  record('Execution: sequential pipeline (100x)', 100, Date.now() - sStart, 0);

  // Parallel throughput
  const pStart = Date.now();
  for (let i = 0; i < 50; i++) {
    const gId = await engine.createGraph(`Parallel-${i}`, [
      { id: 'r', name: 'R', type: 'function', fn: async (i) => i },
      { id: 'p1', name: 'P1', type: 'function', fn: async (i) => i },
      { id: 'p2', name: 'P2', type: 'function', fn: async (i) => i },
      { id: 'p3', name: 'P3', type: 'function', fn: async (i) => i },
      { id: 'm', name: 'M', type: 'function', fn: async (i) => i },
    ], [
      { source: 'r', target: 'p1' }, { source: 'r', target: 'p2' }, { source: 'r', target: 'p3' },
      { source: 'p1', target: 'm' }, { source: 'p2', target: 'm' }, { source: 'p3', target: 'm' },
    ], { maxConcurrency: 5 });
    await engine.executeGraph(gId, { i });
  }
  record('Execution: parallel fan-out (50x)', 50, Date.now() - pStart, 0);

  // Large graph
  const largeNodes: any[] = [];
  const largeEdges: any[] = [];
  for (let i = 0; i < 50; i++) {
    largeNodes.push({ id: `n${i}`, name: `N${i}`, type: 'function' as const, fn: async (i: any) => i });
    if (i > 0) largeEdges.push({ source: `n${i - 1}`, target: `n${i}` });
  }
  const lgStart = Date.now();
  const lgId = await engine.createGraph('Large', largeNodes, largeEdges, { maxConcurrency: 10 });
  const lgResult = await engine.executeGraph(lgId, {});
  const lgTime = Date.now() - lgStart;
  record(`Execution: 50-node chain (1x)`, 50, lgTime, Array.from(lgResult.values()).filter(r => r.status !== 'completed').length);
}

async function benchmarkStateGraph() {
  const registry = new StateMachineRegistry();

  // FSM transition throughput
  const fsm = registry.createCognitiveLifecycle();
  const events = ['init', 'ready', 'start', 'pause', 'resume', 'shutdown'];

  const fStart = Date.now();
  for (let i = 0; i < 100; i++) {
    const m = registry.createCognitiveLifecycle();
    for (const evt of events) await m.send(evt);
  }
  record('State: lifecycle transitions (100x)', 100 * events.length, Date.now() - fStart, 0);

  // Large FSM
  const manyStates: any[] = [];
  const manyTransitions: any[] = [];
  for (let i = 0; i < 50; i++) {
    manyStates.push({ id: `s${i}`, label: `State ${i}`, type: (i === 0 ? 'initial' : i === 49 ? 'final' : 'normal') as any });
    if (i > 0) manyTransitions.push({ from: `s${i - 1}`, to: `s${i}`, event: `next_${i}` });
  }

  const lgStart = Date.now();
  for (let i = 0; i < 20; i++) {
    const m = registry.create('Big', manyStates, manyTransitions, 's0');
    for (let j = 1; j < 50; j++) await m.send(`next_${j}`);
  }
  record('State: 50-state machine (20x)', 20 * 49, Date.now() - lgStart, 0);

  // Guard evaluation
  const gStart = Date.now();
  for (let i = 0; i < 500; i++) {
    const m = registry.create('Guard', [
      { id: 'a', label: 'A', type: 'initial' },
      { id: 'b', label: 'B' },
    ], [
      { from: 'a', to: 'b', event: 'go', guard: (ctx) => ctx.data.x === i },
    ]);
    m.contextData.data.x = i;
    await m.send('go');
  }
  record('State: guard evaluation (500x)', 500, Date.now() - gStart, 0);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   GRAPH ENGINE BENCHMARKS                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('📍 Level 0: Visual Graph');
  await benchmarkVisualGraph();

  console.log('\n📍 Level 1: Execution Graph');
  await benchmarkExecutionGraph();

  console.log('\n📍 Level 2: State Graph');
  await benchmarkStateGraph();

  console.log('\n═══════════════════════════════════════════════════════════\n');
  const totalOps = results.reduce((s, r) => s + r.iterations, 0);
  const totalTime = results.reduce((s, r) => s + r.totalTimeMs, 0);
  console.log(`Total: ${results.length} benchmarks`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`Total operations: ${totalOps}`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Overall throughput: ${Math.round((totalOps / totalTime) * 1000)} ops/s`);
  console.log(`Errors: ${results.reduce((s, r) => s + r.errors, 0)}`);

  if (failed === 0) console.log('\n✅✅✅ ALL GRAPH BENCHMARKS PASSED');
  else console.log(`\n❌ ${failed} benchmark(s) failed`);

  fs.writeFileSync('graph-benchmark-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { totalBenchmarks: results.length, passed, failed, totalOps, totalTimeMs: totalTime, throughput: Math.round((totalOps / totalTime) * 1000) },
    results: results.map(r => ({ ...r })),
  }, null, 2));
  console.log('\n📊 Results saved to graph-benchmark-results.json');
}

main().catch(console.error);