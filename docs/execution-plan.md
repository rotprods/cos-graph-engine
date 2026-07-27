# COS Execution Plan — Fases Completas

## Estructura del plan

Cada fase incluye:
- **Objetivo**: qué se construye y por qué
- **Dependencias**: qué debe estar listo antes
- **Archivos**: qué se crea o modifica
- **Verificación**: cómo confirmar que funciona
- **Tiempo estimado**: minutos de ejecución

---

## Fase 0: Fundación

**Objetivo:** Establecer el lenguaje del sistema — tipos, errores, y la unidad fundamental de computación cognitiva (CogCell).

**Dependencias:** Ninguna

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/core/src/types.ts` | 50+ tipos base: EntityId, CogCell, MemoryEntry, GraphNode, CogEvent | 800 |
| `packages/core/src/errors.ts` | CellError con código/severidad/timestamp, 5 errores especializados, generateId | 150 |
| `packages/core/src/cell.ts` | BaseCell: máquina de estados, process(), getHealth(), getMetrics(), inspect() | 350 |
| `packages/core/src/index.ts` | Exportación pública de todos los símbolos | 10 |
| `packages/core/package.json` | Configuración del paquete | 20 |

**Verificación:**
```bash
npx tsx -e "
const {generateId, CellError, BaseCell} = require('./packages/core/src/index.ts');
console.log('ID:', generateId());
const err = new CellError('TEST', 'test error');
console.log('Error:', err.code, err.message);
console.log('✅ Core OK');
"
```

**Tiempo:** 5 minutos

---

## Fase 1: MVP Runtime

**Objetivo:** Construir el backbone de comunicación (EventBus), ejecución (Scheduler), estado (StateManager), y el host de células (CellHost).

**Dependencias:** Fase 0

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/runtime/src/eventbus.ts` | Publish/subscribe tipado, wildcard, prioridad, historial | 250 |
| `packages/runtime/src/scheduler.ts` | Cola con prioridad, reintentos, concurrencia, estadísticas | 400 |
| `packages/runtime/src/state.ts` | Estado inmutable, snapshots, versionado | 200 |
| `packages/runtime/src/cellhost.ts` | Registro de células, ciclo de vida, integración con scheduler | 350 |
| `packages/runtime/src/index.ts` | Exportación pública | 10 |
| `packages/runtime/package.json` | Configuración del paquete | 20 |

**Verificación:**
```bash
npx tsx -e "
const {EventBus, Scheduler, StateManager, CellHost} = require('./packages/runtime/src/index.ts');
const bus = new EventBus();
bus.subscribe('test', async (e) => console.log('Event received:', e.type));
bus.publish({type:'test', source:'test', payload:{msg:'hello'}, severity:'info', metadata:{}});
console.log('Subscribers:', bus.subscriberCount);
console.log('✅ Runtime OK');
"
```

**Tiempo:** 8 minutos

---

## Fase 2: Sistema de Memoria (12 capas)

**Objetivo:** Implementar las 12 capas de memoria con TTL, consolidación, olvido, y cross-linking.

**Dependencias:** Fase 1

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/memory/src/memory-manager.ts` | InMemoryStore + MemoryManager: 12 capas, store/retrieve/query, consolidate/forget/crossLink | 500 |

**Capas de memoria:**
| Capa | TTL | Importancia | Propósito |
|------|-----|-------------|-----------|
| working | 5 min | 1.0 | Contexto activo de procesamiento |
| short_term | 24h | 0.6 | Interacciones recientes |
| long_term | ∞ | 0.8 | Conocimiento consolidado |
| semantic | ∞ | 0.9 | Hechos y conceptos |
| procedural | ∞ | 0.8 | Secuencias de procedimientos |
| episodic | 30d | 0.5 | Eventos con timestamp |
| temporal | 7d | 0.4 | Secuencias temporales |
| spatial | 7d | 0.4 | Memoria basada en ubicación |
| vector | 30d | 0.5 | Búsqueda por embeddings |
| knowledge_graph | ∞ | 0.9 | Relaciones estructuradas |
| cache | 10 min | 0.3 | Almacenamiento temporal rápido |
| reflection | 7d | 0.7 | Insights auto-generados |

**Verificación:**
```bash
npx tsx -e "
const {MemoryManager} = require('./packages/memory/src/index.ts');
const mem = new MemoryManager();
const id = await mem.store('test data', 'semantic', {tags:['test'],importance:0.9});
const retrieved = await mem.retrieve(id);
console.log('Stored:', id.substring(0,20) + '...');
console.log('Retrieved:', retrieved?.content);
const consolidated = await mem.consolidate(0.5);
console.log('Consolidated:', consolidated);
console.log('✅ Memory OK');
"
```

**Tiempo:** 10 minutos

---

## Fase 3: Capa de Conocimiento

**Objetivo:** Grafo de propiedades, grafo de conocimiento, sistema de embeddings, y ontología.

**Dependencias:** Fase 1

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/knowledge/src/property-graph.ts` | PropertyGraph: addNode/Edge, query, traverse, stats | 500 |
| `packages/knowledge/src/knowledge-graph.ts` | KnowledgeGraph: addStatement, query, getRelated | 200 |
| `packages/knowledge/src/embedding.ts` | EmbeddingSystem: store, search, cosine similarity, textToEmbedding | 250 |
| `packages/knowledge/src/ontology.ts` | OntologySystem: defineClass, defineRelation, validate | 300 |
| `packages/knowledge/src/index.ts` | Exportación pública | 10 |
| `packages/knowledge/package.json` | Configuración del paquete | 20 |

**Verificación:**
```bash
npx tsx -e "
const {KnowledgeGraph, EmbeddingSystem, OntologySystem} = require('./packages/knowledge/src/index.ts');
const kg = new KnowledgeGraph();
await kg.addStatement({subject:'COS',predicate:'is_a',object:'System',confidence:1,source:'t',metadata:{},embedding:undefined});
const q = await kg.query('COS');
console.log('Statements:', q.length);

const emb = new EmbeddingSystem();
const v = emb.textToEmbedding('cognitive system');
await emb.store('s1', v, 'concept');
const sr = await emb.search(v, {limit:5});
console.log('Embeddings:', sr.length);

const onto = new OntologySystem();
await onto.defineClass('Component', 'A COS component', null, []);
console.log('Classes:', onto.classCount);
console.log('✅ Knowledge OK');
"
```

**Tiempo:** 10 minutos

---

## Fase 4: Cognición (5 motores de razonamiento)

**Objetivo:** Implementar 5 motores de razonamiento, planificación, evaluación, y aprendizaje.

**Dependencias:** Fase 1

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/cognition/src/reasoning.ts` | ChainOfThought, TreeOfThoughts, Reflection, ReasoningEngineRegistry | 600 |
| `packages/cognition/src/advanced-reasoning.ts` | GraphOfThoughts, Debate | 700 |
| `packages/cognition/src/planning.ts` | PlanningEngine: createPlan, executePlan | 350 |
| `packages/cognition/src/evaluation.ts` | EvaluationSystem: evaluate on N criteria | 200 |
| `packages/cognition/src/learning.ts` | LearningSystem: recordExample, addFeedback, getPatterns | 250 |
| `packages/cognition/src/index.ts` | Exportación pública | 20 |

**Motores de razonamiento:**
1. **Chain of Thought**: Descomposición paso a paso, 5 pasos por defecto
2. **Tree of Thoughts**: Búsqueda por haz, factor de ramificación, profundidad máxima
3. **Reflection**: Autocrítica en N aspectos, sugerencias de mejora
4. **Graph of Thoughts**: DAG no lineal, caminos paralelos, síntesis cruzada, verificación
5. **Debate**: Multi-agente (Pro, Con, Escéptico, Sintetizador), 3 rondas, consenso

**Verificación:**
```bash
npx tsx -e "
const {ReasoningEngineRegistry, PlanningEngine} = require('./packages/cognition/src/index.ts');
const reg = new ReasoningEngineRegistry();
console.log('Engines:', reg.getAll().length);

const steps = await reg.reason('chain_of_thought', {problem:'test',steps:3}, {traceId:'t1'});
console.log('CoT steps:', steps.length);

const plan = new PlanningEngine(reg);
const p = await plan.createPlan('test goal', {traceId:'t2'});
console.log('Plan steps:', p.steps.length);
console.log('✅ Cognition OK');
"
```

**Tiempo:** 15 minutos

---

## Fase 5: Ejecución y Orquestación

**Objetivo:** Herramientas reales (FS, HTTP, Search), sandbox de código, agentes, workflows, políticas.

**Dependencias:** Fase 1

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/execution/src/tool-runtime.ts` | FileSystemTool real, HTTPTool real, SearchTool, ToolRegistry | 700 |
| `packages/execution/src/index.ts` | Exportación pública | 10 |
| `packages/orchestration/src/agent-system.ts` | AgentSystem: defineAgent, executeAgent | 250 |
| `packages/orchestration/src/workflow.ts` | WorkflowEngine: define, execute, step types | 350 |
| `packages/orchestration/src/policy.ts` | PolicyEngine: addRule, evaluate, conditions | 250 |
| `packages/orchestration/src/index.ts` | Exportación pública | 10 |

**Herramientas reales:**
| Herramienta | Operaciones | Módulo |
|-------------|-------------|--------|
| FileSystemTool | read/write/delete/list/exists/mkdtemp | `fs/promises` |
| HTTPTool | GET/POST/PUT/DELETE/PATCH, headers, body, timeout | `http`/`https` |
| SearchTool | Búsqueda en filesystem con grep y scoring | `fs/promises` |
| CodeSandbox | Ejecución JavaScript aislada con timeout | `vm` |

**Verificación:**
```bash
npx tsx -e "
const {ToolRegistry} = require('./packages/execution/src/index.ts');
const tools = new ToolRegistry();
console.log('Tools:', tools.getAll().length);

const fsResult = await tools.execute('filesystem', {operation:'write',path:'/tmp/cos-test.txt',content:'hello'}, {traceId:'t1'});
console.log('FS write:', fsResult.success);

const httpResult = await tools.execute('http_client', {method:'GET',url:'https://api.github.com/zen',headers:{'User-Agent':'COS'}}, {traceId:'t2'});
console.log('HTTP GET:', httpResult.success, 'status:', httpResult.output?.statusCode);
console.log('✅ Execution OK');
"
```

**Tiempo:** 12 minutos

---

## Fase 6: Producción

**Objetivo:** Servidor HTTP, autenticación, CLI, configuración, dashboard, Docker.

**Dependencias:** Fases 0-5

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/infrastructure/src/config.ts` | Configuration: capas, schemas, presets | 400 |
| `packages/api/src/auth.ts` | AuthMiddleware: JWT, API keys, roles | 200 |
| `packages/api/src/http-server.ts` | HttpApiServer: 15 endpoints REST, dashboard, chat | 400 |
| `packages/api/src/server.ts` | COSServer: 11 subsistemas integrados, process routing | 200 |
| `packages/api/src/dashboard.html` | Dashboard UI: 6 paneles, API playground, auto-refresh | 200 |
| `packages/api/src/chat.html` | Chat UI: pipeline cognitivo completo por mensaje | 150 |
| `packages/deployment/src/cli.ts` | CLI: 7 comandos | 200 |
| `packages/deployment/src/launch.ts` | Launch: demo data, autónomo, servidor | 300 |
| `Dockerfile` | Build multi-stage, Alpine, tini, healthcheck | 40 |

**Endpoints API:**
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/` | Dashboard (HTML) |
| GET | `/health` | Estado del sistema |
| GET | `/stats` | Estadísticas completas |
| POST | `/process` | Procesar input |
| POST | `/auth/token` | Generar token JWT |
| GET | `/memory` | Estadísticas de memoria |
| GET | `/knowledge/:query` | Consultar grafo de conocimiento |
| GET | `/self-improve` | Ejecutar meta-cognición |
| GET | `/config` | Configuración actual |
| GET | `/cells` | Lista de células |
| POST | `/goals` | Crear meta autónoma |
| POST | `/goals/:id` | Ejecutar meta |
| GET | `/goals` | Metas activas |
| GET | `/chat` | Chat UI (HTML) |
| POST | `/chat` | Enviar mensaje |

**Verificación:**
```bash
# Iniciar servidor
npx tsx packages/deployment/src/launch.ts &
sleep 3

# Probar endpoints
curl -s http://localhost:8080/health | head -c 100
curl -s http://localhost:8080/stats | head -c 100
curl -s -X POST http://localhost:8080/process -H 'Content-Type: application/json' -d '{"input":"hello"}' | head -c 100
echo "✅ Production OK"
```

**Tiempo:** 20 minutos

---

## Fase 7: Auto-Mejora y LLM

**Objetivo:** Sistema de auto-evaluación, meta-cognición, y adaptador de LLM (Simulated + OpenAI).

**Dependencias:** Fase 4

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/cognition/src/self-improvement.ts` | SelfImprovementSystem: recordOutput, recommendEngine, runMetaCognition | 700 |
| `packages/cognition/src/llm.ts` | LLMProvider, SimulatedProvider, OpenAIProvider, LLMFactory | 500 |

**Componentes de auto-mejora:**
| Componente | Función |
|------------|---------|
| `recordOutput()` | Graba cada salida, auto-evalúa cada N iteraciones |
| `recommendEngine()` | Usa patrones aprendidos para seleccionar el mejor motor |
| `runMetaCognition()` | Sistema reflexiona sobre su rendimiento, identifica debilidades |
| `generateReport()` | Produce reporte con score, tendencia, sugerencias |

**LLM Adapter:**
| Provider | Disponible | Modelos | Cuándo se usa |
|----------|-----------|---------|---------------|
| SimulatedProvider | Siempre | simulated-default | Sin API key (default) |
| OpenAIProvider | Con OPENAI_API_KEY | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo | Con API key configurada |

**Verificación:**
```bash
npx tsx -e "
const {SelfImprovementSystem, LLMFactory, EvaluationSystem, LearningSystem, ReasoningEngineRegistry} = require('./packages/cognition/src/index.ts');
const evalSys = new EvaluationSystem();
const learnSys = new LearningSystem();
const registry = new ReasoningEngineRegistry();
const si = new SelfImprovementSystem(evalSys, learnSys, registry);

for(let i=0;i<10;i++) await si.recordOutput({q:'test-'+i},{r:'result-'+i});
const report = await si.runMetaCognition(true);
console.log('Score:', (report.averageScore*100).toFixed(0)+'/100');
console.log('Trend:', report.scoreTrend);
console.log('Patterns:', report.topPatterns.length);

const llm = new LLMFactory();
console.log('Providers:', llm.getAvailableProviders().length);
console.log('✅ Self-Improvement OK');
"
```

**Tiempo:** 10 minutos

---

## Fase 8: Avanzado

**Objetivo:** Loop autónomo, chat cognitivo, persistencia, y demo de entrenamiento.

**Dependencias:** Fases 0-7

**Archivos:**
| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `packages/orchestration/src/autonomous-loop.ts` | AutonomousLoop: goal→plan→execute→observe→adapt→complete | 700 |
| `packages/infrastructure/src/persistence.ts` | PersistenceManager, FileBackedData, FileBackedMemory | 400 |
| `packages/api/src/server-persist.ts` | PersistentCOSSERVER: auto-save/load | 150 |
| `scripts/training-demo.ts` | Training loop: 30 iteraciones, evaluación, patrones | 200 |
| `scripts/generate-report.js` | Reporte SVG de rendimiento | 120 |

**Componentes avanzados:**
| Componente | Capacidad |
|-------------|-----------|
| AutonomousLoop | Meta → 8 pasos → ejecución → adaptación → completion |
| FileBackedData | Persistencia JSON en filesystem, sobrevive reinicios |
| PersistenceManager | Multi-store init/loadAll/saveAll |
| Training demo | 30 iteraciones, 44 evaluaciones, 34 patrones, +2.2 puntos |

**Verificación:**
```bash
npx tsx -e "
const {AutonomousLoop} = require('./packages/orchestration/src/index.ts');
const {CellHost} = require('./packages/runtime/src/index.ts');
const {MemoryManager} = require('./packages/memory/src/index.ts');
const {ReasoningEngineRegistry, PlanningEngine, EvaluationSystem, SelfImprovementSystem} = require('./packages/cognition/src/index.ts');

const host = new CellHost();
const mem = new MemoryManager();
const reg = new ReasoningEngineRegistry();
const plan = new PlanningEngine(reg);
const evalSys = new EvaluationSystem();
const si = new SelfImprovementSystem(evalSys, evalSys as any, reg);
const loop = new AutonomousLoop(host, mem, plan, evalSys, si);

const goal = await loop.createGoal('Analyze the COS architecture', {traceId:'test'});
console.log('Goal created:', goal.plan.length, 'steps');
await loop.executeGoal(goal.id);
const g = await loop.getGoal(goal.id);
console.log('Completed:', g?.status);
console.log('Summary:', g?.summary);
console.log('✅ Advanced OK');
"
```

**Tiempo:** 15 minutos

---

## Resumen de tiempos

| Fase | Tiempo | Archivos | Paquetes |
|------|--------|----------|----------|
| 0: Fundación | 5 min | 5 | 1 |
| 1: MVP Runtime | 8 min | 6 | 1 |
| 2: Memoria | 10 min | 2 | 1 |
| 3: Conocimiento | 10 min | 6 | 1 |
| 4: Cognición | 15 min | 7 | 1 |
| 5: Ejecución/Orch | 12 min | 7 | 2 |
| 6: Producción | 20 min | 10 | 4 |
| 7: Auto-Mejora | 10 min | 3 | 1 |
| 8: Avanzado | 15 min | 5 | 3 |
| **Total** | **~105 min** | **51** | **11** |

## Orden de ejecución recomendado

```
Fase 0 (Fundación)
    └── Fase 1 (Runtime)
            ├── Fase 2 (Memoria) ── paralelo ── Fase 3 (Conocimiento)
            │                                            │
            └──────────────┬─────────────────────────────┘
                           ▼
                    Fase 4 (Cognición)
                           │
                    Fase 5 (Ejecución + Orquestación)
                           │
                    Fase 6 (Producción)
                           │
                    Fase 7 (Auto-Mejora)
                           │
                    Fase 8 (Avanzado)
```

## Verificación final

```bash
# Después de ejecutar todas las fases:
npx tsx packages/deployment/src/launch.ts

# Verificar todo:
curl -s http://localhost:8080/health
curl -s http://localhost:8080/stats
curl -s http://localhost:8080/memory
curl -s http://localhost:8080/knowledge/COS
curl -s http://localhost:8080/self-improve
curl -s http://localhost:8080/cells
```

## Resumen del sistema completo

```
11 paquetes, 35+ archivos TypeScript, ~12,000 líneas de código
5 motores de razonamiento (CoT, ToT, Reflection, GoT, Debate)
12 capas de memoria con TTL, consolidación, olvido
3 herramientas reales (FS, HTTP, Search) + CodeSandbox
15 endpoints REST + Dashboard + Chat + CLI
Auto-mejora: evaluación → patrones → meta-cognición
Loop autónomo: meta → plan → ejecutar → adaptar → completar
LLM Adapter: Simulated (default) + OpenAI (cuando hay key)
Persistencia: filesystem JSON, sobrevive reinicios