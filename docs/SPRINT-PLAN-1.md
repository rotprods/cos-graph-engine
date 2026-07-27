# Sprint Plan — v2.1 Sprint 1: Telemetry & Visualization

**Duracion**: 2-3 sesiones (~4-6 horas total)
**Objetivo**: Terminar Fase 3 (Telemetry) + completar Fase 4 (Web Visualization)
**Dependencias**: Fase 1 + 2 completadas, T-3.1 y T-3.2 completados

---

## Sprint Backlog

### T-3.2b — ProfilingHook (1h)
Integrar Profiler en CSRGraph + PruningExecutor.

**Archivos**: `packages/observability/src/profiler.ts`, `packages/graph/src/csr.ts`

**Qué hacer**:
- `Profiler` class: `start()`, `snapshot()`, `summary()`, `exportPrometheus()`
- `ProfilingHook` — se integra en CSRGraph.bfs/dfs/shortestPath via callback
- Formato Prometheus: `cos_graph_*` metrics (duration_ms, memory_bytes, operations_total)

**Tests**: 10 tests (unit + Prometheus format + integration)
**Checkpoint**: [ ] T-3.2b: Profiler + ProfilingHook + Prometheus export

---

### T-3.3 — @cos/telemetry Dashboard + Export (1.5h)
Crear el package `packages/telemetry/` con dashboard HTTP y exportadores.

**Archivos**: `packages/telemetry/`

**Qué hacer**:
- `TelemetryDashboard` — servidor HTTP (Node http module, zero deps)
  - `GET /dashboard` → HTML/JS inline
  - `GET /api/traces` → JSON de trazas del collector
  - `GET /api/metrics` → Prometheus format
- `ExportService` — JSON y CSV export
  - `GET /export/json` → descarga de todas las trazas
  - `GET /export/csv` → CSV de hops
- `OTLPExporter` opcional (HTTP JSON a endpoint configurado)

**Tests**: 8 tests (dashboard, export, OTLP)
**Checkpoint**: [ ] T-3.3: @cos/telemetry package completo

---

### QA-3 — Regression Gate (0.5h)
**Target**: 427+ tests, 0 failures.

**Qué hacer**:
- Ejecutar todos los test suites: CSR, Pruning, Benchmark, WASM, Tracing, Collector, Profiler, Telemetry
- Verificar que no hay regresiones
- Actualizar AGENTS.md con checkpoints finales
- Commit: `v2.1 Fase 3: Telemetry & Observability — COMPLETE`

---

### T-4.1 — SVG Renderer (1.5h)
Renderizar grafos CSR como SVG inline, con force-directed layout zero-dep.

**Archivo**: `packages/visualization/src/svg-renderer.ts`

**Qué hacer**:
- `SVGGraphRenderer.render(graph, options?)` → string SVG
- Force-directed layout: Coulomb repulsion + Hooke attraction + cool-down
- Layout configurable: force, tree, radial
- Output: `<svg>` inline, exportable a archivo

**Tests**: 8 tests (render basico, force layout, tree layout, radial, empty, large)
**Checkpoint**: [ ] T-4.1: SVG Renderer con force-directed layout

---

### T-4.2 — Canvas Renderer (1.5h)
Renderizar grafos en Canvas a 30fps con 10K+ nodos.

**Archivo**: `packages/visualization/src/canvas-renderer.ts`

**Qué hacer**:
- `CanvasGraphRenderer` — constructor toma HTMLCanvasElement
- Quadtree culling: solo renderiza nodos visibles en viewport
- Interacciones: zoom + pan, click seleccion, hover tooltip, drag nodo
- requestAnimationFrame loop

**Tests**: 8 tests (render, zoom, pan, click, performance, empty)
**Checkpoint**: [ ] T-4.2: Canvas Renderer con quadtree culling

---

### T-4.3 — Web Component `<cos-graph>` (1h)
Web Component drop-in para cualquier pagina HTML.

**Archivo**: `packages/visualization/src/web-component.ts`

**Qué hacer**:
- `CosGraphElement extends HTMLElement`
- Atributos: data, layout, theme, width, height, interactive
- Metodos: focusNode, highlightPath, exportSVG, exportPNG
- Themes: light, dark
- Binding con niveles L0-L19 para debugging visual

**Tests**: 8 tests (component, attributes, methods, themes, empty, error)
**Checkpoint**: [ ] T-4.3: Web Component `<cos-graph>` listo

---

## Resumen de Carga

| Ticket | Tipo | Archivos | Tests | Esfuerzo |
|--------|------|----------|-------|----------|
| T-3.2b | Codigo | `observability/src/profiler.ts`, `csr.ts` | 10 | 1h |
| T-3.3 | Nuevo package | `packages/telemetry/` | 8 | 1.5h |
| QA-3 | Verificacion | AGENTS.md | 427+ | 0.5h |
| T-4.1 | Codigo | `visualization/src/svg-renderer.ts` | 8 | 1.5h |
| T-4.2 | Codigo | `visualization/src/canvas-renderer.ts` | 8 | 1.5h |
| T-4.3 | Codigo | `visualization/src/web-component.ts` | 8 | 1h |
| **Total** | | | **42 nuevos** | **~7h** |

## Dependencias

```
T-3.2b → T-3.3 → QA-3
T-4.1 → T-4.2 → T-4.3
```

T-3.2b y T-4.1 son paralelos (no comparten dependencias).

## Definition of Done

- [ ] Todos los tests pasan (0 failures)
- [ ] AGENTS.md checkpoints actualizados
- [ ] Commit por cada ticket completado
- [ ] Regression pasa sin regresiones

## Riesgos

| Riesgo | Prob | Impacto | Mitigacion |
|--------|------|---------|------------|
| Overhead de profiling en hot path | Media | Medio | NoopProfiler singleton |
| Dashboard HTTP bloquea event loop | Baja | Bajo | worker_threads si necesario |
| Canvas 10K nodos lento | Media | Medio | Quadtree culling +阈值 |
| OTLP endpoint no disponible | Baja | Bajo | Graceful error, retry backoff |
| Sin credenciales para push | Alta | Alto | Codigo solo en sandbox local |