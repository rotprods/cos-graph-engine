# PLAN DE EJECUCION — COS Graph Engine v2.1+ Fase 1

> **Repo**: git commit ce3f139 | **Branch**: main
> **Inicio**: 2026-07-27 | **Deadline**: 2026-07-31
> **Estado actual**: 1145 tests, 0 failures. T-1.1 CSR Storage completado.

---

## Indice

1. [Estructura de Fases](#1-estructura-de-fases)
2. [Fase 1.2 — Bidirectional Pruning](#2-fase-12--bidirectional-pruning)
3. [Fase 1.3 — Benchmark Suite](#3-fase-13--benchmark-suite)
4. [QA Gate — Metricas de Validacion](#4-qa-gate--metricas-de-validacion)
5. [Rollback & Contingencia](#5-rollback--contingencia)

---

## 1. Estructura de Fases

```
Fase 1: Performance Foundations
├── T-1.1 CSR Storage       ✅ 77 tests
├── T-1.2 Pruning           🔄 68 tests target (este plan)
├── T-1.3 Benchmark Suite   ⏳ 30 tests target
└── QA Gate                 ⏳ Validacion final
```

**Dependencias**: T-1.2 -> T-1.3 (benchmarks miden pruning vs baseline)

---

## 2. Fase 1.2 — Bidirectional Pruning

### 2.1 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    PruningStrategy                       │
│  shouldPrune(node, depth, state): boolean                │
│  onExpand?(node, depth, state): void                     │
│  onTargetFound?(node, state): void                       │
│  reset(): void                                           │
└─────────────────────────────────────────────────────────┘
                           │
                           │ implements
                           ▼
┌─────────────────────────────────────────────────────────┐
│  MaxDepth  │  Visited  │  TargetDir  │  CostBound      │
│  Beam      │  Landmark │  EarlyExit                     │
└─────────────────────────────────────────────────────────┘
                           │
                           │ orchestrated by
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    PruningExecutor                       │
│  shouldPrune() → pipeline de estrategias en orden        │
│  onExpand() → notifica a todas                          │
│  onTargetFound() → notifica a todas                     │
│  reset() → resetea todas                                │
│  result(): PruningResult                                │
└─────────────────────────────────────────────────────────┘
                           │
                           │ consumed by
                           ▼
┌─────────────────────────────────────────────────────────┐
│  CSRGraph.bfsWithPruning()                               │
│  CSRGraph.dfsWithPruning()                               │
│  CSRGraph.bidirectionalBFSWithPruning()                  │
└─────────────────────────────────────────────────────────┘
                           │
                           │ mixed into
                           ▼
┌─────────────────────────────────────────────────────────┐
│  PrunableGraphMixin → L0..L19                           │
│  traverse(source, {strategies, maxDepth, trace})         │
│  shortestPath(s, t, {strategies, maxDepth})              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Sub-tickets

#### T-1.2a — Core Pruning Engine (4-5h)

**Archivo**: `packages/graph/src/pruning.ts`

**Interfaces**:

```typescript
export interface PruningStrategy {
  readonly name: string;
  shouldPrune(nodeId: string, depth: number, state: Readonly<PruningState>): boolean;
  onExpand?(nodeId: string, depth: number, state: PruningState): void;
  onTargetFound?(nodeId: string, state: PruningState): void;
  reset(): void;
}

export interface PruningState {
  visited: Set<string>;
  depth: number;
  maxDepth: number;
  target?: string;
  costSoFar: Map<string, number>;
  currentNode: string;
  source: string;
  bidirectional: boolean;
  metadata: Map<string, unknown>;
}

export interface PruningResult {
  totalNodesConsidered: number;
  expandedNodes: number;
  prunedNodes: number;
  prunedBy: Map<string, number>;
  pruningRatio: number;
  durationMs: number;
  strategiesUsed: string[];
}
```

**Clase**:

```typescript
export class PruningExecutor {
  constructor(strategies: PruningStrategy[]);
  shouldPrune(nodeId: string, depth: number, state: PruningState): boolean;
  onExpand(nodeId: string, depth: number, state: PruningState): void;
  onTargetFound(nodeId: string, state: PruningState): void;
  reset(): void;
  result(): PruningResult;
}
```

**Validacion**:
- Pipeline ejecuta estrategias en orden, cortocircuito en primer `true`
- `reset()` limpia estado interno de todas las estrategias
- `PruningResult` reporta metricas de cada estrategia individual

#### T-1.2b — Estrategias Built-in (4-5h)

**Archivo**: `packages/graph/src/pruning.ts` (mismo archivo)

| Estrategia | Props | Metodo | Complejidad |
|------------|-------|--------|-------------|
| `MaxDepthPruning` | maxDepth | `shouldPrune` si depth >= maxDepth | O(1) |
| `VisitedPruning` | visited Set | `shouldPrune` si nodeId en visited. `onExpand` agrega a visited | O(1) |
| `TargetDirectionPruning` | graph, ancestors Map | `shouldPrune` si target no es alcanzable. Precomputa ancestors via reverse BFS limitado (maxDepth 5) | O(N) precompute |
| `CostBoundPruning` | bestPath Map | `shouldPrune` si `costSoFar.get(nodeId) > bestPath` | O(1) |
| `BeamPruning` | k, candidates array | `onExpand` recolecta candidatos. Solo expande top-K por depth | O(K log K) |
| `LandmarkPruning` | landmarks[], distances[][] | `shouldPrune` si distancia estimada al target > mejor conocido + margen. L landmarks precomputados | O(L * N) precompute |
| `EarlyExitPruning` | target, found flag | `onTargetFound` marca flag. `shouldPrune` despues de encontrado | O(1) |

**Validacion por estrategia**:

| Estrategia | Tests | Casos borde |
|------------|-------|-------------|
| MaxDepthPruning | 5 | depth=0, depth=maxDepth, depth=-1 (sin limite) |
| VisitedPruning | 5 | reset entre runs, grafo vacio, ciclico |
| TargetDirection | 8 | alcanzable, no alcanzable, self-loop, grafo vacio |
| CostBound | 6 | weighted, unweighted, cota exacta, supera cota |
| Beam | 6 | K=1, K=5, K=100, K>N, empates |
| Landmark | 6 | 1 landmark, 5 landmarks, precision, grafo vacio |
| EarlyExit | 4 | encontrado, no encontrado, target=source |

**Total**: 40 tests unitarios

#### T-1.2c — Integracion CSRGraph (2-3h)

**Archivo**: `packages/graph/src/csr.ts` (nuevos metodos en CSRGraph)

```typescript
export class CSRGraph {
  bfsWithPruning(
    source: string,
    strategies: PruningStrategy[],
    maxDepth?: number
  ): { nodes: Array<{ id: string; depth: number }>; result: PruningResult }

  dfsWithPruning(
    source: string,
    strategies: PruningStrategy[],
    maxDepth?: number
  ): { nodes: Array<{ id: string; depth: number }>; result: PruningResult }

  bidirectionalBFSWithPruning(
    source: string,
    target: string,
    strategies: PruningStrategy[],
    maxDepth?: number
  ): { path: Array<{ id: string; depth: number }> | null; result: PruningResult }
}
```

**Validacion**: 10 tests de integracion
- bfsWithPruning con MaxDepth(3) visita max 3 niveles
- bfsWithPruning con EarlyExit corta al encontrar target
- bidirectionalBFSWithPruning con Beam(2) + EarlyExit
- dfsWithPruning con Visited no revisita
- Combinacion de estrategias (MaxDepth + Visited + EarlyExit)
- PruningResult contiene metricas correctas
- PruningRatio calculado correctamente
- Sin estrategias = traversal completa sin poda
- maxDepth=-1 = sin limite
- Grafo no conectado devuelve path null

#### T-1.2d — Integracion Niveles L0-L19 (3-4h)

**Archivo**: `packages/graph/src/prunable-mixin.ts`

```typescript
export class PrunableGraphMixin {
  traverse(
    source: string,
    options?: {
      strategies?: PruningStrategy[];
      maxDepth?: number;
      trace?: boolean;
    }
  ): TraversalResult

  shortestPath(
    source: string,
    target: string,
    options?: {
      strategies?: PruningStrategy[];
      maxDepth?: number;
    }
  ): PathResult | null
}

export interface TraversalResult {
  nodes: Array<{ id: string; depth: number }>;
  result: PruningResult;
  level: string;
  timestamp: number;
}

export interface PathResult {
  path: Array<{ id: string; depth: number }>;
  result: PruningResult;
  level: string;
  timestamp: number;
}
```

**Niveles con pruning custom**:

| Nivel | Pruning Default | Razon |
|-------|----------------|-------|
| L0 Visual | Beam(50) | Solo top vistas relevantes |
| L3 Dependency | TargetDirection | Dependencia especifica |
| L8 Knowledge | Landmark(5) + EarlyExit | Grafos densos, caminos rapidos |
| L11 GraphRAG | CostBound + Beam(20) | RAG necesita menor costo |
| L13 Agent | EarlyExit + Visited | Primer path valido basta |
| L15 Workflow | Beam(100) + CostBound | Mejor path ponderado |

**Validacion**: 6 tests de integracion (L0, L3, L8, L11, L13, L15)

#### T-1.2e — Tests Completos (3-4h)

| Suite | Tests | Comando | Min cobertura |
|-------|-------|---------|---------------|
| Unit: Pruning | 40 | npx tsx scripts/test-pruning.ts | 95% lines |
| Integ: CSR+Pruning | 10 | npx tsx scripts/test-csr.ts (pruning addons) | 90% lines |
| Integ: Niveles | 6 | npx tsx scripts/test-levels-pruning.ts | 85% lines |
| E2E: Path queries | 4 | npx tsx scripts/test-e2e-pruning.ts | 80% lines |
| Regression | 1068+68 | npx tsx scripts/run-tests.ts | 100% pass |

**Total**: 68 tests nuevos, 1136 total

**Metricas de validacion**:
- 0 tests flaky (3 runs consecutivos)
- Coverage > 85% en archivos nuevos
- Tiempo de ejecucion < 15s
- No regresiones en tests existentes

---

## 3. Fase 1.3 — Benchmark Suite

### 3.1 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    BenchmarkRunner                       │
│  run(suite: BenchmarkSuite): BenchmarkReport             │
│  runAll(): BenchmarkReport[]                             │
│  compare(baseline: Report, current: Report): DiffReport  │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────────┐ ┌────────────┐ ┌──────────────┐
│  GraphGenerator  │ │ Measurer   │ │ ReportExporter│
│  chain, grid,    │ │ time,      │ │ JSON, HTML,   │
│  social, random  │ │ memory,    │ │ markdown      │
└──────────────────┘ │ nodes      │ └──────────────┘
                     └────────────┘
```

### 3.2 Benchmarks

| ID | Benchmark | Grafo | Metrica Target |
|----|-----------|-------|----------------|
| B1 | `bfs-chain` | Cadena 10K nodos | nodes/ms >= 2000 |
| B2 | `bfs-grid` | Grid 100x100 | nodes/ms >= 3000 |
| B3 | `bfs-social` | Small world 5K, d=20 | speedup vs Map >= 1.5x |
| B4 | `shortest-path` | Arbol 1K deep | nodes visited <= 30% |
| B5 | `pruning-beam` | Random 10K, beam K=10..100 | pruning ratio >= 40% |
| B6 | `pruning-landmark` | Knowledge 5K, L=5..20 | pruning ratio >= 35% |
| B7 | `memory-profile` | N=1K..100K | CSR <= 50% Map memory |

### 3.3 Output

```json
{
  "suite": "bfs-chain-10k",
  "baseline": { "nodesPerMs": 1420, "memoryMB": 4.2 },
  "current":  { "nodesPerMs": 2840, "memoryMB": 2.1 },
  "speedup": 2.0,
  "memoryReduction": "50%",
  "pass": true
}
```

### 3.4 Tests

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| Unit: GraphGenerator | 8 | chain, grid, social, random, empty |
| Unit: Measurer | 4 | time, memory, cold/warm |
| Integration: Benchmarks | 12 | B1-B7 runs + validation |
| E2E: Report | 6 | JSON, HTML, diff, pass/fail |

**Total**: 30 tests

---

## 4. QA Gate — Metricas de Validacion

### 4.1 Gates de Calidad

Cada ticket tiene su propio gate. Al final de la Fase 1 se ejecuta el **QA Gate final**:

```
QA GATE FASE 1
═══════════════════════════════════════════

[G1] Tests pasando
  □ 100% tests suite completa (1136+ tests)
  □ 0 tests flaky (3 runs)
  □ Coverage > 85% en packages/graph/src/pruning.ts
  □ Coverage > 85% en packages/graph/src/csr.ts (nuevos metodos)

[G2] Benchmark validado
  □ BFS speedup >= 1.5x (CSR+pruning vs Map baseline)
  □ Memoria CSR < 50% de Map en grafos sparse (grado < 5)
  □ Pruning ratio >= 30% en path queries

[G3] Sin regresiones
  □ Todos los tests de v2.0 pasan (1068 tests)
  □ Website compila sin errores
  □ API Reference genera sin warnings

[G4] Git hygiene
  □ Commit con mensaje descriptivo
  □ Sin archivos generados en el repo
  □ Tag v2.1.0-alpha.1 creado
```

### 4.2 Reporte de Coverage

```bash
# Ejecutar coverage
npx c8 --reporter=text --reporter=lcov --include="packages/graph/src/!(index).ts" \
  npx tsx scripts/run-tests.ts

# Coverage target por archivo:
# packages/graph/src/pruning.ts:      > 90%
# packages/graph/src/csr.ts:         > 85% (nuevos metodos)
# packages/graph/src/ (resto):       > 80%
# packages/*/src/ (otros):           > 75%
```

### 4.3 Benchmark Validation

```bash
# Ejecutar benchmark suite
npx tsx scripts/benchmark.ts --suite all --output json

# Validar contra thresholds
npx tsx scripts/validate-benchmarks.ts --threshold 1.5x
```

---

## 5. Rollback & Contingencia

| Escenario | Accion | Tiempo |
|-----------|--------|--------|
| Tests fallan en pruning unit | Fix + re-run | < 30min |
| Regresion en CSR existente | git checkout csr.ts + re-test | < 5min |
| Benchmark speedup < 1.5x | Optimizar beam size, landmark count | < 2h |
| Coverage < 85% | Agregar tests faltantes | < 1h |
| Website no compila | Revisar imports de CSR desde landing | < 30min |
| Embedded git repo corrupto | Restore desde .git | < 5min |

**Puntos de control**:
- Checkpoint 1: T-1.2a + T-1.2b completados (40 unit tests pasando)
- Checkpoint 2: T-1.2c + T-1.2d completados (56 tests pasando)
- Checkpoint 3: T-1.2e completado (68 tests, full regression 1145+68 pasando)
- Checkpoint 4: QA Gate — benchmarks, coverage, git tag
