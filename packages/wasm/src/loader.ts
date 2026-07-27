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
  pageRank(indptr: Int32Array, indices: Int32Array, damping: number, iterations: number): Float64Array;
  shortestPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): Int32Array;
  betweenness(indptr: Int32Array, indices: Int32Array): Float64Array;
}

export function createWASMModule(wasmBuffer: ArrayBuffer): WASMModule {
  const importObj = {
    env: {
      abort: (_msg: number, _file: number, _line: number, _col: number) => {
        throw new Error('WASM abort');
      },
    },
  };

  const module = new WebAssembly.Module(wasmBuffer);
  const instance = new WebAssembly.Instance(module, importObj);
  const exports = instance.exports as Record<string, unknown>;
  const memory = exports.memory as WebAssembly.Memory;

  // Memory allocator: uses a fixed region at high address to avoid WASM runtime conflicts
  // Pre-grow to 64MB to handle large graphs
  const initialPages = memory.buffer.byteLength / (64 * 1024);
  const targetPages = 1024; // 64MB
  if (targetPages > initialPages) {
    memory.grow(targetPages - initialPages);
  }
  let heapPtr = 32 * 1024 * 1024; // 32MB — well past runtime data

  function alloc(size: number): number {
    const ptr = heapPtr;
    heapPtr = (heapPtr + size + 7) & ~7;
    return ptr;
  }

  function writeInt32Array(arr: Int32Array): number {
    const ptr = alloc(arr.byteLength);
    new Int32Array(memory.buffer, ptr, arr.length).set(arr);
    return ptr;
  }

  const fnBFS = exports.bfs as (a: number, b: number, c: number, d: number, e: number) => number;
  const fnSetOutput = exports.setOutputBuffer as (a: number) => void;
  const fnInitBuffers = exports.initBuffers as (a: number, b: number) => void;
  const fnPageRank = exports.pageRank as (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  const fnShortest = exports.shortestPath as (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  const fnBetweenness = exports.betweenness as (a: number, b: number, c: number, d: number, e: number) => void;

  // Pre-allocate internal buffers for BFS (no GC dependency)
  const queuePtr = alloc(65536 * 4);
  const visitedPtr = alloc(65536 / 8 + 1);
  if (fnInitBuffers) {
    fnInitBuffers(queuePtr, visitedPtr);
  }

  function readI32(ptr: number): number {
    return new Int32Array(memory.buffer, ptr, 1)[0];
  }

  return {
    bfs(indptr: Int32Array, indices: Int32Array, source: number): Int32Array {
      const n = indptr.length - 1;
      const outputPtr = alloc(n * 4);
      const indptrPtr = writeInt32Array(indptr);
      const indicesPtr = writeInt32Array(indices);

      fnSetOutput(outputPtr);
      const visitedCount = fnBFS(indptrPtr, indptr.length, indicesPtr, indices.length, source);

      const result = new Int32Array(visitedCount > 0 ? visitedCount : 0);
      for (let i = 0; i < visitedCount && i < n; i++) {
        result[i] = readI32(outputPtr + i * 4);
      }
      return result;
    },

    pageRank(indptr: Int32Array, indices: Int32Array, damping: number, iterations: number): Float64Array {
      const n = indptr.length - 1;
      const resultPtr = alloc(n * 8);
      const indptrPtr = writeInt32Array(indptr);
      const indicesPtr = writeInt32Array(indices);

      fnPageRank(indptrPtr, indptr.length, indicesPtr, indices.length, damping, iterations, resultPtr);
      return new Float64Array(memory.buffer, resultPtr, n);
    },

    shortestPath(indptr: Int32Array, indices: Int32Array, source: number, target: number): Int32Array {
      const resultPtr = alloc(8);
      const indptrPtr = writeInt32Array(indptr);
      const indicesPtr = writeInt32Array(indices);

      const found = fnShortest(indptrPtr, indptr.length, indicesPtr, indices.length, source, target, resultPtr);
      const distance = readI32(resultPtr + 4);
      return new Int32Array([found, distance]);
    },

    betweenness(indptr: Int32Array, indices: Int32Array): Float64Array {
      const n = indptr.length - 1;
      const resultPtr = alloc(n * 8);
      const indptrPtr = writeInt32Array(indptr);
      const indicesPtr = writeInt32Array(indices);

      fnBetweenness(indptrPtr, indptr.length, indicesPtr, indices.length, resultPtr);
      return new Float64Array(memory.buffer, resultPtr, n);
    },
  };
}

// Fallback JS puro
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
  };
}

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