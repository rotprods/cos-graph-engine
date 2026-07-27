# Fase 7: Rendimiento — Plan de Ejecucion

> 4 tickets, ~24h estimadas
> Objetivo: Benchmarks de rendimiento para los 20 niveles + reporte HTML dinamico

---

## T-7.1: Benchmarks L0-L3 (6h) ✅ COMPLETADO

**Nivel:** L0-L3 | **Prioridad:** P0 | **Dependencias:** T-6.0a, T-6.0b

**Resultados (39 mediciones, 0 fallos):**

| Nivel | Operacion | n=10 | n=100 | n=1000 |
|-------|-----------|------|-------|--------|
| L0 | addNode | 0.04 ms (23k/s) | 0.43 ms (2.3k/s) | 19.9 ms (50/s) |
| L0 | addEdge | 0.27 ms (3.6k/s) | 1.24 ms (807/s) | 200 ms (5/s) |
| L0 | toMermaid | 0.05 ms (19k/s) | 2.36 ms (424/s) | 135 ms (7/s) |
| L0 | validate | 0.05 ms (20k/s) | 1.17 ms (856/s) | 218 ms (5/s) |
| L0 | serialization | 0.13 ms (7.5k/s) | 1.25 ms (799/s) | 124 ms (8/s) |
| L0 | removeNode (half) | 0.12 ms (8.3k/s) | 1.44 ms (696/s) | 224 ms (4/s) |
| L1 | createGraph | 0.02 ms (48k/s) | 0.19 ms (5.4k/s) | 2.53 ms (395/s) |
| L1 | getGraph | 0.02 ms (53k/s) | 0.18 ms (5.6k/s) | 2.30 ms (435/s) |
| L2 | addState | 0.02 ms (59k/s) | 0.40 ms (2.5k/s) | 5.16 ms* (194/s) |
| L2 | addTransition | 0.03 ms (30k/s) | 1.13 ms (885/s) | 21.9 ms* (46/s) |
| L2 | validate | 0.04 ms (25k/s) | 1.14 ms (877/s) | 24.6 ms* (41/s) |
| L3 | addNode | 0.02 ms (47k/s) | 0.09 ms (10k/s) | 3.58 ms (279/s) |
| L3 | addEdge+tsort | 0.02 ms (41k/s) | 0.44 ms (2.2k/s) | 11.2 ms (89/s) |

*L2 n=500

**Archivo:** `scripts/benchmark-l0-l3.ts` | `benchmark-results-f7.json`

---

## T-7.2: Benchmarks L4-L11 (8h) ✅ COMPLETADO

**Nivel:** L4-L11 | **Prioridad:** P0 | **Dependencias:** T-7.1

**Resultados (90 mediciones, 0 fallos):**

| Nivel | Operacion | n=10 | n=100 | n=1000 |
|-------|-----------|------|-------|--------|
| L4 | createGraph | 0.02 ms (46k/s) | 0.00 ms (301k/s) | 0.00 ms (499k/s) |
| L4 | addNode | 0.02 ms (53k/s) | 0.51 ms (1.9k/s) | 40.9 ms (24/s) |
| L4 | addEdge | 0.10 ms (9.7k/s) | 2.55 ms (391/s) | 822 ms (1/s) |
| L4 | validate | 0.10 ms (10k/s) | 2.59 ms (386/s) | 567 ms (2/s) |
| L4 | serialization | 0.06 ms (16k/s) | 2.87 ms (348/s) | 342 ms (3/s) |
| L5 | createCFG | 0.01 ms (78k/s) | 0.01 ms (161k/s) | 0.00 ms (316k/s) |
| L5 | addBlock | 0.03 ms (35k/s) | 0.85 ms (1.1k/s) | 121 ms (8/s) |
| L5 | addEdge | 0.06 ms (16k/s) | 3.19 ms (313/s) | 266 ms (4/s) |
| L5 | validate | 0.03 ms (35k/s) | 0.67 ms (1.4k/s) | 88.6 ms (11/s) |
| L5 | serialization | 0.04 ms (22k/s) | 0.54 ms (1.8k/s) | 102 ms (10/s) |
| L6 | addNode | 0.01 ms (78k/s) | 0.33 ms (2.9k/s) | 61.5 ms (16/s) |
| L6 | addEdge | 0.05 ms (21k/s) | 3.19 ms (314/s) | 304 ms (3/s) |
| L6 | validate | 0.05 ms (20k/s) | 4.94 ms (202/s) | 350 ms (3/s) |
| L6 | serialization | 0.27 ms (3.7k/s) | 4.31 ms (232/s) | 334 ms (3/s) |
| L8 | addEntity | 0.02 ms (63k/s) | 0.42 ms (2.3k/s) | 37.0 ms (27/s) |
| L8 | addRelation | 0.05 ms (20k/s) | 1.84 ms (544/s) | 390 ms (3/s) |
| L8 | validate | 0.06 ms (15k/s) | 2.05 ms (487/s) | 513 ms (2/s) |
| L8 | serialization | 0.06 ms (16k/s) | 1.77 ms (566/s) | 360 ms (3/s) |
| L9 | addNode | 0.01 ms (77k/s) | 2.41 ms (415/s) | 32.5 ms (31/s) |
| L9 | addEdge | 0.04 ms (22k/s) | 4.37 ms (229/s) | 535 ms (2/s) |
| L9 | validate | 0.05 ms (19k/s) | 5.43 ms (184/s) | 255 ms (4/s) |
| L9 | serialization | 0.30 ms (3.3k/s) | 3.31 ms (302/s) | 582 ms (2/s) |
| L10 | addNode | 0.01 ms (95k/s) | 4.89 ms (205/s) | 71.8 ms (14/s) |
| L10 | addEdge | 0.63 ms (1.5k/s) | 2.16 ms (463/s) | 259 ms (4/s) |
| L10 | validate | 0.05 ms (19k/s) | 6.31 ms (158/s) | 264 ms (4/s) |
| L10 | serialization | 0.05 ms (20k/s) | 2.51 ms (398/s) | 214 ms (5/s) |
| L11 | addChunk | 0.01 ms (104k/s) | 0.08 ms (11k/s) | 2.28 ms (438/s) |
| L11 | addEntity+rel | 0.05 ms (19k/s) | 1.97 ms (508/s) | 419 ms (2/s) |
| L11 | validate | 0.06 ms (16k/s) | 2.11 ms (475/s) | 742 ms (1/s) |
| L11 | serialization | 0.06 ms (17k/s) | 1.84 ms (544/s) | 482 ms (2/s) |

**Insights:**
- L4 createGraph es O(1) — 499k ops/s independiente de n
- L4 addEdge es el cuello de botella (822ms n=1000) — buildAdjacency recrea el grafo completo cada vez
- L5 CFG es rapido en validacion (88ms n=1000 vs 567ms L4)
- L6-L10 tienen rendimiento similar (~300-500ms para n=1000 edges)
- L11 addChunk es el mas rapido (2.28ms n=1000) — no reconstruye adjacency

**Archivo:** `scripts/benchmark-l4-l11.ts` | `benchmark-results-f7-2.json`

---

## T-7.3: Benchmarks L12-L19 (6h) ✅ COMPLETADO

**Nivel:** L12-L19 | **Prioridad:** P0 | **Dependencias:** T-7.2

**Resultados (96 mediciones, 0 fallos):**

| Nivel | Operacion | n=10 | n=100 | n=1000 |
|-------|-----------|------|-------|--------|
| L12 | addNode | 0.08 ms (11k/s) | 1.07 ms (936/s) | 64.2 ms (16/s) |
| L12 | addEdge | 0.15 ms (6.6k/s) | 4.43 ms (226/s) | 615 ms (2/s) |
| L12 | validate | 0.08 ms (12k/s) | 1.21 ms (827/s) | 55.4 ms (18/s) |
| L12 | serialization | 0.08 ms (11k/s) | 1.14 ms (880/s) | 59.9 ms (17/s) |
| L13 | addNode | 0.04 ms (23k/s) | 0.60 ms (1.6k/s) | 33.4 ms (30/s) |
| L13 | addEdge | 0.07 ms (14k/s) | 2.54 ms (394/s) | 191 ms (5/s) |
| L13 | validate | 0.04 ms (22k/s) | 0.86 ms (1.1k/s) | 36.8 ms (27/s) |
| L13 | serialization | 0.04 ms (23k/s) | 0.95 ms (1k/s) | 71.0 ms (14/s) |
| L14 | addNode | 0.05 ms (19k/s) | 0.78 ms (1.2k/s) | 59.6 ms (17/s) |
| L14 | addEdge | 0.07 ms (14k/s) | 2.42 ms (414/s) | 375 ms (3/s) |
| L14 | validate | 0.04 ms (24k/s) | 9.77 ms (102/s) | 40.4 ms (25/s) |
| L14 | serialization | 0.05 ms (19k/s) | 0.90 ms (1.1k/s) | 84.4 ms (12/s) |
| L15 | addNode | 0.06 ms (16k/s) | 1.17 ms (854/s) | 180 ms (6/s) |
| L15 | addEdge | 0.13 ms (7.9k/s) | 3.35 ms (298/s) | 310 ms (3/s) |
| L15 | validate | 0.07 ms (15k/s) | 1.28 ms (779/s) | 103 ms (10/s) |
| L15 | serialization | 0.07 ms (13k/s) | 1.29 ms (772/s) | 80.1 ms (12/s) |
| L16 | addNode | 0.04 ms (26k/s) | 0.55 ms (1.8k/s) | 29.7 ms (34/s) |
| L16 | addEdge | 0.07 ms (15k/s) | 1.83 ms (546/s) | 255 ms (4/s) |
| L16 | validate | 0.03 ms (36k/s) | 0.43 ms (2.3k/s) | 32.5 ms (31/s) |
| L16 | serialization | 0.04 ms (23k/s) | 0.55 ms (1.8k/s) | 48.1 ms (21/s) |
| L17 | addNode | 0.03 ms (32k/s) | 0.64 ms (1.5k/s) | 39.8 ms (25/s) |
| L17 | addEdge | 0.07 ms (15k/s) | 1.76 ms (569/s) | 268 ms (4/s) |
| L17 | validate | 0.03 ms (36k/s) | 0.45 ms (2.2k/s) | 38.7 ms (26/s) |
| L17 | serialization | 0.04 ms (24k/s) | 0.61 ms (1.6k/s) | 36.8 ms (27/s) |
| L18 | addNode | 0.03 ms (33k/s) | 0.48 ms (2k/s) | 46.2 ms (22/s) |
| L18 | addEdge | 0.06 ms (16k/s) | 2.00 ms (499/s) | 284 ms (4/s) |
| L18 | validate | 0.03 ms (34k/s) | 0.47 ms (2.1k/s) | 71.8 ms (14/s) |
| L18 | serialization | 0.04 ms (25k/s) | 0.54 ms (1.8k/s) | 57.0 ms (18/s) |
| L19 | addAtom | 0.03 ms (29k/s) | 0.69 ms (1.4k/s) | 54.3 ms (18/s) |
| L19 | addBond | 0.05 ms (18k/s) | 1.96 ms (510/s) | 296 ms (3/s) |
| L19 | validate | 0.04 ms (24k/s) | 0.96 ms (1k/s) | 47.7 ms (21/s) |
| L19 | serialization | 0.04 ms (26k/s) | 0.85 ms (1.1k/s) | 32.4 ms (31/s) |

**Insights:**
- L16 (Network) es el mas rapido: validate 32ms n=1000, addNode 29ms
- L15 (Workflow) es el mas lento: addNode 180ms n=1000, L12 addEdge 615ms
- L12-L19 tienen patrones homogeneos gracias a la mutation API uniforme
- L19 (Molecular) es el mas rapido en serializacion (32ms n=1000)
- L12 tiene el addEdge mas lento (615ms) por usar `associates` con strength

**Archivo:** `scripts/benchmark-l12-l19.ts` | `benchmark-results-f7-3.json`

---

## T-7.4: Benchmark Report Dinamico (4h) ✅ COMPLETADO

**Nivel:** infra | **Prioridad:** P1 | **Dependencias:** T-7.3

**Resultados:**
- Reporte HTML generado en `docs/benchmark-report.html`
- 225 mediciones de 19 niveles (L0-L19, excepto L7)
- Graficos de barras con Chart.js para addNode, addEdge, validate, serialization
- Tablas comparativas entre niveles en n=1000
- Tablas detalladas por nivel con n=10, n=100, n=1000
- Colores por dominio (Base verde, Computacional azul, Cognitivo naranja, Aplicado morado/rojo)
- Diseño oscuro, responsive, auto-contenido

**Archivo:** `scripts/generate-benchmark-report.ts` | `docs/benchmark-report.html`

**Archivo:** `scripts/generate-benchmark-report.ts`

---

## Dependencias

```
T-6.0a (L0 refactor) ──┐
                        ├── T-7.1 (L0-L3) ── T-7.2 (L4-L11) ── T-7.3 (L12-L19) ── T-7.4 (Report)
T-6.0b (L2 refactor) ──┘
```

## Tiempo Estimado

| Ticket | Horas | Dependencias |
|--------|-------|-------------|
| T-7.1 | 6 | T-6.0a, T-6.0b |
| T-7.2 | 8 | T-7.1 |
| T-7.3 | 6 | T-7.2 |
| T-7.4 | 4 | T-7.3 |
| **Total** | **24h** | |