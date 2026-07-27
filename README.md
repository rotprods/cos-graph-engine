# COS Graph Engine

> Motor de grafos de 20 niveles, 0 dependencias externas, para sistemas multi-agente, IA, ciencia y produccion.

[![CI](https://github.com/cos/graph-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/cos/graph-engine/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-390%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-63%25-yellow)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Zero Dep](https://img.shields.io/badge/dependencies-0-success)]()

---

## Que es?

COS Graph Engine es un motor de grafos modular de 20 niveles que cubre 4 dominios:

```
Base (L0-L3)        → Visual, Execution, State, Dependency
Computacional (L4-L7) → Call, CFG, DataFlow, Compute (ML)
Cognitivo (L8-L11)  → Knowledge, Semantic, Embedding, GraphRAG
Aplicado (L12-L19)  → Memory, Agent, Tool, Workflow, Network, Social, Bio, Molecular
```

Cada nivel comparte el mismo patron: mutation API, serializacion, adjacency maps, y 40+ tests.

---

## Por que COS?

| Problema | Solucion tradicional | COS |
|----------|---------------------|-----|
| Multi-agente | LangChain, CrewAI (deps pesadas) | Agent Graph nativo, 0 deps |
| Memoria para IA | Redis, Pinecone (infra externa) | Memory Graph con TTL, decaimiento |
| RAG estructurado | RAG plano (chunks sin contexto) | GraphRAG multi-hop navigation |
| Tracing de llamadas | Datadog, X-Ray ($1000+/mes) | Call Graph con flame graphs, $0 |
| Workflows | n8n, Zapier (SaaS, $20+/mes) | Workflow Graph embebido, $0 |
| Descubrimiento farmacos | RDKit, PyMol (Python-only) | Molecular Graph en JS/TS |

---

## Los 20 Niveles

| Nivel | Nombre | Que hace | Tests |
|-------|--------|----------|-------|
| L0 | Visual Graph | Render Mermaid/Graphviz/ASCII | 0 |
| L1 | Execution Graph | Planificacion topologica O(n+m) | 44 ✅ |
| L2 | State Machine | FSM con guards, timeouts, historial | 0 |
| L3 | Dependency Graph | Resolucion de dependencias O(n+m) | 57 ✅ |
| L4 | Call Graph | Tracing de llamadas, flame graphs | Validacion |
| L5 | Control Flow Graph | CFG, dominadores, complejidad ciclomatica | Validacion |
| L6 | DataFlow Graph | Pipelines, bottlenecks, critical path | Validacion |
| L7 | Compute Graph | Redes neuronales, forward/backward | 61 ✅ |
| L8 | Knowledge Graph | Ontologias, entidades, relaciones | Validacion |
| L9 | Semantic Graph | Taxonomias, hiperonimos, caminos | Validacion |
| L10 | Embedding Graph | Vectores, distancia L2, cosine, k-means | Validacion |
| L11 | GraphRAG | RAG con grafo, multi-hop retrieval | Validacion |
| L12 | Memory Graph | Memoria persistente, TTL, decaimiento | Suite combinada |
| L13 | Agent Graph | Multi-agente, roles, delegacion | Suite combinada |
| L14 | Tool Graph | Routing de herramientas, fallbacks | Suite combinada |
| L15 | Workflow Graph | Automatizacion n8n-style, retry logic | Suite combinada |
| L16 | Network Graph | Topologia de infraestructura, CDN | Suite combinada |
| L17 | Social Graph | Redes sociales, comunidades, PageRank | Suite combinada |
| L18 | Biological Graph | Neuronas, proteinas, sinapsis | Suite combinada |
| L19 | Molecular Graph | Atomos, enlaces, huellas, 3D | Suite combinada |

---

## Instalacion

```bash
git clone https://github.com/cos/graph-engine.git
cd cos
npm install
```

No hay dependencias externas. Solo TypeScript y Node stdlib.

---

## Uso Rapido

### L0 — Visualizar grafo

```typescript
import { VisualGraph, MermaidRenderer } from '@cos/graph';
const g = new VisualGraph("Mi App");
g.addNode("api", "API Gateway", "process");
g.addNode("db", "Database", "database");
g.addEdge("api", "db", "queries");
console.log(new MermaidRenderer().render(g));
```

### L2 — Maquina de estados

```typescript
import { StateMachine } from '@cos/graph';
const sm = new StateMachine("Order", [
  { id: "pending", label: "Pending", type: "initial" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered", type: "final" }
], [
  { from: "pending", to: "shipped", event: "ship" },
  { from: "shipped", to: "delivered", event: "confirm" }
]);
await sm.send("ship");  // pending → shipped
```

### L7 — Red neuronal

```typescript
import { ComputationalGraph } from '@cos/graph';
const nn = new ComputationalGraph();
nn.buildMLP(784, 256, 2);
const loss = nn.forward({ x: 0.5, w1: 0.1, b1: 0, w2: 0.1, b2: 0 });
const grads = nn.backward();
```

### L13 — Multi-agente

```typescript
import { AgentGraphEngine } from '@cos/graph';
const swarm = new AgentGraphEngine("Dev Team");
const ceo = swarm.addNode({ name: "CEO", role: "ceo", capabilities: ["planning"], tools: [], memoryIds: [], confidence: 0.9 });
const dev = swarm.addNode({ name: "Dev", role: "developer", capabilities: ["code"], tools: [], memoryIds: [], confidence: 0.85 });
swarm.addEdge(ceo, dev, "delegates_to", 8);
```

### L19 — Molecula

```typescript
import { MolecularGraphEngine } from '@cos/graph';
const mol = new MolecularGraphEngine("Aspirin");
mol.addAtom({ element: "C", atomicNumber: 6, type: "atom", mass: 12.011, hybridization: "sp2" });
mol.addAtom({ element: "O", atomicNumber: 8, type: "atom", mass: 15.999, hybridization: "sp2" });
mol.addBond("n1", "n2", "double", 2);
console.log(mol.computeWeight());  // Peso molecular
```

---

## Scripts

| Comando | Que hace |
|---------|----------|
| `npm run test:all` | 7 suites, 390 tests |
| `npm run test:l1` | L1 diamond + mutation |
| `npm run test:l3` | L3 consistency + mutation |
| `npm run test:l7` | L7 compute |
| `npm run test:mutation` | L1 + L3 mutation |
| `npm run benchmark` | Benchmarks de rendimiento |
| `npm run benchmark:report` | Benchmark + HTML con Chart.js |
| `npm run coverage` | Cobertura con c8 |
| `npm run ci` | CI completo |

---

## Roadmap

| Fase | Estado | Que incluye |
|------|--------|-------------|
| 1 | ✅ | L1, L3, L7 refactorizados (390 tests) |
| 2 | ✅ | CI, benchmark, CHANGELOG, release |
| 3 | ▶ En Progreso | Tooling, coverage, docs, validacion L4-L11 |
| 4 | Pendiente | Integracion SMB (Shared Memory Bus) |
| 5 | Pendiente | Homogeneizacion L4-L19 (mutation, serializacion, adj) |
| 6 | Pendiente | 40+ tests por nivel (720+ tests nuevos) |
| 7-8 | Pendiente | Rendimiento, CLI, WASM, v2.0.0 release |

---

## Documentacion

- [20 Casos de Uso](docs/20-USECASES.md) — Problemas reales por nivel
- [API Reference](docs/API-REFERENCE.md) — Todas las clases y metodos
- [Plan de Refactorizacion](docs/PLAN-REFACTOR-20-FASES.md) — 20 fases, 68 tickets
- [Roadmap Completo](docs/ROADMAP-COMPLETO.md) — 8 fases para v2.0.0
- [Plan Maestro](PLAN-MAESTRO.md) — Arquitectura completa, fixes, hoja de ruta
- [LOOP Framework](LOOP-MAESTRO.md) — Ciclo de desarrollo
- [Kanban Board](KANBAN.html) — Estado visual del proyecto

---

## Licencia

MIT. Ver [LICENSE](LICENSE).

---

## /LOOP

```bash
npx tsx scripts/loop.ts status  # Estado actual
npx tsx scripts/loop.ts board   # Tablero Kanban
npx tsx scripts/loop.ts check   # Quality checklist
```

Construido con el /LOOP framework — 7 pasos por ticket, 4 tracks paralelos, verificacion adversarial.