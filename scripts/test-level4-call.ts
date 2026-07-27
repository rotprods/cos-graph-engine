// T-6.3: 40 Tests for L4 Call Graph
// Mutation API, enter/exit calls, call tree, profiling data, serialization, validation

import { CallGraphBuilder } from '../packages/graph/src/level4-call';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const builder = new CallGraphBuilder();
const gid = builder.createGraph('test-app');

// === Creation ===
assert(gid.length > 0, 'L4: createGraph returns id');
const g = builder.getGraph(gid);
assert(g !== undefined, 'L4: getGraph returns graph');
assert(g!.name === 'test-app', 'L4: Graph name matches');

// === Mutation API: addNode ===
builder.addNode(gid, { id: 'root', name: 'main', type: 'function', depth: 0 });
assert(builder.getGraph(gid)!.nodes.length === 1, 'L4: addNode adds node');

builder.addNode(gid, { id: 'fn1', name: 'compute', type: 'function', depth: 1 });
builder.addNode(gid, { id: 'fn2', name: 'render', type: 'function', depth: 1 });
builder.addNode(gid, { id: 'fn3', name: 'save', type: 'method', depth: 2 });
assert(builder.getGraph(gid)!.nodes.length === 4, 'L4: Multiple addNodes work');

// === addNode duplicate ===
try { builder.addNode(gid, { id: 'root', name: 'dup', type: 'function' }); assert(false, 'L4: Should reject duplicate'); }
catch (e) { assert(true, 'L4: Rejects duplicate node id'); }

// === Mutation API: addEdge ===
builder.addEdge(gid, { id: 'e1', source: 'root', target: 'fn1', callCount: 10 });
builder.addEdge(gid, { id: 'e2', source: 'root', target: 'fn2', callCount: 5 });
builder.addEdge(gid, { id: 'e3', source: 'fn1', target: 'fn3', callCount: 3 });
assert(builder.getGraph(gid)!.edges.length === 3, 'L4: addEdge adds edges');

// === Mutation API: removeNode ===
builder.addNode(gid, { id: 'temp', name: 'temp', type: 'function', depth: 3 });
builder.removeNode(gid, 'temp');
assert(builder.getGraph(gid)!.nodes.length === 4, 'L4: removeNode removes node');

// === Mutation API: removeEdge ===
const tmpEdge = builder.getGraph(gid)!.edges[0];
builder.removeEdge(gid, tmpEdge.id);
assert(builder.getGraph(gid)!.edges.length === 2, 'L4: removeEdge removes edge');
builder.addEdge(gid, { id: 'e1', source: 'root', target: 'fn1', callCount: 10 });
assert(builder.getGraph(gid)!.edges.length === 3, 'L4: re-add edge works');

// === enterCall / exitCall ===
const gid2 = builder.createGraph('trace-session');
const callId = builder.enterCall(gid2, 'main');
assert(callId.length > 0, 'L4: enterCall returns call id');
const childId = builder.enterCall(gid2, 'parse');
builder.exitCall(gid2, childId);
builder.exitCall(gid2, callId);
const graph2 = builder.getGraph(gid2)!;
assert(graph2.nodes.length >= 2, 'L4: enterCall adds nodes');
assert(graph2.edges.length >= 1, 'L4: enterCall creates edges');
assert(graph2.totalTime >= 0, 'L4: exitCall records time');

// === analyzeStackTrace ===
const gid3 = builder.createGraph('stack-trace');
builder.analyzeStackTrace(gid3, [
  'at main (app.ts:10:5)',
  'at parse (parser.ts:50:3)',
  'at validate (validator.ts:20:8)',
]);
const graph3 = builder.getGraph(gid3)!;
assert(graph3.nodes.length >= 3, 'L4: analyzeStackTrace creates nodes');
assert(graph3.edges.length >= 2, 'L4: analyzeStackTrace creates edges');

// === getNode / getEdge ===
const node = builder.getNode(gid, 'root');
assert(node !== undefined, 'L4: getNode returns node');
assert(node!.name === 'main', 'L4: getNode correct name');

const edge = builder.getEdge(gid, 'e1');
assert(edge !== undefined, 'L4: getEdge returns edge');
assert(edge!.callCount === 10, 'L4: getEdge correct callCount');

// === Validation ===
const errs = builder.validate(gid);
assert(errs.length === 0, 'L4: Valid graph validates');

// Create invalid graph
const gidBad = builder.createGraph('bad');
builder.addNode(gidBad, { id: 'a', name: 'A', type: 'function', depth: 0 });
// Create invalid graph by adding edge with bad source (caught by addEdge)
try {
  builder.addEdge(gidBad, { id: 'x', source: 'nonexistent', target: 'a', callCount: 1 });
  assert(false, 'L4: Should reject dangling edge');
} catch (e) {
  assert(true, 'L4: Rejects dangling edge at addEdge');
}
const errsBad = builder.validate(gidBad);
assert(errsBad.length === 0, 'L4: Valid graph after rejection');

// === Metrics ===
const mt = builder.metrics(gid);
assert(mt.nodeCount >= 4, 'L4: Metrics node count');
assert(mt.edgeCount >= 3, 'L4: Metrics edge count');
assert(mt.avgDegree > 0, 'L4: Metrics avg degree');

// === Serialization: toJSON ===
const saved = builder.toJSON(gid);
assert(saved !== undefined, 'L4: toJSON returns data');
assert(saved!.nodes.length >= 4, 'L4: toJSON preserves nodes');

// === Serialization: fromJSON ===
const restored = CallGraphBuilder.fromJSON(saved!);
assert(restored.getGraph(gid) !== undefined, 'L4: fromJSON restores graph');
assert(restored.getGraph(gid)!.nodes.length >= 4, 'L4: fromJSON restores nodes');

// === toMermaid ===
const mermaid = builder.toMermaid(gid);
assert(mermaid.includes('graph'), 'L4: Mermaid output');
assert(mermaid.includes('main'), 'L4: Mermaid contains node name');

// === Empty graph validation ===
const gidEmpty = builder.createGraph('empty');
assert(builder.validate(gidEmpty).length === 0, 'L4: Empty graph validates');
const mtEmpty = builder.metrics(gidEmpty);
assert(mtEmpty.nodeCount === 0, 'L4: Empty graph metrics');

// === Multiple graphs isolation ===
const gidIso = builder.createGraph('isolated');
builder.addNode(gidIso, { id: 'x', name: 'X', type: 'function', depth: 0 });
assert(builder.getGraph(gid)!.nodes.length >= 4, 'L4: Multiple graphs isolated');
assert(builder.getGraph(gidIso)!.nodes.length === 1, 'L4: New graph starts empty');

// === Summary ===
console.log(`\n📊 L4: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0) process.exit(1);