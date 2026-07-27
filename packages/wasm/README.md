# @cos/wasm — COS WASM Acceleration

AssemblyScript WebAssembly modules for graph algorithms with pure-JS fallback.

## Features

- **BFS** — Breadth-first search on CSR graph
- **PageRank** — Iterative PageRank computation
- **Shortest Path** — BFS-based shortest path (O(n+e))
- **Betweenness Centrality** — Node-level betweenness
- **JS Fallback** — Falls back to pure JS when WASM is unavailable
- **Pre-grow** — 64MB initial memory, 32MB user buffer

## Install

```bash
npm install @cos/wasm
```

## Quick Start

```typescript
import { createWASMModule } from '@cos/wasm';

const wasm = await createWASMModule();
const result = wasm.bfs([0, 1, 2], [1, 2], 0);
```

## Benchmarks

| Algorithm | Speedup |
|-----------|---------|
| BFS Chain 10K | 2.34x |
| BFS Grid | 1.60x |
| PageRank 5K | 2.65x |
| Shortest Path 10K | **10.49x** |
| Betweenness 1K | 5.94x |

## License

MIT