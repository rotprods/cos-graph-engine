# @cos/graph — COS Graph Engine

Production-grade graph engine with **compressed sparse row (CSR)** storage, **bidirectional BFS**,
**7 pruning strategies**, and **AssemblyScript WASM bindings**.

## Features

- **CSRGraph** — Cache-friendly adjacency storage, 77 tests
- **Bidirectional BFS** — Up to 10x speedup over unidirectional BFS
- **Pruning Pipeline** — 7 composable strategies (MaxDepth, Visited, TargetDirection, CostBound, Beam, Landmark, EarlyExit)
- **WASM Acceleration** — BFS (2.34x), PageRank (2.65x), Shortest Path (10.49x), Betweenness (5.94x)
- **Zero Dependencies** — No external runtime dependencies

## Install

```bash
npm install @cos/graph
```

## Quick Start

```typescript
import { CSRGraph } from '@cos/graph';

const graph = new CSRGraph();
graph.addNode({ id: 'a' });
graph.addNode({ id: 'b' });
graph.addEdge('a', 'b', { weight: 1 });

const path = graph.bidirectionalBFS('a', 'b');
console.log(path?.map(n => n.id)); // ['a', 'b']
```

## License

MIT