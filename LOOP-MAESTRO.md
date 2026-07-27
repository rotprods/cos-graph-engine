# LOOP MAESTRO — COS Graph Engine

> El ciclo vivo del proyecto: diseniar, planificar, ejecutar, validar,
> testear, refactorizar, debuggear — hasta el objetivo final.

---

## 0. EL OBJETIVO FINAL

### Vision

COS Graph Engine es un motor de grafos de 20 niveles, autocontenido, de
calidad de produccion, donde CADA nivel tiene el mismo estandar:

```
  ✅ Mutation API (addNode, removeNode, addEdge, removeEdge)
  ✅ Validacion (IDs duplicados, edges colgantes)
  ✅ Serializacion (toJSON / fromJSON)
  ✅ JSDoc completo (convencion de edges, parametros, returns)
  ✅ Adjacency maps (O(n+m) en vez de O(n*m))
  ✅ Test suite (40+ tests por nivel)
  ✅ Documentacion (README, CONTRIBUTING, API reference)
  ✅ Integracion SMB (Shared Memory Bus)
  ✅ Benchmark (comparacion antes/despues)
```

### Metricas objetivo

| Metrica | Hoy | Objetivo Final |
|---------|-----|----------------|
| Tests | 390 | 2000+ |
| Cobertura | ~70% | 95%+ |
| Niveles con mutation API | 2/20 | 20/20 |
| Niveles con serializacion | 1/20 | 20/20 |
| Tiempo CI | ~8min | <10min |
| Performance (todos los niveles) | L1,L3 | Todos |
| Documentacion | CHANGELOG | Sitio completo |
| Integracion SMB | 0/20 | 20/20 |

### Arbol de dependencias del objetivo

```
OBJETIVO FINAL
├── FASE 3: Consolidacion (herramientas)
│   ├── T-3.1 npm scripts
│   ├── T-3.2 benchmark dinamico
│   ├── T-3.3 auto-release
│   ├── T-3.4 coverage
│   ├── T-3.5 README
│   ├── T-3.6 CONTRIBUTING
│   ├── T-3.7 TypeDoc
│   └── T-3.8 validacion L4-L11
│
├── FASE 4: Integracion SMB
│   ├── T-4.1 Conectar L7 al SMB
│   ├── T-4.2 Conectar L12 al SMB
│   ├── T-4.3 Tests integracion SMB
│   ├── T-4.4 memory-manager AI Employee
│   └── T-4.5 Documentacion SMB
│
├── FASE 5: Homogeneizacion L4-L19
│   ├── T-5.1 Mutation API L4-L11
│   ├── T-5.2 Mutation API L12-L19
│   ├── T-5.3 Serializacion L4-L11
│   ├── T-5.4 Serializacion L12-L19
│   ├── T-5.5 Adjacency maps L4-L11
│   └── T-5.6 Adjacency maps L12-L19
│
├── FASE 6: Expansion de tests L4-L19
│   ├── T-6.1 L4 Call (40 tests)
│   ├── T-6.2 L5 CFG (40 tests)
│   ├── T-6.3 L6 DataFlow (40 tests)
│   ├── T-6.4 L8-L11 (160 tests)
│   ├── T-6.5 L12-L15 (160 tests)
│   └── T-6.6 L16-L19 (160 tests)
│
├── FASE 7: Endurecimiento
│   ├── T-7.1 Edge cases (empty, null, malformed)
│   ├── T-7.2 Error messages descriptivos
│   ├── T-7.3 Logging y tracing
│   ├── T-7.4 Rate limiting y backpressure
│   ├── T-7.5 Benchmarks comparativos totales
│   └── T-7.6 Performance profiling
│
├── FASE 8: Release y ecosistema
│   ├── T-8.1 Galeria de ejemplos
│   ├── T-8.2 Playground interactivo (dashboard)
│   ├── T-8.3 Documentacion de API completa
│   ├── T-8.4 Publicacion npm
│   ├── T-8.5 Release v2.0.0
│   └── T-8.6 Post-mortem del proyecto
│
└── META: /LOOP de diseño continuo
    └── Este documento
```

---

## 1. EL /LOOP — Ciclo de vida de cada fase

Cada fase del proyecto ejecuta el mismo ciclo de 7 pasos. El ciclo es
**recursivo**: cada paso puede contener sub-loops.

```
                  ┌─────────────────────────────────────┐
                  │           DISENIAR                   │
                  │  (que hay que hacer, arquitectura)   │
                  └────────────┬────────────────────────┘
                               │
                  ┌────────────▼────────────────────────┐
                  │           PLANIFICAR                 │
                  │  (tareas, estimaciones, orden)       │
                  └────────────┬────────────────────────┘
                               │
                  ┌────────────▼────────────────────────┐
                  │           EJECUTAR                   │
                  │  (implementar cambios)               │
                  └────────────┬────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
   ┌────────▼────────┐ ┌──────▼───────┐ ┌────────▼────────┐
   │    VALIDAR      │ │   TESTEAR    │ │  REFACTORIZAR   │
   │ (logica, diseño)│ │ (tests, CI)  │ │ (limpieza, perf)│
   └────────┬────────┘ └──────┬───────┘ └────────┬────────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                  ┌────────────▼────────────────────────┐
                  │          DEBUGGEAR                  │
                  │  (bugs, regresiones, fixes)         │
                  └────────────┬────────────────────────┘
                               │
                  ┌────────────▼────────────────────────┐
                  │       ¿TODO VERDE?                  │
                  │  (tests pasan, metricas ok)         │
                  └────────────┬────────────────────────┘
                               │
                    SI ┌────────┐ NO
                       │        │
                       ▼        └──→ volver a EJECUTAR
                                   (o REFACTORIZAR si es
                                    problema estructural)
```

### Ciclo completo (textual)

```
1. DISENIAR
   ├── Analisis del estado actual
   ├── Definir que debe cambiar
   ├── Decisiones de arquitectura
   ├── Documentar en TICKETS-*.md
   └── Output: documento de diseño

2. PLANIFICAR
   ├── Desglosar en tickets atomicos
   ├── Estimar tiempo por ticket
   ├── Ordenar por dependencias
   ├── Asignar prioridad (P0/P1/P2/P3)
   └── Output: lista de tickets ejecutable

3. EJECUTAR
   ├── Implementar cambios por ticket
   ├── Un ticket a la vez
   ├── Commits atomicos por ticket
   ├── Escribir tests mientras se implementa
   └── Output: codigo modificado + tests

4. VALIDAR
   ├── Verificar logica: los algoritmos son correctos?
   ├── Verificar diseño: las APIs son consistentes?
   ├── Verificar documentacion: JSDoc, README?
   ├── Verificar edge cases: empty, null, extremos?
   └── Output: lista de issues encontrados (si hay)

5. TESTEAR
   ├── Ejecutar suite completa (npm run test:all)
   ├── Ejecutar tests especificos del ticket
   ├── Verificar cobertura (si aplica)
   ├── Verificar benchmarks (si aplica)
   └── Output: resultados de tests

6. REFACTORIZAR
   ├── Solo si hay deuda tecnica identificada
   ├── Optimizar: O(n*m) → O(n+m)
   ├── Estandarizar: mismos patrones entre niveles
   ├── Limpiar: codigo muerto, imports no usados
   └── Output: codigo mejorado

7. DEBUGGEAR
   ├── Solo si tests fallan o validacion encuentra bugs
   ├── Reproducir el bug
   ├── Identificar causa raiz
   ├── Aplicar fix
   ├── Verificar que el fix no rompe nada (tests)
   └── Output: bug fixeado + test que lo prueba
```

### Reglas del /LOOP

1. **Un ticket a la vez.** No avanzar al siguiente ticket hasta que el actual
   haya completado el ciclo completo (pasos 1-7).

2. **Tests primero (cuando sea posible).** Si el ticket define una API nueva,
   escribir los tests ANTES de la implementacion (TDD).

3. **Si tests fallan → DEBUGGEAR.** No avanzar. No empezar el siguiente ticket.
   No refactorizar. Primero arreglar.

4. **Si validacion encuentra problemas → volver a EJECUTAR o REFACTORIZAR.**
   Si es un bug en la implementacion, volver a Ejecutar. Si es un problema
   estructural (API inconsistente, performance pobre), Refactorizar.

5. **Cada iteracion del loop produce un commit.** Commits atomicos por ticket.

6. **Cada fase completa produce un release.** Al finalizar todas las iteraciones
   de una fase, se corre la suite completa, se actualiza CHANGELOG, y se crea
   un tag.

---

## 2. LAS FASES — Desglose completo con iteraciones

### FASE 3: Consolidacion (herramientas y docs)

**Objetivo:** Que el proyecto sea facil de usar, contribuir, y mantener.

| Iteracion | Tickets | Descripcion | Estimacion |
|-----------|---------|-------------|------------|
| **3.1** | T-3.1 | npm scripts en package.json | 1h |
| **3.2** | T-3.8 | Validacion de grafos L4-L11 | 3h |
| **3.3** | T-3.4 | Cobertura de codigo con c8 | 3h |
| **3.4** | T-3.2 | benchmark-report dinamico | 3h |
| **3.5** | T-3.5 | README actualizado | 2h |
| **3.6** | T-3.3 | Auto-release en push a main | 4h |
| **3.7** | T-3.6 | CONTRIBUTING.md | 3h |
| **3.8** | T-3.7 | API Reference con TypeDoc | 8h |
| | | **Total fase** | **~27h** |

**/LOOP de ejemplo — Iteracion 3.1 (npm scripts):**

```
1. DISENIAR:
   Estado: package.json tiene 7 scripts, ninguno para las nuevas suites.
   Que: Agregar test:all, test:l1, test:l3, test:l7, benchmark, ci.
   Output: Lista de scripts a agregar en TICKETS-FASE3.md#T-3.1.

2. PLANIFICAR:
   1. Agregar test:all → 7 suites en secuencia
   2. Agregar test:mutation → L1+L3 mutation
   3. Agregar benchmark → benchmark-perf.ts
   4. Agregar benchmark:report → + generate HTML
   5. Agregar ci → test:all con flags
   6. Verificar que funcionan

3. EJECUTAR:
   Editar package.json scripts section. Agregar 8 scripts.
   Commit: "feat(scripts): add npm scripts for all test suites"

4. VALIDAR:
   - Los nombres son consistentes? (test:* para tests, benchmark* para perf)
   - Cubren todas las suites? (7 suites: run, diamond, mut-L1, mut-L3,
     consistency, L7, L12-19)
   - benchmark:report incluye benchmark + generate?

5. TESTEAR:
   - npm run test:all → 390 tests, 0 failures
   - npm run benchmark → benchmark output
   - npm run benchmark:report → benchmark + HTML generado

6. REFACTORIZAR:
   N/A para esta iteracion (son scripts, no codigo).

7. DEBUGGEAR:
   Si un script falla, revisar: rutas correctas? timeout suficiente?
   tsx disponible? corrige y repite 3-5.
```

---

### FASE 4: Integracion SMB

**Objetivo:** Conectar el Graph Engine con el Shared Memory Bus para
persistencia distribuida y memoria compartida entre agentes.

| Iteracion | Tickets | Descripcion | Estimacion |
|-----------|---------|-------------|------------|
| **4.1** | T-4.1 | Conectar L7 Compute al SMB | 8h |
| **4.2** | T-4.2 | Conectar L12 Memory al SMB | 8h |
| **4.3** | T-4.3 | Tests de integracion SMB ↔ Graph | 8h |
| **4.4** | T-4.4 | Operationalizar memory-manager AI Employee | 4h |
| **4.5** | T-4.5 | Documentacion de integracion | 4h |
| | | **Total fase** | **~32h** |

**/LOOP de ejemplo — Iteracion 4.1 (L7 → SMB):**

```
1. DISENIAR:
   Estado: ComputationalGraph tiene toJSON/fromJSON pero no persiste.
   Contexto: SMB es un servicio HTTP REST con API key.
   SDK: @higgsfield/shared-memory-bus-sdk.
   AI Employee: memory-manager (d15c77b9) para delegar.
   Sitio: shared-memory-bus.higgsfield.app.
   Token: smb-agent-2026-shared-secure-token.
   Que: Agregar saveToSMB() y loadFromSMB() a ComputationalGraph.
   Output: Diseño de la integracion — 2 metodos nuevos.

2. PLANIFICAR:
   1. Leer skill shared-memory-bus-skill
   2. Leer SDK @higgsfield/shared-memory-bus-sdk
   3. Agregar saveToSMB(name): guarda toJSON() como documento
   4. Agregar loadFromSMB(name): carga fromJSON() desde documento
   5. Agregar SMB_TOKEN como secret (website_secrets)
   6. Tests: guardar y cargar un grafo MLP
   7. Usar memory-manager AI Employee si aplica

3. EJECUTAR:
   - Leer SDK para entender API (HTTP POST/GET con token)
   - saveToSMB(graphName): POST /documents con toJSON()
   - loadFromSMB(graphName): GET /documents/{name} → fromJSON()
   - Manejar errores: SMB no disponible, token invalido
   - Commit: "feat(l7): add SMB persistence for ComputationalGraph"

4. VALIDAR:
   - saveToSMB guarda correctamente 11 nodos y 10 edges?
   - loadFromSMB restaura el grafo identico?
   - El grafo restaurado produce el mismo forward()?
   - Que pasa si SMB no esta disponible (fallback)?
   - Que pasa si el documento no existe?

5. TESTEAR:
   - Test unitario: saveToSMB mockeado → datos correctos
   - Test unitario: loadFromSMB mockeado → grafo identico
   - Test de integracion (si SMB esta disponible): round-trip real
   - npm run test:all → todo verde

6. REFACTORIZAR:
   - Extraer logica de SMB a un adapter separado
   - Inyectar dependencia SMB en lugar de llamada directa
   - ComputationalGraph no debe depender de SMB directamente

7. DEBUGGEAR:
   - Si el grafo no se restaura identico, revisar serializacion
   - Si SMB rechaza el token, verificar secret
   - Si timeout, ajustar config
```

---

### FASE 5: Homogeneizacion L4-L19

**Objetivo:** Que todos los niveles tengan las mismas capacidades que
L1, L3, y L7 (mutation API, serializacion, adjacency maps).

| Iteracion | Tickets | Descripcion | Niveles | Estimacion |
|-----------|---------|-------------|---------|------------|
| **5.1** | T-5.1 | Mutation API L4-L6 | L4, L5, L6 | 6h |
| **5.2** | T-5.2 | Mutation API L8-L11 | L8, L9, L10, L11 | 8h |
| **5.3** | T-5.3 | Mutation API L12-L19 | L12-L19 | 12h |
| **5.4** | T-5.4 | Serializacion L4-L11 | L4-L11 | 8h |
| **5.5** | T-5.5 | Serializacion L12-L19 | L12-L19 | 8h |
| **5.6** | T-5.6 | Adjacency maps L4-L19 | L4-L19 | 12h |
| | | **Total fase** | | **~54h** |

**/LOOP de ejemplo — Iteracion 5.1 (Mutation API L4-L6):**

```
1. DISENIAR:
   Estado actual de validacion:
     L4 (CallGraphBuilder): NO valida IDs duplicados, NO valida edges
     L5 (CFGBuilder): NO valida IDs de bloques, NO valida edges
     L6 (DataFlowGraph): NO valida IDs, NO valida edges
   Referencia: patron exacto de L1 (TICKET-002) y L3 (TICKET-008).
   Output: Disenio de mutation API para L4, L5, L6.

2. PLANIFICAR:
   1. L4: Agregar addNode/removeNode/addEdge/removeEdge
   2. L5: Agregar addBlock/removeBlock/addEdge/removeEdge
   3. L6: Agregar addNode/removeNode/addEdge/removeEdge
   4. Tests: 25 tests por nivel (misma estructura que L1+L3)

3. EJECUTAR:
   L4 (CallGraphBuilder):
     addNode: validar ID unico, agregar nodo
     removeNode: eliminar nodo + edges conectados
     addEdge: validar source/target existen
     removeEdge: eliminar por source+target

   L5 (CFGBuilder):
     addBlock/removeBlock: igual patron
     addEdge/removeEdge: igual patron
     Nota: L5 usa block IDs, no edge IDs

   L6 (DataFlowGraph):
     addNode/removeNode: igual patron
     addEdge/removeEdge: igual patron

   Commit: "feat(l4-l6): add mutation API with validation"

4. VALIDAR:
   - Los patrones son identicos entre L4, L5, L6, L1, L3?
   - Todos lanzan error en IDs duplicados?
   - Todos lanzan error en edges colgantes?
   - removeNode elimina edges conectados en todos?

5. TESTEAR:
   - 25 tests x 3 niveles = 75 tests nuevos
   - npm run test:all → 465 tests, 0 failures
   - Verificar que tests existentes no se rompieron

6. REFACTORIZAR:
   - Extraer logica de validacion a un helper compartido?
   - O mantener cada nivel autocontenido (zero-dep rule)?
   - Decision: mantener autocontenido por ahora (cada nivel es
     independiente por diseño)

7. DEBUGGEAR:
   - Si algun test de L4 existente falla, revisar cambios
   - Si addNode rompe createGraph existente, revisar compatibilidad
```

---

### FASE 6: Expansion de tests L4-L19

**Objetivo:** Cada nivel tiene 40+ tests que cubren todas las operaciones.

| Iteracion | Tickets | Descripcion | Tests nuevos | Estimacion |
|-----------|---------|-------------|-------------|------------|
| **6.1** | T-6.1 | L4 Call Graph | 40 | 4h |
| **6.2** | T-6.2 | L5 CFG | 40 | 4h |
| **6.3** | T-6.3 | L6 DataFlow | 40 | 4h |
| **6.4** | T-6.4 | L8-L11 (Knowledge, Semantic, Embedding, GraphRAG) | 160 | 12h |
| **6.5** | T-6.5 | L12-L15 (Memory, Agent, Tool, Workflow) | 160 | 12h |
| **6.6** | T-6.6 | L16-L19 (Network, Social, Biological, Molecular) | 160 | 12h |
| | | **Total fase** | **600** | **~48h** |

**Estructura de tests por nivel (40 tests):**

```
Test Suite L{N} — {Nombre}
├── Creacion (5 tests)
│   ├── create devuelve ID valido
│   ├── create con nombre default
│   ├── create vacio
│   ├── create sin parametros
│   └── create no lanza error
│
├── Nodos (10 tests)
│   ├── addNode con ID unico
│   ├── addNode con ID duplicado → throw
│   ├── addNode con datos completos
│   ├── addNode con datos minimos
│   ├── removeNode existente
│   ├── removeNode inexistente → throw
│   ├── removeNode con edges conectados → edges eliminados
│   ├── removeNode y luego addNode con mismo ID funciona
│   ├── multiple addNode en secuencia
│   └── addNode despues de removeNode
│
├── Edges (10 tests)
│   ├── addEdge con source/target validos
│   ├── addEdge con source inexistente → throw
│   ├── addEdge con target inexistente → throw
│   ├── addEdge verifica tipo
│   ├── removeEdge por source+target
│   ├── removeEdge inexistente → throw
│   ├── addEdge despues de removeNode
│   ├── multiple addEdge
│   ├── removeEdge solo elimina el edge correcto
│   └── addEdge con caso borde
│
├── Operaciones especificas del nivel (10 tests)
│   ├── [L4] enterCall/exitCall tracing
│   ├── [L5] buildIfThenElse estructura
│   ├── [L6] findBottlenecks logica
│   ├── [L8] sparql query basica
│   ├── [L9] lca taxonomia
│   ├── [L10] buildKNN estructura
│   ├── [L11] retrieve hibrido
│   ├── [L12] recall asociativo
│   ├── [L13] delegationChain
│   ├── [L14] route entre herramientas
│   ├── [L15] execute workflow
│   ├── [L16] shortestPath BFS
│   ├── [L17] mutualFriends
│   ├── [L18] simulateFiring
│   └── [L19] detectRings
│
├── Edge cases (5 tests)
│   ├── Grafo vacio
│   ├── Nodo sin edges
│   ├── Todos los nodos desconectados
│   ├── Operacion en grafo inexistente → throw
│   └── toMermaid con grafo vacio
│
└── Serializacion (si aplica, 10 tests)
    ├── toJSON estructura basica
    ├── fromJSON restaura nodos
    ├── Round-trip produce datos identicos
    ├── fromJSON con datos invalidos → throw
    └── Serializacion despues de mutacion
```

---

### FASE 7: Endurecimiento (hardening)

**Objetivo:** El motor es robusto contra casos borde, tiene mensajes de error
descriptivos, y funciona bajo condiciones extremas.

| Iteracion | Tickets | Descripcion | Estimacion |
|-----------|---------|-------------|------------|
| **7.1** | T-7.1 | Edge cases en todos los niveles | 8h |
| **7.2** | T-7.2 | Mensajes de error descriptivos | 6h |
| **7.3** | T-7.3 | Logging y tracing | 8h |
| **7.4** | T-7.4 | Rate limiting y backpressure | 4h |
| **7.5** | T-7.5 | Benchmarks comparativos totales | 6h |
| **7.6** | T-7.6 | Performance profiling | 8h |
| | | **Total fase** | **~40h** |

**/LOOP de ejemplo — Iteracion 7.2 (mensajes de error):**

```
1. DISENIAR:
   Estado actual: mensajes como "Node not found", "Edge not found".
   Objetivo: cada mensaje de error debe decir:
     - QUE paso ("Node X not found")
     - DONDE paso ("in graph Y")
     - QUE esperaba ("expected one of: A, B, C")
     - POR QUE (si aplica: "because it was removed")
   Output: Estandar de mensajes de error para todo el proyecto.

2. PLANIFICAR:
   1. Revisar todos los throw en L0-L19
   2. Categorizar por tipo de error (not found, duplicate, invalid)
   3. Aplicar formato estandar a cada uno
   4. Tests que verifiquen mensajes exactos

3. EJECUTAR:
   Formato estandar:
     "[Nivel] Operacion — Detalle: contexto"

   Ejemplos:
     "[L1] addNode — Duplicate node ID 'x': node already exists in graph 'main'"
     "[L3] removeEdge — Edge not found: no edge from 'a' to 'b' in graph 'deps'"
     "[L7] forward — Sink node not found: graph has no nodes without outgoing edges"

   Commit: "fix(all): standardize error messages across all levels"

4. VALIDAR:
   - Todos los mensajes siguen el formato estandar?
   - Incluyen suficiente contexto para debuggear sin mirar el codigo?
   - Son consistentes entre niveles?
   - No exponen informacion interna (no stack traces en mensajes)?

5. TESTEAR:
   - Tests existentes que verifican throw → actualizar mensajes esperados
   - npm run test:all → todo verde
   - Verificar que los mensajes nuevos no rompen tests

6. REFACTORIZAR:
   - Extraer formato a funcion helper: graphError(level, op, detail)
   - O mantener inline para claridad (cada error es unico)

7. DEBUGGEAR:
   - Si un test falla por mensaje de error, actualizar test
   - Si un mensaje es confuso, mejorarlo
```

---

### FASE 8: Release y ecosistema

**Objetivo:** COS Graph Engine v2.0.0 publicado, documentado, y demostrable.

| Iteracion | Tickets | Descripcion | Estimacion |
|-----------|---------|-------------|------------|
| **8.1** | T-8.1 | Galeria de ejemplos (uno por nivel) | 8h |
| **8.2** | T-8.2 | Playground interactivo en dashboard | 12h |
| **8.3** | T-8.3 | Documentacion de API completa (TypeDoc site) | 8h |
| **8.4** | T-8.4 | Publicacion npm (@cos/graph) | 4h |
| **8.5** | T-8.5 | Release v2.0.0 con CI/CD | 2h |
| **8.6** | T-8.6 | Post-mortem del proyecto | 4h |
| | | **Total fase** | **~38h** |

---

## 3. RESUMEN GLOBAL

### Mapa completo de fases e iteraciones

```
FASE 1: REFACTOR (COMPLETADA) ──── 14 tickets (15 cambios reales)
  ├── L1 (4): queue, mutation, validation, docs
  ├── L3 (5): adjacency x3, mutation, docs
  └── L7 (6): dead param, multi-logit, docs x2, serialization, bug
  Resultado: 390 tests, 250x perf, 0 fallas

FASE 2: ENTREGA (COMPLETADA) ────── 3 tickets
  ├── CI pipeline (8 jobs)
  ├── HTML benchmark report
  └── Release notes + plan maestro
  Resultado: CI/CD funcionando, documentacion lista

FASE 3: CONSOLIDACION (~27h) ────── 8 tickets
  3.1 npm scripts................1h
  3.2 Validacion L4-L11..........3h
  3.3 Cobertura c8...............3h
  3.4 Benchmark dinamico.........3h
  3.5 README....................2h
  3.6 Auto-release...............4h
  3.7 CONTRIBUTING...............3h
  3.8 TypeDoc...................8h
  Meta: tests=450, coverage=80%

FASE 4: INTEGRACION SMB (~32h) ──── 5 tickets
  4.1 L7 → SMB...................8h
  4.2 L12 → SMB..................8h
  4.3 Tests integracion..........8h
  4.4 memory-manager.............4h
  4.5 Documentacion..............4h
  Meta: 20 niveles conectados al SMB

FASE 5: HOMOGENEIZACION (~54h) ──── 6 tickets
  5.1 Mutation L4-L6.............6h
  5.2 Mutation L8-L11............8h
  5.3 Mutation L12-L19..........12h
  5.4 Serializacion L4-L11.......8h
  5.5 Serializacion L12-L19......8h
  5.6 Adjacency L4-L19..........12h
  Meta: 20/20 niveles con API completa

FASE 6: TESTS (~48h) ────────────── 6 tickets
  6.1 L4 Call....................4h  (+40)
  6.2 L5 CFG....................4h  (+40)
  6.3 L6 DataFlow...............4h  (+40)
  6.4 L8-L11...................12h  (+160)
  6.5 L12-L15..................12h  (+160)
  6.6 L16-L19..................12h  (+160)
  Meta: tests=2000+, cobertura=95%+

FASE 7: ENDURECIMIENTO (~40h) ───── 6 tickets
  7.1 Edge cases................8h
  7.2 Error messages.............6h
  7.3 Logging..................8h
  7.4 Rate limiting..............4h
  7.5 Benchmarks................6h
  7.6 Profiling.................8h
  Meta: produccion-ready

FASE 8: RELEASE (~38h) ──────────── 6 tickets
  8.1 Galeria de ejemplos........8h
  8.2 Playground................12h
  8.3 API docs..................8h
  8.4 npm publish...............4h
  8.5 v2.0.0 release............2h
  8.6 Post-mortem...............4h
  Meta: COS Graph Engine v2.0.0
```

### Progresion de metricas fase a fase

```
Metrica         | Hoy  | F3   | F4   | F5   | F6   | F7   | F8   | Final
----------------|------|------|------|------|------|------|------|-------
Tests           | 390  | 450  | 500  | 700  | 1300 | 1800 | 2000 | 2000+
Cobertura       | ~70% | 80%  | 80%  | 85%  | 90%  | 95%  | 95%  | 95%+
Mutation API    | 2/20 | 2/20 | 2/20 | 20/20| 20/20| 20/20| 20/20| 20/20
Serializacion   | 1/20 | 1/20 | 2/20 | 20/20| 20/20| 20/20| 20/20| 20/20
Adjacency maps  | 2/20 | 2/20 | 2/20 | 20/20| 20/20| 20/20| 20/20| 20/20
CI/CD           | 8job | 10job| 10job| 12job| 12job| 15job| 15job| 15job
Integracion SMB | 0/20 | 0/20 | 20/20| 20/20| 20/20| 20/20| 20/20| 20/20
Documentacion   | 4doc | 6doc | 6doc | 6doc | 6doc | 6doc | full | full
```

### Tiempo total estimado

```
Fase 3:   27h
Fase 4:   32h
Fase 5:   54h
Fase 6:   48h
Fase 7:   40h
Fase 8:   38h
         ─────
Total:  ~239h (~30 dias de 8h, ~6 semanas)
```

### Dependencias entre fases

```
FASE 3 (tooling)
  │
  ├──→ FASE 4 (SMB) — necesita T-3.5 (README) para docs
  │
  ├──→ FASE 5 (homogenizacion) — necesita T-3.2 (benchmark dinamico)
  │      para medir impacto de cambios de performance
  │
  ├──→ FASE 6 (tests) — necesita FASE 5 (las APIs deben existir
  │      antes de testearlas)
  │
  ├──→ FASE 7 (hardening) — necesita FASE 6 (tests pasando antes
  │      de endurecer)
  │
  └──→ FASE 8 (release) — necesita TODO lo anterior
```

---

## 4. EL /LOOP COMO HERRAMIENTA DIARIA

### Formato de una sesion de trabajo

Cada vez que te sientas a trabajar, sigues este patron:

```
SESION: [Fecha] — [Fase X, Iteracion Y]

1. ¿QUE VAMOS A HACER?
   Ticket: T-X.Y — [titulo]
   Objetivo de la sesion: [que logramos hoy]

2. DISENIAR (5 min)
   - Leer el ticket
   - Revisar estado actual del codigo
   - Decidir enfoque

3. PLANIFICAR (5 min)
   - Dividir en pasos concretos
   - Estimar cada paso

4. EJECUTAR (tiempo variable)
   - Implementar paso a paso
   - Commits atomicos

5. VALIDAR (10 min)
   - Revision logica del cambio
   - Verificar contra el diseño original

6. TESTEAR (5 min)
   - npm run test:all
   - Tests especificos del area

7. REFACTORIZAR? (solo si es necesario)
   - El cambio es limpio?
   - Sigue los patrones establecidos?

8. DEBUGGEAR? (solo si tests fallan)
   - Que falla?
   - Por que?
   - Fix?

9. CIERRE
   - Todo verde?
   - Proximo ticket listo?
```

### Checklist de calidad por iteracion

```
[ ] 1. Tests pasan (npm run test:all → 0 failures)
[ ] 2. No hay codigo muerto (parametros no usados, imports)
[ ] 3. JSDoc completo en metodos nuevos
[ ] 4. Sigue el patron de los niveles existentes
[ ] 5. Mensajes de error descriptivos
[ ] 6. Edge cases considerados (empty, null, inexistente)
[ ] 7. Commit unico por ticket, mensaje descriptivo
[ ] 8. CHANGELOG actualizado (si aplica)
[ ] 9. README actualizado (si aplica)
[ ] 10. Benchmark verificado (si aplica)
```

---

## 5. CODIGO DEL /LOOP (version ejecutable)

```typescript
// /LOOP — El ciclo vivo del proyecto COS Graph Engine
// Ejecutable conceptual: cada fase es una llamada a loop()

interface Ticket {
  id: string;
  fase: number;
  titulo: string;
  nivel: string;       // L1, L3, L4-L19, etc.
  tipo: 'feature' | 'bugfix' | 'performance' | 'documentation' | 'testing' | 'infra';
  prioridad: 'P0' | 'P1' | 'P2' | 'P3';
  estimacion: number;  // horas
  estado: 'diseniando' | 'planificado' | 'ejecutando' | 'validando' |
          'testeando' | 'refactorizando' | 'debuggeando' | 'completado';
  dependencias: string[];
}

interface Fase {
  id: number;
  nombre: string;
  tickets: Ticket[];
  objetivo: string;
  metaMetrica: Partial<Metricas>;
}

interface Metricas {
  tests: number;
  cobertura: number;    // %
  mutationAPICount: number;
  serializacionCount: number;
  adjMapCount: number;
  smbIntegration: boolean;
  docsCompleta: boolean;
  ciJobs: number;
}

function loop(ticket: Ticket): boolean {
  // PASO 1: DISENIAR
  diseniar(ticket);

  // PASO 2: PLANIFICAR
  const pasos = planificar(ticket);

  // PASO 3-7: CICLO PRINCIPAL
  let verde = false;
  let intentos = 0;

  while (!verde && intentos < 3) {
    intentos++;

    // PASO 3: EJECUTAR
    for (const paso of pasos) {
      ejecutar(paso);
    }

    // PASO 4: VALIDAR
    const issues = validar(ticket);
    if (issues.length > 0) {
      refactorizar(ticket, issues);  // PASO 6
      continue;  // volver a ejecutar
    }

    // PASO 5: TESTEAR
    const resultados = testear();
    if (!resultados.ok) {
      debuggear(ticket, resultados.errores);  // PASO 7
      continue;  // volver a ejecutar
    }

    verde = true;
  }

  if (verde) {
    ticket.estado = 'completado';
    actualizarMetricas(ticket);
    return true;
  }

  return false;  // escalar — no se pudo resolver en 3 intentos
}

function ejecutarFase(fase: Fase): boolean {
  console.log(`\n=== FASE ${fase.id}: ${fase.nombre} ===`);
  console.log(`Objetivo: ${fase.objetivo}\n`);

  for (const ticket of fase.tickets) {
    console.log(`\n--- Ticket ${ticket.id}: ${ticket.titulo} ---`);
    const ok = loop(ticket);
    if (!ok) {
      console.error(`FALLO: Ticket ${ticket.id} no se pudo completar`);
      return false;
    }
    console.log(`✓ Ticket ${ticket.id} completado`);
  }

  console.log(`\n✓ Fase ${fase.id} completada`);
  reportarMetricas(fase);
  return true;
}

// Uso:
// const fase3 = { id: 3, nombre: 'Consolidacion', tickets: [T3_1, T3_2, ...] };
// ejecutarFase(fase3);
```

---

## 6. GLOSARIO DEL /LOOP

| Termino | Significado |
|---------|-------------|
| **Fase** | Bloque grande de trabajo con objetivo propio (ej: "Consolidacion") |
| **Iteracion** | Unidad minima de trabajo dentro de una fase (1 ticket) |
| **Ticket** | Tarea atomica, implementable y testeable independientemente |
| **/LOOP** | Ciclo de 7 pasos que se ejecuta por cada ticket |
| **Diseñar** | Decidir QUE hacer y COMO hacerlo (decisiones de arquitectura) |
| **Planificar** | Desglosar en pasos concretos con estimaciones |
| **Ejecutar** | Implementar los cambios en codigo |
| **Validar** | Verificar que los cambios son correctos conceptualmente |
| **Testear** | Ejecutar tests automatizados |
| **Refactorizar** | Mejorar estructura sin cambiar comportamiento |
| **Debuggear** | Encontrar y corregir bugs |
| **P0** | Critico — bloquea todo lo demas |
| **P1** | Importante — debe hacerse pronto |
| **P2** | Normal — hacer cuando se pueda |
| **P3** | Bonus — hacer solo si sobra tiempo |
| **Zero-dep rule** | Sin dependencias externas excepto Stripe, SendGrid, LangChain, Algolia |
| **Adjacency map** | Estructura Map<nodeId, Edge[]> para lookup O(1) de vecinos |
| **SMB** | Shared Memory Bus — servicio de memoria distribuida |
| **DOM** | Definition of Done — condiciones para marcar un ticket como completado |
