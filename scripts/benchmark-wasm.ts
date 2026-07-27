#!/usr/bin/env npx tsx
/**
 * WASM Benchmark Suite — COS Graph Engine v2.1
 *
 * Compara rendimiento de WASM vs JS puro para BFS, PageRank,
 * Shortest Path, y Betweenness Centrality.
 *
 * Usage: npx tsx scripts/benchmark-wasm.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWASMModule, createJSFallback, WASMModule } from '../packages/wasm/src/loader';

function measure<T>(fn: () => T, iterations: number): { timeMs: number; result: T } {
  // Cold run
  fn();
  // Measured
  const start = performance.now();
  let result: T = undefined as unknown as T;
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  const end = performance.now();
  return { timeMs: (end - start) / iterations, result };
}

function bench(name: string, fn: () => unknown, iterations: number = 10): number {
  const { timeMs } = measure(fn, iterations);
  console.log(`  ${name.padEnd(40)} ${timeMs.toFixed(3)}ms (${iterations} iteraciones)`);
  return timeMs;
}

function makeChain(n: number): { indptr: Int32Array; indices: Int32Array } {
  const indptr = new Int32Array(n + 1);
  const indices = new Int32Array(n - 1);
  for (let i = 0; i < n; i++) indptr[i] = i;
  indptr[n] = n - 1;
  for (let i = 0; i < n - 1; i++) indices[i] = i + 1;
  return { indptr, indices };
}

function makeGrid(rows: number, cols: number): { indptr: Int32Array; indices: Int32Array } {
  const n = rows * cols;
  const edges: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r * cols + c;
      if (c + 1 < cols) edges.push([id, id + 1]);       // right
      if (r + 1 < rows) edges.push([id, id + cols]);     // down
    }
  }
  const indptr = new Int32Array(n + 1);
  const indices = new Int32Array(edges.length);
  let count = 0;
  let edgeIdx = 0;
  for (let i = 0; i < n; i++) {
    indptr[i] = count;
    // Collect edges for this node
    while (edgeIdx < edges.length && edges[edgeIdx][0] === i) {
      indices[count] = edges[edgeIdx][1];
      count++;
      edgeIdx++;
    }
  }
  indptr[n] = count;
  return { indptr, indices };
}

console.log('\n=== COS WASM Benchmark Suite v2.1 ===\n');

// Load WASM
const wasmPath = path.resolve(__dirname, '../packages/wasm/build/optimized.wasm');
if (!fs.existsSync(wasmPath)) {
  console.error('WASM binary not found. Run: npm run asbuild');
  process.exit(1);
}
const buffer = fs.readFileSync(wasmPath);
const wasm: WASMModule = createWASMModule(buffer);
const js: WASMModule = createJSFallback();

// ===== B1: BFS Chain 10K =====
console.log('B1: BFS Chain 10K');

const chain10k = makeChain(10000);
const wasmTime1 = bench('WASM BFS chain 10K', () => wasm.bfs(chain10k.indptr, chain10k.indices, 0), 20);
const jsTime1 = bench('JS BFS chain 10K', () => js.bfs(chain10k.indptr, chain10k.indices, 0), 20);
console.log(`  Speedup: ${(jsTime1 / wasmTime1).toFixed(2)}x`);
console.log();

// ===== B2: BFS Grid 100x100 =====
console.log('B2: BFS Grid 100x100');

const grid100 = makeGrid(100, 100);
const wasmTime2 = bench('WASM BFS grid 100x100', () => wasm.bfs(grid100.indptr, grid100.indices, 0), 20);
const jsTime2 = bench('JS BFS grid 100x100', () => js.bfs(grid100.indptr, grid100.indices, 0), 20);
console.log(`  Speedup: ${(jsTime2 / wasmTime2).toFixed(2)}x`);
console.log();

// ===== B3: PageRank Chain 5K =====
console.log('B3: PageRank Chain 5K');

const chain5k = makeChain(5000);
const wasmTime3 = bench('WASM PageRank 5K x20', () => wasm.pageRank(chain5k.indptr, chain5k.indices, 0.85, 20), 5);
const jsTime3 = bench('JS PageRank 5K x20', () => js.pageRank(chain5k.indptr, chain5k.indices, 0.85, 20), 5);
console.log(`  Speedup: ${(jsTime3 / wasmTime3).toFixed(2)}x`);
console.log();

// ===== B4: Shortest Path Chain 10K =====
console.log('B4: Shortest Path Chain 10K');

const chain10k2 = makeChain(10000);
const wasmTime4 = bench('WASM Shortest Path 10K', () => wasm.shortestPath(chain10k2.indptr, chain10k2.indices, 0, 9999), 20);
const jsTime4 = bench('JS Shortest Path 10K', () => js.shortestPath(chain10k2.indptr, chain10k2.indices, 0, 9999), 20);
console.log(`  Speedup: ${(jsTime4 / wasmTime4).toFixed(2)}x`);
console.log();

// ===== B5: Betweenness Centrality Chain 1K =====
console.log('B5: Betweenness Centrality Chain 1K');

const chain1k = makeChain(1000);
const wasmTime5 = bench('WASM Betweenness 1K', () => wasm.betweenness(chain1k.indptr, chain1k.indices), 3);
const jsTime5 = bench('JS Betweenness 1K', () => js.betweenness(chain1k.indptr, chain1k.indices), 3);
console.log(`  Speedup: ${(jsTime5 / wasmTime5).toFixed(2)}x`);
console.log();

// ===== Summary =====
console.log('=== Summary ===');
console.log(`| Benchmark | WASM (ms) | JS (ms) | Speedup |`);
console.log(`|-----------|-----------|---------|---------|`);
console.log(`| BFS Chain 10K | ${wasmTime1.toFixed(3)} | ${jsTime1.toFixed(3)} | ${(jsTime1 / wasmTime1).toFixed(2)}x |`);
console.log(`| BFS Grid 100x100 | ${wasmTime2.toFixed(3)} | ${jsTime2.toFixed(3)} | ${(jsTime2 / wasmTime2).toFixed(2)}x |`);
console.log(`| PageRank 5K | ${wasmTime3.toFixed(3)} | ${jsTime3.toFixed(3)} | ${(jsTime3 / wasmTime3).toFixed(2)}x |`);
console.log(`| Shortest Path 10K | ${wasmTime4.toFixed(3)} | ${jsTime4.toFixed(3)} | ${(jsTime4 / wasmTime4).toFixed(2)}x |`);
console.log(`| Betweenness 1K | ${wasmTime5.toFixed(3)} | ${jsTime5.toFixed(3)} | ${(jsTime5 / wasmTime5).toFixed(2)}x |`);
console.log();