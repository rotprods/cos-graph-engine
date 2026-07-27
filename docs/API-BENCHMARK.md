# Benchmark API — COS Graph Engine v2.1

API de los componentes `GraphGenerator`, `Measurer`, `BenchmarkRunner` y `ReportExporter` para la suite de benchmarks.

---

## GraphGenerator

6 generadores de grafos sinteticos para benchmarks de rendimiento.

### `chain(n)`

Cadena lineal de n nodos, n-1 aristas.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | `number` | Numero de nodos (>= 0) |

**Output**: `CSRGraph` con nodos `n0`...`n{n-1}`, aristas `ni → n{i+1}`

**Ejemplo**:
```typescript
const g = GraphGenerator.chain(10000);
g.nodeCount(); // 10000
g.edgeCount(); // 9999
g.bfs('n0'); // 10000 nodos visitados
```

### `grid(rows, cols)`

Grid 2D con vecinos cardinales (right, down).

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `rows` | `number` | Filas (> 0) |
| `cols` | `number` | Columnas (> 0) |

**Output**: `CSRGraph` con nodos `r{row}_c{col}`, aristas `(r,c) → (r,c+1)` y `(r,c) → (r+1,c)`

**Total edges**: `rows*(cols-1) + (rows-1)*cols`

**Ejemplo**:
```typescript
const g = GraphGenerator.grid(100, 100);
g.nodeCount(); // 10000
g.edgeCount(); // 19800
```

### `social(n, degree)`

Small-world (Watts-Strogatz) con rewiring probability 0.1.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | `number` | Numero de nodos (> 0) |
| `degree` | `number` | Grado de cada nodo (debe ser par) |

**Output**: `CSRGraph` no dirigido con nodos `s0`...`s{n-1}`

**Algoritmo**: Ring lattice inicial, luego rewiring de cada arista con probabilidad 0.1.

### `random(n, edgeProb)`

Erdos-Renyi G(n,p).

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | `number` | Numero de nodos (>= 0) |
| `edgeProb` | `number` | Probabilidad de arista entre cada par ([0, 1]) |

**Output**: `CSRGraph` dirigido con `~n*(n-1)/2*edgeProb` aristas esperadas.

### `tree(depth, branching)`

Arbol balanceado.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `depth` | `number` | Profundidad del arbol (>= 0) |
| `branching` | `number` | Factor de ramificacion (> 0) |

**Output**: `CSRGraph` con `(branching^{depth+1} - 1)/(branching - 1)` nodos.

**Ejemplo**:
```typescript
const g = GraphGenerator.tree(10, 3); // ~88573 nodos
g.edgeCount(); // g.nodeCount() - 1
```

### `knowledge(n, clusters)`

Grafo con estructura de clusters jerarquicos.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `n` | `number` | Numero de nodos (> 0) |
| `clusters` | `number` | Numero de clusters (> 0) |

**Output**: `CSRGraph` con alta densidad intra-cluster (0.3) y baja inter-cluster (0.01).

---

## Measurer

4 metodos para medir rendimiento de operaciones.

### `time(fn, iterations)`

Ejecuta `fn()` N veces y retorna el tiempo promedio por iteracion.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `fn` | `() => T` | Funcion a medir |
| `iterations` | `number` | Numero de iteraciones (>= 1) |

**Returns**: `{ result: T, timeMs: number }`

- Incluye cold run (JIT warmup) antes del loop medido
- Usa `performance.now()` para precision sub-milisegundo
- Excepcion si `iterations < 1`

**Ejemplo**:
```typescript
const { result, timeMs } = Measurer.time(() => graph.bfs('n0'), 100);
console.log(`Promedio: ${timeMs.toFixed(3)}ms por BFS`);
```

### `memory(fn)`

Ejecuta `fn()` y mide el delta de heap.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `fn` | `() => T` | Funcion a medir |

**Returns**: `{ result: T, heapDelta: number }` (delta en bytes)

- Fuerza GC via `global.gc()` si `--expose-gc` esta activo
- Clamp a 0 si el delta es negativo (GC intermedio)
- Usa `process.memoryUsage().heapUsed`

**Ejemplo**:
```typescript
const { heapDelta } = Measurer.memory(() => new CSRGraph());
console.log(`Memoria: ${(heapDelta / 1024).toFixed(1)} KB`);
```

### `measure(fn, iterations)`

Combina `time()` + `memory()` + extraccion de metadatos en una sola metrica.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `fn` | `() => T` | Funcion a medir |
| `iterations` | `number` | Numero de iteraciones (>= 1) |

**Returns**: `Metrics`

```typescript
interface Metrics {
  timeMs: number;           // tiempo promedio por iteracion
  memoryBytes: number;      // delta de heap (bytes)
  heapUsedMB: number;       // memoryBytes en megabytes
  nodesProcessed: number;   // nodos procesados (extraido de fn())
  edgesProcessed: number;   // aristas procesadas
  nodesPerMs: number;       // throughput = nodes / timeMs
  pruningRatio: number;     // ratio de poda (default 0)
}
```

- El resultado de `fn()` se analiza via duck-typing:
  - Si tiene `nodeCount()`/`edgeCount()` → CSRGraph
  - Si tiene `nodes`/`edges` → plain object
  - Sino → 0

**Ejemplo**:
```typescript
const m = Measurer.measure(() => GraphGenerator.chain(10000), 5);
console.log(`Throughput: ${m.nodesPerMs.toFixed(0)} nodes/ms`);
```

### `warmup(fn, iterations)`

JIT warmup: ejecuta `fn()` N veces sin medir.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `fn` | `() => T` | Funcion para warmup |
| `iterations` | `number` | Iteraciones (>= 0, 0 = no-op) |

**Returns**: `void`

**Ejemplo**:
```typescript
Measurer.warmup(() => graph.bfs('n0'), 1000); // JIT warmup
const { timeMs } = Measurer.time(() => graph.bfs('n0'), 100); // cold penalty eliminado
```

---

## BenchmarkRunner

Orquesta la ejecucion de benchmarks.

### `define(benchmark)`

Registra un benchmark en el runner.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `benchmark` | `Benchmark` | Definicion del benchmark |

```typescript
interface Benchmark {
  id: string;                    // identificador unico (e.g. 'B1')
  name: string;                  // nombre legible
  description: string;           // descripcion
  graph: CSRGraph;               // grafo para el benchmark
  setup: () => void;             // setup antes de medir
  run: (graph: CSRGraph) => unknown; // operacion a medir
  baseline: { nodesPerMs: number; memoryMB: number }; // baseline v2.0
  threshold: Partial<{ speedup, maxMemoryMB, minPruningRatio, maxNodesVisitedPercent, maxMemoryRatio }>;
}
```

- Lanza error si `id` duplicado
- `threshold.speedup`: minimo speedup requerido
- `threshold.maxMemoryMB`: maximo consumo de memoria

### `run(id)`

Ejecuta un benchmark registrado.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `id` | `string` | Identificador del benchmark |

**Returns**: `BenchmarkResult`

```typescript
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
```

### `runAll()`

Ejecuta todos los benchmarks registrados.

**Returns**: `BenchmarkResult[]`

### `compare(results, baseline)`

Calcula diff report comparando resultados contra un baseline.

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `results` | `BenchmarkResult[]` | Resultados de benchmarks |
| `baseline` | `{ nodesPerMs: number }` | Baseline de referencia |

**Returns**: `DiffReport`

```typescript
interface DiffReport {
  results: BenchmarkResult[];
  overallSpeedup: number;
  passCount: number;
  failCount: number;
  summary: string;
}
```

---

## ReportExporter

Exporta `DiffReport` a varios formatos.

### `toJSON(report)`

Serializa a JSON con indentacion 2 espacios.

### `toMarkdown(report)`

Genera tabla Markdown con resultados de benchmarks.

### `toHTML(report)`

Genera pagina HTML auto-contenida con CSS inline y cards de resumen.

### `validateThresholds(report)`

Valida que todos los benchmarks hayan pasado.

**Returns**: `boolean` — `true` si todos pasaron, `false` si alguno fallo.

---

## Benchmark Definitions (B1-B7)

Benchmarks pre-definidos en `BENCHMARK_DEFINITIONS`:

| ID | Nombre | Grafo | Threshold |
|----|--------|-------|-----------|
| B1 | bfs-chain-10k | Chain 10K | speedup >= 1.5x |
| B2 | bfs-grid-100x100 | Grid 100x100 | speedup >= 1.5x |
| B3 | bfs-social-5k | Social 5K | speedup >= 1.5x |
| B4 | shortest-path-tree-1k | Tree depth 10, branch 3 | maxNodesVisitedPercent <= 30% |
| B5 | pruning-beam-10k | Random 10K | minPruningRatio >= 0.40 |
| B6 | pruning-landmark-5k | Knowledge 5K | minPruningRatio >= 0.35 |
| B7 | memory-profile | Chain 1K..100K | maxMemoryRatio <= 0.50 |