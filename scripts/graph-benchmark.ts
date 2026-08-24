// COS Graph Engine — Benchmark Suite
// Measures throughput, latency, and capacity for all 3 levels

import { VisualGraphEngine, ExecutionGraphEngine, StateMachineRegistry } from '../packages/graph/src/index.ts';
import * as fs from 'fs';

interface BenchmarkResult {
  name: string; iterations: number; totalTimeMs: number;
  opsPerSecond: number; avgLatencyMs: number; errors: number; passed: boolean;
}

const results: BenchmarkResult[] = [];
let passed = 0, failed = 0;

function record(name: string, ops: number, timeMs: number, errs: number) {
  const safeTime = Math.max(timeMs, 0.001);
  const r: BenchmarkResult = {
    name, iterations: ops, totalTimeMs: timeMs,
    opsPerSecond: Math.round((ops / safeTime) * 1000),
    avgLatencyMs: Math.round((safeTime / ops) * 1000) / 1000,
    errors: errs, passed: errs === 0,
  };
  results.push(r);
  if (r.passed) { passed++; console.log(`  ✅ ${name}: ${r.opsPerSecond} ops/s (${r.avgLatencyMs}ms avg)`); }
  else { failed++; console.log(`  ❌ ${name}: ${r.errors} errors`); }
}

async function benchmarkVisualGraph() {
  const engine = new VisualGraphEngine();
  const nodes: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < 100; i++) nodes.push({ from: `N${i}`, to: `N${i + 1}` });
  const graph = engine.createFromEdges(`Benchmark ${nodes.length} edges`, nodes);
  let start = performance.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'mermaid');
  record('Visual: Mermaid render (50x)', 50, performance.now() - start, 0);
  start = performance.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'ascii');
  record('Visual: ASCII render (50x)', 50, performance.now() - start, 0);
  start = performance.now();
  for (let i = 0; i < 100; i++) engine.render(graph, 'json');
  record('Visual: JSON export (100x)', 100, performance.now() - start, 0);
  start = performance.now();
  for (let i = 0; i < 50; i++) engine.render(graph, 'graphviz');
  record('Visual: Graphviz render (50x)', 50, performance.now() - start, 0);
}

async function benchmarkExecutionGraph() {
  const engine = new ExecutionGraphEngine();
  let start = performance.now();
  for (let i = 0; i < 100; i++) {
    const id = await engine.createGraph(`Run-${i}`, [
      { id: 'a', name: 'A', type: 'function', fn: async (input) => input },
      { id: 'b', name: 'B', type: 'function', fn: async (input) => input },
    ], [{ source: 'a', target: 'b' }]);
    await engine.executeGraph(id, { i });
  }
  record('Execution: sequential pipeline (100x)', 100, performance.now() - start, 0);

  start = performance.now();
  for (let i = 0; i < 50; i++) {
    const id = await engine.createGraph(`Parallel-${i}`, [
      { id: 'r', name: 'R', type: 'function', fn: async (input) => input },
      { id: 'p1', name: 'P1', type: 'function', fn: async (input) => input },
      { id: 'p2', name: 'P2', type: 'function', fn: async (input) => input },
      { id: 'p3', name: 'P3', type: 'function', fn: async (input) => input },
      { id: 'm', name: 'M', type: 'function', fn: async (input) => input },
    ], [
      { source: 'r', target: 'p1' }, { source: 'r', target: 'p2' }, { source: 'r', target: 'p3' },
      { source: 'p1', target: 'm' }, { source: 'p2', target: 'm' }, { source: 'p3', target: 'm' },
    ], { maxConcurrency: 5 });
    await engine.executeGraph(id, { i });
  }
  record('Execution: parallel fan-out (50x)', 50, performance.now() - start, 0);

  const largeNodes: any[] = [];
  const largeEdges: any[] = [];
  for (let i = 0; i < 50; i++) {
    largeNodes.push({ id: `n${i}`, name: `N${i}`, type: 'function' as const, fn: async (input: any) => input });
    if (i > 0) largeEdges.push({ source: `n${i - 1}`, target: `n${i}` });
  }
  start = performance.now();
  const id = await engine.createGraph('Large', largeNodes, largeEdges, { maxConcurrency: 10 });
  const result = await engine.executeGraph(id, {});
  record('Execution: 50-node chain (1x)', 50, performance.now() - start,
    Array.from(result.values()).filter(item => item.status !== 'completed').length);
}

async function benchmarkStateGraph() {
  const registry = new StateMachineRegistry();
  const events = ['init', 'ready', 'start', 'pause', 'resume', 'shutdown'];
  let start = performance.now();
  for (let i = 0; i < 100; i++) {
    const machine = registry.createCognitiveLifecycle();
    for (const event of events) await machine.send(event);
  }
  record('State: lifecycle transitions (100x)', 100 * events.length, performance.now() - start, 0);

  const manyStates: any[] = [];
  const manyTransitions: any[] = [];
  for (let i = 0; i < 50; i++) {
    manyStates.push({ id: `s${i}`, label: `State ${i}`, type: (i === 0 ? 'initial' : i === 49 ? 'final' : 'normal') as any });
    if (i > 0) manyTransitions.push({ from: `s${i - 1}`, to: `s${i}`, event: `next_${i}` });
  }
  start = performance.now();
  for (let i = 0; i < 20; i++) {
    const machine = registry.create('Big', manyStates, manyTransitions, 's0');
    for (let j = 1; j < 50; j++) await machine.send(`next_${j}`);
  }
  record('State: 50-state machine (20x)', 20 * 49, performance.now() - start, 0);

  start = performance.now();
  let guardErrors = 0;
  for (let i = 0; i < 500; i++) {
    const machine = registry.create('Guard', [
      { id: 'a', label: 'A', type: 'initial' },
      { id: 'b', label: 'B' },
    ], [{ from: 'a', to: 'b', event: 'go', guard: context => context.data.x === i }]);
    await machine.patchData({ x: i });
    if (!(await machine.send('go'))) guardErrors += 1;
  }
  record('State: guard evaluation (500x)', 500, performance.now() - start, guardErrors);
  registry.clear();
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   GRAPH ENGINE BENCHMARKS                               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  await benchmarkVisualGraph();
  await benchmarkExecutionGraph();
  await benchmarkStateGraph();
  const totalOps = results.reduce((sum, result) => sum + result.iterations, 0);
  const totalTime = results.reduce((sum, result) => sum + result.totalTimeMs, 0);
  const summary = {
    totalBenchmarks: results.length,
    passed,
    failed,
    totalOps,
    totalTimeMs: totalTime,
    throughput: Math.round((totalOps / Math.max(totalTime, 0.001)) * 1000),
  };
  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total operations: ${totalOps}`);
  fs.writeFileSync('graph-benchmark-results.json', JSON.stringify({ timestamp: new Date().toISOString(), summary, results }, null, 2));
  if (failed > 0) process.exit(1);
}

main().catch(error => { console.error(error); process.exit(1); });
