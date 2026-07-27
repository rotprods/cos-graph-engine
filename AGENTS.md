# COS Graph Engine — AGENTS.md

> **Proposito**: Orquestador principal entre sesiones. Contiene el protocolo de commits, el registro de fases completadas, el plan de la fase activa, y los checkpoints para reanudacion.

---

## Protocolo de Commits por Fase

Cada fase debe ser commitada **inmediatamente despues de completarla**, porque el sandbox se borra entre sesiones.

### Reglas

1. **Un commit por fase completa** — no commits intermedios a menos que la fase sea > 30 min de trabajo continuo.
2. **Mensaje de commit estandarizado**:
   ```
   v2.1 Fase <N>: <Nombre> — COMPLETE [| <STATUS>]

   T-<X>.<Y>: <descripcion breve>
   - detalle 1
   - detalle 2

   Tests: <N> tests, <N> failures
   Regression: <N> tests, <N> failures
   ```
3. **Push inmediato** (cuando haya credenciales): `git add -A && git commit -m "..." && git push`.
4. **Package.json version bump** al inicio de cada fase: `npm version prerelease --preid alpha`.
5. **Checkpoints en AGENTS.md**: Al final de cada ticket, marcar [x] en la checklist.

### Commits Realizados

| Commit | Fase | Fecha |
|--------|------|-------|
| `694d966` | Fase 1 — Performance Foundations | Anterior |
| `39cc4e4` | Fase 2 — WASM Acceleration | 2026-07-27 |

---

## Registro de Fases Completadas

### Fase 1 — Performance Foundations ✅ COMPLETE

**Tickets**:
- T-1.1: CSR Storage — `packages/graph/src/csr.ts`, 77 tests
- T-1.2: Bidirectional Pruning — `packages/graph/src/pruning.ts`, 70 tests
- T-1.3: Benchmark Suite — GraphGenerator, Measurer, BenchmarkRunner, ReportExporter, 64 tests

**Resultados**: 365 tests, 0 failures. 7/7 benchmarks PASS. QA-2 Gate passed.

---

### Fase 2 — WASM Acceleration ✅ COMPLETE

**Tickets**:
- T-2.1: AssemblyScript Pipeline — 4 modulos (csr, pagerank, shortest, centrality), WASM 6.3KB
- T-2.2: WASM Loader — `loader.ts` con `createWASMModule`, `createJSFallback`, `WASMLoader`, pre-grow 64MB
- T-2.3: WASM Benchmarks — `benchmark-wasm.ts`, 5 benchmarks

**Resultados**: 23 tests WASM, 0 failures. Benchmarks:
- BFS Chain 10K: 2.34x | BFS Grid 100x100: 1.60x | PageRank 5K: 2.65x
- Shortest Path 10K: 10.49x | Betweenness 1K: 5.94x

**Regression**: 388 tests, 0 failures. Commit `39cc4e4`.

---

## Fase Activa: Fase 3 — Telemetry & Observability 🔄

> **Objetivo**: Per-hop tracing, profiling, export OpenTelemetry.

### Dependencias
- `@cos/core` (existe): TelemetryEvent, MetricSample, ITelemetry, CogEvent
- `@cos/observability` (existe): TelemetrySystem stub
- `packages/graph/`: CSRGraph, PruningExecutor (destinos de integracion)

### Plan de Ejecucion

#### T-3.1 — Per-Hop Tracing

**Archivo**: `packages/observability/src/tracing.ts`

Interfaces:
- `TraceHop` — hopIndex, nodeId, depth, timestamp, duration, source: 'forward'|'backward'|'pruned', metadata
- `TraceSession` — id, hops, addHop(), getSummary(): { totalHops, prunedHops, bidirectional, durationMs }
- `NoopTraceSession` — singleton, zero overhead
- `TraceableGraph` — mixin que wrappea CSRGraph.bfs/dfs/shortestPath con hooks de tracing

**Integracion CSRGraph**:
- Metodos acceptan `traceSession?: TraceSession`
- Cada hop registra nodeId + depth + timestamp + source
- Default: NoopTraceSession (sin overhead)

#### T-3.2 — Profiling

**Archivo**: `packages/observability/src/profiler.ts`

- `Profiler` class: `start()`, `snapshot()`, `summary()`, `exportPrometheus()`
- Formato Prometheus: `cos_graph_*` metrics (duration_ms, memory_bytes, operations_total)
- `ProfilingHook` — se integra en CSRGraph y PruningExecutor

#### T-3.3 — @cos/telemetry Dashboard + Export

**Nuevo package**: `packages/telemetry/`

- Dashboard HTTP (Node http module, zero deps)
  - `GET /dashboard` — HTML/JS inline
  - `GET /api/events`, `GET /api/metrics`
- Export: `GET /export/json`, `GET /export/csv`
- OTLPExporter opcional (HTTP JSON a endpoint configurado)

### Tests esperados

| Componente | Tests | Archivo |
|-----------|-------|---------|
| Tracing (TraceSession, Noop, integration) | 15 | `packages/observability/tests/tracing.test.ts` |
| Profiler | 10 | `packages/observability/tests/profiler.test.ts` |
| Telemetry Dashboard | 8 | `packages/telemetry/tests/dashboard.test.ts` |
| CSR + Tracing integration | 6 | `packages/graph/tests/tracing-integration.test.ts` |

**Total nuevos**: ~39 tests → regression target: 427 tests, 0 failures.

### Checkpoints

- [x] T-3.1: TraceSession + NoopTraceSession + TraceableGraph implementados
- [x] T-3.1: Integracion en CSRGraph (bfs, dfs, shortestPath)
- [x] T-3.2: Trace Collector — CircularBuffer + TraceCollectorImpl + NoopTraceCollector + JSON export
- [x] T-3.2b: Profiler + ProfilingHook + Prometheus export + CSR integration
- [x] T-3.3: @cos/telemetry — Dashboard HTTP + Export JSON/CSV + OTLPExporter
- [x] QA-3: Todos los tests pasan, regression 462+ tests
- [x] Commit: `0ee9d39` — v2.1 T-3.3: @cos/telemetry — Dashboard + Export + OTLP
- [ ] Tag: `v2.1.0-alpha.3` (cuando haya push)

---

## Fase Activa: Fase 6 — Ecosystem & DX 🔄

> **Objetivo**: npm packages, API docs, release automation.

### Checkpoints

- [x] T-6.1: npm packages — @cos/graph, @cos/observability, @cos/wasm, @cos/visualization
- [x] T-6.2: API docs — TypeDoc entry points, READMEs, LICENSE files
- [x] T-6.3: Release automation — version-bump.js, publish:all scripts, CHANGELOG v2.1.0

---

## 🎉 Proyecto COMPLETO — 6/6 Fases, 18/18 Tickets

Todos los tickets del roadmap v2.1 han sido ejecutados y verificados.

| Metrica | Valor |
|---------|-------|
| Version | 2.1.0 |
| Tests totales | **600** |
| Failures | **0** |
| Fases completadas | 11/15 |
| Commits | 30+ |
| Version | 2.1.1-dev |
| LoC | 28,000+ |
| Commit actual | `1a1fc65` |
| Sandbox | Ephemeral — commit frecuente |
| Remote | `origin` → `https://github.com/rotprods/cos-graph-engine.git` (push OK) |
