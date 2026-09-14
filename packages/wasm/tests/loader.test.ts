/**
 * Tests for WASM Loader — Extended
 *
 * Covers the JS fallback plus a compiled-WASM PageRank oracle so backend
 * equivalence cannot hide a shared mathematical defect.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createJSFallback, createWASMModule, WASMModule, isWASMAvailable } from '../src/loader';

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;
let testCount = 0;

function assert(condition: boolean, msg: string): void {
  testCount++;
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function assertStrictEqual<T>(a: T, b: T, msg: string): void {
  testCount++;
  if (a === b) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}: expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`); }
}

function assertApprox(actual: number, expected: number, tolerance: number, msg: string): void {
  testCount++;
  if (Math.abs(actual - expected) <= tolerance) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}: expected ${actual} ~= ${expected} (±${tolerance})`); }
}

function section(name: string): void {
  console.log(`\n=== ${name} ===`);
}

/** Build a directed chain 0→1→2→...→n-1 */
function buildChain(n: number): { indptr: Int32Array; indices: Int32Array } {
  // Each node i has outgoing edge to i+1, except last node
  // indptr: [0, 1, 2, 3, ..., n-1, n-1]
  const indptr = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) indptr[i] = i;
  indptr[n] = n - 1;
  const indices = new Int32Array(n - 1);
  for (let i = 0; i < n - 1; i++) indices[i] = i + 1;
  return { indptr, indices };
}

function buildGrid(rows: number, cols: number): { indptr: Int32Array; indices: Int32Array } {
  const n = rows * cols;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (r > 0) adj[idx].push((r - 1) * cols + c);
      if (r < rows - 1) adj[idx].push((r + 1) * cols + c);
      if (c > 0) adj[idx].push(r * cols + (c - 1));
      if (c < cols - 1) adj[idx].push(r * cols + (c + 1));
    }
  }
  const indptr = new Int32Array(n + 1);
  let total = 0;
  for (let i = 0; i < n; i++) { indptr[i] = total; total += adj[i].length; }
  indptr[n] = total;
  const indices = new Int32Array(total);
  let idx = 0;
  for (let i = 0; i < n; i++) { for (const e of adj[i]) indices[idx++] = e; }
  return { indptr, indices };
}

function buildAdj(adj: number[][]): { indptr: Int32Array; indices: Int32Array } {
  const n = adj.length;
  const indptr = new Int32Array(n + 1);
  let total = 0;
  for (let i = 0; i < n; i++) { indptr[i] = total; total += adj[i].length; }
  indptr[n] = total;
  const indices = new Int32Array(total);
  let idx = 0;
  for (let i = 0; i < n; i++) { for (const e of adj[i]) indices[idx++] = e; }
  return { indptr, indices };
}

function assertPageRankChainOracle(module: WASMModule, backend: string): void {
  const { indptr, indices } = buildChain(5);
  const result = module.pageRank(indptr, indices, 0.85, 20);
  const expected = [0.08118305, 0.15019045, 0.20884783, 0.25870436, 0.30107431];

  assertStrictEqual(result.length, 5, `${backend}: PageRank returns 5 values`);
  const total = Array.from(result).reduce((sum, rank) => sum + rank, 0);
  assertApprox(total, 1, 1e-9, `${backend}: PageRank mass is conserved`);
  for (let i = 0; i < expected.length; i++) {
    assertApprox(result[i], expected[i], 1e-6, `${backend}: PageRank[${i}] matches independent oracle`);
  }
  assert(result[4] > result[0], `${backend}: terminal node outranks source in directed chain`);
}

function loadCompiledWASM(): WASMModule {
  const bytes = readFileSync(resolve(__dirname, '../build/optimized.wasm'));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return createWASMModule(buffer);
}

// ============================================================
// Tests
// ============================================================

let wasm: WASMModule;

section('createJSFallback — basic');

{
  wasm = createJSFallback();
  assert(wasm !== null, 'createJSFallback returns module');
  assert(typeof wasm.bfs === 'function', 'has bfs');
  assert(typeof wasm.dfs === 'function', 'has dfs');
  assert(typeof wasm.dfsHasPath === 'function', 'has dfsHasPath');
  assert(typeof wasm.pageRank === 'function', 'has pageRank');
  assert(typeof wasm.shortestPath === 'function', 'has shortestPath');
  assert(typeof wasm.betweenness === 'function', 'has betweenness');
  assert(typeof wasm.connectedComponents === 'function', 'has connectedComponents');
  assert(typeof wasm.topologicalSort === 'function', 'has topologicalSort');
  assert(typeof wasm.hasCycle === 'function', 'has hasCycle');
  assert(typeof wasm.dijkstra === 'function', 'has dijkstra');
}

// ============================================================
section('BFS — chain 10');

{
  const { indptr, indices } = buildChain(10);
  const result = wasm.bfs(indptr, indices, 0);
  assert(result.length === 10, 'BFS visits all 10 nodes');
  assertStrictEqual(result[0], 0, 'first node is source');
  assertStrictEqual(result[9], 9, 'last node is 9');
}

// ============================================================
section('DFS — chain 10');

{
  const { indptr, indices } = buildChain(10);
  const result = wasm.dfs(indptr, indices, 0);
  assert(result.length === 10, 'DFS visits all 10 nodes');
  assertStrictEqual(result[0], 0, 'first node is source');
  assert(result.length === 10, 'DFS returns all nodes');
}

// ============================================================
section('DFS has path');

{
  const { indptr, indices } = buildChain(10);
  assert(wasm.dfsHasPath(indptr, indices, 0, 9) === true, 'path exists 0→9');
  assert(wasm.dfsHasPath(indptr, indices, 0, 0) === true, 'path exists source===target');
  assert(wasm.dfsHasPath(indptr, indices, 9, 0) === false, 'no path 9→0 (directed)');
}

// ============================================================
section('PageRank — independent oracle');

{
  assertPageRankChainOracle(wasm, 'JS fallback');
}

// ============================================================
section('PageRank — compiled WASM independent oracle');

{
  assertPageRankChainOracle(loadCompiledWASM(), 'compiled WASM');
}

// ============================================================
section('Shortest path — chain 10');

{
  const { indptr, indices } = buildChain(10);
  const result = wasm.shortestPath(indptr, indices, 0, 9);
  assertStrictEqual(result[0], 1, 'path found');
  assertStrictEqual(result[1], 9, 'distance is 9');
}

// ============================================================
section('Betweenness — chain 5');

{
  const { indptr, indices } = buildChain(5);
  const result = wasm.betweenness(indptr, indices);
  assert(result.length === 5, 'betweenness returns 5 values');
}

// ============================================================
section('Connected components — disconnected graph');

{
  // Two disconnected chains: 0-1-2, 3-4-5 (undirected)
  const adj: number[][] = [[1], [0, 2], [1], [4], [3, 5], [4]];
  const { indptr, indices } = buildAdj(adj);

  const { componentIds, count } = wasm.connectedComponents(indptr, indices);
  assertStrictEqual(count, 2, '2 connected components');
  assertStrictEqual(componentIds[0], componentIds[1], '0 and 1 same component');
  assertStrictEqual(componentIds[3], componentIds[4], '3 and 4 same component');
  assert(componentIds[0] !== componentIds[3], 'different components');
}

// ============================================================
section('Topological sort — DAG');

{
  // 0 → 1 → 2 → 3
  const adj: number[][] = [[1], [2], [3], []];
  const { indptr, indices } = buildAdj(adj);

  const result = wasm.topologicalSort(indptr, indices);
  assert(result.length === 4, 'topological sort returns 4 nodes');
  const pos = new Map<number, number>();
  for (let i = 0; i < result.length; i++) pos.set(result[i], i);
  assert(pos.get(0)! < pos.get(1)!, '0 before 1');
  assert(pos.get(1)! < pos.get(2)!, '1 before 2');
  assert(pos.get(2)! < pos.get(3)!, '2 before 3');
}

// ============================================================
section('Has cycle — cycle detection');

{
  const adj: number[][] = [[1], [2], [3], [0]];
  const { indptr, indices } = buildAdj(adj);

  assert(wasm.hasCycle(indptr, indices) === true, 'cycle detected');
}

// ============================================================
section('Has cycle — no cycle (DAG)');

{
  const adj: number[][] = [[1], [2], [3], []];
  const { indptr, indices } = buildAdj(adj);

  assert(wasm.hasCycle(indptr, indices) === false, 'no cycle in DAG');
}

// ============================================================
section('Dijkstra — chain 10');

{
  const { indptr, indices } = buildChain(10);
  const weights = new Int32Array(indices.length);
  for (let i = 0; i < weights.length; i++) weights[i] = 1;

  const { distances } = wasm.dijkstra(indptr, indices, weights, 0);
  assertStrictEqual(distances[0], 0, 'distance to source is 0');
  assertStrictEqual(distances[9], 9, 'distance to last node is 9');
}

// ============================================================
section('isWASMAvailable');

{
  assert(isWASMAvailable() === true, 'WASM is available in Node.js');
}

// ============================================================
section('Empty graph — single node');

{
  const indptr = new Int32Array([0, 0]);
  const indices = new Int32Array(0);

  const bfsResult = wasm.bfs(indptr, indices, 0);
  assertStrictEqual(bfsResult.length, 1, 'BFS returns source node');

  const { count } = wasm.connectedComponents(indptr, indices);
  assertStrictEqual(count, 1, '1 component for single node');
}

// ============================================================
section('Grid 3x3 — BFS');

{
  const { indptr, indices } = buildGrid(3, 3);
  const result = wasm.bfs(indptr, indices, 0);
  assert(result.length === 9, 'BFS visits all 9 nodes');
}

// ============================================================
section('Dijkstra — no path');

{
  const indptr = new Int32Array([0, 0, 0]);
  const indices = new Int32Array(0);
  const weights = new Int32Array(0);

  const { distances } = wasm.dijkstra(indptr, indices, weights, 0);
  assertStrictEqual(distances[0], 0, 'distance to source is 0');
  assert(distances[1] > 1000000, 'distance to unreachable node is INF');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Summary ===`);
console.log(`Assertions: ${testCount}, Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
