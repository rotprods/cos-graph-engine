# TICKETS FASE 8 — Integracion Cruzada (24h)

> Fase 8 del COS Graph Engine: Integrar niveles en pipelines de extremo a extremo.
> 4 tickets, ~24h estimados.

---

## T-8.1: Pipeline L4 → L5 → L6 (6h) ✅ COMPLETADO

**Nivel:** L4-L6 | **Prioridad:** P0 | **Dependencias:** Fase 7

**Que hacer:**
- `PipelineL4L5L6` class: trace → CallGraph → CFG → DataFlow
- `traceToCallGraph(trace)`: Convierte trace estructurado en CallGraph
- `callGraphToCFG(graphId)`: Convierte CallGraph en CFG
- `cfgToDataFlow(cfgId)`: Convierte CFG en DataFlowGraph
- `traceToDataFlow(trace)`: End-to-end conversion
- `analyzeStackTrace(graphId, stackLines)`: Analiza stack traces
- Validacion y metricas de los 3 niveles en pipeline
- Propagacion de timing data (latencia, throughput)
- 62 tests, 0 failures

**Archivos:**
- `packages/graph/src/pipeline-l4l5l6.ts` — Pipeline class
- `scripts/test-pipeline-l45l6.ts` — 62 tests
- `packages/graph/src/index.ts` — Export pipeline

**Resultados:**
- 62/62 tests passed
- 16 test cases covering: creation, empty/nested/simple traces, E2E, timing, validation, metrics, stack analysis, multiple traces
- Regresion completa: 0 failures

---

## T-8.2: Pipeline L8 → L9 → L10 → L11 (8h)

**Nivel:** L8-L11 | **Prioridad:** P0 | **Dependencias:** T-8.1

**Que hacer:**
1. Revisar APIs de L8 (Knowledge), L9 (Semantic), L10 (Embedding), L11 (GraphRAG)
2. Crear `PipelineL8L9L10L11` que integre: query → ontology → semantic expansion → embedding → graph context
3. Tests: 40+ tests para el pipeline
4. Validar regresion completa

---

## T-8.3: Pipeline L12 → L13 → L14 → L15 (6h)

**Nivel:** L12-L15 | **Prioridad:** P0 | **Dependencias:** T-8.2

**Que hacer:**
1. Revisar APIs de L12 (Memory), L13 (Agent), L14 (Tool), L15 (Workflow)
2. Crear `PipelineL12L13L14L15` que integre: memory → agent → tool → workflow
3. Tests: 40+ tests
4. Validar regresion completa

---

## T-8.4: Pipeline L16 → L17 → L18 → L19 (4h)

**Nivel:** L16-L19 | **Prioridad:** P0 | **Dependencias:** T-8.3

**Que hacer:**
1. Revisar APIs de L16 (Network), L17 (Social), L18 (Biological), L19 (Molecular)
2. Crear `PipelineL16L17L18L19` que integre: network → teams → proteins → molecules
3. Tests: 40+ tests
4. Validar regresion completa