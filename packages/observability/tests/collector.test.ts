/**
 * Tests for Trace Collector — T-3.2
 *
 * 16 tests covering:
 *  - CircularBuffer: push, overflow, getAll, getLast, clear, edge cases
 *  - TraceCollectorImpl: record, recordDirect, getAll, getLast, findById, filter
 *  - JSON export: exportJSON, exportJSONPretty, exportSummaryJSON
 *  - NoopTraceCollector: singleton, zero overhead
 *  - Integration: collect TracesSessions from CSR
 *  - Edge cases: empty collector, overflow, single session
 *  - mergeCollectorsExport
 */

import {
  CircularBuffer,
  TraceCollectorImpl,
  NoopTraceCollector,
  StoredTrace,
  mergeCollectorsExport,
} from '../src/collector';
import { TraceSessionImpl, NoopTraceSession, TraceHop, TraceSummary } from '../src/tracing';
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
// 1. CircularBuffer — push and getAll
// ============================================================
section('CircularBuffer — push and getAll');

{
  const buf = new CircularBuffer<number>(5);
  assert(buf.isEmpty, 'empty after creation');
  assert(buf.size === 0, 'size is 0');
  assert(buf.capacity === 5, 'capacity is 5');

  buf.push(10);
  buf.push(20);
  buf.push(30);
  assert(buf.size === 3, 'size is 3 after 3 pushes');
  assert(!buf.isEmpty, 'not empty');
  assert(!buf.isFull, 'not full');

  const all = buf.getAll();
  assert(all.length === 3, 'getAll returns 3 items');
  assertStrictEqual(all[0], 10, 'first is 10');
  assertStrictEqual(all[1], 20, 'second is 20');
  assertStrictEqual(all[2], 30, 'third is 30');
}

// ============================================================
// 2. CircularBuffer — overflow evicts oldest
// ============================================================
section('CircularBuffer — overflow evicts oldest');

{
  const buf = new CircularBuffer<number>(3);
  buf.push(1);
  buf.push(2);
  buf.push(3);
  assert(buf.isFull, 'full after 3 pushes');
  assert(buf.getAll().length === 3, '3 items before overflow');

  buf.push(4); // evicts 1
  assert(buf.size === 3, 'still 3 after overflow');
  const all = buf.getAll();
  assertStrictEqual(all[0], 2, 'oldest evicted: first is 2');
  assertStrictEqual(all[1], 3, 'second is 3');
  assertStrictEqual(all[2], 4, 'third is 4');

  buf.push(5); // evicts 2
  buf.push(6); // evicts 3
  const all2 = buf.getAll();
  assertStrictEqual(all2[0], 4, 'after 2 more pushes: first is 4');
  assertStrictEqual(all2[1], 5, 'second is 5');
  assertStrictEqual(all2[2], 6, 'third is 6');
}

// ============================================================
// 3. CircularBuffer — getLast
// ============================================================
section('CircularBuffer — getLast');

{
  const buf = new CircularBuffer<string>(5);
  buf.push('a');
  buf.push('b');
  buf.push('c');
  buf.push('d');
  buf.push('e');

  const last2 = buf.getLast(2);
  assert(last2.length === 2, 'getLast(2) returns 2');
  assertStrictEqual(last2[0], 'd', 'last 2: first is d');
  assertStrictEqual(last2[1], 'e', 'last 2: second is e');

  const last10 = buf.getLast(10);
  assert(last10.length === 5, 'getLast(10) returns all 5 when buffer < n');
}

// ============================================================
// 4. CircularBuffer — clear
// ============================================================
section('CircularBuffer — clear');

{
  const buf = new CircularBuffer<number>(3);
  buf.push(1);
  buf.push(2);
  buf.push(3);
  assert(!buf.isEmpty, 'not empty before clear');
  buf.clear();
  assert(buf.isEmpty, 'empty after clear');
  assert(buf.size === 0, 'size 0 after clear');
  assert(buf.getAll().length === 0, 'getAll empty after clear');
}

// ============================================================
// 5. CircularBuffer — capacity validation
// ============================================================
section('CircularBuffer — capacity validation');

{
  try {
    new CircularBuffer<number>(0);
    assert(false, 'should throw on capacity 0');
  } catch {
    assert(true, 'throws on capacity 0');
  }

  try {
    new CircularBuffer<number>(-1);
    assert(false, 'should throw on negative capacity');
  } catch {
    assert(true, 'throws on negative capacity');
  }
}

// ============================================================
// 6. CircularBuffer — single element
// ============================================================
section('CircularBuffer — single element');

{
  const buf = new CircularBuffer<number>(1);
  assert(buf.capacity === 1, 'capacity 1');
  buf.push(42);
  assert(buf.size === 1, 'size 1');
  assert(buf.isFull, 'isFull');
  assertStrictEqual(buf.getAll()[0], 42, 'getAll returns 42');

  buf.push(99); // evicts 42
  assert(buf.size === 1, 'still size 1');
  assertStrictEqual(buf.getAll()[0], 99, 'now 99');
}

// ============================================================
// 7. TraceCollectorImpl — record
// ============================================================
section('TraceCollectorImpl — record');

{
  const collector = new TraceCollectorImpl(10);
  assert(collector.isEmpty, 'initially empty');
  assert(collector.size === 0, 'size 0');

  const session = new TraceSessionImpl();
  session.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  session.addHop({ hopIndex: 1, nodeId: 'b', depth: 1, duration: 1, source: 'forward' });

  collector.record(session);
  assert(collector.size === 1, 'size 1 after record');
  assert(!collector.isEmpty, 'not empty');

  const all = collector.getAll();
  assert(all.length === 1, '1 stored trace');
  assert(all[0].sessionId === session.id, 'sessionId matches');
  assert(all[0].summary.totalHops === 2, 'summary has 2 hops');
  assert(all[0].hops.length === 2, '2 hops stored');
}

// ============================================================
// 8. TraceCollectorImpl — recordDirect
// ============================================================
section('TraceCollectorImpl — recordDirect');

{
  const collector = new TraceCollectorImpl(10);
  const summary: TraceSummary = {
    totalHops: 3, prunedHops: 1, bidirectional: false, durationMs: 5.5,
    hopsByDepth: { 0: 1, 1: 2 }, hopsBySource: { forward: 2, pruned: 1 },
  };
  const hops: TraceHop[] = [
    { hopIndex: 0, nodeId: 'x', depth: 0, duration: 1, source: 'forward', timestamp: Date.now() },
    { hopIndex: 1, nodeId: 'y', depth: 1, duration: 2, source: 'forward', timestamp: Date.now() },
    { hopIndex: 2, nodeId: 'z', depth: 1, duration: 0, source: 'pruned', timestamp: Date.now() },
  ];

  collector.recordDirect('session-1', 1000, 2000, summary, hops);
  assert(collector.size === 1, 'size 1');
  const all = collector.getAll();
  assert(all[0].sessionId === 'session-1', 'sessionId matches');
  assert(all[0].startTime === 1000, 'startTime matches');
  assert(all[0].endTime === 2000, 'endTime matches');
  assert(all[0].summary.totalHops === 3, 'totalHops 3');
}

// ============================================================
// 9. TraceCollectorImpl — getLast, findById, filter
// ============================================================
section('TraceCollectorImpl — query methods');

{
  const collector = new TraceCollectorImpl(10);
  for (let i = 0; i < 5; i++) {
    const s = new TraceSessionImpl();
    s.addHop({ hopIndex: 0, nodeId: `n${i}`, depth: 0, duration: 1, source: 'forward' });
    collector.record(s);
  }

  const last2 = collector.getLast(2);
  assert(last2.length === 2, 'getLast(2) returns 2');

  const all = collector.getAll();
  const firstId = all[0].sessionId;
  const found = collector.findById(firstId);
  assert(found !== undefined, 'findById finds session');
  assert(found!.sessionId === firstId, 'findById correct id');

  const notFound = collector.findById('nonexistent');
  assert(notFound === undefined, 'findById returns undefined for nonexistent');

  const filtered = collector.filter(t => t.summary.totalHops === 1);
  assert(filtered.length === 5, 'filter returns all 5 (all have 1 hop)');
}

// ============================================================
// 10. TraceCollectorImpl — overflow
// ============================================================
section('TraceCollectorImpl — overflow');

{
  const collector = new TraceCollectorImpl(3);
  for (let i = 0; i < 5; i++) {
    const s = new TraceSessionImpl();
    s.addHop({ hopIndex: 0, nodeId: `n${i}`, depth: 0, duration: 1, source: 'forward' });
    collector.record(s);
  }

  assert(collector.size === 3, 'size capped at 3');
  const all = collector.getAll();
  assert(all.length === 3, '3 stored traces');
  // Should have n2, n3, n4 (n0 and n1 evicted)
  assert(all[0].hops[0].nodeId === 'n2', 'oldest is n2');
}

// ============================================================
// 11. TraceCollectorImpl — clear
// ============================================================
section('TraceCollectorImpl — clear');

{
  const collector = new TraceCollectorImpl(10);
  for (let i = 0; i < 3; i++) {
    const s = new TraceSessionImpl();
    s.addHop({ hopIndex: 0, nodeId: `n${i}`, depth: 0, duration: 1, source: 'forward' });
    collector.record(s);
  }
  assert(collector.size === 3, '3 before clear');
  collector.clear();
  assert(collector.isEmpty, 'empty after clear');
  assert(collector.size === 0, 'size 0 after clear');
}

// ============================================================
// 12. TraceCollectorImpl — exportJSON
// ============================================================
section('TraceCollectorImpl — exportJSON');

{
  const collector = new TraceCollectorImpl(10);
  const s = new TraceSessionImpl();
  s.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  collector.record(s);

  const json = collector.exportJSON();
  assert(typeof json === 'string', 'exportJSON returns string');
  const parsed = JSON.parse(json);
  assert(Array.isArray(parsed), 'parsed is array');
  assert(parsed.length === 1, '1 trace in export');
  assert(parsed[0].sessionId === s.id, 'sessionId in JSON');
  assert(parsed[0].hops.length === 1, '1 hop in JSON');
  assert(parsed[0].summary.totalHops === 1, 'summary in JSON');
}

// ============================================================
// 13. TraceCollectorImpl — exportJSONPretty
// ============================================================
section('TraceCollectorImpl — exportJSONPretty');

{
  const collector = new TraceCollectorImpl(10);
  const s = new TraceSessionImpl();
  s.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  collector.record(s);

  const pretty = collector.exportJSONPretty();
  assert(typeof pretty === 'string', 'exportJSONPretty returns string');
  // Pretty-printed JSON has newlines
  assert(pretty.includes('\n'), 'pretty JSON has newlines');
  const parsed = JSON.parse(pretty);
  assert(parsed.length === 1, '1 trace in pretty JSON');
}

// ============================================================
// 14. TraceCollectorImpl — exportSummaryJSON
// ============================================================
section('TraceCollectorImpl — exportSummaryJSON');

{
  const collector = new TraceCollectorImpl(10);
  const s = new TraceSessionImpl();
  s.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  s.addHop({ hopIndex: 1, nodeId: 'b', depth: 1, duration: 1, source: 'forward' });
  collector.record(s);

  const summaryJson = collector.exportSummaryJSON();
  const parsed = JSON.parse(summaryJson);
  assert(Array.isArray(parsed), 'parsed is array');
  assert(parsed.length === 1, '1 summary');
  assert(parsed[0].summary !== undefined, 'has summary field');
  assert(parsed[0].hops === undefined, 'no hops in summary export');
  assert(parsed[0].sessionId === s.id, 'sessionId present');
}

// ============================================================
// 15. NoopTraceCollector — singleton
// ============================================================
section('NoopTraceCollector — singleton');

{
  const a = NoopTraceCollector.instance;
  const b = NoopTraceCollector.instance;
  assert(a === b, 'singleton: same instance');
  assert(a.isEmpty, 'isEmpty returns true');
  assert(a.size === 0, 'size is 0');
  assert(a.capacity === 0, 'capacity is 0');

  // Noop operations should not throw
  const s = new TraceSessionImpl();
  a.record(s);
  assert(a.size === 0, 'record does not affect size');

  a.recordDirect('x', 0, 0, {} as TraceSummary, []);
  assert(a.size === 0, 'recordDirect does not affect size');

  assertStrictEqual(a.exportJSON(), '[]', 'exportJSON returns []');
  assertStrictEqual(a.exportJSONPretty(), '[]', 'exportJSONPretty returns []');
  assertStrictEqual(a.exportSummaryJSON(), '[]', 'exportSummaryJSON returns []');

  assert(a.getAll().length === 0, 'getAll returns empty');
  assert(a.getLast(5).length === 0, 'getLast returns empty');
  assert(a.findById('x') === undefined, 'findById returns undefined');
  assert(a.filter(() => true).length === 0, 'filter returns empty');

  a.clear(); // should not throw
}

// ============================================================
// 16. Integration: CSR BFS + collector
// ============================================================
section('Integration: CSR BFS + collector');

{
  const graph = buildChain(20);
  const collector = new TraceCollectorImpl(100);

  // Run 3 BFS traversals, collect each
  for (let i = 0; i < 3; i++) {
    const session = new TraceSessionImpl();
    graph.bfs('n0', 5, session);
    collector.record(session);
  }

  assert(collector.size === 3, '3 sessions collected');
  const all = collector.getAll();
  for (const trace of all) {
    assert(trace.summary.totalHops > 0, 'each session has hops');
    assert(trace.hops.length > 0, 'each session has stored hops');
    assert(trace.hops[0].source === 'forward', 'first hop is forward');
  }

  // JSON export round-trip
  const json = collector.exportJSON();
  const parsed = JSON.parse(json);
  assert(parsed.length === 3, '3 traces in JSON export');
}

// ============================================================
// 17. mergeCollectorsExport
// ============================================================
section('mergeCollectorsExport');

{
  const c1 = new TraceCollectorImpl(10);
  const c2 = new TraceCollectorImpl(10);

  const s1 = new TraceSessionImpl();
  s1.addHop({ hopIndex: 0, nodeId: 'a', depth: 0, duration: 1, source: 'forward' });
  c1.record(s1);

  const s2 = new TraceSessionImpl();
  s2.addHop({ hopIndex: 0, nodeId: 'b', depth: 0, duration: 1, source: 'forward' });
  c2.record(s2);

  const merged = mergeCollectorsExport([c1, c2]);
  const parsed = JSON.parse(merged);
  assert(parsed.length === 2, '2 traces merged');
  assert(parsed[0].sessionId === s1.id || parsed[0].sessionId === s2.id, 'merged has sessions');
}

// ============================================================
// 18. Empty collector edge cases
// ============================================================
section('Empty collector edge cases');

{
  const collector = new TraceCollectorImpl(10);
  assert(collector.isEmpty, 'initially empty');
  assert(collector.getAll().length === 0, 'getAll empty');
  assert(collector.getLast(5).length === 0, 'getLast empty');
  assert(collector.findById('x') === undefined, 'findById undefined');
  assert(collector.filter(() => true).length === 0, 'filter empty');
  assertStrictEqual(collector.exportJSON(), '[]', 'exportJSON is []');
  assertStrictEqual(collector.exportJSONPretty(), '[]', 'exportJSONPretty is []');
  assertStrictEqual(collector.exportSummaryJSON(), '[]', 'exportSummaryJSON is []');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);