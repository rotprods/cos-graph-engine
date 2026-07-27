# WASM Acceleration — COS Graph Engine

## Overview

WASM Acceleration module for COS Graph Engine v2.1+. Compiles hot paths (BFS, PageRank, shortest path, betweenness centrality) to WebAssembly via AssemblyScript.

## Architecture

```
packages/wasm/
├── assembly/          # AssemblyScript source
│   ├── csr.ts         # BFS — raw memory, GC runtime
│   ├── pagerank.ts    # PageRank — power iteration
│   ├── shortest.ts    # Dijkstra — unweighted shortest path
│   ├── centrality.ts  # Brandes — betweenness centrality
│   └── index.ts       # Entry point
├── build/             # WASM output (compiled)
│   ├── optimized.wasm # 6.3KB compiled WASM
│   ├── optimized.wat  # WAT text format
│   ├── optimized.js   # JS wrapper (auto-generated)
│   └── optimized.d.ts # TypeScript types
├── src/
│   ├── loader.ts      # WASM loader with JS fallback
│   └── index.ts       # Public API
├── AGENTS.md          # This file
├── asconfig.json      # AssemblyScript config
├── tsconfig.json      # TypeScript config
└── package.json       # @cos/wasm
```

## Key Files

### `assembly/csr.ts`
- `bfs(indptrPtr, indptrLen, indicesPtr, indicesLen, source) → i32`
- Uses `heap.alloc`/`heap.free` for internal queue + visited bit array
- Writes visited nodes to output buffer (set via `setOutputBuffer`)
- Returns count of visited nodes

### `assembly/pagerank.ts`
- `pageRank(indptrPtr, indptrLen, indicesPtr, indicesLen, damping, iterations, resultPtr)`
- Power iteration on CSR arrays
- Writes Float64Array of ranks to resultPtr

### `assembly/shortest.ts`
- `shortestPath(indptrPtr, indptrLen, indicesPtr, indicesLen, source, target, resultPtr) → i32`
- Unweighted Dijkstra (BFS with distances)
- Writes [found, distance] to resultPtr

### `assembly/centrality.ts`
- `betweenness(indptrPtr, indptrLen, indicesPtr, indicesLen, resultPtr)`
- Brandes algorithm O(n^2) for unweighted graphs
- Writes Float64Array of centralities to resultPtr

### `src/loader.ts`
- `createWASMModule(buffer)` — creates WASM instance, wraps exports
- `createJSFallback()` — pure JS implementations for all 4 functions
- `WASMLoader(url?)` — async loader with auto-detect (Node.js / browser)
- `isWASMAvailable()` — feature detection

## Build

```bash
# Build WASM modules
npm run asbuild

# Output: packages/wasm/build/optimized.wasm (6.3KB)
```

## Tests

```bash
# WASM integration tests (21 tests)
npx tsx scripts/test-wasm.ts
```

## Usage

```typescript
import { WASMLoader, createJSFallback } from '../packages/wasm/src/loader';

// Auto-detect: WASM or JS fallback
const wasm = await WASMLoader();
const result = wasm.bfs(indptr, indices, 0);

// Or force JS fallback
const js = createJSFallback();
const path = js.shortestPath(indptr, indices, 0, 50);
```

## Test Results

- 21 WASM tests: all pass
- 4 WASM modules: bfs, pageRank, shortestPath, betweenness
- WASM vs JS: all results match within tolerance
- WASM binary: 6.3KB optimized

## Dependencies

- **Build**: assemblyscript (devDependency only)
- **Runtime**: zero external dependencies
- **Fallback**: pure JS, zero external dependencies