# COS Graph Engine — AGENTS.md

> **CANONICAL CURRENT CONSTITUTION — 2026-08-25**
>
> This header supersedes historical phase/status language below **without deleting it**. The old ledger remains as provenance. Current operational truth lives in `README_FIRST.md`, `GOAL.md`, `STATE.md`, `SCORECARD_20D.md`, `EXECUTION_PLAN.md`, `GRAPH.md`, and `HANDOFF.md`.

## Mandatory cold start

Read in this exact order before proposing or mutating code:

1. `README_FIRST.md`
2. `GOAL.md`
3. `STATE.md`
4. `SCORECARD_20D.md`
5. `EXECUTION_PLAN.md`
6. `GRAPH.md`
7. `HANDOFF.md`
8. `docs/hardening/FULL_STACK_ADVERSARIAL_REVIEW.md`
9. this `AGENTS.md`

Then inspect PRs #34, #35, #36, #37, #38 and issue #39.

## Current authority state

- Status: `ACTIVE / STOP-THE-LINE RECONCILIATION`
- Authority: `SHADOW_ONLY`
- North Star: all D01–D20 Authority scores = 10.0 with linked evidence
- Score law: `Authority = min(Build, Assurance)`
- Current means: Build 7.6 / Assurance 2.6 / Authority 2.6
- Active phase: Phase 01 — reconcile divergent W12.4 siblings #34 + #35 from #33
- Automatic CI/CD: OFF during convergence
- Recurring incremental infrastructure cost target: 0 EUR/month

Historical `COMPLETE`, phase counts, test totals and benchmark claims below are **historical evidence only**, not current authority claims.

## Non-negotiable execution laws

### /leydekidlin
Before any material change, explicitly define:
- observed facts;
- assumptions;
- unknowns;
- scope;
- desired outcome;
- constraints;
- success criteria;
- falsifiable failure condition.

### /leydegilbert
Own discovery of the best viable implementation path using repository evidence, available tools, prior art and system context. Do not wait for step-by-step instructions when the path can be discovered safely.

### Complex-systems doctrine
For material changes apply the resilience principles encoded from `how.complexsystems.fail`:
- avoid monocausal explanations unless evidence truly isolates one cause;
- model latent conditions and coupled failures;
- expect degraded modes and adaptive behavior;
- treat near misses as first-class evidence;
- inspect change-induced failure modes;
- record blast radius, defenses, recovery path and residual risk.

## Branch / PR governance

1. #34 and #35 are divergent sibling implementations; neither may be treated as canonical alone.
2. W13 #36 does not qualify the complete candidate and remains paused.
3. PR #37 is draft/rework: manual-only Actions is correct, loss of verification breadth is not.
4. No new product breadth before reconciliation and P0 closure.
5. One primary guarantee per PR whenever feasible.
6. No merge merely because a PR is `mergeable`.
7. Final merge requires independent approval, evidence gates, expected SHA and rollback checkpoint.
8. Never weaken branch protection to bypass review.

## Deletion / replacement law

Any change deleting or replacing >50 non-generated lines in one file must record:
- previous behavior;
- reason for removal;
- replacement path;
- observable behavioral delta;
- compatibility policy;
- verification evidence;
- rollback path.

Tests are evidence, not implementation accessories. Preserve legacy tests and add authority tests separately unless an ADR explicitly authorizes a break and supplies migration evidence.

## Authority engineering law

No dimension reaches 10/10 because code looks complete.

- Build may rise from implementation/review.
- Assurance rises only from executed evidence.
- Authority is the lower of the two.
- New evidence may lower scores.

Required end-state evidence includes clean install, legacy+strict typecheck, full regression, orphan suites, negative/property/mutation tests, security review, contention/crash tests, deterministic replay, corrupted-snapshot + empty-DB restore, scientific benchmarks, blind cold-agent resume and final 20D adversarial review.

## Tool / persistence routing

- GitHub = executable truth, branches, commits, PRs, reviews and evidence artifacts.
- Drive = cross-chat operational memory, Acta/STATE/Handoff.
- Todoist project `COS GRAPH ENGINE · 10/10 AUTHORITY PROGRAM` = live execution queue.
- Do not mutate unrelated Todoist projects as part of COS synchronization.
- Codex is optional for long repo-local shell loops; it is not required for GitHub orchestration.
- No secrets in repo/Drive/prompts/issues.

## Checkpoint protocol

After every material checkpoint:
1. persist code/docs/PR state in GitHub;
2. update `STATE.md` and `HANDOFF.md`;
3. update Drive Acta + AGENTIC_SYSTEMS_OS STATE;
4. update Todoist tasks/scores;
5. record any desynchronization explicitly.

---

# HISTORICAL LEDGER — preserved from prior AGENTS.md

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

## Fase 4: Higgsfield Landing Page + Ecosystem (2026-07-27)

### Completed
- [x] Landing page redesigned: `cos-graph-engine.higgsfield.app`
  - Hero with canvas real-time graph visualization
  - 8 sections: Hero, Stats, Levels, Features, Architecture, CLI, CTA, Footer
  - Cold luxury palette (midnight + electric blue + indigo)
  - Geist font + JetBrains Mono, scroll reveals, CLI typing animation
  - Animated counters, glassmorphism cards, SVG assets
- [x] Design brief: `app/design-brief.md`
- [x] Published to Higgsfield community feed
- [x] GitHub repo: `rotprods/cos-graph-engine-landing-page` (README pushed)
- [x] New Higgsfield project: `cos-graph-docs.higgsfield.app` (scroll-scrub template)

### Live URLs
- Landing page: https://cos-graph-engine.higgsfield.app
- Feed listing: https://higgsfield.ai/supercomputer/apps/8238d2d6-bfda-4f4b-9c90-1ce4f1a238b9/view
- GitHub: https://github.com/rotprods/cos-graph-engine
- Landing page repo: https://github.com/rotprods/cos-graph-engine-landing-page
- Docs site: https://cos-graph-docs.higgsfield.app (scaffolding, needs content)
