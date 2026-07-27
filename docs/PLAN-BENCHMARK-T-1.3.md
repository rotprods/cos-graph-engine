# PLAN DE EJECUCION — T-1.3 Benchmark Suite

> **Proyecto**: COS Graph Engine v2.1+ Fase 1.3
> **Dependencia**: T-1.2 (Bidirectional Pruning) ✅ completado
> **Target**: 30 tests, 7 benchmarks, 2x speedup vs v2.0 baseline

---

## Indice

1. [Arquitectura](#1-arquitectura)
2. [Componentes](#2-componentes)
3. [Benchmarks (B1-B7)](#3-benchmarks-b1-b7)
4. [Tasklist Detallada](#4-tasklist-detallada)
5. [Tests (30 total)](#5-tests-30-total)
6. [Metricas de Validacion](#6-metricas-de-validacion)
7. [QA Gate](#7-qa-gate)

---

## 1. Arquitectura

```
scripts/benchmark.ts
├── GraphGenerator          ← generacion de grafos sinteticos
├── Measurer                ← recoleccion de metricas
├── BenchmarkRunner         ← orquestacion de benchmarks
│   ├── B1: bfs-chain       ← BFS en cadena 10K nodos
│   ├── B2: bfs-grid        ← BFS en grid 100x100
│   ├── B3: bfs-social      ← BFS small-world 5K
│   ├── B4: shortest-path   ← Shortest path arbol 1K
│   ├── B5: pruning-beam    ← Beam pruning random 10K
│   ├── B6: pruning-landmark← Landmark pruning knowledge 5K
│   └── B7: memory-profile  ← Memoria CSR vs Map N=1K..100K
├── ReportExporter          ← JSON / Markdown / HTML
└── baseline.json           ← v2.0 baseline (Map-based)

scripts/test-benchmark.ts
├── Unit: GraphGenerator    ← 8 tests
├── Unit: Measurer          ← 4 tests
├── Integration: Benchmarks ← 12 tests (B1-B7 runs + validation)
└── E2E: Report             ← 6 tests (JSON, HTML, diff, pass/fail)
```

**Flujo de ejecucion**:

```
GraphGenerator.generate(type, params)
       │
       ▼
CSRGraph (v2.1) ──→ BenchmarkRunner.run(benchmark)
                          │
                          ▼
                     Measurer.measure(fn)
                          │
                          ▼
                     { time, memory, nodes, pruningRatio, speedup }
                          │
                          ▼
                     ReportExporter.export(format)
                          │
                          ▼
                     JSON / Markdown / HTML
```

---

## 2. Componentes

### 2.1 GraphGenerator

```typescript
class GraphGenerator {
  static chain(n: number): CSRGraph                    // cadena simple
  static grid(rows: number, cols: number): CSRGraph     // grid 2D con vecinos cardinales
  static social(n: number, degree: number): CSRGraph    // small-world (Watts-Strogatz)
  static random(n: number, edgeProb: number): CSRGraph  // Erdos-Renyi G(n,p)
  static tree(depth: number, branching: number): CSRGraph // arbol balanceado
  static knowledge(n: number, clusters: number): CSRGraph // clusters jerarquicos
}
```

**Validacion**:
- `chain(100)`: 100 nodos, 99 aristas, linear
- `grid(10,10)`: 100 nodos, 180 aristas
- `social(100, 3)`: 100 nodos, grado promedio ~6
- `random(100, 0.1)`: 100 nodos, ~495 aristas esperadas
- `tree(5, 2)`: 63 nodos, 62 aristas
- `knowledge(100, 5)`: 100 nodos, agrupados en 5 clusters

### 2.2 Measurer

```typescript
interface Metrics {
  timeMs: number;
  memoryBytes: number;
  heapUsedMB: number;
  nodesProcessed: number;
  edgesProcessed: number;
  nodesPerMs: number;
  pruningRatio: number;
}

class Measurer {
  static time<T>(fn: () => T, iterations: number): { result: T; timeMs: number };
  static memory<T>(fn: () => T): { result: T; heapDelta: number };
  static measure<T>(fn: () => T, iterations: number): Metrics;
  static warmup<T>(fn: () => T, iterations: number): void;
}
```

### 2.3 BenchmarkRunner

```typescript
interface Benchmark {
  id: string;                    // B1, B2, ..., B7
  name: string;                  // bfs-chain-10k
  description: string;
  graph: CSRGraph;
  setup: () => void;
  run: (graph: CSRGraph) => unknown;
  baseline: { nodesPerMs: number; memoryMB: number };
  threshold: { speedup: number; maxMemoryMB: number; minPruningRatio: number };
}

interface BenchmarkResult {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  metrics: Metrics;
  baseline: { nodesPerMs: number; memoryMB: number };
  speedup: number;
  memoryReduction: string;
  details: Record<string, unknown>;
}

class BenchmarkRunner {
  private benchmarks: Map<string, Benchmark>;
  define(b: Benchmark): void;
  run(id: string): BenchmarkResult;
  runAll(): BenchmarkResult[];
  compare(results: BenchmarkResult[], baseline: { nodesPerMs: number }): DiffReport;
}
```

### 2.4 ReportExporter

```typescript
interface DiffReport {
  results: BenchmarkResult[];
  overallSpeedup: number;
  passCount: number;
  failCount: number;
  summary: string;
}

class ReportExporter {
  static toJSON(report: DiffReport): string;
  static toMarkdown(report: DiffReport): string;
  static toHTML(report: DiffReport): string;
  static validateThresholds(report: DiffReport): boolean;
}
```

---

## 3. Benchmarks (B1-B7)

| ID | Benchmark | Grafo | Setup | Run | Metricas Target |
|----|-----------|-------|-------|-----|-----------------|
| B1 | `bfs-chain` | Cadena 10K nodos | CSR build | BFS source->last | nodes/ms >= 2000 |
| B2 | `bfs-grid` | Grid 100x100 (10K nodos) | CSR build | BFS center->all | nodes/ms >= 3000 |
| B3 | `bfs-social` | Small-world 5K nodos, grado 20 | CSR build + Map build | BFS (CSR vs Map) | speedup >= 1.5x |
| B4 | `shortest-path` | Arbol 10 niveles, branching 3 (29.5K nodos) | CSR build | bidirectionalBFS source->leaf | nodes visited <= 30% |
| B5 | `pruning-beam` | Random 10K, 5% densidad | CSR build | bfsWithPruning(Beam K=10..100) | pruning ratio >= 40% |
| B6 | `pruning-landmark` | Knowledge 5K, 10 clusters | CSR build + landmarks (10) | bfsWithPruning(Landmark(5)+EarlyExit) | pruning ratio >= 35% |
| B7 | `memory-profile` | N=1K, 10K, 100K, grado 3 | CSR build + Map build | memory(CSR) vs memory(Map) | CSR <= 50% Map |

### B1: bfs-chain-10k

```typescript
{
  id: 'B1',
  name: 'bfs-chain-10k',
  graph: GraphGenerator.chain(10000),
  setup: () => { graph.bfs('node_0'); }, // warmup
  run: (g) => g.bfs('node_0'),
  baseline: { nodesPerMs: 1420, memoryMB: 4.2 },
  threshold: { speedup: 1.5, maxMemoryMB: 10, minPruningRatio: 0 }
}
```

### B2: bfs-grid-100x100

```typescript
{
  id: 'B2',
  name: 'bfs-grid-100x100',
  graph: GraphGenerator.grid(100, 100),
  setup: () => { graph.bfs('r50_c50'); },
  run: (g) => g.bfs('r50_c50'),
  baseline: { nodesPerMs: 2100, memoryMB: 6.8 },
  threshold: { speedup: 1.5, maxMemoryMB: 15, minPruningRatio: 0 }
}
```

### B3: bfs-social-5k

Mide speedup de CSR vs Map para BFS:

```typescript
// Baseline: Map<string, string[]> BFS
const mapGraph = new Map<string, string[]>();
for (const node of graph.getAllNodes()) {
  mapGraph.set(node.id, graph.neighbors(node.id));
}
function mapBFS(source: string) { ... } // sobre Map

// Current: CSR BFS
const csrResult = measurer.measure(() => graph.bfs(source));
const mapResult = measurer.measure(() => mapBFS(source));
```

### B4: shortest-path-tree-1k

```typescript
{
  id: 'B4',
  name: 'shortest-path-tree-1k',
  graph: GraphGenerator.tree(10, 3), // 29524 nodos
  run: (g) => g.bidirectionalBFS('root', 'deepest_leaf'),
  threshold: { nodesVisitedPercent: 30 }
}
```

### B5: pruning-beam-10k

```typescript
{
  id: 'B5',
  name: 'pruning-beam-10k',
  graph: GraphGenerator.random(10000, 0.05),
  run: (g) => g.bfsWithPruning('node_0', [new BeamPruning(50), new VisitedPruning()]),
  threshold: { minPruningRatio: 0.40 }
}
```

### B6: pruning-landmark-5k

```typescript
{
  id: 'B6',
  name: 'pruning-landmark-5k',
  graph: GraphGenerator.knowledge(5000, 10),
  run: (g) => g.bfsWithPruning('cluster_0_node_0', [
    new LandmarkPruning(g, extractLandmarks(g, 10), 3),
    new EarlyExitPruning(),
    new VisitedPruning()
  ]),
  threshold: { minPruningRatio: 0.35 }
}
```

### B7: memory-profile

```typescript
{
  id: 'B7',
  name: 'memory-profile',
  sizes: [1000, 10000, 100000],
  run: (size) => {
    const csrMem = measure(() => buildCSRGraph(size));
    const mapMem = measure(() => buildMapGraph(size));
    return { csrMB, mapMB, ratio: csrMB / mapMB };
  },
  threshold: { maxRatio: 0.50 }
}
```

---

## 4. Tasklist Detallada

### T-1.3a — GraphGenerator (2h)

**Archivo**: `scripts/benchmark.ts` (seccion GraphGenerator)

**Tasklist**:
1. [ ] Implementar `GraphGenerator.chain(n)`
2. [ ] Implementar `GraphGenerator.grid(rows, cols)`
3. [ ] Implementar `GraphGenerator.social(n, degree)` — Watts-Strogatz con rewiring 0.1
4. [ ] Implementar `GraphGenerator.random(n, edgeProb)`
5. [ ] Implementar `GraphGenerator.tree(depth, branching)`
6. [ ] Implementar `GraphGenerator.knowledge(n, clusters)` — clusters jerarquicos con intra-cluster density 0.3, inter-cluster 0.01

**Validacion**: 6 tests de generacion
- `chain(100)`: 100 nodos, 99 aristas
- `grid(10,10)`: 100 nodos, 180 aristas
- `social(100, 3)`: 100 nodos, grado promedio ~6
- `random(100, 0.1)`: ~495 aristas esperadas (tolerancia 10%)
- `tree(5, 2)`: 63 nodos, 62 aristas
- `knowledge(100, 5)`: 100 nodos, >5 aristas

### T-1.3b — Measurer (2h)

**Archivo**: `scripts/benchmark.ts` (seccion Measurer)

**Tasklist**:
1. [ ] Implementar `Measurer.time(fn, iterations)` — ejecuta fn N veces, promedio
2. [ ] Implementar `Measurer.memory(fn)` — heap delta via `process.memoryUsage()`
3. [ ] Implementar `Measurer.measure(fn, iterations)` — combina time + memory
4. [ ] Implementar `Measurer.warmup(fn, iterations)` — JIT warmup

**Casos borde**:
- `iterations=0` → error
- `fn` lanza excepcion → capturar y reportar
- Memoria negativa (GC intermedio) → clamp a 0
- Cold vs warm cache (primera llamada mas lenta)

### T-1.3c — BenchmarkRunner + 7 Benchmarks (3h)

**Archivo**: `scripts/benchmark.ts` (seccion BenchmarkRunner + benchmarks)

**Tasklist**:
1. [ ] Implementar `BenchmarkRunner.define(b)` — registro
2. [ ] Implementar `BenchmarkRunner.run(id)` — ejecucion individual
3. [ ] Implementar `BenchmarkRunner.runAll()` — ejecucion en serie
4. [ ] Implementar `BenchmarkRunner.compare(baseline, current)` — diff report
5. [ ] Implementar benchmark B1: bfs-chain-10k
6. [ ] Implementar benchmark B2: bfs-grid-100x100
7. [ ] Implementar benchmark B3: bfs-social-5k (CSR vs Map)
8. [ ] Implementar benchmark B4: shortest-path-tree-1k
9. [ ] Implementar benchmark B5: pruning-beam-10k
10. [ ] Implementar benchmark B6: pruning-landmark-5k
11. [ ] Implementar benchmark B7: memory-profile

**Validacion**: Cada benchmark produce `BenchmarkResult` con status pass/fail

### T-1.3d — ReportExporter (1.5h)

**Archivo**: `scripts/benchmark.ts` (seccion ReportExporter)

**Tasklist**:
1. [ ] Implementar `ReportExporter.toJSON(report)`
2. [ ] Implementar `ReportExporter.toMarkdown(report)` — tabla con resultados
3. [ ] Implementar `ReportExporter.toHTML(report)` — pagina HTML con CSS inline
4. [ ] Implementar `ReportExporter.validateThresholds(report)` — chequea todos los thresholds

### T-1.3e — Tests (2h)

**Archivo**: `scripts/test-benchmark.ts`

**Tasklist**:
1. [ ] 8 tests unitarios de GraphGenerator (todos los tipos + edge cases)
2. [ ] 4 tests unitarios de Measurer (time, memory, cold/warm, error handling)
3. [ ] 12 tests de integracion (B1-B7 runs + metricas validas)
4. [ ] 6 tests E2E de ReportExporter (JSON, Markdown, HTML, thresholds, diff, failure)

**Total**: 30 tests

---

## 5. Tests (30 total)

| Suite | Tests | Cobertura | Archivo |
|-------|-------|-----------|---------|
| Unit: GraphGenerator | 8 | 95% | `test-benchmark.ts` |
| Unit: Measurer | 4 | 90% | `test-benchmark.ts` |
| Integration: Benchmarks | 12 | 85% | `test-benchmark.ts` |
| E2E: Report | 6 | 80% | `test-benchmark.ts` |
| **Total** | **30** | **85% avg** | |

### Test Matrix

#### Unit: GraphGenerator (8 tests)

| # | Test | Assert |
|---|------|--------|
| 1 | chain(0) | 0 nodos, 0 aristas |
| 2 | chain(100) | 100 nodos, 99 aristas |
| 3 | grid(1,1) | 1 nodo, 0 aristas |
| 4 | grid(10,10) | 100 nodos, 180 aristas |
| 5 | social(100, 3) | 100 nodos, grado promedio > 0 |
| 6 | random(100, 0) | 0 aristas |
| 7 | tree(5, 2) | 63 nodos, 62 aristas |
| 8 | knowledge(100, 5) | 100 nodos, >5 aristas |

#### Unit: Measurer (4 tests)

| # | Test | Assert |
|---|------|--------|
| 1 | time(fast-fn, 100) | timeMs > 0 |
| 2 | memory(fast-fn) | heapDelta >= 0 |
| 3 | measure(fast-fn, 10) | nodesPerMs > 0 |
| 4 | warmup(fast-fn, 10) | no error |

#### Integration: Benchmarks (12 tests)

| # | Test | Assert |
|---|------|--------|
| 1 | B1: bfs-chain-10k | nodesPerMs >= 2000 |
| 2 | B2: bfs-grid-100x100 | nodesPerMs >= 3000 |
| 3 | B3: bfs-social-5k | speedup >= 1.5x |
| 4 | B4: shortest-path-tree-1k | visited <= 30% |
| 5 | B5: pruning-beam-10k | pruningRatio >= 0.40 |
| 6 | B6: pruning-landmark-5k | pruningRatio >= 0.35 |
| 7 | B7: memory-profile-1k | CSR <= 50% Map |
| 8 | B7: memory-profile-10k | CSR <= 50% Map |
| 9 | B7: memory-profile-100k | CSR <= 50% Map |
| 10 | runAll produce 7 results | results.length === 7 |
| 11 | run(id invalido) → error | lanza error |
| 12 | define con id duplicado → error | lanza error |

#### E2E: Report (6 tests)

| # | Test | Assert |
|---|------|--------|
| 1 | toJSON produce JSON valido | JSON.parse(results) sin error |
| 2 | toMarkdown produce tabla | contiene "| Benchmark |" |
| 3 | toHTML produce pagina | contiene "<html>" |
| 4 | validateThresholds pass | true si todos los thresholds pasan |
| 5 | compare produce diff | diff.overallSpeedup > 0 |
| 6 | failure mode | reporte de fallos correcto |

---

## 6. Metricas de Validacion

### Thresholds de Rendimiento

| Benchmark | Metrica | Minimo | Target | Stretch |
|-----------|---------|--------|--------|---------|
| B1: bfs-chain-10k | nodes/ms | 2,000 | 3,000 | 5,000 |
| B2: bfs-grid-100x100 | nodes/ms | 3,000 | 5,000 | 8,000 |
| B3: bfs-social-5k | speedup vs Map | 1.5x | 2.0x | 3.0x |
| B4: shortest-path-tree | visited % | ≤30% | ≤20% | ≤10% |
| B5: pruning-beam-10k | pruning ratio | 40% | 50% | 65% |
| B6: pruning-landmark-5k | pruning ratio | 35% | 45% | 60% |
| B7: memory-profile | CSR vs Map | ≤50% | ≤35% | ≤25% |

### Quality Gates

```
[G1] Tests pasando
  □ 30 tests de benchmark suite
  □ 0 tests flaky (3 runs consecutivos)
  □ 0 regresiones en tests existentes (1215 tests)

[G2] Benchmarks pasando
  □ B1 nodes/ms >= 2000
  □ B2 nodes/ms >= 3000
  □ B3 speedup >= 1.5x
  □ B4 visited <= 30%
  □ B5 pruning ratio >= 40%
  □ B6 pruning ratio >= 35%
  □ B7 CSR memory <= 50% Map

[G3] Reporte generado
  □ JSON valido
  □ Markdown legible
  □ HTML navegable
  □ Thresholds validados

[G4] Git hygiene
  □ Commit con mensaje descriptivo
  □ Sin archivos generados en el repo
  □ Tag v2.1.0-alpha.1 creado
```

---

## 7. QA Gate

### Pre-requisitos

```
□ T-1.2 completado (70 tests, 0 failures)
□ CSR storage estable (77 tests, 0 failures)
□ Regression completa (1215 tests, 0 failures)
```

### Ejecucion

```bash
# 1. Benchmark suite completa
npx tsx scripts/benchmark.ts --suite all --output json

# 2. Tests de benchmark
npx tsx scripts/test-benchmark.ts

# 3. Validacion de thresholds
npx tsx scripts/benchmark.ts --validate

# 4. Regression completa
npx tsx scripts/run-tests.ts
```

### Rollback

| Escenario | Accion | Tiempo |
|-----------|--------|--------|
| B1 nodes/ms < 2000 | Aumentar nodos en chain, reducir iteraciones | < 15min |
| B3 speedup < 1.5x | Verificar warmup, ajustar JIT | < 30min |
| B5 pruning ratio < 40% | Aumentar beam size, ajustar densidad del grafo | < 30min |
| B7 memory ratio > 50% | Verificar memory leak en CSR, rebuild | < 1h |
| Tests fallan | Fix + re-run | < 30min |
| Regresion CSR existente | git checkout csr.ts + re-test | < 5min |