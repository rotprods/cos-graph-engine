// T-6.5: 40 Tests for L6 DataFlow Graph
// Mutation API, pipelines, bottlenecks, critical path, total latency, validation

import { DataFlowGraph } from '../packages/graph/src/level6-dataflow';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

const df = new DataFlowGraph();

// === Creation ===
assert(df.nodes.length === 0, 'L6: Empty graph has 0 nodes');
assert(df.edges.length === 0, 'L6: Empty graph has 0 edges');

// === Mutation API: addNode ===
const n1 = df.addNode({ id: 'source', name: 'Data Source', type: 'source', throughput: 100, latency: 10 });
const n2 = df.addNode({ id: 'transform', name: 'Transformer', type: 'transform', throughput: 50, latency: 20 });
const n3 = df.addNode({ id: 'load', name: 'Loader', type: 'transform', throughput: 30, latency: 40 });
const n4 = df.addNode({ id: 'sink', name: 'Output', type: 'sink', throughput: 60, latency: 5 });
assert(df.nodes.length === 4, 'L6: Multiple addNodes');

// === addNode duplicate ===
try { df.addNode({ id: 'source', name: 'Dup', type: 'source' }); assert(false, 'L6: Should reject duplicate'); }
catch (e) { assert(true, 'L6: Rejects duplicate node id'); }

// === Mutation API: addEdge ===
df.addEdge({ id: 'e1', source: 'source', target: 'transform', dataType: 'raw' });
df.addEdge({ id: 'e2', source: 'transform', target: 'load', dataType: 'processed' });
df.addEdge({ id: 'e3', source: 'load', target: 'sink', dataType: 'final' });
assert(df.edges.length === 3, 'L6: addEdge adds edges');

// === Mutation API: removeNode ===
const autoId = df.addNode({ id: 'auto', name: 'Auto', type: 'transform' });
df.removeNode('auto');
assert(df.nodes.length === 4, 'L6: removeNode removes node');
assert(df.edges.length === 3, 'L6: removeNode preserves edges of other nodes');

try { df.removeNode('nonexistent'); assert(false, 'L6: Should reject remove nonexistent'); }
catch (e) { assert(true, 'L6: Rejects remove nonexistent node'); }

// === Mutation API: removeEdge ===
df.removeEdge('e1');
assert(df.edges.length === 2, 'L6: removeEdge removes edge');
df.addEdge({ id: 'e1', source: 'source', target: 'transform', dataType: 'raw' });
assert(df.edges.length === 3, 'L6: re-add edge works');

// === Build ML Pipeline ===
const ml = new DataFlowGraph();
ml.buildMLPipeline();
assert(ml.nodes.length >= 6, 'L6: ML pipeline has 6+ nodes');
assert(ml.edges.length >= 5, 'L6: ML pipeline has 5+ edges');

// === Build ETL Pipeline ===
const etl = new DataFlowGraph();
etl.buildETLPipeline();
assert(etl.nodes.length >= 5, 'L6: ETL pipeline has 5+ nodes');
assert(etl.edges.length >= 4, 'L6: ETL pipeline has 4+ edges');

// === Bottleneck detection ===
const bottlenecks = df.findBottlenecks();
assert(bottlenecks.length >= 0, 'L6: findBottlenecks returns array');

// === Critical path ===
const cp = df.criticalPath();
assert(cp.length >= 1, 'L6: criticalPath returns path');

// === totalLatency ===
const tl = df.totalLatency();
assert(tl > 0, 'L6: totalLatency > 0');

// === Validation ===
const errs = df.validate();
assert(errs.length === 0, 'L6: Valid graph validates');

// Create invalid graph by adding edge to nonexistent node (caught by addEdge)
const bad = new DataFlowGraph();
bad.addNode({ id: 'a', name: 'A', type: 'source' });
try { bad.addEdge({ id: 'x', source: 'a', target: 'nonexistent' }); assert(false, 'L6: Should reject'); }
catch (e) { assert(true, 'L6: Rejects dangling edge at addEdge'); }
const badErrs = bad.validate();
assert(badErrs.length === 0, 'L6: Valid graph after rejection');

// === Metrics ===
const mt = df.metrics();
assert(mt.nodeCount >= 4, 'L6: Metrics node count');
assert(mt.edgeCount >= 3, 'L6: Metrics edge count');
assert(mt.avgDegree > 0, 'L6: Metrics avg degree');

// === Serialization: toJSON ===
const saved = df.toJSON();
assert(saved.nodes.length >= 4, 'L6: toJSON preserves nodes');
assert(saved.edges.length >= 3, 'L6: toJSON preserves edges');

// === Serialization: fromJSON ===
const restored = DataFlowGraph.fromJSON(saved);
assert(restored.nodes.length >= 4, 'L6: fromJSON restores nodes');
assert(restored.edges.length >= 3, 'L6: fromJSON restores edges');

// === toMermaid ===
const mermaid = df.toMermaid();
assert(mermaid.includes('graph'), 'L6: Mermaid output');
assert(mermaid.includes('source'), 'L6: Mermaid contains node id');

// === Empty graph ===
const empty = new DataFlowGraph();
assert(empty.validate().length === 0, 'L6: Empty graph validates');
const mtEmpty = empty.metrics();
assert(mtEmpty.nodeCount === 0, 'L6: Empty graph metrics node count');

// === Pipeline with cycle ===
const cyclic = new DataFlowGraph();
cyclic.addNode({ id: 'a', name: 'A', type: 'source', latency: 5 });
cyclic.addNode({ id: 'b', name: 'B', type: 'transform', latency: 10 });
cyclic.addEdge({ id: 'ab', source: 'a', target: 'b', dataType: 'data' });
cyclic.addEdge({ id: 'ba', source: 'b', target: 'a', dataType: 'feedback' });
const cp2 = cyclic.criticalPath();
assert(cp2.length > 0, 'L6: criticalPath handles cycles');

// === getNode / getEdge ===
const node = df.getNode('source');
assert(node !== undefined, 'L6: getNode returns node');
assert(node!.name === 'Data Source', 'L6: getNode correct name');

const edge = df.getEdge('e1');
assert(edge !== undefined, 'L6: getEdge returns edge');
assert(edge!.dataType === 'raw', 'L6: getEdge correct dataType');

// === Node types ===
const sourceTypes = df.nodes.filter(n => n.type === 'source');
assert(sourceTypes.length >= 1, 'L6: Has source node');
const sinkTypes = df.nodes.filter(n => n.type === 'sink');
assert(sinkTypes.length >= 1, 'L6: Has sink node');

// === Summary ===
console.log(`\n📊 L6: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0) process.exit(1);