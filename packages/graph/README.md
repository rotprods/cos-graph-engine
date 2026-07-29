# @cos/graph

COS Graph Engine — Motor de grafos de 20 niveles con zero dependencias externas.

## Instalacion

```bash
npm install @cos/graph
```

## Uso Rapido

```typescript
import { Graph } from "@cos/graph";

const g = new Graph();
g.addNode(1, { label: "Start" });
g.addNode(2, { label: "End" });
g.addEdge(1, 2);

// BFS
g.bfs(1);

// PageRank
g.pageRank();

// Shortest Path
g.shortestPath(1, 2);
```

## Niveles

L0-L3: Base (Visual, Execution, State, Dependency)
L4-L7: Computacional (Call, CFG, DataFlow, Compute)
L8-L11: Cognitivo (Knowledge, Semantic, Embedding, GraphRAG)
L12-L19: Aplicado (Memory, Agent, Tool, Workflow, Network, Social, Bio, Molecular)

## API

- `Graph` — CSR-based graph engine
- `BFS` / `DFS` — Traversal
- `PageRank` — Ranking
- `Dijkstra` / `ShortestPath` — Pathfinding
- `Components` — Connected components
- `TopologicalSort` — Dependency resolution
- `Pruning` — 7 bidirectional pruning strategies
- `Tracing` — Per-hop tracing with TraceSession
- `Profiling` — Profiler with Prometheus export

## Benchmarks

| Benchmark | JS | WASM | Improvement |
|-----------|----|------|-------------|
| BFS 10K | 1.0x | 2.34x | +134% |
| PageRank 5K | 1.0x | 2.65x | +165% |
| Shortest Path 10K | 1.0x | 10.49x | +949% |
| Betweenness 1K | 1.0x | 5.94x | +494% |

## Tests

600+ tests, 0 failures. Zero runtime dependencies.