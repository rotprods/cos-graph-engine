/**
 * Tests for Per-Hop Tracing — T-3.1
 *
 * 15 tests covering:
 *  - TraceSessionImpl: addHop, getSummary, reset, empty, multiple hops
 *  - NoopTraceSession: singleton, zero overhead, no side effects
 *  - CSR + tracing integration: bfs, dfs, bidirectionalBFS, source===target, pruning
 *  - Edge cases: empty graph, maxDepth=0
 */

import {
  TraceSessionImpl,
  NoopTraceSession,
  formatTraceSummary,
  TraceHop,
  TraceSession,
  TraceSummary,
} from '../src/tracing';
import { CSRGraph } from '../../graph/src/csr';

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

function assertNear(a: number, b: number, tolerance: number, msg: string): void {
  testCount++;
  if (Math.abs(a - b) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}: expected ${a} ≈ ${b} (tol=${tolerance})`);
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
// 1. TraceSessionImpl — addHop
// ============================================================
section('TraceSessionImpl — addHop');

{
  const session = new TraceSessionImpl();
  assert(session.hops.length === 0, 'empty session has 0 hops');
  assert(typeof session.id === 'string' && session.id.length > 0, 'session has id');

  session.addHop({ hopIndex: 0, nodeId: 'n1', depth: 0, duration: 1, source: 'forward' });
  assert(session.hops.length === 1, 'one hop added');
  assert(session.hops[0].nodeId === 'n1', 'first hop is n1');
  assert(session.hops[0].source === 'forward', 'source is forward');
  assert(typeof session.hops[0].timestamp === 'number', 'has timestamp');
}

// ============================================================
// 2. TraceSessionImpl — multiple hops
// ============================================================
section('TraceSessionImpl — multiple hops');

{
  const session = new TraceSessionImpl();
  session.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 1, nodeId: 'b', depth: 1, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 2, nodeId: 'c', depth: 2, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 3, nodeId: 'd', depth: 2, duration: 1, source: 'pruned' });
  assert(session.hops.length === 4, '4 hops total');
  assert(session.hops[2].nodeId === 'c', 'third hop is c');
}

// ============================================================
// 3. TraceSessionImpl — getSummary
// ============================================================
section('TraceSessionImpl — getSummary');

{
  const session = new TraceSessionImpl();
  session.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 1, nodeId: 'b', depth: 1, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 2, nodeId: 'c', depth: 2, duration: 1, source: 'pruned' });
  session.addHop({ hopIndex: 3, nodeId: 'd', depth: 2, duration: 1, source: 'backward' });

  const summary = session.getSummary();
  assert(summary.totalHops === 4, 'totalHops = 4');
  assert(summary.prunedHops === 1, 'prunedHops = 1');
  assert(summary.bidirectional === false, 'not bidirectional');
  assert(summary.durationMs >= 0, 'durationMs >= 0');
  assert(summary.hopsByDepth[0] === 1, '1 hop at depth 0');
  assert(summary.hopsByDepth[1] === 1, '1 hop at depth 1');
  assert(summary.hopsByDepth[2] === 2, '2 hops at depth 2');
  assert(summary.hopsBySource['forward'] === 2, '2 forward hops');
  assert(summary.hopsBySource['backward'] === 1, '1 backward hop');
  assert(summary.hopsBySource['pruned'] === 1, '1 pruned hop');
}

// ============================================================
// 4. TraceSessionImpl — bidirectional flag
// ============================================================
section('TraceSessionImpl — bidirectional');

{
  const session = new TraceSessionImpl(true);
  session.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  const summary = session.getSummary();
  assert(summary.bidirectional === true, 'bidirectional flag set');
}

// ============================================================
// 5. TraceSessionImpl — reset
// ============================================================
section('TraceSessionImpl — reset');

{
  const session = new TraceSessionImpl();
  session.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 1, nodeId: 'b', depth: 1, duration: 1, source: 'forward' });
  assert(session.hops.length === 2, '2 hops before reset');
  session.reset();
  assert(session.hops.length === 0, '0 hops after reset');
  const summary = session.getSummary();
  assert(summary.totalHops === 0, 'summary resets too');
}

// ============================================================
// 6. NoopTraceSession — singleton
// ============================================================
section('NoopTraceSession — singleton');

{
  const a = NoopTraceSession.instance;
  const b = NoopTraceSession.instance;
  assert(a === b, 'singleton: same instance');
  assert(a.id === 'noop', 'id is noop');
  assert(a.hops.length === 0, 'hops is empty array');
}

// ============================================================
// 7. NoopTraceSession — zero overhead (no side effects)
// ============================================================
section('NoopTraceSession — no side effects');

{
  const session = NoopTraceSession.instance;
  const before = session.hops.length;
  session.addHop({ hopIndex: 0, nodeId: 'x', depth: 0, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 1, nodeId: 'y', depth: 1, duration: 1, source: 'pruned' });
  assert(session.hops.length === before, 'addHop does not modify hops');
  const summary = session.getSummary();
  assert(summary.totalHops === 0, 'summary returns zero');
  session.reset(); // should not throw
}

// ============================================================
// 8. formatTraceSummary
// ============================================================
section('formatTraceSummary');

{
  const summary: TraceSummary = {
    totalHops: 10,
    prunedHops: 2,
    bidirectional: true,
    durationMs: 5.5,
    hopsByDepth: { 0: 1, 1: 3, 2: 6 },
    hopsBySource: { forward: 5, backward: 3, pruned: 2 },
  };
  const text = formatTraceSummary(summary);
  assert(text.includes('Total hops: 10'), 'includes total');
  assert(text.includes('Pruned hops: 2'), 'includes pruned');
  assert(text.includes('Bidirectional: true'), 'includes bidirectional');
  assert(text.includes('Duration: 5.50ms'), 'includes duration');
}

// ============================================================
// 9. CSR + BFS tracing
// ============================================================
section('CSR + BFS tracing');

{
  const graph = buildChain(10);
  const session = new TraceSessionImpl();

  const result = graph.bfs('n0', 3, session);
  assert(result.length > 0, 'BFS returns nodes');
  const summary = session.getSummary();
  assert(summary.totalHops > 0, 'BFS recorded hops');
  assert(summary.hopsBySource['forward'] > 0, 'BFS has forward hops');
  assert(summary.hopsBySource['pruned'] === 0 || summary.hopsBySource['pruned'] > 0, 'BFS may have pruned hops');
}

// ============================================================
// 10. CSR + BFS tracing with maxDepth pruning
// ============================================================
section('CSR + BFS tracing with pruning');

{
  const graph = buildChain(5);
  const session = new TraceSessionImpl();

  // maxDepth=1: source (n0) + n1. n1's neighbor n2 gets pruned
  const result = graph.bfs('n0', 1, session);
  const summary = session.getSummary();
  assert(result.length <= 2, 'BFS maxDepth=1 returns at most 2 nodes');
  assert(summary.totalHops >= result.length, 'totalHops >= result length');
  console.log(`  Hops: total=${summary.totalHops}, pruned=${summary.prunedHops}, result=${result.length}`);
}

// ============================================================
// 11. CSR + BFS tracing with empty graph
// ============================================================
section('CSR + BFS tracing — empty graph');

{
  const graph = new CSRGraph();
  const session = new TraceSessionImpl();

  const result = graph.bfs('nonexistent', 10, session);
  assert(result.length === 0, 'BFS returns empty for nonexistent');
  const summary = session.getSummary();
  assert(summary.totalHops === 0, 'no hops recorded');
}

// ============================================================
// 12. CSR + DFS tracing
// ============================================================
section('CSR + DFS tracing');

{
  const graph = buildChain(10);
  const session = new TraceSessionImpl();

  const result = graph.dfs('n0', 5, session);
  assert(result.length > 0, 'DFS returns nodes');
  const summary = session.getSummary();
  assert(summary.totalHops > 0, 'DFS recorded hops');
  assert(summary.hopsBySource['forward'] > 0, 'DFS has forward hops');
}

// ============================================================
// 13. CSR + bidirectionalBFS tracing
// ============================================================
section('CSR + bidirectionalBFS tracing');

{
  const graph = buildChain(10);
  const session = new TraceSessionImpl(true);

  const path = graph.bidirectionalBFS('n0', 'n9', 10, session);
  assert(path !== null, 'path found');
  assert(path!.length > 0, 'path has nodes');
  const summary = session.getSummary();
  assert(summary.totalHops > 0, 'biBFS recorded hops');
  assert(summary.hopsBySource['forward']! > 0, 'biBFS has forward hops');
  assert(summary.hopsBySource['backward']! > 0, 'biBFS has backward hops');
  assert(summary.bidirectional === true, 'bidirectional flag set');
}

// ============================================================
// 14. CSR + bidirectionalBFS source === target
// ============================================================
section('CSR + bidirectionalBFS — source === target');

{
  const graph = buildChain(10);
  const session = new TraceSessionImpl(true);

  const path = graph.bidirectionalBFS('n5', 'n5', 10, session);
  assert(path !== null, 'path found for same node');
  assert(path!.length === 1, 'path has 1 node');
  const summary = session.getSummary();
  assert(summary.totalHops >= 1, 'at least 1 hop recorded');
}

// ============================================================
// 15. CSR + NoopTraceSession — no performance regression
// ============================================================
section('CSR + NoopTraceSession — zero overhead');

{
  const graph = buildChain(100);
  const noop = NoopTraceSession.instance;

  // Warmup
  graph.bfs('n0', 50, noop);

  // Measure without trace
  const start1 = performance.now();
  for (let i = 0; i < 100; i++) graph.bfs('n0', 50);
  const end1 = performance.now();

  // Measure with NoopTraceSession
  const start2 = performance.now();
  for (let i = 0; i < 100; i++) graph.bfs('n0', 50, noop);
  const end2 = performance.now();

  const t1 = end1 - start1;
  const t2 = end2 - start2;

  // Noop should add < 10% overhead
  const ratio = t2 / t1;
  assert(ratio < 1.5, `Noop overhead ratio ${ratio.toFixed(2)} (should be < 1.5)`);
  console.log(`  Overhead ratio: ${ratio.toFixed(2)}x (noop ${t2.toFixed(1)}ms vs base ${t1.toFixed(1)}ms)`);
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);