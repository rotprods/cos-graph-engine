# PLAN DE REFACTORIZACION — 20 FASES

> COS Graph Engine: refactorizar los 20 niveles al mismo nivel de calidad.
> Estado actual: L1, L3, L7 refactorizados (Fase 1). L4-L11 con validacion basica. L0, L2, L12-L19 sin refactorizar.
> Meta: 20 niveles con mutation API, serializacion, adjacency maps, 40+ tests, 95% coverage.

---

## Arquitectura de Referencia

Cada nivel debe implementar estos 6 patrones:

```
Patron              | Que resuelve                      | Medida
--------------------|-----------------------------------|----------------
Mutation API        | addNode/removeNode/addEdge/removeEdge | API consistente entre niveles
Serialization       | toJSON/fromJSON                   | Persistencia e intercambio
Adjacency Maps      | O(n+m) en lugar de O(n*m)         | Performance escalable
Validacion          | IDs duplicados, edges colgantes   | Integridad de datos
Tests               | 40+ tests por nivel               | 95%+ coverage
JSDoc               | API documentada                   | DX consistente
```

---

## Fase 0: Fundacion (8h)

### T-0.1: Refactorizar L0 — Visual Graph (4h)

**Estado actual:** ~165 lineas, 3 renderers (Mermaid, Graphviz, ASCII), 0 tests.

**Que hacer:**
1. Mutation API: `addNode(id, label, type?)`, `addEdge(source, target, label?)`, `removeNode(id)`, `removeEdge(source, target)`
2. Serialization: `toJSON()` y `fromJSON(data)` en VisualGraph y cada renderer
3. Adjacency maps: precalcular lista de adyacencia para render rapido
4. Validacion: IDs duplicados en nodos, source/target existen en edges
5. Tests: 40 tests (creacion, render Mermaid, render Graphviz, render ASCII, serializacion, validacion)
6. JSDoc: todas las clases, metodos, interfaces documentadas

**Archivos:** `packages/graph/src/level0-visual.ts`, `scripts/test-level0-visual.ts`

### T-0.2: Refactorizar L2 — State Machine (4h)

**Estado actual:** ~250 lineas, FSM completa, 0 tests.

**Que hacer:**
1. Mutation API: `addState(id, label, type?)`, `addTransition(from, to, event, guard?)`, `removeState(id)`, `removeTransition(event)`
2. Serialization: `toJSON()` y `fromJSON(data)` en StateMachine
3. Adjacency maps: precalcular transiciones por estado origen
4. Validacion: estado inicial debe existir, transiciones deben conectar estados existentes, no duplicados
5. Tests: 40 tests (creacion, transiciones, guards, timeouts, serializacion, validacion, errores)
6. JSDoc: API completa documentada

**Archivos:** `packages/graph/src/level2-state.ts`, `scripts/test-level2-state.ts`

---

## Fase 1: Core Refactorizado (Completado)

### T-1.1: L1 Execution Graph — ✅ Completado
- Queue O(n+m) planificacion topologica
- Mutation API, serializacion, adjacency maps
- 22 tests L1 diamond + 22 tests L1 mutation

### T-1.2: L3 Dependency Graph — ✅ Completado
- Resolucion O(n+m) con deteccion de ciclos
- Mutation API, serializacion, adjacency maps
- 32 tests L3 consistency + 25 tests L3 mutation

### T-1.3: L7 Compute Graph — ✅ Completado
- Forward/backward propagation, cross-entropy
- MLP builder, serializacion, adjacency maps
- 61 tests L7 compute

---

## Fase 2: Entrega (Completado)

- CI pipeline, benchmark report, CHANGELOG, release notes
- 390 tests, 0 failures

---

## Fase 3: Consolidacion (En Progreso — 2/8 tickets)

### T-3.1: npm scripts — ✅ Completado
### T-3.2: benchmark-report dinamico (3h)
### T-3.3: Auto-release en push a main (4h)
### T-3.4: Cobertura de codigo con c8 (3h)
### T-3.5: README actualizado (2h)
### T-3.6: CONTRIBUTING.md (3h)
### T-3.7: API Reference con TypeDoc (8h)
### T-3.8: Validacion de grafos L4-L11 — ✅ Completado

---

## Fase 4: Integracion SMB (32h)

### T-4.1: Conectar L7 al Shared Memory Bus (8h)
- `saveToSMB()`: serializa L7 a JSON, lo escribe en SMB
- `loadFromSMB()`: lee de SMB, reconstruye ComputationalGraph
- Tests: round-trip L7 → SMB → L7

### T-4.2: Conectar L12 al Shared Memory Bus (8h)
- `saveToSMB()` y `loadFromSMB()` en MemoryGraphEngine
- Persistencia automatica: cada mutacion guarda en SMB

### T-4.3: Tests de integracion SMB (8h)
- Round-trip completo: 20 niveles guardar/cargar
- Pruebas de concurrencia, conflictos, recuperacion

### T-4.4: Operacionalizar memory-manager AI Employee (4h)
- Delegar operaciones SMB al AI Employee

### T-4.5: Documentacion SMB (4h)
- `docs/smb-integration.md` con ejemplos de uso

---

## Fase 5: Homogeneizacion L4-L19 (54h)

### T-5.1: Mutation API L4-L6 (6h)
**L4 Call Graph:** `addNode`, `removeNode`, `addEdge`, `removeEdge`, `getNode(id)`, `getEdge(id)`
**L5 CFG:** `addBlock`, `removeBlock`, `addEdge`, `removeEdge`, `getBlock(id)`
**L6 DataFlow:** `addNode`, `removeNode`, `addEdge`, `removeEdge`

### T-5.2: Mutation API L8-L11 (8h)
**L8 Knowledge:** `addEntity`, `removeEntity`, `addRelation`, `removeRelation`
**L9 Semantic:** `addNode`, `removeNode`, `addEdge`, `removeEdge`
**L10 Embedding:** `addNode`, `removeNode`
**L11 GraphRAG:** `addChunk`, `removeChunk`, `addEntity`, `addRelation`

### T-5.3: Mutation API L12-L19 (12h)
8 niveles, cada uno con `addNode`/`removeNode`/`addEdge`/`removeEdge`:
**L12 Memory, L13 Agent, L14 Tool, L15 Workflow, L16 Network, L17 Social, L18 Bio, L19 Molecular**

### T-5.4: Serializacion L4-L11 (8h)
`toJSON()` y `fromJSON(data)` en 7 niveles, siguiendo el patron de L7.

### T-5.5: Serializacion L12-L19 (8h)
`toJSON()` y `fromJSON(data)` en 8 niveles.

### T-5.6: Adjacency Maps L4-L19 (12h)
Reemplazar filtrados O(n*m) por adjacency maps O(n+m) en todos los niveles.
- L4: adjacency list para edges de llamada
- L5: adjacency list para edges de control flow
- L6: adjacency list para edges de data flow
- L8-L11: adjacency list para relaciones/edges
- L12-L19: adjacency list para edges de cada dominio

---

## Fase 6: Expansion de Tests (48h)

### T-6.1: Tests L0 Visual Graph (4h)
40 tests: render Mermaid, Graphviz, ASCII, serializacion, validacion, edge cases.

### T-6.2: Tests L2 State Machine (4h)
40 tests: transiciones, guards, timeouts, entry/exit actions, serializacion, errores.

### T-6.3: Tests L4 Call Graph (4h)
40 tests: creacion de llamadas, tracing, flame graph, hot paths, validacion, serializacion.

### T-6.4: Tests L5 CFG (4h)
40 tests: bloques, edges, if/then/else, loops, switch, dominators, complejidad ciclomatica.

### T-6.5: Tests L6 DataFlow (4h)
40 tests: pipelines, bottlenecks, critical path, fan-in/fan-out, validacion.

### T-6.6: Tests L8-L11 (12h)
160 tests (40x nivel): Knowledge, Semantic, Embedding, GraphRAG.

### T-6.7: Tests L12-L15 (12h)
160 tests (40x nivel): Memory, Agent, Tool, Workflow.

### T-6.8: Tests L16-L19 (12h)
160 tests (40x nivel): Network, Social, Biological, Molecular.

---

## Fase 7: Rendimiento (24h)

### T-7.1: Benchmarks L0-L3 (6h)
Benchmarks de rendimiento para Visual, Execution, State, Dependency.

### T-7.2: Benchmarks L4-L11 (8h)
Benchmarks de call tracing, CFG analysis, dataflow, knowledge graph, embeddings, GraphRAG.

### T-7.3: Benchmarks L12-L19 (6h)
Benchmarks de memory recall, agent delegation, tool routing, workflow execution, network path, social graph, biological simulation, molecular fingerprint.

### T-7.4: Benchmark Report Dinamico (4h)
Generar HTML report con graficos de rendimiento, comparacion entre niveles, historico de ejecuciones.

---

## Fase 8: Integracion Cruzada (24h)

### T-8.1: Pipeline L4 → L5 → L6 (6h)
Integrar Call Graph → CFG → DataFlow: un programa se traza como calls, se analiza como CFG, se optimiza como dataflow.

### T-8.2: Pipeline L8 → L9 → L10 → L11 (8h)
Integrar Knowledge → Semantic → Embedding → GraphRAG: una consulta navega ontologias, expande semanticamente, busca por embedding, y retorna con contexto de grafo.

### T-8.3: Pipeline L12 → L13 → L14 → L15 (6h)
Integrar Memory → Agent → Tool → Workflow: un agente recuerda, delega, usa herramientas, y ejecuta workflows.

### T-8.4: Pipeline L16 → L17 → L18 → L19 (4h)
Integrar Network → Social → Bio → Molecular: un nodo de infraestructura se mapea a equipos (social), proteinas (bio), moleculas (molecular).

---

## Fase 9: CLI y Herramientas (16h)

### T-9.1: CLI Unificada (8h)
Comando `cos graph` para operar cualquier nivel desde terminal:
```
cos graph exec --file workflow.json
cos graph analyze --level L4 --trace profile.json
cos graph render --mermaid --output diagram.md
cos graph smb --save --level L7 --id my-graph
```

### T-9.2: Visualizador Web (8h)
Panel web para visualizar cualquier grafo: arrastrar nodos, colorear por tipo, exportar a PNG/SVG.

---

## Fase 10: Seguridad y Validacion (16h)

### T-10.1: Validacion de Esquemas (8h)
- JSON Schema para cada nivel
- Validacion de entrada/salida en mutation APIs
- Sanitizacion de IDs y nombres

### T-10.2: Security Audit (8h)
- Inyeccion de IDs en queries
- Denial of service en grafos gigantes
- Timeout en operaciones largas
- Rate limiting en APIs

---

## Fase 11: Internationalizacion (8h)

### T-11.1: Render multilingue (4h)
MermaidRenderer con labels en ES/EN/PT/FR/DE.

### T-11.2: Documentacion i18n (4h)
README, API docs, use cases en ES y EN.

---

## Fase 12: Plugins y Extensiones (16h)

### T-12.1: Plugin System (8h)
- Hook system: beforeAddNode, afterAddEdge, onRemoveNode
- Plugins externos: importar/exportar en formatos CSV, JSON, GraphML

### T-12.2: Marketplace de Plugins (8h)
Catalogo de plugins comunitarios, sistema de versiones, dependencias.

---

## Fase 13: WebAssembly (20h)

### T-13.1: Runtime WASM (8h)
Compilar L1, L3, L7 a WebAssembly para rendimiento nativo en navegador.

### T-13.2: SDK WASM (8h)
Bindings para JS/TS, Python, Rust desde el runtime WASM.

### T-13.3: Benchmarks WASM vs JS (4h)
Comparacion de rendimiento en navegador, Node, Deno, Bun.

---

## Fase 14: GraphQL API (16h)

### T-14.1: Schema GraphQL (8h)
Schema completo para los 20 niveles:
```graphql
type Query {
  graph(level: Int!, id: ID!): Graph
  search(level: Int!, query: String!): [Node]
}
type Mutation {
  addNode(level: Int!, input: NodeInput!): Node
  addEdge(level: Int!, input: EdgeInput!): Edge
}
```

### T-14.2: Resolvers y Persistencia (8h)
Resolvers conectados a SMB, queries paginadas, mutations batch.

---

## Fase 15: Machine Learning Integrado (24h)

### T-15.1: L7 como motor de inferencia (8h)
- Integrar L7 con L10 Embeddings: clasificacion sobre vectores
- Integrar L7 con L11 GraphRAG: reranking de resultados por red neuronal

### T-15.2: Graph Neural Networks (8h)
- GCN (Graph Convolutional Network) sobre L8-L11
- Node classification, link prediction, graph classification

### T-15.3: AutoML (8h)
- Busqueda automatica de arquitectura de redes (L7)
- Optimizacion de hiperparametros sobre grafos

---

## Fase 16: Tiempo Real (16h)

### T-16.1: Streaming de Grafos (8h)
- WebSocket API para actualizaciones en tiempo real
- Diferencial de cambios (patches, no grafos completos)

### T-16.2: Reactividad (8h)
- Observables: `onNodeAdded`, `onEdgeRemoved`, `onStateChanged`
- Subscripciones selectivas por nivel, tipo, o patron

---

## Fase 17: Persistencia y Escalabilidad (20h)

### T-17.1: Sharding de Grafos (8h)
- Particionamiento horizontal por nivel o por dominio
- Shard key: nivel + hash de id

### T-17.2: Cache Multinivel (6h)
- L1: cache en memoria (LRU)
- L2: cache en SMB (TTL)
- L3: cache en disco (serializado)

### T-17.3: Replicacion (6h)
- Master-slave para grafos de lectura pesada
- Multi-master para grafos distribuidos

---

## Fase 18: DX y Herramientas (16h)

### T-18.1: Playground Interactivo (8h)
- REPL en terminal para experimentar con cada nivel
- Comandos: `cos playground L4` para entrar al REPL de Call Graph

### T-18.2: Tutoriales Interactivos (8h)
- 20 tutoriales (uno por nivel) en el playground
- `cos tutorial L17` → guia paso a paso de Social Graph

---

## Fase 19: Estandarizacion y Formatos (12h)

### T-19.1: Import/Export Universal (6h)
- GraphML, GEXF, GDF, JSON, CSV, DOT
- Migracion entre formatos: `cos graph convert input.gml output.dot`

### T-19.2: Compatibilidad con Cypher/SPARQL (6h)
- Consultas estilo Cypher sobre L8-L11
- `cos graph query "MATCH (p:Person)-[:developed]->(t:Theory) RETURN p, t"`

---

## Fase 20: Release y Ecosistema (24h)

### T-20.1: v2.0.0 Release (8h)
- CHANGELOG completo, release notes, versionado semantico
- Paquetes npm: `@cos/graph`, `@cos/visual`, `@cos/ml`, `@cos/bio`, `@cos/chem`

### T-20.2: Landing Page y Documentacion (8h)
- cosgraph.dev: landing page con ejemplos interactivos
- Documentacion completa con tutoriales, API reference, use cases

### T-20.3: Comunidad (8h)
- GitHub Issues plantillas, Discussions, Contributing Guide
- Ejemplos en CodeSandbox, StackBlitz, RunKit

---

## Resumen de Fases

| Fase | Nombre | Tickets | Horas | Depende de |
|------|--------|---------|-------|------------|
| 0 | Fundacion | 2 | 8h | — |
| 1 | Core Refactorizado | 3 | ✅ | — |
| 2 | Entrega | 5 | ✅ | Fase 1 |
| 3 | Consolidacion | 8 | ~27h | Fase 2 |
| 4 | Integracion SMB | 5 | ~32h | Fase 3 |
| 5 | Homogeneizacion L4-L19 | 6 | ~54h | Fase 3 |
| 6 | Expansion de Tests | 8 | ~48h | Fase 5 |
| 7 | Rendimiento | 4 | ~24h | Fase 6 |
| 8 | Integracion Cruzada | 4 | ~24h | Fase 6 |
| 9 | CLI y Herramientas | 2 | ~16h | Fase 6 |
| 10 | Seguridad y Validacion | 2 | ~16h | Fase 5 |
| 11 | Internationalizacion | 2 | ~8h | Fase 9 |
| 12 | Plugins y Extensiones | 2 | ~16h | Fase 6 |
| 13 | WebAssembly | 3 | ~20h | Fase 6 |
| 14 | GraphQL API | 2 | ~16h | Fase 6 |
| 15 | ML Integrado | 3 | ~24h | Fase 7 |
| 16 | Tiempo Real | 2 | ~16h | Fase 14 |
| 17 | Persistencia y Escalabilidad | 3 | ~20h | Fase 14 |
| 18 | DX y Herramientas | 2 | ~16h | Fase 9 |
| 19 | Estandarizacion | 2 | ~12h | Fase 17 |
| 20 | Release y Ecosistema | 3 | ~24h | Fase 19 |

**Total: 68 tickets, ~461h estimadas**

---

## Mapa de Ejecucion en Paralelo

```
Fase 3 ──┬── T-3.1 ──┬── T-3.2 ── T-3.3
         │           ├── T-3.4
         │           └── T-3.5 ──┬── T-3.6 ── T-3.7
         └── T-3.8 (independiente)

Fase 0 ──┬── T-0.1 ── T-0.2 (independiente de Fase 3)

Fase 4 ── T-4.1 ── T-4.2 ── T-4.3 ──┬── T-4.4 ── T-4.5

Fase 5 ── T-5.1 ── T-5.2 ──┬── T-5.3
                           ├── T-5.4 ── T-5.5
                           └── T-5.6

Fase 6 ──┬── T-6.1 ── T-6.2 (independientes)
         ├── T-6.3 ── T-6.4 ── T-6.5 (independientes entre si)
         ├── T-6.6 (depende de T-5.2)
         ├── T-6.7 (depende de T-5.3)
         └── T-6.8 (depende de T-5.3)

Fase 7 ──┬── T-7.1 (independiente)
         ├── T-7.2 ── T-7.3 (independientes entre si)
         └── T-7.4 (depende de T-7.1, T-7.2, T-7.3)

Fase 8 ──┬── T-8.1 ── T-8.2 (independientes entre si)
         └── T-8.3 ── T-8.4 (independientes entre si)
```