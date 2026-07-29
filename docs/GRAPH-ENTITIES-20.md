# COS Graph Engine — 20 Graph Entities

> **20 niveles de abstracción**, cada uno con dimensiones, estilo y propósito distintos.
> Cada entidad es un tipo de grafo con su propia topología, métricas, y caso de uso.

---

## Entity Index

| # | Entity | Dimension | Style | Topology | Use Case |
|---|--------|-----------|-------|----------|----------|
| 0 | **VisualGraph** | 2D (x, y, shape) | Mermaid/Graphviz/ASCII | Directed labeled | Diagramas, documentación, lluvia de ideas |
| 1 | **ExecGraph** | Temporal (DAG) | Pipeline | DAG estricto | Ejecución de funciones, workflows, pipelines |
| 2 | **StateGraph** | 3D (x, y, state) | FSM / Statechart | Directed cyclic | Máquinas de estado, UI, transiciones |
| 3 | **DependencyGraph** | Jerárquico (tree) | Tree / Nested | Arborescencia | Paquetes, módulos, imports, DI |
| 4 | **CallGraph** | 2D (caller→callee) | Call tree | Directed acyclic | Análisis estático, profiling, traces |
| 5 | **ControlFlowGraph** | 2D (blocks + edges) | Basic blocks | Directed + branches | Compiladores, CFG, análisis de flujo |
| 6 | **DataFlowGraph** | 2D (def→use) | Data pipeline | Bipartito | Transformación de datos, ETL, streaming |
| 7 | **ComputeGraph** | 3D (op, tensor, dim) | Tensor DAG | Directed weighted | Redes neuronales, cómputo simbólico |
| 8 | **KnowledgeGraph** | Semántico (RDF) | Triple store | Directed labeled | Ontologías, razonamiento, QA |
| 9 | **SemanticGraph** | 2D (concept→relation) | WordNet / FrameNet | Undirected weighted | NLP, semántica, word embeddings |
| 10 | **EmbeddingGraph** | N-D (latent space) | Vector space | Complete weighted | Embeddings, similitud, clustering |
| 11 | **GraphRAG** | Híbrido (KG + vector) | Retrieval graph | Bipartito + vector | RAG, búsqueda híbrida, QA |
| 12 | **MemoryGraph** | Temporal + asociativo | Episodic buffer | Weighted + decay | Memoria agente, recall, olvido |
| 13 | **AgentGraph** | 2D (agent→message) | Multi-agent | Directed + state | Comunicación entre agentes, delegación |
| 14 | **ToolGraph** | 2D (tool→schema) | Capability graph | Bipartito | Descubrimiento de herramientas, routing |
| 15 | **WorkflowGraph** | 2D (step→transition) | State machine | DAG + condición | Orquestación, approval flows, CI/CD |
| 16 | **NetworkGraph** | 2D (node→link) | Force-directed | Scale-free | Redes sociales, IoT, telecom |
| 17 | **SocialGraph** | 2D (person→relation) | Community | Small-world | Amistades, influencia, difusión |
| 18 | **BiologicalGraph** | 3D (protein→interaction) | Pathway | Scale-free + hub | Biología de sistemas, PPI, metabolismo |
| 19 | **MolecularGraph** | 3D (atom→bond) | Molecular | Bounded degree | Química, drug discovery, QSAR |

---

## Entity Details

### Entity 0: VisualGraph — Dimensión: 2D (x, y, shape)

```
Estilo: Mermaid/Graphviz/ASCII
Topología: Directed labeled
Props: { id, label, type, color, shape, x, y }
```

Propósito: "Solo quiero dibujar algo". Renderers: Mermaid, Graphviz, ASCII, JSON.

```typescript
interface VisualNode {
  id: string; label: string;
  type?: 'process' | 'decision' | 'start' | 'end' | 'database' | 'document' | 'default';
  color?: string; shape?: string;
}
```

### Entity 1: ExecGraph — Dimensión: Temporal (DAG)

```
Estilo: Pipeline
Topología: DAG estricto
Props: { id, name, type, fn, timeout, retries, config }
```

Los nodos ejecutan código. Planifica, ejecuta, observa.

```typescript
type ExecNodeType = 'function' | 'tool' | 'subgraph' | 'condition' | 'transform' | 'sleep';
interface ExecNode {
  id: string; name: string; type: ExecNodeType;
  fn?: (input: unknown, context: CellContext) => Promise<unknown>;
  timeout?: number; retries?: number;
}
```

### Entity 2: StateGraph — Dimensión: 3D (x, y, state)

```
Estilo: FSM / Statechart
Topología: Directed cyclic
Props: { id, state, transitions, guards, actions }
```

Máquinas de estado. UI, transiciones, protocolos.

### Entity 3: DependencyGraph — Dimensión: Jerárquico (tree)

```
Estilo: Tree / Nested
Topología: Arborescencia
Props: { id, parent, children, version, constraints }
```

Paquetes, módulos, imports, dependency injection.

### Entity 4: CallGraph — Dimensión: 2D (caller→callee)

```
Estilo: Call tree
Topología: Directed acyclic
Props: { id, function, calls, depth, frequency }
```

Análisis estático, profiling, stack traces.

### Entity 5: ControlFlowGraph — Dimensión: 2D (blocks + edges)

```
Estilo: Basic blocks
Topología: Directed + branches
Props: { id, block, successors, condition, loop }
```

Compiladores, CFG, análisis de flujo de control.

### Entity 6: DataFlowGraph — Dimensión: 2D (def→use)

```
Estilo: Data pipeline
Topología: Bipartito
Props: { id, source, target, transform, schema }
```

Transformación de datos, ETL, streaming.

### Entity 7: ComputeGraph — Dimensión: 3D (op, tensor, dim)

```
Estilo: Tensor DAG
Topología: Directed weighted
Props: { id, op, inputs, outputs, shape, dtype }
```

Redes neuronales, cómputo simbólico, autograd.

### Entity 8: KnowledgeGraph — Dimensión: Semántico (RDF)

```
Estilo: Triple store
Topología: Directed labeled
Props: { id, subject, predicate, object, confidence, source }
```

Ontologías, razonamiento, QA, fact-checking.

### Entity 9: SemanticGraph — Dimensión: 2D (concept→relation)

```
Estilo: WordNet / FrameNet
Topología: Undirected weighted
Props: { id, concept, relation, weight, pos, domain }
```

NLP, semántica, word embeddings, similitud léxica.

### Entity 10: EmbeddingGraph — Dimensión: N-D (latent space)

```
Estilo: Vector space
Topología: Complete weighted
Props: { id, vector, dimension, metric, cluster }
```

Embeddings, similitud coseno, clustering, ANN.

### Entity 11: GraphRAG — Dimensión: Híbrido (KG + vector)

```
Estilo: Retrieval graph
Topología: Bipartito + vector
Props: { id, kgNode, vectorNode, score, context }
```

RAG, búsqueda híbrida, QA con contexto.

### Entity 12: MemoryGraph — Dimensión: Temporal + asociativo

```
Estilo: Episodic buffer
Topología: Weighted + decay
Props: { id, content, timestamp, accessCount, decay, associations }
```

Memoria de agente, recall, olvido, rehearsal.

### Entity 13: AgentGraph — Dimensión: 2D (agent→message)

```
Estilo: Multi-agent
Topología: Directed + state
Props: { id, agent, role, message, state, capabilities }
```

Comunicación entre agentes, delegación, coordinación.

### Entity 14: ToolGraph — Dimensión: 2D (tool→schema)

```
Estilo: Capability graph
Topología: Bipartito
Props: { id, tool, inputSchema, outputSchema, cost, rate }
```

Descubrimiento de herramientas, routing, rate limiting.

### Entity 15: WorkflowGraph — Dimensión: 2D (step→transition)

```
Estilo: State machine
Topología: DAG + condición
Props: { id, step, transition, condition, timeout, retry }
```

Orquestación, approval flows, CI/CD pipelines.

### Entity 16: NetworkGraph — Dimensión: 2D (node→link)

```
Estilo: Force-directed
Topología: Scale-free
Props: { id, ip, port, bandwidth, latency, protocol }
```

Redes sociales, IoT, telecom, peer-to-peer.

### Entity 17: SocialGraph — Dimensión: 2D (person→relation)

```
Estilo: Community
Topología: Small-world
Props: { id, person, relation, strength, influence, community }
```

Amistades, influencia, difusión de información.

### Entity 18: BiologicalGraph — Dimensión: 3D (protein→interaction)

```
Estilo: Pathway
Topología: Scale-free + hub
Props: { id, protein, interaction, type, confidence, pathway }
```

Biología de sistemas, PPI, metabolismo, signaling.

### Entity 19: MolecularGraph — Dimensión: 3D (atom→bond)

```
Estilo: Molecular
Topología: Bounded degree
Props: { id, atom, element, bondType, charge, stereo }
```

Química, drug discovery, QSAR, molecular dynamics.

---

## Entity Clusters

```
0-5:   Foundation (Visual, Exec, State, Dep, Call, CFG)    → Diagramas, código, análisis
6-7:   Compute (DataFlow, Compute)                          → Datos, ML, tensores
8-11:  Knowledge (KG, Semantic, Embedding, GraphRAG)        → Conocimiento, NLP, RAG
12-15: Agency (Memory, Agent, Tool, Workflow)               → Sistemas multi-agente
16-19: Natural (Network, Social, Biological, Molecular)     → Sistemas del mundo real
```

## Integration via SMB

All 20 entities connect through the **Shared Memory Bus** (SMB):

```
Entity 0-6 ──► SMB (EventBus + MemoryManager) ◄── Entity 7-13
Entity 14-19 ──► SMB ◄── Entity 0-6
```

The SMB provides:
- **EventBus**: Publish/subscribe entre entidades
- **MemoryManager**: Persistencia y recuperación de estado
- **GraphIndex**: índice de todos los grafos activos
- **Cross-entity queries**: Consultas que cruzan niveles