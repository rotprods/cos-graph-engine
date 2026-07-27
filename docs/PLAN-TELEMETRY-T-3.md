# Plan de Ejecucion — Fase 3: Telemetry & Observability

**Objetivo**: Per-hop tracing, profiling, export OpenTelemetry, dashboard de monitoreo.

**Dependencias**: Fase 1 (CSRGraph como destino de tracing + profiling)
**Duracion estimada**: 3-4 horas

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                   @cos/telemetry                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ HTTP Dashboard │  │ Export       │  │ OTLP       ││
│  │ (GET /dashbrd) │  │ JSON / CSV   │  │ Exporter   ││
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘│
└─────────┼──────────────────┼────────────────┼───────┘
          │                  │                │
┌─────────┼──────────────────┼────────────────┼───────────┐
│         │     @cos/observability            │           │
│  ┌──────┴──────┐  ┌────────┴───────┐  ┌────┴────────┐ │
│  │ TraceSession│  │ Profiler       │  │ Telemetry   │ │
│  │ TraceHop    │  │ Prometheus fmt │  │ System      │ │
│  │ NoopSession │  │ ProfilingHook  │  │ (existente)  │ │
│  └──────┬──────┘  └────────┬───────┘  └─────┬───────┘ │
└─────────┼──────────────────┼────────────────┼──────────┘
          │                  │                │
┌─────────┼──────────────────┼────────────────┼───────────┐
│         │  packages/graph/                  │           │
│  ┌──────┴──────┐  ┌────────┴───────┐        │           │
│  │ CSRGraph    │  │ PruningExecutor│        │           │
│  │ bfs/dfs/sp  │  │ strategies     │        │           │
│  │ +trace hooks│  │ +profile hooks │        │           │
│  └─────────────┘  └────────────────┘        │           │
└─────────────────────────────────────────────────────────┘
```

## Tickets

### T-3.1 — Per-Hop Tracing

**Archivos**:
- `packages/observability/src/tracing.ts` — interfaces + implementaciones
- `packages/observability/src/index.ts` — export tracing
- `packages/graph/src/csr.ts` — hooks en CSRGraph

**Interfaces**:

```typescript
interface TraceHop {
  hopIndex: number;
  nodeId: string;
  depth: number;
  timestamp: number;
  duration: number;
  source: 'forward' | 'backward' | 'pruned';
  metadata?: Record<string, unknown>;
}

interface TraceSummary {
  totalHops: number;
  prunedHops: number;
  bidirectional: boolean;
  durationMs: number;
  hopsByDepth: Record<number, number>;
  hopsBySource: Record<string, number>;
}

interface TraceSession {
  readonly id: string;
  readonly hops: readonly TraceHop[];
  addHop(hop: Omit<TraceHop, 'timestamp'>): void;
  getSummary(): TraceSummary;
  reset(): void;
}

class NoopTraceSession implements TraceSession {
  // singleton, zero allocation
  static readonly instance: NoopTraceSession;
  addHop(): void {} // no-op
  getSummary(): TraceSummary {
    return { totalHops: 0, prunedHops: 0, ... };
  }
}
```

**Integracion en CSRGraph**:

```typescript
class CSRGraph<N, E> {
  bfs(
    source: string,
    options?: { traceSession?: TraceSession; maxDepth?: number }
  ): string[] {
    const trace = options?.traceSession ?? NoopTraceSession.instance;
    // ... cada nodo visitado:
    trace.addHop({ hopIndex: i, nodeId: n, depth: d, duration: t, source: 'forward' });
  }
}
```

**Tests** (15):
| Grupo | Tests | Que cubre |
|-------|-------|-----------|
| TraceSession unit | 5 | addHop, getSummary, reset, empty, multiple hops |
| NoopTraceSession | 3 | Singleton, zero overhead, no side effects |
| CSR + tracing integration | 6 | bfs con trace, dfs con trace, shortestPath, bidiBFS, pruning, reset |
| Edge cases | 1 | Tracing con grafo vacio, maxDepth=0 |

### T-3.2 — Profiling

**Archivos**:
- `packages/observability/src/profiler.ts` — Profiler class
- `packages/observability/src/index.ts` — export profiler

**Profiler API**:

```typescript
interface ProfileSample {
  label: string;
  elapsed: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class Profiler {
  start(label: string): void;
  snapshot(label: string): ProfileSample;
  summary(): ProfilerSummary[];
  reset(): void;

  // Prometheus exposition format
  exportPrometheus(): string;
}

interface ProfilerSummary {
  label: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
}
```

**Formato Prometheus**:
```
# HELP cos_graph_bfs_duration_ms BFS execution duration
# TYPE cos_graph_bfs_duration_ms histogram
cos_graph_bfs_duration_ms{level="knowledge"} 12.5

# HELP cos_graph_memory_bytes Graph memory usage
# TYPE cos_graph_memory_bytes gauge
cos_graph_memory_bytes{graph="csr"} 2048576

# HELP cos_graph_operations_total Total operations
# TYPE cos_graph_operations_total counter
cos_graph_operations_total{operation="add_node"} 5000
cos_graph_operations_total{operation="bfs"} 1240
```

**Tests** (10):
| Grupo | Tests | Que cubre |
|-------|-------|-----------|
| Profiler unit | 5 | start/snapshot/summary, multiple labels, reset, edge cases |
| Prometheus export | 3 | formato basico, multiple metrics, empty profiler |
| Integration | 2 | Profiler + CSRGraph bfs, Profiler + PruningExecutor |

### T-3.3 — @cos/telemetry Dashboard + Export

**Nuevo package**: `packages/telemetry/`

**Archivos**:
- `packages/telemetry/package.json`
- `packages/telemetry/tsconfig.json`
- `packages/telemetry/src/index.ts`
- `packages/telemetry/src/dashboard.ts` — HTTP server
- `packages/telemetry/src/export.ts` — JSON/CSV export
- `packages/telemetry/src/otlp.ts` — OTLP HTTP exporter

**Dashboard HTTP**:

```typescript
class TelemetryDashboard {
  constructor(telemetry: ITelemetry, port?: number);

  start(): Promise<void>;
  stop(): Promise<void>;

  // Endpoints
  // GET /dashboard → HTML page
  // GET /api/events?limit=100 → JSON
  // GET /api/metrics?limit=100 → JSON
  // GET /export/json → JSON download
  // GET /export/csv?type=events → CSV download
}
```

**OTLP Exporter**:

```typescript
interface OTLPConfig {
  endpoint: string; // e.g. "http://otel-collector:4318/v1/traces"
  headers?: Record<string, string>;
  exportIntervalMs?: number; // default 10000
}

class OTLPExporter {
  constructor(config: OTLPConfig);
  start(): void; // periodic export
  stop(): void;
  flush(): Promise<void>; // immediate export
}
```

**Tests** (8):
| Grupo | Tests | Que cubre |
|-------|-------|-----------|
| Dashboard | 3 | start/stop, GET /dashboard returns HTML, GET /api/events |
| Export | 3 | JSON export, CSV export events, CSV export metrics |
| OTLP | 2 | Constructor, start/stop (no network test en unit) |

---

## Resumen de Tests

| Componente | Tests | Archivo |
|-----------|-------|---------|
| Tracing | 15 | `packages/observability/tests/tracing.test.ts` |
| Profiler | 10 | `packages/observability/tests/profiler.test.ts` |
| Telemetry Dashboard | 8 | `packages/telemetry/tests/dashboard.test.ts` |
| **Total nuevos** | **33** | |
| Regression actual | 388 | |
| **Target regression** | **421** | |

---

## Commits

```bash
# Despues de T-3.1
git add -A && git commit -m "v2.1 T-3.1: Per-Hop Tracing — TraceSession + NoopTraceSession + CSR integration"

# Despues de T-3.2
git add -A && git commit -m "v2.1 T-3.2: Profiling — Profiler + Prometheus export + ProfilingHook"

# Despues de T-3.3 + QA-3
git add -A && git commit -m "v2.1 Fase 3: Telemetry & Observability — COMPLETE

T-3.1: Per-Hop Tracing — TraceSession, NoopTraceSession, CSR integration
T-3.2: Profiling — Profiler, Prometheus format, ProfilingHook
T-3.3: @cos/telemetry — Dashboard HTTP, Export JSON/CSV, OTLP Exporter

Tests: 33 tests, 0 failures
Regression: 421+ tests, 0 failures"
```

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| TypedArrays detach con memory.grow | Baja | Alto | Pre-grow 64MB, freeze buffer antes de WASM call |
| Overhead de tracing en hot path | Media | Medio | NoopTraceSession singleton, sin allocations |
| Dashboard HTTP bloquea event loop | Baja | Bajo | Usar worker_threads si es necesario |
| OTLP endpoint no disponible | Media | Bajo | Graceful error, retry con backoff |