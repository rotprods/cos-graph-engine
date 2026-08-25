# COS Graph Engine — AGENTS.md

## CANONICAL CONSTITUTION — CURRENT AUTHORITY

This section supersedes old operational-status claims without deleting the historical ledger below.

### North Star

Bring COS Graph Engine to `Authority 10.0` in all 20 audited verticals and qualify it as the zero-cost graph compute/projection and agent-runtime substrate of AGENTIC_SYSTEMS_OS.

`Authority = min(Build, Assurance)`.

No agent may promote a score, mark a phase complete, merge a hardening PR or claim 10/10 from code volume, documentation, test count or model confidence alone.

### Current mode

- phase: `01 — CANONICAL RECONCILIATION #34 + #35`;
- branch: `hardening/canonical-authority-reconciliation`;
- base: #33 @ `5806a71fd7bb11245dfe1454b7094bc9febf8ed5`;
- authority: `SHADOW_ONLY`;
- W13: paused;
- automatic CI/CD: off;
- merge authorization: denied until reconciliation and evidence.

### Mandatory read order

`README_FIRST → GOAL → STATE → SCORECARD_20D → TASKS → GRAPH → HANDOFF → Phase 01 matrix → Deletion Ledger → AGENTS historical ledger`.

### Mandatory reasoning laws

#### /leydekidlin

Before proposing or mutating, record:

- observed facts;
- assumptions;
- unknowns;
- affected scope;
- desired outcome;
- constraints;
- success criteria;
- falsifiable failure condition.

#### /leydegilbert

Once the problem is sufficiently defined, own discovery and execution of the best viable path using available repository evidence, tools, prior art and tests. Missing step-by-step instructions are not a blocker.

#### /complexsystems

Before a material change, identify:

- removed failure modes;
- introduced failure modes;
- new couplings;
- latent conditions;
- defenses;
- degraded states;
- failure combinations;
- near-miss signals;
- blast radius;
- rollback path;
- smallest reversible action.

Single-root-cause framing is prohibited for non-trivial systemic incidents unless evidence supports it.

### Canonical reconciliation rules

1. #34 and #35 are divergent evidence sources, not merge targets.
2. One authority owner is allowed per capability.
3. Legacy compatibility may remain only with explicit `shadow`, `deprecated` or migration status.
4. A replacement deleting >50 non-generated lines requires a semantic deletion-ledger entry.
5. Legacy tests remain intact; authority tests are additive unless an ADR authorizes a break.
6. W13 must be recreated from the reconciled candidate.
7. No current-row overwrite may be described as complete bi-temporal history.
8. Presence of `idempotencyKey` or `fencingVersion` is not proof of exactly-once side effects.
9. Reads from canonical state must not leak mutable references.
10. Replay must apply recorded outcomes, not re-decide historical commands.

### Commit / PR protocol

The previous “one commit per phase” rule is superseded for the hardening program.

Use:

- one coherent guarantee/capability per commit;
- exact source lineage in commit message when porting from #34/#35;
- small reversible diffs;
- no version bump merely to start a phase;
- no direct main writes;
- no merge without exact head SHA, evidence and independent review;
- update `STATE.md`, `TASKS.md` and `HANDOFF.md` at material checkpoints.

Recommended commit form:

```text
<type>(<area>): <guarantee>

Source: <branch/PR/SHA>
Invariant: <falsifiable guarantee>
Failure modes: <removed / introduced>
Verification: <executed or pending>
Rollback: <exact ref>
```

### Cost and execution policy

- recurring incremental infrastructure cost: `EUR 0/month`;
- GitHub Actions: manual-only;
- manual Actions must preserve full verification breadth;
- CD/deploy/release: off until separate authorization;
- local/offline verification preferred;
- Codex optional for shell-heavy loops, not required for GitHub control-plane work.

### Cross-plane persistence

For every material checkpoint:

```text
GitHub = executable/evidence truth
Drive = cross-chat Acta + STATE
Todoist = live execution state
```

If one plane is not updated, record the exception in `HANDOFF.md`.

### Current next action

Port low-conflict selected primitives with source-provenance commits:

1. strict tool runtime from #35;
2. AuthorityTelemetry from #34;
3. EventBus delivery-failure observation from #35;
4. GitHub provider fixtures from #34.

Then open a draft reconciliation PR against #33 and continue with state/registry convergence.

---

# HISTORICAL LEDGER — PRESERVED, NON-CANONICAL STATUS CLAIMS

The content below records prior implementation history. Statements such as “Proyecto COMPLETO”, historic test totals and old active phases are provenance, not current authority.

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
