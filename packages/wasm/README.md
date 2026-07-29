# @cos/wasm

AssemblyScript WASM acceleration modules for COS Graph Engine.

## Instalacion

```bash
npm install @cos/wasm
```

## Modulos

- `csr` — CSR matrix operations
- `pagerank` — PageRank algorithm
- `shortest` — Shortest path (BFS-based)
- `centrality` — Betweenness centrality
- `dfs` — Depth-first search
- `components` — Connected components
- `toposort` — Topological sort
- `dijkstra` — Dijkstra's algorithm
- `bfs` — Breadth-first search
- `graph` — Graph utilities

## Uso

```typescript
import { loadWasm, getModule } from "@cos/wasm";

const wasm = await loadWasm();
const csr = getModule("csr");
const result = csr.batchAdjacency(adjacency, indices);
```

## Performance

| Module | Speedup vs JS |
|--------|--------------|
| BFS | 2.34x |
| PageRank | 2.65x |
| Shortest Path | 10.49x |
| Betweenness | 5.94x |

## Build

```bash
npm run build  # Compiles assembly/*.ts to build/optimized.wasm
```

## Fallback

All WASM modules have automatic JS fallback when WebAssembly is unavailable.