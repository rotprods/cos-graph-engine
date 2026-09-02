#!/usr/bin/env npx tsx
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createWASMModule, createJSFallback } from '../packages/wasm/src/loader';

const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
assert.equal(fs.existsSync(wasmPath), true, 'WASM binary must exist before extended ABI tests');
const wasm = createWASMModule(fs.readFileSync(wasmPath));
const js = createJSFallback();

function equalI32(actual: Int32Array, expected: Int32Array, label: string): void {
  assert.deepEqual(Array.from(actual), Array.from(expected), label);
}

// DFS / path — branching DAG: 0 -> [1,2], 1 -> 3, 2 -> 4
{
  const indptr = new Int32Array([0, 2, 3, 4, 4, 4]);
  const indices = new Int32Array([1, 2, 3, 4]);
  equalI32(wasm.dfs(indptr, indices, 0), js.dfs(indptr, indices, 0), 'WASM DFS matches JS fallback');
  assert.equal(wasm.dfsHasPath(indptr, indices, 0, 4), js.dfsHasPath(indptr, indices, 0, 4), 'WASM DFS path=true matches');
  assert.equal(wasm.dfsHasPath(indptr, indices, 3, 4), js.dfsHasPath(indptr, indices, 3, 4), 'WASM DFS path=false matches');
}

// Connected components — {0,1} and {2,3}; isolated 4.
{
  const indptr = new Int32Array([0, 1, 2, 3, 4, 4]);
  const indices = new Int32Array([1, 0, 3, 2]);
  const wa = wasm.connectedComponents(indptr, indices);
  const ja = js.connectedComponents(indptr, indices);
  assert.equal(wa.count, ja.count, 'WASM component count matches JS');
  equalI32(wa.componentIds, ja.componentIds, 'WASM component IDs match JS');
}

// Topological sort + cycle detection.
{
  const dagPtr = new Int32Array([0, 2, 3, 4, 4]);
  const dagIdx = new Int32Array([1, 2, 3, 3]);
  const wOrder = wasm.topologicalSort(dagPtr, dagIdx);
  const jOrder = js.topologicalSort(dagPtr, dagIdx);
  assert.equal(wOrder.length, 4, 'WASM topo returns all DAG nodes');
  assert.equal(jOrder.length, 4, 'JS topo returns all DAG nodes');
  const position = new Map(Array.from(wOrder).map((node, i) => [node, i]));
  assert.ok(position.get(0)! < position.get(1)! && position.get(0)! < position.get(2)!, 'WASM topo respects 0 dependencies');
  assert.ok(position.get(1)! < position.get(3)! && position.get(2)! < position.get(3)!, 'WASM topo respects 3 dependencies');
  assert.equal(wasm.hasCycle(dagPtr, dagIdx), false, 'WASM hasCycle false on DAG');
  assert.equal(wasm.hasCycle(dagPtr, dagIdx), js.hasCycle(dagPtr, dagIdx), 'WASM cycle result matches JS on DAG');

  const cyclePtr = new Int32Array([0, 1, 2]);
  const cycleIdx = new Int32Array([1, 0]);
  assert.equal(wasm.hasCycle(cyclePtr, cycleIdx), true, 'WASM hasCycle true on cycle');
  assert.equal(wasm.hasCycle(cyclePtr, cycleIdx), js.hasCycle(cyclePtr, cycleIdx), 'WASM cycle result matches JS on cycle');
}

// Weighted shortest paths.
{
  // 0->1(2), 0->2(5), 1->2(1), 1->3(10), 2->3(3)
  const indptr = new Int32Array([0, 2, 4, 5, 5]);
  const indices = new Int32Array([1, 2, 2, 3, 3]);
  const weights = new Int32Array([2, 5, 1, 10, 3]);
  const wa = wasm.dijkstra(indptr, indices, weights, 0);
  const ja = js.dijkstra(indptr, indices, weights, 0);
  equalI32(wa.distances, ja.distances, 'WASM Dijkstra distances match JS');
  equalI32(wa.parents, ja.parents, 'WASM Dijkstra parents match JS');
  assert.deepEqual(Array.from(wa.distances), [0, 2, 3, 6], 'WASM Dijkstra expected distances');
}

console.log('Extended WASM ABI integration: PASS');
