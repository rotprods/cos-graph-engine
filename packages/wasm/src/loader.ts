/**
 * WASM Loader — COS Graph Engine v2.1
 *
 * Carga los modulos WASM compilados y provee una interfaz uniforme
 * con fallback automatico a implementacion JS pura.
 *
 * Zero dependencias externas.
 */

export interface WASMModule {
  bfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array;
  dfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array;
  dfsHasPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): boolean;
  pageRank(indptr: Int32Array, indices: Int32Array, damping: number, iterations: number): Float64Array;
  shortestPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): Int32Array;
  betweenness(indptr: Int32Array, indices: Int32Array): Float64Array;
  connectedComponents(indptr: Int32Array, indices: Int32Array): { componentIds: Int32Array; count: number };
  topologicalSort(indptr: Int32Array, indices: Int32Array): Int32Array;
  hasCycle(indptr: Int32Array, indices: Int32Array): boolean;
  dijkstra(indptr: Int32Array, indices: Int32Array, weights: Int32Array, source: number): { distances: Int32Array; parents: Int32Array };
}

// ============================================================
// WASM Module Creator
// ============================================================

function createWASMImports() {
  return {
    env: {
      abort: (_msg: number, _file: number, _line: number, _col: number) => {
        throw new Error('WASM abort');
      },
    },
  };
}

function setupMemory(memory: WebAssembly.Memory): void {
  const initialPages = memory.buffer.byteLength / (64 * 1024);
  const targetPages = 1024; // 64MB
  if (targetPages > initialPages) {
    memory.grow(targetPages - initialPages);
  }
}

export function createWASMModule(wasmBuffer: ArrayBuffer): WASMModule {
  const module = new WebAssembly.Module(wasmBuffer);
  const instance = new WebAssembly.Instance(module, createWASMImports());
  const exports = instance.exports as Record<string, unknown>;
  const memory = exports.memory as WebAssembly.Memory;

  setupMemory(memory);
  let heapPtr = 32 * 1024 * 1024; // 32MB — past runtime data

  function alloc(size: number): number {
    const ptr = heapPtr;
    heapPtr = (heapPtr + size + 7) & ~7;
    return ptr;
  }

  function writeI32(arr: Int32Array): number {
    const ptr = alloc(arr.byteLength);
    new Int32Array(memory.buffer, ptr, arr.length).set(arr);
    return ptr;
  }

  function readI32(ptr: number): number {
    return new Int32Array(memory.buffer, ptr, 1)[0];
  }

  const fnBFS = exports.bfs as (a: number, b: number, c: number, d: number, e: number) => number;
  const fnDFS = exports.dfs as (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  const fnDFSHasPath = exports.dfsHasPath as (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  const fnSetOutput = exports.setOutputBuffer as (a: number) => void;
  const fnPageRank = exports.pageRank as (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  const fnShortest = exports.shortestPath as (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  const fnBetweenness = exports.betweenness as (a: number, b: number, c: number, d: number, e: number) => void;
  const fnComponents = exports.connectedComponents as (a: number, b: number, c: number, d: number, e: number) => number;
  const fnTopoSort = exports.topologicalSort as (a: number, b: number, c: number, d: number, e: number) => number;
  const fnHasCycle = exports.hasCycle as (a: number, b: number, c: number, d: number) => number;
  const fnDijkstra = exports.dijkstra as (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;

  // Pre-allocate internal buffers
  const queuePtr = alloc(65536 * 4);
  const visitedPtr = alloc(65536 / 8 + 1);

  return {
    bfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array {
      const n = indptr.length - 1;
      const outputPtr = alloc(n * 4);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      fnSetOutput(outputPtr);
      const count = fnBFS(indptrPtr, indptr.length, indicesPtr, indices.length, source);
      const result = new Int32Array(Math.max(0, count));
      for (let i = 0; i < count && i < n; i++) result[i] = readI32(outputPtr + i * 4);
      return result;
    },

    dfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array {
      const n = indptr.length - 1;
      const outputPtr = alloc(n * 4);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      const count = fnDFS(indptrPtr, indptr.length, indicesPtr, indices.length, source, outputPtr);
      const result = new Int32Array(Math.max(0, count));
      for (let i = 0; i < count && i < n; i++) result[i] = readI32(outputPtr + i * 4);
      return result;
    },

    dfsHasPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): boolean {
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      return fnDFSHasPath(indptrPtr, indptr.length, indicesPtr, indices.length, source, target) !== 0;
    },

    pageRank(indptr: Int32Array, indices: Int32Array, damping: number, iterations: number): Float64Array {
      const n = indptr.length - 1;
      const resultPtr = alloc(n * 8);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      fnPageRank(indptrPtr, indptr.length, indicesPtr, indices.length, damping, iterations, resultPtr);
      return new Float64Array(memory.buffer, resultPtr, n);
    },

    shortestPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): Int32Array {
      const resultPtr = alloc(8);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      const n = indptr.length - 1;
      const found = fnShortest(indptrPtr, indptr.length, indicesPtr, indices.length, source, target, resultPtr);
      const distance = readI32(resultPtr + 4);
      return new Int32Array([found, distance]);
    },

    betweenness(indptr: Int32Array, indices: Int32Array): Float64Array {
      const n = indptr.length - 1;
      const resultPtr = alloc(n * 8);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      fnBetweenness(indptrPtr, indptr.length, indicesPtr, indices.length, resultPtr);
      return new Float64Array(memory.buffer, resultPtr, n);
    },

    connectedComponents(indptr: Int32Array, indices: Int32Array): { componentIds: Int32Array; count: number } {
      const n = indptr.length - 1;
      const compPtr = alloc(n * 4);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      const count = fnComponents(indptrPtr, indptr.length, indicesPtr, indices.length, compPtr);
      const ids = new Int32Array(n);
      for (let i = 0; i < n; i++) ids[i] = readI32(compPtr + i * 4);
      return { componentIds: ids, count };
    },

    topologicalSort(indptr: Int32Array, indices: Int32Array): Int32Array {
      const n = indptr.length - 1;
      const outputPtr = alloc(n * 4);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      const count = fnTopoSort(indptrPtr, indptr.length, indicesPtr, indices.length, outputPtr);
      if (count === 0) return new Int32Array(0); // cycle detected
      const result = new Int32Array(count);
      for (let i = 0; i < count; i++) result[i] = readI32(outputPtr + i * 4);
      return result;
    },

    hasCycle(indptr: Int32Array, indices: Int32Array): boolean {
      const n = indptr.length - 1;
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      return fnHasCycle(indptrPtr, indptr.length, indicesPtr, indices.length) !== 0;
    },

    dijkstra(indptr: Int32Array, indices: Int32Array, weights: Int32Array, source: number): { distances: Int32Array; parents: Int32Array } {
      const n = indptr.length - 1;
      const distPtr = alloc(n * 4);
      const parentPtr = alloc(n * 4);
      const indptrPtr = writeI32(indptr);
      const indicesPtr = writeI32(indices);
      const weightsPtr = writeI32(weights);
      fnDijkstra(indptrPtr, indptr.length, indicesPtr, indices.length, weightsPtr, weights.length, source, distPtr, parentPtr);
      const distances = new Int32Array(n);
      const parents = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        distances[i] = readI32(distPtr + i * 4);
        parents[i] = readI32(parentPtr + i * 4);
      }
      return { distances, parents };
    },
  };
}

// ============================================================
// Fallback JS puro
// ============================================================

export function createJSFallback(): WASMModule {
  return {
    bfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array {
      const n = indptr.length - 1;
      const visited = new Set<number>();
      const queue: number[] = [source];
      const result: number[] = [];
      visited.add(source);
      while (queue.length > 0) {
        const node = queue.shift()!;
        result.push(node);
        const start = indptr[node];
        const end = indptr[node + 1];
        for (let j = start; j < end; j++) {
          const neighbor = indices[j];
          if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
      }
      return new Int32Array(result);
    },

    dfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array {
      const n = indptr.length - 1;
      const visited = new Set<number>();
      const stack: number[] = [source];
      const result: number[] = [];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node)) continue;
        visited.add(node);
        result.push(node);
        const start = indptr[node];
        const end = indptr[node + 1];
        for (let j = start; j < end; j++) {
          const neighbor = indices[j];
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
      return new Int32Array(result);
    },

    dfsHasPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): boolean {
      if (source === target) return true;
      const visited = new Set<number>();
      const stack: number[] = [source];
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (visited.has(node)) continue;
        visited.add(node);
        const start = indptr[node];
        const end = indptr[node + 1];
        for (let j = start; j < end; j++) {
          const neighbor = indices[j];
          if (neighbor === target) return true;
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
      return false;
    },

    pageRank(indptr: Int32Array, indices: Int32Array, damping: number, iterations: number): Float64Array {
      const n = indptr.length - 1;
      const rank = new Float64Array(n);
      const newRank = new Float64Array(n);
      const initRank = 1.0 / n;
      rank.fill(initRank);
      for (let iter = 0; iter < iterations; iter++) {
        let danglingSum = 0.0;
        for (let i = 0; i < n; i++) { if (indptr[i] === indptr[i + 1]) danglingSum += rank[i]; }
        const baseRank = (1.0 - damping) / n;
        for (let i = 0; i < n; i++) {
          let sum = 0.0;
          const start = indptr[i];
          const end = indptr[i + 1];
          for (let j = start; j < end; j++) {
            const neighbor = indices[j];
            const outDegree = indptr[neighbor + 1] - indptr[neighbor];
            if (outDegree > 0) sum += rank[neighbor] / outDegree;
          }
          newRank[i] = baseRank + damping * sum + damping * initRank * danglingSum;
        }
        rank.set(newRank);
      }
      return rank;
    },

    shortestPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): Int32Array {
      const n = indptr.length - 1;
      const dist = new Int32Array(n);
      dist.fill(-1);
      const visited = new Set<number>();
      const queue: number[] = [source];
      dist[source] = 0;
      visited.add(source);
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node === target) return new Int32Array([1, dist[node]]);
        const start = indptr[node];
        const end = indptr[node + 1];
        for (let j = start; j < end; j++) {
          const neighbor = indices[j];
          if (!visited.has(neighbor)) { visited.add(neighbor); dist[neighbor] = dist[node] + 1; queue.push(neighbor); }
        }
      }
      return new Int32Array([0, -1]);
    },

    betweenness(indptr: Int32Array, indices: Int32Array): Float64Array {
      const n = indptr.length - 1;
      const result = new Float64Array(n);
      for (let s = 0; s < n; s++) {
        const stack: number[] = [];
        const queue: number[] = [s];
        const dist = new Int32Array(n); dist.fill(-1);
        const sigma = new Int32Array(n);
        const delta = new Float64Array(n);
        dist[s] = 0; sigma[s] = 1;
        while (queue.length > 0) {
          const v = queue.shift()!; stack.push(v);
          const start = indptr[v], end = indptr[v + 1];
          for (let j = start; j < end; j++) {
            const w = indices[j];
            if (dist[w] < 0) { queue.push(w); dist[w] = dist[v] + 1; }
            if (dist[w] === dist[v] + 1) sigma[w] += sigma[v];
          }
        }
        while (stack.length > 0) {
          const w = stack.pop()!;
          if (w !== s) {
            const start = indptr[w], end = indptr[w + 1];
            for (let j = start; j < end; j++) {
              const v = indices[j];
              if (dist[v] === dist[w] - 1) delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w]);
            }
            result[w] += delta[w];
          }
        }
      }
      return result;
    },

    connectedComponents(indptr: Int32Array, indices: Int32Array): { componentIds: Int32Array; count: number } {
      const n = indptr.length - 1;
      const parent = new Int32Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      function find(x: number): number {
        while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
      }
      function union(a: number, b: number): void {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[ra] = rb;
      }
      for (let node = 0; node < n; node++) {
        const start = indptr[node], end = indptr[node + 1];
        for (let j = start; j < end; j++) union(node, indices[j]);
      }
      for (let i = 0; i < n; i++) parent[i] = find(i);
      const compMap = new Map<number, number>();
      const ids = new Int32Array(n);
      let count = 0;
      for (let i = 0; i < n; i++) {
        const r = parent[i];
        if (!compMap.has(r)) compMap.set(r, count++);
        ids[i] = compMap.get(r)!;
      }
      return { componentIds: ids, count };
    },

    topologicalSort(indptr: Int32Array, indices: Int32Array): Int32Array {
      const n = indptr.length - 1;
      const inDegree = new Int32Array(n);
      for (let node = 0; node < n; node++) {
        const start = indptr[node], end = indptr[node + 1];
        for (let j = start; j < end; j++) inDegree[indices[j]]++;
      }
      const queue: number[] = [];
      for (let i = 0; i < n; i++) if (inDegree[i] === 0) queue.push(i);
      const result: number[] = [];
      while (queue.length > 0) {
        const node = queue.shift()!;
        result.push(node);
        const start = indptr[node], end = indptr[node + 1];
        for (let j = start; j < end; j++) {
          const neighbor = indices[j];
          if (--inDegree[neighbor] === 0) queue.push(neighbor);
        }
      }
      if (result.length < n) return new Int32Array(0); // cycle
      return new Int32Array(result);
    },

    hasCycle(indptr: Int32Array, indices: Int32Array): boolean {
      return this.topologicalSort(indptr, indices).length === 0;
    },

    dijkstra(indptr: Int32Array, indices: Int32Array, weights: Int32Array, source: number): { distances: Int32Array; parents: Int32Array } {
      const n = indptr.length - 1;
      const INF = 2147483647;
      const dist = new Int32Array(n); dist.fill(INF);
      const parent = new Int32Array(n); parent.fill(n);
      const visited = new Set<number>();
      dist[source] = 0;
      for (let iter = 0; iter < n; iter++) {
        let u = -1;
        let minDist = INF;
        for (let i = 0; i < n; i++) {
          if (!visited.has(i) && dist[i] < minDist) { minDist = dist[i]; u = i; }
        }
        if (u === -1) break;
        visited.add(u);
        const start = indptr[u], end = indptr[u + 1];
        for (let j = start; j < end; j++) {
          const v = indices[j];
          const w = weights[j];
          const nd = dist[u] + w;
          if (nd < dist[v] && nd >= 0) { dist[v] = nd; parent[v] = u; }
        }
      }
      return { distances: dist, parents: parent };
    },
  };
}

// ============================================================
// WASM Loader (factory)
// ============================================================

export async function WASMLoader(wasmUrl?: string): Promise<WASMModule> {
  try {
    if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly not supported');
    if (wasmUrl) {
      const response = await fetch(wasmUrl);
      const buffer = await response.arrayBuffer();
      return createWASMModule(buffer);
    }
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const paths = [
      resolve(__dirname, '../build/optimized.wasm'),
      resolve(process.cwd(), 'packages/wasm/build/optimized.wasm'),
    ];
    for (const p of paths) {
      try {
        const buffer = readFileSync(p);
        return createWASMModule(buffer.buffer as ArrayBuffer);
      } catch { continue; }
    }
    throw new Error('WASM binary not found');
  } catch {
    console.warn('WASM not available, using JS fallback');
    return createJSFallback();
  }
}

export function isWASMAvailable(): boolean {
  return typeof WebAssembly !== 'undefined'
    && typeof WebAssembly.Module !== 'undefined'
    && typeof WebAssembly.Instance !== 'undefined';
}