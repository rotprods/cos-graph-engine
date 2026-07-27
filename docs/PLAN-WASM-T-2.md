# Plan de Ejecucion — Fase 2: WASM Acceleration

**Objetivo**: Compilar core math a WebAssembly real. Hot paths (BFS, PageRank, shortest paths, centrality) en WASM.

**Dependencias**: Fase 1 (CSR arrays como entrada de WASM)
**Duracion estimada**: 4-5 horas

---

## Tickets

### T-2.1 — AssemblyScript Pipeline

**Archivos**:
- `packages/wasm/assembly/` — modulos AssemblyScript
- `packages/wasm/asconfig.json` — configuracion de build
- `packages/wasm/package.json` — package propio

**Modulos WASM**:

| Modulo | Funcion | Entrada | Salida |
|--------|---------|---------|--------|
| `csr.wasm` | CSR traverse (BFS) | indptr + indices en TypedArrays | Array de nodos visitados |
| `pagerank.wasm` | Power iteration | CSR + damping factor | Float64Array de ranks |
| `shortest.wasm` | Bidirectional Dijkstra | CSR + source + target | Path + distancia |
| `centrality.wasm` | Betweenness centrality | CSR | Float64Array de centralities |

**API AssemblyScript**:
```typescript
// assembly/csr.ts
export function bfs(indptrPtr: usize, indptrLen: i32, indicesPtr: usize, indicesLen: i32, source: i32): void;
export function pageRank(indptrPtr: usize, indicesLen: i32, indicesPtr: usize, indicesLen: i32, damping: f64, iterations: i32): void;
export function shortestPath(indptrPtr: usize, indptrLen: i32, indicesPtr: usize, indicesLen: i32, source: i32, target: i32): void;
export function betweenness(indptrPtr: usize, indptrLen: i32, indicesPtr: usize, indicesLen: i32): void;
```

### T-2.2 — WASM Loader

**Archivo**: `packages/wasm/src/loader.ts`

Interfaz WASMModule con 4 metodos. WASMLoader.load() async con fallback automatico a JS puro.

**Fallback**: Si WASM no esta disponible, se usa el CSRGraph de JS como fallback transparente.

### T-2.3 — WASM Benchmarks

**Archivo**: `scripts/benchmark-wasm.ts`

| Benchmark | WASM | JS puro | Speedup esperado |
|-----------|------|---------|------------------|
| BFS 10K nodos | 0.3ms | 0.8ms | 2.5-3x |
| PageRank 5K nodos, 20 iter | 12ms | 45ms | 3-4x |
| Dijkstra bidireccional 10K | 1.2ms | 3.5ms | 2.5-3x |
| Betweenness centrality 1K | 340ms | 1200ms | 3-4x |

---

## Arquitectura

```
packages/wasm/
├── assembly/          # AssemblyScript source
│   ├── csr.ts         # BFS
│   ├── pagerank.ts    # PageRank power iteration
│   ├── shortest.ts    # Bidirectional Dijkstra  
│   └── centrality.ts  # Betweenness centrality
├── build/             # WASM output (compiled)
│   ├── optimized.wasm
│   └── optimized.wat
├── src/
│   ├── loader.ts      # WASM loader with fallback
│   └── index.ts       # public API
├── asconfig.json      # AssemblyScript config
├── package.json       # @cos/wasm
└── tsconfig.json
```

## Integracion con CSRGraph

CSRGraph ya tiene indptr e indices como arrays planos. WASM modules reciben punteros a estos arrays via memoria lineal compartida.

```typescript
// loader.ts
const wasm = await WASMLoader.load().catch(() => null);
const bfs = wasm ? wasm.bfs : jsFallbackBFS;
```

## Tests

- 4 tests de compilacion (1 por modulo WASM)
- 4 tests de loader (load, fallback, error handling, feature detection)
- 4 benchmarks WASM vs JS (BFS, PageRank, ShortestPath, Centrality)

Total: 12 tests, 0 fallos esperados.