# ROADMAP — COS Graph Engine

> Hoja de ruta completa para terminar el proyecto.
> De 390 tests / 2 niveles refactorizados a 2000+ tests / 20 niveles homogeneos.

---

## Estado Actual

| Metrica | Ahora | Meta | Gap |
|---------|-------|------|-----|
| Tests | 390 | 2000+ | 1610 faltantes |
| Niveles con mutation API | 2 (L1, L3) | 20 | 18 faltantes |
| Niveles con serializacion | 1 (L7) | 20 | 19 faltantes |
| Niveles con adjacency maps | 2 (L1, L3) | 20 | 18 faltantes |
| Niveles con tests dedicados | 3 (L1, L3, L7) | 20 | 17 faltantes |
| Cobertura | ~70% | 95%+ | Pendiente de medir |
| Integracion SMB | No | Si | 5 tickets |
| CI/CD | Basico | Completo | 3 tickets |
| Docs | Parcial | Completo | 4 tickets |

**Lo que ya funciona bien:** L1 (execution), L3 (dependencies), L7 (compute) — refactorizados con mutation API, serializacion, adjacency maps, y tests.

**Lo que falta:** L0, L2, L4-L6, L8-L19 — 17 niveles sin refactorizar, sin tests dedicados, sin APIs consistentes.

---

## Las 8 Fases

### Fase 1: Refactor Adversarial ✅ COMPLETO
L1, L3, L7 refactorizados. 14 fixes + 1 bug. 390 tests.

### Fase 2: Entrega y Documentacion ✅ COMPLETO
CI pipeline, benchmark report, CHANGELOG, release notes.

### Fase 3: Consolidacion ◀ ACTIVO (2/8 tickets)
Terminar tooling, coverage, documentacion basica, y validacion L4-L11.

| Ticket | Que | Dep | Estimado |
|--------|-----|-----|----------|
| T-3.1 | npm scripts | — | ✅ 1h |
| T-3.2 | benchmark-report dinamico | T-3.1 | 3h |
| T-3.3 | Auto-release en push a main | T-3.1 | 4h |
| T-3.4 | Cobertura de codigo con c8 | T-3.1 | 3h |
| T-3.5 | README actualizado | T-3.1 | 2h |
| T-3.6 | CONTRIBUTING.md | T-3.5 | 3h |
| T-3.7 | API Reference con TypeDoc | T-3.5 | 8h |
| T-3.8 | Validacion de grafos L4-L11 | — | ✅ 3h |

**Total F3:** ~27h | **Progreso:** 2/8 (25%)

### Fase 4: Integracion SMB ◀ Pendiente
Conectar L7 y L12 al Shared Memory Bus para persistencia real.

| Ticket | Que | Dep | Estimado |
|--------|-----|-----|----------|
| T-4.1 | Conectar L7 al Shared Memory Bus | T-3.5 | 8h |
| T-4.2 | Conectar L12 al Shared Memory Bus | T-4.1 | 8h |
| T-4.3 | Tests de integracion SMB | T-4.2 | 8h |
| T-4.4 | Operacionalizar memory-manager AI Employee | T-4.3 | 4h |
| T-4.5 | Documentacion de integracion SMB | T-4.4 | 4h |

**Total F4:** ~32h | **Meta:** 500 tests, 80% cobertura

### Fase 5: Homogeneizacion L4-L19 ◀ Pendiente
Mutation API, serializacion, y adjacency maps en los 17 niveles faltantes.

| Track | Tickets | Que cubre | Estimado |
|-------|---------|-----------|----------|
| A | T-5.1, T-5.2, T-5.3 | Mutation API L4→L19 | 26h |
| B | T-5.4, T-5.5 | Serializacion L4→L19 | 16h |
| C | T-5.6 | Adjacency maps L4→L19 | 12h |

**Total F5:** ~54h | **Meta:** 700 tests, 85% cobertura

### Fase 6: Expansion de Tests ◀ Pendiente
40+ tests por nivel, 720+ tests nuevos.

| Track | Tickets | Niveles | Tests | Estimado |
|-------|---------|---------|-------|----------|
| A | T-6.1, T-6.2 | L0, L2 | 80 | 8h |
| B | T-6.3, T-6.4, T-6.5 | L4, L5, L6 | 120 | 12h |
| C | T-6.6 | L8-L11 | 160 | 12h |
| D | T-6.7 | L12-L15 | 160 | 12h |
| E | T-6.8 | L16-L19 | 160 | 12h |

**Total F6:** ~48h | **Meta:** 1300+ tests, 90% cobertura

### Fase 7: Endurecimiento (F7-NUEVA)
Performance, integracion cruzada, y herramientas.

| Ticket | Que | Dep | Estimado |
|--------|-----|-----|----------|
| T-7.1 | Benchmarks L0-L19 | F6 | 12h |
| T-7.2 | CLI unificada (`cos graph`) | F5 | 8h |
| T-7.3 | Pipeline cruzado L4→L5→L6 | F5 | 6h |
| T-7.4 | Pipeline cruzado L8→L9→L10→L11 | F5 | 8h |
| T-7.5 | Pipeline cruzado L12→L13→L14→L15 | F5 | 6h |
| T-7.6 | Validacion de esquemas (JSON Schema) | F5 | 8h |
| T-7.7 | Security audit | F6 | 8h |

**Total F7:** ~56h | **Meta:** 1800+ tests, 92% cobertura

### Fase 8: Release y Ecosistema (F8-NUEVA)

| Ticket | Que | Dep | Estimado |
|--------|-----|-----|----------|
| T-8.1 | v2.0.0 Release (CHANGELOG, tags, npm) | F7 | 8h |
| T-8.2 | Playground interactivo en terminal | F7 | 8h |
| T-8.3 | Landing page del proyecto | F7 | 8h |
| T-8.4 | Import/Export GraphML, GEXF, CSV | F5 | 6h |
| T-8.5 | WebAssembly runtime (L1, L3, L7) | F7 | 16h |
| T-8.6 | Documentacion i18n ES/EN | F7 | 8h |

**Total F8:** ~54h | **Meta:** 2000+ tests, 95%+ cobertura

---

## Mapa de Dependencias

```
F3 ──┬── T-3.1 ──┬── T-3.2 ── T-3.3
     │           ├── T-3.4
     │           └── T-3.5 ──┬── T-3.6 ── T-3.7
     └── T-3.8 (independiente)

F4 ── T-4.1 ── T-4.2 ── T-4.3 ──┬── T-4.4 ── T-4.5
                                 │
F5 ──┬── T-5.1 ── T-5.2 ──┬── T-5.3
     │                     ├── T-5.4 ── T-5.5
     │                     └── T-5.6
     │
F6 ──┬── T-6.1 ── T-6.2 (indep. de F5)
     ├── T-6.3 ── T-6.4 ── T-6.5 (indep. de F5)
     ├── T-6.6 (depende de T-5.2)
     ├── T-6.7 (depende de T-5.3)
     └── T-6.8 (depende de T-5.3)

F7 ──┬── T-7.1 (indep. de F6)
     ├── T-7.2 (indep. de F5)
     ├── T-7.3 ── T-7.4 ── T-7.5 (indep. entre si)
     ├── T-7.6 (indep. de F5)
     └── T-7.7 (indep. de F6)

F8 ──┬── T-8.1 ── T-8.3 ── T-8.6 (secuencial)
     ├── T-8.2 (indep.)
     ├── T-8.4 (indep. de F5)
     └── T-8.5 (indep. de F7)
```

---

## Tracks Paralelos

### Track A: CI/CD y Tooling (F3)
```
T-3.1 → T-3.2 → T-3.3
       → T-3.4
       → T-3.5 → T-3.6 → T-3.7
```
~20h, 1 persona, desbloquea el resto del proyecto.

### Track B: Codigo (F3 → F5 → F6)
```
T-3.8 → T-5.1 → T-5.2 → T-5.3 → T-6.7 → T-6.8
       → T-5.4 → T-5.5
       → T-5.6
       → T-6.3 → T-6.4 → T-6.5
```
~70h, 1 persona, el corazon de la refactorizacion.

### Track C: Infraestructura (F4)
```
T-4.1 → T-4.2 → T-4.3 → T-4.4 → T-4.5
```
~32h, 1 persona, SMB integration.

### Track D: Tests (F6)
```
T-6.1 → T-6.2 (paralelo con Track B)
T-6.6 (depende de T-5.2)
T-6.7 (depende de T-5.3)
T-6.8 (depende de T-5.3)
```
~48h, 1 persona tras F5.

### Track E: Release (F7 → F8)
```
T-7.1 → T-7.7 → T-8.1 → T-8.3 → T-8.6
T-7.2 → T-8.2 (paralelo)
T-7.3 → T-7.4 → T-7.5 (paralelo)
T-7.6 → T-8.4 (paralelo)
T-8.5 (independiente)
```
~110h, mezcla de paralelo y secuencial.

---

## Milestones

| Hito | Cuando | Que entregamos | Como medimos |
|------|--------|----------------|--------------|
| **M1: Fundacion** | Fin F3 | CI/CD funcionando, coverage, README, validacion L4-L11 | 450+ tests, CI verde, 70%+ cobertura |
| **M2: Memoria Persistente** | Fin F4 | Grafos L7 y L12 persisten en SMB, round-trip probado | 500+ tests, SMB integrado |
| **M3: APIs Unificadas** | Fin F5 | 20 niveles con mutation API, serializacion, adjacency maps | 700+ tests, API consistente en todos los niveles |
| **M4: Cobertura Total** | Fin F6 | 40+ tests por nivel, 720+ tests nuevos | 1300+ tests, 90%+ cobertura |
| **M5: Produccion** | Fin F7 | Benchmarks, CLI, pipelines cruzados, seguridad | 1800+ tests, 92%+ cobertura |
| **M6: v2.0.0 Release** | Fin F8 | npm publish, playground, landing page, WASM | 2000+ tests, 95%+ cobertura, release publico |

---

## Estimacion Total

| Fase | Horas | Tickets | Dependencias |
|------|-------|---------|--------------|
| F3 | 27h | 8 | — |
| F4 | 32h | 5 | F3 |
| F5 | 54h | 6 | F3 |
| F6 | 48h | 8 | F5 |
| F7 | 56h | 7 | F5+F6 |
| F8 | 54h | 6 | F7 |
| **Total** | **~271h** | **40 tickets** | — |

**En paralelo (3 tracks):** ~135h efectivas ≈ 17 dias laborales (8h/dia) ≈ 3.5 semanas.

**En secuencial (1 persona):** ~271h ≈ 34 dias ≈ 7 semanas.

---

## Que Significa "Terminar"

### Definition of Done por Nivel

Cada uno de los 20 niveles debe tener:

- [ ] **Mutation API:** `addNode`, `removeNode`, `addEdge`, `removeEdge`, `getNode(id)`, `getEdge(id)` con validacion de IDs duplicados y edges colgantes
- [ ] **Serializacion:** `toJSON()` y `static fromJSON(data)` para persistencia
- [ ] **Adjacency maps:** Estructura O(n+m) para queries de vecinos, no filtrados O(n*m)
- [ ] **40+ tests:** Tests de creacion, mutacion, serializacion, validacion, y casos borde
- [ ] **95%+ cobertura:** Medido por c8, reporte en CI
- [ ] **JSDoc completo:** Todas las clases, interfaces, metodos, y parametros documentados
- [ ] **toMermaid():** Visualizacion del grafo como diagrama Mermaid
- [ ] **validate():** Metodo de validacion de integridad del grafo
- [ ] **metrics():** Metodo de metricas (conteos, promedios, densidad)

### Definition of Done del Proyecto

- [ ] 2000+ tests, 0 failures
- [ ] 95%+ cobertura de codigo
- [ ] CI/CD pipeline: push a main → tests → benchmark → release
- [ ] npm package publico: `@cos/graph`
- [ ] Documentacion completa: README, API Reference, 20 Use Cases, Contributing
- [ ] CLI: `cos graph` comandos para todos los niveles
- [ ] Playground interactivo en terminal
- [ ] Landing page del proyecto

---

## Proximos Pasos Inmediatos

**Ahora mismo (Fase 3):** Terminar los 6 tickets restantes de F3 en paralelo:
1. T-3.2 + T-3.4 + T-3.5 comienzan juntos (todos dependen solo de T-3.1 que ya esta listo)
2. T-3.3 comienza despues de T-3.2
3. T-3.6 + T-3.7 comienzan despues de T-3.5

**Cuando F3 termine:** Saltar a F4 (SMB) o F5 (codigo) segun prioridad del negocio.

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Dependencias externas rotas | Baja | Alto | Zero-dep rule: 0 dependencias externas |
| Tests flaky en CI | Media | Medio | Timeouts generosos, retry en CI |
| Cobertura < 95% en niveles nuevos | Media | Medio | Tests primero, codigo despues (TDD) |
| SMB integration compleja | Media | Alto | Mock SMB en tests, integration test aparte |
| Scope creep | Alta | Alto | Tickets definidos, no agregar sin approval |