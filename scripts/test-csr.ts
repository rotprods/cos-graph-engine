/**
 * Tests de CSR Storage y Bidirectional Pruning (v2.1 Fase 1)
 */

import { CSRGraph, CompressedAdjacency } from '../packages/graph/src/csr';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) passed++;
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// CSRGraph — Construction
// =============================================

section('CSRGraph — Construction');

const graph = new CSRGraph();
assert(graph !== undefined, 'CSRGraph constructed');
assert(graph.nodeCount() === 0, 'Empty graph');
assert(graph.edgeCount() === 0, 'No edges');

// =============================================
// CSRGraph — Add nodes
// =============================================

section('CSRGraph — Add nodes');

graph.addNode({ id: 'A' });
graph.addNode({ id: 'B' });
graph.addNode({ id: 'C' });
graph.addNode({ id: 'D' });
assert(graph.nodeCount() === 4, '4 nodes added');
assert(graph.hasNode('A'), 'Has node A');
assert(graph.hasNode('B'), 'Has node B');
assert(!graph.hasNode('Z'), 'Does not have Z');

section('CSRGraph — Get node');

const node = graph.getNode('A');
assert(node !== undefined, 'Get node A');
assert(node!.id === 'A', 'Node id is A');

section('CSRGraph — Add edges');

graph.addEdge('A', 'B');
graph.addEdge('A', 'C');
graph.addEdge('B', 'C');
graph.addEdge('C', 'D');
assert(graph.edgeCount() === 4, '4 edges added');
assert(graph.hasEdge('A', 'B'), 'Has edge A->B');
assert(graph.hasEdge('A', 'C'), 'Has edge A->C');
assert(graph.hasEdge('B', 'C'), 'Has edge B->C');
assert(graph.hasEdge('C', 'D'), 'Has edge C->D');
assert(!graph.hasEdge('A', 'D'), 'No edge A->D');

section('CSRGraph — Get edge');

const edge = graph.getEdge('A', 'B');
assert(edge !== undefined, 'Get edge A->B');
assert(edge!.source === 'A', 'Edge source is A');
assert(edge!.target === 'B', 'Edge target is B');

// =============================================
// CSRGraph — neighbors
// =============================================

section('CSRGraph — neighbors');

const nbrsA = graph.neighbors('A');
assert(nbrsA.length === 2, 'A has 2 neighbors');
assert(nbrsA.includes('B'), 'A neighbors include B');
assert(nbrsA.includes('C'), 'A neighbors include C');

const nbrsC = graph.neighbors('C');
assert(nbrsC.length === 1, 'C has 1 neighbor');
assert(nbrsC[0] === 'D', 'C neighbor is D');

const nbrsD = graph.neighbors('D');
assert(nbrsD.length === 0, 'D has 0 neighbors');

section('CSRGraph — reverseNeighbors');

const revNbrs = graph.reverseNeighbors('C');
assert(revNbrs.length === 2, 'C has 2 reverse neighbors');
assert(revNbrs.includes('A'), 'C reverse includes A');
assert(revNbrs.includes('B'), 'C reverse includes B');

// =============================================
// CSRGraph — BFS
// =============================================

section('CSRGraph — BFS');

const bfsResult = graph.bfs('A');
assert(bfsResult.length === 4, 'BFS from A visits 4 nodes');
assert(bfsResult[0].id === 'A', 'BFS first is A');
assert(bfsResult[0].depth === 0, 'A depth 0');

// BFS with max depth
const bfsShallow = graph.bfs('A', 1);
assert(bfsShallow.length === 3, 'BFS depth 1 visits 3 nodes (A, B, C)');

// =============================================
// CSRGraph — DFS
// =============================================

section('CSRGraph — DFS');

const dfsResult = graph.dfs('A');
assert(dfsResult.length === 4, 'DFS from A visits 4 nodes');

// =============================================
// CSRGraph — Bidirectional BFS
// =============================================

section('CSRGraph — Bidirectional BFS');

const biResult = graph.bidirectionalBFS('A', 'D');
assert(biResult !== null, 'Bidirectional BFS finds path A->D');
assert(biResult!.length > 0, 'Path has nodes');
assert(biResult![0].id === 'A', 'Path starts at A');
assert(biResult![biResult!.length - 1].id === 'D', 'Path ends at D');

// Same source/target
const biSame = graph.bidirectionalBFS('A', 'A');
assert(biSame !== null, 'Bidirectional BFS same node');
assert(biSame!.length === 1, 'Path length 1');

// Disconnected
const biNone = graph.bidirectionalBFS('A', 'Z');
assert(biNone === null, 'Bidirectional BFS disconnected returns null');

// =============================================
// CSRGraph — degree
// =============================================

section('CSRGraph — degree');

assert(graph.degree('A') === 2, 'A degree 2');
assert(graph.degree('C') === 1, 'C degree 1');
assert(graph.degree('D') === 0, 'D degree 0');

// =============================================
// CSRGraph — Remove edge
// =============================================

section('CSRGraph — Remove edge');

const g2 = new CSRGraph();
g2.addNode({ id: 'X' });
g2.addNode({ id: 'Y' });
g2.addEdge('X', 'Y');
assert(g2.edgeCount() === 1, '1 edge before removal');
assert(g2.hasEdge('X', 'Y'), 'Has edge before');

g2.removeEdge('X', 'Y');
assert(g2.edgeCount() === 0, '0 edges after removal');
assert(!g2.hasEdge('X', 'Y'), 'No edge after removal');

section('CSRGraph — Remove node');

const g3 = new CSRGraph();
g3.addNode({ id: 'P' });
g3.addNode({ id: 'Q' });
g3.addNode({ id: 'R' });
g3.addEdge('P', 'Q');
g3.addEdge('Q', 'R');
assert(g3.nodeCount() === 3, '3 nodes before removal');
g3.removeNode('Q');
assert(g3.nodeCount() === 2, '2 nodes after removal');
assert(!g3.hasEdge('P', 'Q'), 'Edge removed with node');

// =============================================
// CSRGraph — Serialization
// =============================================

section('CSRGraph — Serialization');

const json = graph.toJSON();
assert(json.nodes.length === 4, 'JSON has 4 nodes');
assert(json.edges.length === 4, 'JSON has 4 edges');

const restored = CSRGraph.fromJSON(json);
assert(restored.nodeCount() === 4, 'Restored has 4 nodes');
assert(restored.edgeCount() === 4, 'Restored has 4 edges');
assert(restored.hasEdge('A', 'B'), 'Restored has edge A->B');

// =============================================
// CSRGraph — Clear
// =============================================

section('CSRGraph — Clear');

const g4 = new CSRGraph();
g4.addNode({ id: 'A' });
g4.addNode({ id: 'B' });
g4.addEdge('A', 'B');
g4.clear();
assert(g4.nodeCount() === 0, '0 nodes after clear');
assert(g4.edgeCount() === 0, '0 edges after clear');

// =============================================
// CSRGraph — Memory estimation
// =============================================

section('CSRGraph — Memory estimation');

const memGraph = new CSRGraph();
const M = 200;
for (let i = 0; i < M; i++) memGraph.addNode({ id: `m${i}` });
for (let i = 0; i < M; i++) {
  for (let j = 1; j <= 10 && i + j < M; j++) {
    memGraph.addEdge(`m${i}`, `m${i + j}`);
  }
}
const mem = memGraph.memoryEstimate();
assert(mem.total > 0, 'Memory estimate > 0');
assert(mem.indices >= 0, 'Indices memory');
assert(mem.indptr >= 0, 'Indptr memory');

// =============================================
// CSRGraph — Large graph performance
// =============================================

section('CSRGraph — Large graph');

const large = new CSRGraph();
const N = 100;
for (let i = 0; i < N; i++) {
  large.addNode({ id: `n${i}` });
}
for (let i = 0; i < N - 1; i++) {
  large.addEdge(`n${i}`, `n${i + 1}`);
}
assert(large.nodeCount() === N, `${N} nodes in large graph`);
assert(large.edgeCount() === N - 1, `${N - 1} edges in large graph`);

const bfsLarge = large.bfs('n0');
assert(bfsLarge.length === N, 'BFS visits all nodes');

const biLarge = large.bidirectionalBFS('n0', `n${N - 1}`, N);
assert(biLarge !== null, 'Bidirectional BFS on large graph');
assert(biLarge!.length === N, 'Path covers all nodes');

// =============================================
// CompressedAdjacency
// =============================================

section('CompressedAdjacency — Basic');

const adj = new CompressedAdjacency();
adj.addEdge('a', 'b');
adj.addEdge('a', 'c');
adj.addEdge('b', 'd');

assert(adj.nodeCount() === 4, '4 nodes in compressed adjacency');
assert(adj.edgeCount() === 3, '3 edges in compressed adjacency');
assert(adj.neighbors('a').length === 2, 'a has 2 neighbors');
assert(adj.neighbors('b').length === 1, 'b has 1 neighbor');
assert(adj.neighbors('c').length === 0, 'c has 0 neighbors');

section('CompressedAdjacency — hasEdge');

assert(adj.hasEdge('a', 'b'), 'Adj has edge a->b');
assert(!adj.hasEdge('b', 'a'), 'Adj does not have b->a');

section('CompressedAdjacency — degree');

assert(adj.degree('a') === 2, 'Adj a degree 2');
assert(adj.degree('d') === 0, 'Adj d degree 0');

section('CompressedAdjacency — removeEdge');

adj.removeEdge('a', 'b');
assert(!adj.hasEdge('a', 'b'), 'Edge removed');
assert(adj.edgeCount() === 2, '2 edges after removal');

section('CompressedAdjacency — clear');

const adj2 = new CompressedAdjacency();
adj2.addEdge('x', 'y');
adj2.clear();
assert(adj2.nodeCount() === 0, '0 nodes after clear');
assert(adj2.edgeCount() === 0, '0 edges after clear');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });