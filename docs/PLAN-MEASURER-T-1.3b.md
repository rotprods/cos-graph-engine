# PLAN DE EJECUCION — T-1.3b Measurer

> **Proyecto**: COS Graph Engine v2.1+ Fase 1.3
> **Dependencia**: T-1.3a (GraphGenerator) ✅ completado
> **Estado**: `time()` ✅ implementado. Restan: `memory()`, `measure()`, `warmup()`, edge cases, tests, docs
> **Target**: 4 metodos implementados, 8+ tests reales, 0 failures

---

## Indice

1. [Arquitectura](#1-arquitectura)
2. [Componentes](#2-componentes)
3. [T-1.3b-MEASURER-MEMORY](#3-t-13b-measurer-memory)
4. [T-1.3b-MEASURER-MEASURE](#4-t-13b-measurer-measure)
5. [T-1.3b-MEASURER-WARMUP](#5-t-13b-measurer-warmup)
6. [T-1.3b-EDGE-CASES](#6-t-13b-edge-cases)
7. [T-1.3b-TESTS](#7-t-13b-tests)
8. [T-1.3b-DOCS](#8-t-13b-docs)
9. [QA Gate](#9-qa-gate)

---

## 1. Arquitectura

```
Measurer
├── time(fn, iterations)    ✅ → { result, timeMs }
├── memory(fn)              ⏳ → { result, heapDelta }
├── measure(fn, iterations) ⏳ → Metrics
└── warmup(fn, iterations)  ⏳ → void
```

**Flujo de datos**:

```
time() + memory() ──→ measure() ──→ Metrics
                           │
                    nodesProcessed ──→ nodesPerMs
                    edgesProcessed ──→ pruningRatio
```

**Dependencias**:
- `time()` → `measure()` (reutiliza logica de timing)
- `memory()` → `measure()` (reutiliza logica de heap)
- `warmup()` → `time()` / `measure()` (pre-calienta antes de medir)
- `Metrics.nodesProcessed` / `edgesProcessed` → el caller debe proveer estos valores (el fn retorna un objeto con `{nodes, edges}` o se extraen del grafo)

---

## 2. Componentes

### 2.1 Metrics Interface

```typescript
export interface Metrics {
  timeMs: number;           // tiempo promedio por iteracion (ms)
  memoryBytes: number;      // delta de heap (bytes)
  heapUsedMB: number;       // memoryBytes convertido a MB
  nodesProcessed: number;   // nodos procesados en la operacion
  edgesProcessed: number;   // aristas procesadas
  nodesPerMs: number;       // throughput = nodesProcessed / timeMs
  pruningRatio: number;     // ratio de poda (0 si no aplica)
}
```

### 2.2 Measurer API

```typescript
class Measurer {
  static time<T>(fn: () => T, iterations: number): { result: T; timeMs: number }
  // ✅ Implementado. Promedio de N ejecuciones con performance.now().

  static memory<T>(fn: () => T): { result: T; heapDelta: number }
  // ⏳ Mide heap delta via process.memoryUsage().heapUsed.
  //   Ejecuta fn, mide heap antes/despues, retorna delta en bytes.

  static measure<T>(fn: () => T, iterations: number): Metrics
  // ⏳ Combina time() + memory() en una sola metrica.
  //   Extrae nodesProcessed/edgesProcessed del resultado de fn
  //   (espera que fn retorne un objeto con la estructura
  //    { nodes: number, edges: number } o similar).

  static warmup<T>(fn: () => T, iterations: number): void
  // ⏳ Ejecuta fn N veces sin medir. Para JIT warmup
  //   antes de llamar a time() o measure().
}
```

### 2.3 Casos Borde Cross-Cutting

| Caso | Metodo | Comportamiento esperado |
|------|--------|------------------------|
| `iterations=0` | `time()`, `measure()` | `throw Error('iterations must be >= 1')` |
| `iterations=0` | `warmup()` | No-op (0 iteraciones = nada que hacer) |
| `fn` lanza excepcion | Todos | Propagacion natural (no catch interno) |
| GC intermedio | `memory()` | `heapDelta` clamp a 0 si negativo |
| Cold cache | `time()` | Cold run explicito antes del loop medido |
| fn no retorna objeto | `measure()` | `nodesProcessed=0, edgesProcessed=0, pruningRatio=0` |
| fn retorna CSRGraph | `measure()` | Extraer `nodeCount()` y `edgeCount()` |
| Grafo vacio | `measure()` | `nodesPerMs=0` (division por zero safe) |

---

## 3. T-1.3b-MEASURER-MEMORY

### 3.1 Especificacion

```typescript
static memory<T>(fn: () => T): { result: T; heapDelta: number }
```

**Algoritmo**:
1. Tomar snapshot de `process.memoryUsage().heapUsed` (antes)
2. Ejecutar `fn()`
3. Forzar GC: `global.gc?.()` si disponible (Node --expose-gc)
4. Tomar snapshot de `process.memoryUsage().heapUsed` (despues)
5. `heapDelta = Math.max(0, despues - antes)` (clamp a 0)
6. Retornar `{ result, heapDelta }`

**Casos borde**:
- `heapDelta` negativo por GC intermedio → `Math.max(0, delta)`
- Sin `--expose-gc` → no forzar GC, solo medir delta raw
- fn que no aloca memoria → delta ~0 (pero >= 0)
- fn que aloca mucha memoria → delta positivo

### 3.2 Implementacion

```typescript
static memory<T>(fn: () => T): { result: T; heapDelta: number } {
  // Force GC if available
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc();
  }

  const before = process.memoryUsage().heapUsed;
  const result = fn();
  const after = process.memoryUsage().heapUsed;

  const heapDelta = Math.max(0, after - before);
  return { result, heapDelta };
}
```

### 3.3 Tests

| # | Test | Assert |
|---|------|--------|
| 1 | memory(() => 42) | heapDelta >= 0 |
| 2 | memory(() => new Array(1e6).fill(0)) | heapDelta > 1000 bytes |
| 3 | memory(() => {}) | heapDelta >= 0 (cerca de 0) |
| 4 | Llamada repetida 3x | heapDelta siempre >= 0 |

---

## 4. T-1.3b-MEASURER-MEASURE

### 4.1 Especificacion

```typescript
static measure<T>(fn: () => T, iterations: number): Metrics
```

**Algoritmo**:
1. Validar `iterations >= 1`
2. Cold run de `fn()`
3. Tomar snapshot de memoria antes
4. Ejecutar loop de `iterations` veces midiendo con `performance.now()`
5. Tomar snapshot de memoria despues
6. Extraer metadatos del resultado de `fn()`:
   - Si `result` es `CSRGraph` → `nodesProcessed = result.nodeCount()`, `edgesProcessed = result.edgeCount()`
   - Si `result` es objeto con `{ nodes, edges }` → usar esos valores
   - Sino → `nodesProcessed = 0, edgesProcessed = 0`
7. Calcular metricas derivadas:
   - `timeMs = totalTime / iterations`
   - `memoryBytes = Math.max(0, after - before)`
   - `heapUsedMB = memoryBytes / (1024 * 1024)`
   - `nodesPerMs = timeMs > 0 ? nodesProcessed / timeMs : 0`
   - `pruningRatio = 0` (lo setea el caller o el benchmark)
8. Retornar `Metrics`

### 4.2 Metadatos del Resultado

```typescript
type MeasurableResult = {
  nodes?: number;
  edges?: number;
  nodeCount?: () => number;
  edgeCount?: () => number;
  [key: string]: unknown;
};
```

**Logica de extraccion**:
```typescript
function extractMetadata(result: unknown): { nodes: number; edges: number } {
  if (!result || typeof result !== 'object') return { nodes: 0, edges: 0 };
  const r = result as MeasurableResult;
  // CSRGraph duck-typing
  if (typeof r.nodeCount === 'function' && typeof r.edgeCount === 'function') {
    return { nodes: r.nodeCount(), edges: r.edgeCount() };
  }
  // Plain object with nodes/edges
  return {
    nodes: typeof r.nodes === 'number' ? r.nodes : 0,
    edges: typeof r.edges === 'number' ? r.edges : 0,
  };
}
```

### 4.3 Tests

| # | Test | Assert |
|---|------|--------|
| 1 | measure(() => 42, 10) | Metrics con timeMs > 0, nodes=0, edges=0 |
| 2 | measure(() => CSRGraph, 10) | nodes=0, edges=0 (grafo vacio) |
| 3 | measure(() => chain(100), 10) | nodes=100, edges=99 |
| 4 | measure(() => grid(10,10), 10) | nodes=100, edges=180, nodesPerMs > 0 |

---

## 5. T-1.3b-MEASURER-WARMUP

### 5.1 Especificacion

```typescript
static warmup<T>(fn: () => T, iterations: number): void
```

**Algoritmo**:
1. Si `iterations < 1` → return (no-op)
2. Loop de `iterations` veces ejecutando `fn()`
3. No mide nada, no retorna nada

**Proposito**: JIT warmup antes de medir. Llamar antes de `time()` o `measure()` para evitar cold-start penalty.

### 5.2 Tests

| # | Test | Assert |
|---|------|--------|
| 1 | warmup(() => 42, 0) | No-op, no error |
| 2 | warmup(() => 42, 100) | No error |
| 3 | warmup(() => { throw new Error('x'); }, 1) | Error propagado |
| 4 | warmup + time: time despues de warmup | Mas rapido que sin warmup |

---

## 6. T-1.3b-EDGE-CASES

### 6.1 Cross-Cutting Edge Cases

| # | Escenario | Metodo | Assert |
|---|-----------|--------|--------|
| 1 | iterations=0 | `time()` | `throw Error` |
| 2 | iterations=0 | `measure()` | `throw Error` |
| 3 | iterations=0 | `warmup()` | No-op |
| 4 | fn lanza exception | `time()` | Propaga error |
| 5 | fn lanza exception | `memory()` | Propaga error |
| 6 | fn lanza exception | `measure()` | Propaga error |
| 7 | GC intermedio, heap negativo | `memory()` | Clamp a 0 |
| 8 | fn no retorna objeto | `measure()` | nodes=0, edges=0 |
| 9 | Grafo vacio en measure | `measure()` | nodesPerMs=0 (no division by zero) |
| 10 | iterations=1 | `time()` | Funciona correctamente (1 iteracion) |

### 6.2 Tests de Edge Cases

| # | Test | Metodo | Assert |
|---|------|--------|--------|
| 1 | time(() => 42, 0) | `time()` | `assertThrows` |
| 2 | measure(() => 42, 0) | `measure()` | `assertThrows` |
| 3 | warmup(() => 42, 0) | `warmup()` | No error |
| 4 | time(() => { throw new Error('x'); }, 1) | `time()` | `assertThrows` |
| 5 | memory(() => { throw new Error('x'); }) | `memory()` | `assertThrows` |
| 6 | measure(() => { throw new Error('x'); }, 1) | `measure()` | `assertThrows` |
| 7 | time(() => 42, 1) | `time()` | timeMs > 0, result = 42 |

---

## 7. T-1.3b-TESTS

### 7.1 Test File: `scripts/test-benchmark.ts`

**Seccion Measurer actual** (tests 9-12):

```typescript
// Test 9:  time()        ✅ 3 asserts reales (implementado)
// Test 10: memory()      ⏳ assertThrows → reemplazar con 3 asserts reales
// Test 11: measure()     ⏳ assertThrows → reemplazar con 4 asserts reales
// Test 12: warmup()      ⏳ assertThrows → reemplazar con 2 asserts reales
```

**Nuevos tests a agregar**:

```typescript
// Test 13: Edge cases
// Test 14: Smoke: time(chain-1000) > 0ms
// Test 15: Smoke: memory(grid-100x100) > 0 bytes
// Test 16: Smoke: measure(chain-10000, 5) produce Metrics completas
// Test 17: Integration: warmup + time combinados
```

### 7.2 Test Matrix Final

| # | Test | Tipo | Status |
|---|------|------|--------|
| 9 | time(() => 42, 100) | Unit | ✅ |
| 10 | memory(() => 42) | Unit | ⏳ |
| 11 | measure(() => 42, 10) | Unit | ⏳ |
| 12 | warmup(() => 42, 10) | Unit | ⏳ |
| 13 | time(() => 42, 0) → error | Edge | ⏳ |
| 14 | memory(() => new Array(1e6)) > 1000 | Edge | ⏳ |
| 15 | measure(() => chain(100), 10) | Edge | ⏳ |
| 16 | warmup(() => 42, 0) → no-op | Edge | ⏳ |
| 17 | Smoke: chain(1000) time > 0ms | Smoke | ⏳ |
| 18 | Smoke: grid(100,100) memory > 0 | Smoke | ⏳ |
| 19 | Smoke: measure() Metrics completas | Smoke | ⏳ |
| 20 | Integration: warmup + time | Integration | ⏳ |

**Total**: 12 tests (4 existentes + 6 edge + 3 smoke + 1 integration)

---

## 8. T-1.3b-DOCS

### 8.1 Archivo: `docs/API-BENCHMARK.md`

**Contenido**:

```markdown
# Benchmark API — COS Graph Engine v2.1

## GraphGenerator

6 generadores sinteticos para benchmarks.

### chain(n)
Cadena lineal de n nodos, n-1 aristas.
- Input: `n: number` (>= 0)
- Output: `CSRGraph`
- Nodos: `n0`, `n1`, ..., `n{n-1}`
- Aristas: `ni → n{i+1}`

### grid(rows, cols)
Grid 2D con vecinos cardinales (right, down).
- Input: `rows: number` (> 0), `cols: number` (> 0)
- Output: `CSRGraph`
- Nodos: `r{row}_c{col}`
- Aristas: `(r,c) → (r,c+1)`, `(r,c) → (r+1,c)`
- Total edges: `rows*(cols-1) + (rows-1)*cols`

### social(n, degree)
Small-world (Watts-Strogatz) con rewiring 0.1.
- Input: `n: number` (> 0), `degree: number` (even, > 0)
- Output: `CSRGraph`
- Nodos: `s0` ... `s{n-1}`
- Grafo no dirigido (edge bidireccional)

### random(n, edgeProb)
Erdos-Renyi G(n,p).
- Input: `n: number` (>= 0), `edgeProb: number` ([0, 1])
- Output: `CSRGraph`
- Nodos: `r0` ... `r{n-1}`
- Aristas dirigidas, ~ n*(n-1)/2 * edgeProb esperadas

### tree(depth, branching)
Arbol balanceado.
- Input: `depth: number` (>= 0), `branching: number` (> 0)
- Output: `CSRGraph`
- Nodos: `t0` ... `t{T-1}`, T = (branching^{depth+1} - 1)/(branching - 1)
- Aristas: T-1

### knowledge(n, clusters)
Clusters jerarquicos.
- Input: `n: number` (> 0), `clusters: number` (> 0)
- Output: `CSRGraph`
- Intra-cluster density: 0.3
- Inter-cluster density: 0.01

## Measurer

4 metodos para medir rendimiento.

### time(fn, iterations)
Ejecuta fn N veces, retorna promedio por iteracion.
- Input: `fn: () => T`, `iterations: number` (>= 1)
- Output: `{ result: T, timeMs: number }`
- Incluye cold run antes del loop medido
- Usa `performance.now()` para precision sub-ms

### memory(fn)
Ejecuta fn, mide delta de heap.
- Input: `fn: () => T`
- Output: `{ result: T, heapDelta: number }`
- Usa `process.memoryUsage().heapUsed`
- Clamp a 0 si delta negativo (GC intermedio)
- Force GC si `--expose-gc` activo

### measure(fn, iterations)
Combina time + memory + metadatos en una sola metrica.
- Input: `fn: () => T | CSRGraph`, `iterations: number` (>= 1)
- Output: `Metrics`
- Extrae nodesProcessed/edgesProcessed del resultado
- Calcula nodesPerMs, heapUsedMB

### warmup(fn, iterations)
JIT warmup sin medir.
- Input: `fn: () => T`, `iterations: number` (>= 0)
- Output: `void`
- iterations=0 → no-op
```

---

## 9. QA Gate

### Pre-requisitos

```
□ T-1.3a GraphGenerator completado (8 tests, 0 failures)
□ Measurer.time() implementado (3 asserts, 0 failures)
```

### Ejecucion

```bash
# 1. Tests de Measurer
npx tsx scripts/test-benchmark.ts

# 2. Regression completa
npx tsx scripts/run-tests.ts

# 3. API docs generadas
cat docs/API-BENCHMARK.md | head -5
```

### Quality Gates

```
[G1] Tests pasando
  □ 12 tests de Measurer (incluyendo edge cases)
  □ 0 tests flaky (3 runs consecutivos)
  □ 0 regresiones (348+ tests existentes)

[G2] Funcionalidad
  □ time() produce timeMs > 0 para fn rapida
  □ memory() produce heapDelta >= 0
  □ measure() produce Metrics completas con nodes/edges
  □ warmup() no-op con iterations=0

[G3] Casos borde
  □ iterations=0 → error en time() y measure()
  □ fn exception → propagada
  □ heap negativo → clamp a 0
  □ fn no-objeto → nodes=0, edges=0

[G4] Documentacion
  □ docs/API-BENCHMARK.md generado
  □ GraphGenerator API documentada (6 metodos)
  □ Measurer API documentada (4 metodos)
```

### Rollback

| Escenario | Accion | Tiempo |
|-----------|--------|--------|
| memory() heapDelta negativo | Verificar clamp Math.max(0, delta) | < 5min |
| measure() nodesPerMs = NaN | Division por zero: check timeMs > 0 | < 5min |
| warmup() lento con iterations grandes | Reducir iterations por defecto | < 2min |
| Tests flaky por GC | Aumentar tolerancia, reducir allocs | < 15min |
| Docs incompletas | Agregar metodos faltantes | < 10min |