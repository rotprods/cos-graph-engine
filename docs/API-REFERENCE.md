# API Reference — COS Graph Engine

> Referencia completa de las APIs de los 20 niveles (L0-L19).
> Cada nivel incluye: interfaces, clases, metodos, parametros, valores de retorno, y ejemplos.

---

## L0 — Visual Graph

**Import:** `import { VisualGraphEngine, MermaidRenderer, GraphvizRenderer, ASCIITreeRenderer, JSONGraphExporter, VisualGraph, VisualNode, VisualEdge } from '@cos/graph'`

### Interfaces

```typescript
interface VisualNode {
  id: string;
  label: string;
  type?: 'process' | 'decision' | 'start' | 'end' | 'database' | 'document' | 'default';
  color?: string;
  shape?: string;
}

interface VisualEdge {
  source: string;
  target: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
}

interface VisualGraph {
  title: string;
  nodes: VisualNode[];
  edges: VisualEdge[];
  direction?: 'TB' | 'LR' | 'RL' | 'BT';
  metadata?: Record<string, unknown>;
}
```

### Clases y Metodos

#### MermaidRenderer
`render(graph: VisualGraph): string`
- **Descripcion:** Renderiza el grafo como diagrama Mermaid (embeddable en Markdown)
- **Parametros:** `graph` — el grafo visual a renderizar
- **Retorno:** String Mermaid (graph TD/LR)
- **Ejemplo:** `new MermaidRenderer().render(visualGraph)`

#### GraphvizRenderer
`render(graph: VisualGraph): string`
- **Descripcion:** Renderiza el grafo como formato DOT de Graphviz
- **Retorno:** String DOT listo para dot/graphviz CLI

#### ASCIITreeRenderer
`render(graph: VisualGraph): string`
- **Descripcion:** Renderiza el grafo como arbol ASCII con bordes unicode
- **Retorno:** String con formato de arbol jerarquico

#### JSONGraphExporter
`export(graph: VisualGraph): string`
- **Descripcion:** Exporta el grafo como JSON con metadatos
- **Retorno:** String JSON pretty-printed

#### VisualGraphEngine
`render(graph: VisualGraph, format: 'mermaid' | 'graphviz' | 'ascii' | 'json'): string`
- **Descripcion:** Renderiza unificado, delega al renderer segun formato
- **Valor defecto:** `format = 'mermaid'`

`createFromEdges(title: string, edges: Array<{ from: string; to: string; label?: string }>): VisualGraph`
- **Descripcion:** Crea un VisualGraph desde una lista de edges (infiere nodos)
- **Retorno:** VisualGraph con nodos deducidos de los edges

---

## L1 — Execution Graph

**Import:** `import { ExecutionGraphEngine, ExecNode, ExecEdge, ExecNodeResult, ExecutionGraph, ExecNodeType } from '@cos/graph'`

### Interfaces

```typescript
type ExecNodeType = 'function' | 'tool' | 'subgraph' | 'condition' | 'transform' | 'sleep';

interface ExecNode {
  id: EntityId; name: string; type: ExecNodeType;
  fn?: (input: unknown, context: CellContext) => Promise<unknown>;
  toolName?: string; toolInput?: unknown;
  config?: Record<string, unknown>; timeout?: number; retries?: number;
}

interface ExecEdge {
  id: EntityId; source: EntityId; target: EntityId;
  dataMap?: (input: unknown) => unknown;
  condition?: (output: unknown) => boolean;
}

interface ExecNodeResult {
  nodeId: EntityId; status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: unknown; output: unknown; error?: string;
  startedAt?: Timestamp; completedAt?: Timestamp;
  duration: number; confidence: number; cost: Cost;
}
```

### Clase: ExecutionGraphEngine

`async createGraph(name: string, nodes: ExecNode[], edges: ExecEdge[], options?: { maxConcurrency?: number }): Promise<EntityId>`
- **Descripcion:** Crea un grafo de ejecucion. Valida: sin IDs duplicados, edges referencian nodos existentes
- **Retorno:** ID del grafo creado
- **Error:** Si hay nodos duplicados o edges colgantes

`addNode(graphId: EntityId, node: ExecNode): void`
- **Descripcion:** Agrega un nodo a un grafo existente
- **Error:** Si el grafo no existe o el nodo ya existe

`removeNode(graphId: EntityId, nodeId: EntityId): void`
- **Descripcion:** Elimina un nodo y sus edges conectados

`addEdge(graphId: EntityId, edge: ExecEdge): void`
- **Descripcion:** Agrega un edge. Valida: source y target existen
- **Error:** Si source o target no existen

`removeEdge(graphId: EntityId, edgeId: EntityId): void`
- **Descripcion:** Elimina un edge por ID

`async executeGraph(graphId: EntityId, input?: unknown): Promise<Map<EntityId, ExecNodeResult>>`
- **Descripcion:** Ejecuta el grafo. Detecta ciclos, planifica topologicamente, ejecuta en batches paralelos
- **Algoritmo:** Kahn's algorithm O(n+m) con cola de listos
- **Retorno:** Mapa de nodeId → resultado de ejecucion
- **Error:** Si el grafo contiene ciclos

`getResults(graphId: EntityId): Map<EntityId, ExecNodeResult> | undefined`
- **Descripcion:** Obtiene resultados de una ejecucion previa

`getGraph(id: EntityId): ExecutionGraph | undefined`
- **Descripcion:** Obtiene un grafo por ID

---

## L2 — State Machine

**Import:** `import { StateMachine, StateMachineRegistry, StateConfig, StateTransition, StateContext, StateId } from '@cos/graph'`

### Interfaces

```typescript
type StateId = string;

interface StateConfig {
  id: StateId; label: string;
  entry?: (context: StateContext) => Promise<void> | void;
  exit?: (context: StateContext) => Promise<void> | void;
  type?: 'initial' | 'normal' | 'final' | 'error';
  timeout?: number; // seconds
}

interface StateTransition {
  from: StateId; to: StateId; event: string;
  guard?: (context: StateContext) => boolean;
  action?: (context: StateContext) => Promise<void> | void;
  label?: string;
}

interface StateContext {
  machineId: EntityId; currentState: StateId; previousState: StateId | null;
  history: Array<{ from: StateId; to: StateId; event: string; timestamp: Timestamp }>;
  data: Record<string, unknown>; errors: string[];
  startedAt: Timestamp; transitions: number;
}
```

### Clase: StateMachine

`constructor(name: string, states: StateConfig[], transitions: StateTransition[], initial?: StateId)`
- **Descripcion:** Crea una maquina de estados. Si no se especifica initial, busca el primer estado con type='initial'

**Propiedades:**
- `get id(): EntityId` — ID de la maquina
- `get state(): StateId` — Estado actual
- `get contextData(): StateContext` — Contexto completo (copia)

`async send(event: string, payload?: Record<string, unknown>): Promise<boolean>`
- **Descripcion:** Envia un evento. Ejecuta: guard → exit action → transicion → entry action → timeout
- **Retorno:** `true` si la transicion fue exitosa, `false` si no existe el evento o el guard la bloquea

`can(event: string): boolean`
- **Descripcion:** Verifica si un evento es valido desde el estado actual

`getAvailableEvents(): string[]`
- **Descripcion:** Lista los eventos disponibles desde el estado actual

`isInFinalState(): boolean`
- **Descripcion:** Verifica si la maquina esta en un estado final

`onChange(listener: (from: StateId, to: StateId, event: string) => void): void`
- **Descripcion:** Registra un listener para cambios de estado

`visualize(): string`
- **Descripcion:** Renderiza la maquina como ASCII art

### Clase: StateMachineRegistry

`create(name: string, states: StateConfig[], transitions: StateTransition[], initial?: StateId): StateMachine`
- **Descripcion:** Crea y registra una maquina de estados

`get(id: EntityId): StateMachine | undefined`
- **Descripcion:** Obtiene una maquina registrada por ID

`getAll(): StateMachine[]`
- **Descripcion:** Lista todas las maquinas registradas

`createCognitiveLifecycle(): StateMachine`
- **Descripcion:** Crea una FSM predefinida de ciclo de vida cognitivo (created → initializing → ready → running → paused → error → terminated)

`createAutonomousGoalFSM(): StateMachine`
- **Descripcion:** Crea una FSM predefinida de objetivos autonomos (created → planning → executing → observing → adapting → completed → failed)

---

## L3 — Dependency Graph

**Import:** `import { DependencyResolver, DepNode, DepEdge, DependencyGraph } from '@cos/graph'`

### Interfaces

```typescript
interface DepNode {
  id: EntityId; name: string; version?: string;
  type: 'package' | 'module' | 'service' | 'library' | 'config' | 'file';
  metadata?: Record<string, unknown>; size?: number;
}

interface DepEdge {
  source: EntityId; target: EntityId;
  type: 'depends_on' | 'imports' | 'extends' | 'composes' | 'optional';
  version?: string; semver?: string;
}
```

### Clase: DependencyResolver

`createGraph(name: string, nodes: DepNode[], edges: DepEdge[]): EntityId`
- **Descripcion:** Crea un grafo de dependencias. Valida: sin IDs duplicados, edges referencian nodos existentes
- **Convencion:** source → target significa "source depende de target"

`addNode(graphId: EntityId, node: DepNode): void`
- **Descripcion:** Agrega un nodo. Error: si el nodo ya existe

`removeNode(graphId: EntityId, nodeId: EntityId): void`
- **Descripcion:** Elimina un nodo y todos sus edges conectados

`addEdge(graphId: EntityId, edge: DepEdge): void`
- **Descripcion:** Agrega un edge. Valida: source y target existen

`removeEdge(graphId: EntityId, source: EntityId, target: EntityId): void`
- **Descripcion:** Elimina edges coincidentes por source+target

`getGraph(id: EntityId): DependencyGraph | undefined`
- **Descripcion:** Obtiene un grafo por ID

`topologicalSort(graphId: EntityId): EntityId[]`
- **Descripcion:** Orden topologico (Kahn's algorithm). Cada nodo aparece DESPUES de sus dependencias
- **Complejidad:** O(n+m)
- **Error:** Si el grafo no existe

`detectCycle(graphId: EntityId): EntityId[] | null`
- **Descripcion:** Detecta ciclos via DFS. Retorna el camino del ciclo si existe, o null
- **Complejidad:** O(n+m)

`computeDepth(graphId: EntityId): Map<EntityId, number>`
- **Descripcion:** Profundidad de dependencia (distancia desde la raiz mas lejana)
- **Complejidad:** O(n+m)

`findLeaves(graphId: EntityId): DepNode[]`
- **Descripcion:** Nodos sin edges entrantes (nada depende de ellos)

`findRoots(graphId: EntityId): DepNode[]`
- **Descripcion:** Nodos sin edges salientes (no dependen de nada)

`subgraph(graphId: EntityId, rootId: EntityId): { nodes: DepNode[]; edges: DepEdge[] } | null`
- **Descripcion:** Subarbol de dependencias desde un nodo raiz
- **Complejidad:** O(n+m)

`toMermaid(graphId: EntityId): string`
- **Descripcion:** Renderiza como diagrama Mermaid

---

## L4 — Call Graph

**Import:** `import { CallGraphBuilder, CallNode, CallEdge, CallGraph, CallNodeType } from '@cos/graph'`

### Interfaces

```typescript
type CallNodeType = 'function' | 'method' | 'api' | 'async' | 'external' | 'root';

interface CallNode {
  id: EntityId; name: string; module?: string; type: CallNodeType;
  line?: number; column?: number;
  selfTime?: number; totalTime?: number; callCount?: number; depth?: number;
}

interface CallEdge {
  source: EntityId; target: EntityId; callCount: number;
  avgDuration?: number; totalDuration?: number; async?: boolean; args?: string[];
}
```

### Clase: CallGraphBuilder

`createGraph(name: string): EntityId`
- **Descripcion:** Crea un grafo de llamadas vacio

`enterCall(graphId: EntityId, name: string, type: CallNodeType = 'function', module?: string): EntityId`
- **Descripcion:** Registra una entrada de llamada. Si existe una llamada con mismo nombre+modulo+type, incrementa callCount
- **Retorno:** ID del nodo (existente o nuevo)

`exitCall(graphId: EntityId, nodeId: EntityId): void`
- **Descripcion:** Registra una salida de llamada, actualiza selfTime y totalTime

`analyzeStackTrace(graphId: EntityId, stack: string[]): void`
- **Descripcion:** Analiza un stack trace (formato V8) y construye el grafo

`findHotPaths(graphId: EntityId, minCalls: number = 5): CallEdge[]`
- **Descripcion:** Encuentra los caminos mas frecuentes (hot paths)

`computeDepth(graphId: EntityId): Map<EntityId, number>`
- **Descripcion:** Calcula la profundidad de cada nodo en el arbol de llamadas

`toFlameData(graphId: EntityId): Array<{ name: string; value: number; children: any[] }>`
- **Descripcion:** Genera datos para flame graph (formato jerarquico)

`toMermaid(graphId: EntityId): string`
- **Descripcion:** Renderiza como diagrama Mermaid con tiempos y conteos

`getGraph(id: EntityId): CallGraph | undefined`

---

## L5 — Control Flow Graph

**Import:** `import { CFGBuilder, BasicBlock, CFEdge, ControlFlowGraph, BlockType } from '@cos/graph'`

### Interfaces

```typescript
type BlockType = 'entry' | 'exit' | 'basic' | 'branch' | 'merge' | 'loop_header' | 'loop_body' | 'condition';

interface BasicBlock {
  id: EntityId; name: string; type: BlockType;
  instructions?: string[]; condition?: string; loopVar?: string;
  depth?: number; hitCount?: number;
}

interface CFEdge {
  source: EntityId; target: EntityId;
  type: 'true' | 'false' | 'jump' | 'fallthrough' | 'back_edge' | 'exception';
  label?: string; probability?: number;
}
```

### Clase: CFGBuilder

`createCFG(name: string): EntityId`
- **Descripcion:** Crea un CFG con bloques entry y exit predefinidos

`addBlock(cfgId: EntityId, name: string, type: BlockType, instructions?: string[]): EntityId`
- **Descripcion:** Agrega un bloque basico. Validacion: ID unico

`addEdge(cfgId: EntityId, source: EntityId, target: EntityId, type: CFEdge['type'] = 'jump', label?: string): void`
- **Descripcion:** Agrega un edge de control flow. Validacion: source y target existen

`buildIfThenElse(cfgId: EntityId, condition: string, thenBlock: string, elseBlock: string, mergeBlock: string): void`
- **Descripcion:** Construye un patron if-then-else completo con bloques, edges, y merge

`buildLoop(cfgId: EntityId, loopVar: string, init: string, condition: string, body: string): void`
- **Descripcion:** Construye un bucle con header, body, back_edge, y salida

`buildSwitch(cfgId: EntityId, expression: string, cases: Array<{ value: string; block: string }>, defaultBlock: string): void`
- **Descripcion:** Construye un switch/case con N casos + default + merge

`computeDominators(cfgId: EntityId): Map<EntityId, Set<EntityId>>`
- **Descripcion:** Calcula dominadores (algoritmo iterativo de interseccion de conjuntos)
- **Retorno:** Mapa de blockId → conjunto de IDs que lo dominan

`detectLoops(cfgId: EntityId): Array<{ header: EntityId; body: EntityId[] }>`
- **Descripcion:** Detecta bucles naturales a partir de back_edges

`toMermaid(cfgId: EntityId): string`
- **Descripcion:** Renderiza como Mermaid con formas por tipo de bloque

`getCFG(id: EntityId): ControlFlowGraph | undefined`

---

## L6 — DataFlow Graph

**Import:** `import { DataFlowGraph, DataFlowNode, DataFlowEdge } from '@cos/graph'`

### Interfaces

```typescript
interface DataFlowNode {
  id: string; name: string; type: 'source' | 'transform' | 'sink' | 'storage' | 'filter' | 'join';
  inputShape?: string; outputShape?: string; batchSize?: number;
  throughput?: number; latency?: number; ops?: string; memoryMB?: number;
  params?: Record<string, unknown>;
}

interface DataFlowEdge {
  source: string; target: string;
  dataType: string; shape?: string; sizeBytes?: number; compression?: string;
  partitionKey?: string;
}
```

### Clase: DataFlowGraph

`addNode(n: DataFlowNode): string`
- **Descripcion:** Agrega un nodo. Validacion: ID unico
- **Retorno:** ID del nodo

`addEdge(e: DataFlowEdge): void`
- **Descripcion:** Agrega un edge. Validacion: source y target existen

`buildMLPipeline(): void`
- **Descripcion:** Construye un pipeline ML tipico: Image → Resize → Normalize → CNN → FC → Output

`buildETLPipeline(): void`
- **Descripcion:** Construye un pipeline ETL streaming: Kafka → Parse → Filter → Enrich → S3/Dashboard

`findBottlenecks(thresholdPercentile: number = 0.8): DataFlowNode[]`
- **Descripcion:** Encuentra nodos con mayor latencia o menor throughput (percentil superior)

`criticalPath(): DataFlowNode[]`
- **Descripcion:** Camino critico (ruta de mayor latencia total) usando DP topologico

`totalLatency(): number`
- **Descripcion:** Latencia total del pipeline (suma del camino critico)

`toMermaid(): string`
- **Descripcion:** Renderiza como Mermaid

`toJSON(): { nodes: DataFlowNode[]; edges: DataFlowEdge[] }`
- **Descripcion:** Serializa a JSON plano

`static fromJSON(data: { nodes: DataFlowNode[]; edges: DataFlowEdge[] }): DataFlowGraph`
- **Descripcion:** Deserializa desde JSON

---

## L7 — Compute Graph

**Import:** `import { ComputationalGraph, ComputeNode, ComputeEdge, ComputeGraphData, OpType } from '@cos/graph'`

### Interfaces

```typescript
type OpType = 'add' | 'mul' | 'matmul' | 'conv2d' | 'relu' | 'softmax' | 'cross_entropy'
  | 'reduce_mean' | 'reshape' | 'concat' | 'neg' | 'sub' | 'div' | 'pow' | 'exp'
  | 'log' | 'tanh' | 'sigmoid' | 'constant';

interface ComputeNode {
  id: string; name: string; op: OpType;
  inputShape?: string[]; outputShape?: string;
  params?: Record<string, number>;
  value?: number; requiresGrad?: boolean;
}

interface ComputeEdge { source: string; target: string; srcOutputIdx?: number; }
```

### Clase: ComputationalGraph

`addNode(n: ComputeNode): string`
- **Descripcion:** Agrega un nodo de computo

`addEdge(e: ComputeEdge): void`
- **Descripcion:** Agrega un edge de computo

`buildMLP(inputDim: number = 784, hiddenDim: number = 256, numClasses: number = 2): void`
- **Descripcion:** Construye un MLP de 2 capas con cross-entropy loss y 2 logits
- **Estructura:** x → matmul(w1) + b1 → relu → matmul(w2) → [logit0, logit1] → cross_entropy

`buildExpression(): void`
- **Descripcion:** Construye z = (x * y) + (w * v) con 4 hojas entrenables

`topologicalSort(): string[]`
- **Descripcion:** Orden topologico (Kahn's algorithm)

`forward(inputs: Record<string, number>): number`
- **Descripcion:** Forward pass: calcula valores en orden topologico
- **Retorno:** Valor del nodo de salida (ultimo sink)

`backward(): Map<string, number>`
- **Descripcion:** Backward pass: propagacion de gradientes via autodiff reverso
- **Retorno:** Mapa de nodeId → gradiente

`paramCount(): number`
- **Descripcion:** Cuenta parametros entrenables (requiresGrad=true)

`toMermaid(): string`

`toJSON(): ComputeGraphData`
- **Descripcion:** Serializa a JSON plano

`static fromJSON(data: ComputeGraphData): ComputationalGraph`
- **Descripcion:** Deserializa desde JSON

### Operaciones Soportadas

| Op | Forward | Gradiente |
|----|---------|-----------|
| `add` | Suma inputs | 1 para cada input |
| `mul` | Producto | input[1] y input[0] |
| `matmul` | input[0] * input[1] | input[1] y input[0] |
| `relu` | max(0, x) | 1 si x > 0, 0 si no |
| `tanh` | tanh(x) | 1 - tanh²(x) |
| `sigmoid` | 1/(1+e⁻ˣ) | s * (1-s) |
| `cross_entropy` | -log(softmax[0]) | softmax - one_hot |
| `exp` | eˣ | eˣ |
| `log` | ln(x) | 1/x |

---

## L8 — Knowledge Graph

**Import:** `import { KnowledgeGraphEngine, KGEntity, KGRelation, SPARQLQuery, EntityType, RelationType } from '@cos/graph'`

### Interfaces

```typescript
type EntityType = 'concept' | 'person' | 'org' | 'product' | 'tech' | 'event' | 'place' | 'system';
type RelationType = 'created' | 'uses' | 'part_of' | 'subclass_of' | 'located_in' | 'produced_by' | 'has' | 'related_to';

interface KGEntity {
  id: string; name: string; type: EntityType;
  aliases?: string[]; description?: string; properties?: Record<string, string>;
}

interface KGRelation {
  source: string; target: string; type: RelationType;
  confidence?: number; sourceDoc?: string; properties?: Record<string, string>;
}

interface SPARQLQuery {
  select: string[];  // Variables with ? prefix
  where: Array<{ subject: string; predicate: string; object: string }>;
  limit?: number;
}
```

### Clase: KnowledgeGraphEngine

`addEntity(e: KGEntity): string`
- **Descripcion:** Agrega una entidad. Validacion: ID unico
- **Retorno:** ID de la entidad

`addRelation(r: KGRelation): void`
- **Descripcion:** Agrega una relacion. Validacion: source y target existen

`buildAIEcosystem(): void`
- **Descripcion:** Construye grafo de IA: OpenAI, GPT-5, Transformer, LLM, RAG, Embedding

`buildCOS(): void`
- **Descripcion:** Construye grafo de COS: Cognitive OS, Memory, Reasoning, Knowledge, Execution, Orchestration

`sparql(query: SPARQLQuery): Array<Record<string, KGEntity>>`
- **Descripcion:** Consulta estilo SPARQL: triple patterns con variables
- **Retorno:** Bindings de variables a entidades

`query(sourceId: string, relation?: RelationType, maxDepth: number = 2): KGEntity[]`
- **Descripcion:** Recorrido BFS desde una entidad, opcionalmente filtrado por tipo de relacion

`inferTransitive(): KGRelation[]`
- **Descripcion:** Infiere relaciones transitivas (A→B, B→C => A→C)
- **Retorno:** Relaciones inferidas con confianza = conf1 * conf2 * 0.9

`getRelations(entityId: string): KGRelation[]`
- **Descripcion:** Obtiene todas las relaciones de una entidad

`toMermaid(): string`

---

## L9 — Semantic Graph

**Import:** `import { SemanticGraph, SemanticNode, SemanticEdge } from '@cos/graph'`

### Interfaces

```typescript
interface SemanticNode {
  id: string; concept: string; type: 'entity' | 'class' | 'attribute' | 'relation';
  definition?: string; examples?: string[]; embedding?: number[];
}

interface SemanticEdge {
  source: string; target: string;
  relation: 'is_a' | 'has_property' | 'related_to' | 'part_of' | 'opposite_of' | 'causes' | 'requires';
  strength: number; // 0..1
}
```

### Clase: SemanticGraph

`addNode(n: SemanticNode): string`
- **Descripcion:** Agrega un nodo semantico. Validacion: ID unico

`addEdge(e: SemanticEdge): void`
- **Descripcion:** Agrega un edge semantico. Validacion: source y target existen

`buildAnimalTaxonomy(): void`
- **Descripcion:** Construye taxonomia animal: Animal ← Mammal ← Dog/Cat, Animal ← Bird ← Eagle

`lca(id1: string, id2: string): SemanticNode | null`
- **Descripcion:** Ancestro comun mas bajo (Lowest Common Ancestor) en la taxonomia

`similarity(id1: string, id2: string): number`
- **Descripcion:** Similitud semantica basada en distancia al LCA (0..1)

`toMermaid(): string`

---

## L10 — Embedding Graph

**Import:** `import { EmbeddingGraph, EmbeddingNode, EmbeddingEdge } from '@cos/graph'`

### Interfaces

```typescript
interface EmbeddingNode {
  id: string; label: string; vector: number[];
  metadata?: Record<string, unknown>; clusterId?: number;
}

interface EmbeddingEdge {
  source: string; target: string; similarity: number; distance: number;
}
```

### Clase: EmbeddingGraph

`addNode(n: EmbeddingNode): string`
- **Descripcion:** Agrega un nodo con vector. Validacion: ID unico

`static distance(a: number[], b: number[]): number`
- **Descripcion:** Distancia L2 euclidiana entre dos vectores

`static cosine(a: number[], b: number[]): number`
- **Descripcion:** Similitud coseno entre dos vectores

`buildKNN(k: number = 3): void`
- **Descripcion:** Construye grafo KNN: cada nodo se conecta a sus K vecinos mas cercanos (por distancia L2)

`buildEpsilon(epsilon: number = 0.5): void`
- **Descripcion:** Construye grafo epsilon: conecta nodos con distancia < epsilon

`cluster(k: number = 3, seed?: number): Map<number, EmbeddingNode[]>`
- **Descripcion:** K-means clustering con inicializacion K-means++ y convergencia automatica
- **Retorno:** Mapa de clusterId → nodos

`buildAIModelGraph(): void`
- **Descripcion:** Construye grafo de similitud de modelos AI: GPT-4, GPT-3.5, Claude 3, Gemini, Llama 3, Mistral

`toMermaid(): string`

---

## L11 — GraphRAG

**Import:** `import { GraphRAGEngine, Chunk, GraphRAGConfig, GraphRAGResult } from '@cos/graph'`

### Interfaces

```typescript
interface Chunk {
  id: string; text: string; source: string;
  embedding: number[]; entities: string[];
}

interface GraphRAGConfig {
  topK: number;           // Chunks a recuperar (default: 5)
  walkDepth: number;       // Profundidad de traversal KG (default: 2)
  similarityWeight: number; // Peso de similitud vectorial (default: 0.6)
}

interface GraphRAGResult {
  query: string; chunks: Chunk[]; entities: string[];
  relationships: Array<{ source: string; target: string; relation: string }>;
  context: string; answer: string; confidence: number; trace: string[];
}
```

### Clase: GraphRAGEngine

`constructor(config?: Partial<GraphRAGConfig>)`
- **Descripcion:** Crea el motor con configuracion. Valores por defecto: topK=5, walkDepth=2, similarityWeight=0.6

`addChunk(c: Chunk): void`
- **Descripcion:** Agrega un chunk de texto. Validacion: ID unico

`addEntity(id: string, name: string, type: string = 'concept'): void`
- **Descripcion:** Agrega una entidad. Validacion: ID unico

`addRelation(source: string, target: string, type: string = 'related_to'): void`
- **Descripcion:** Agrega una relacion. Validacion: source y target existen

`buildDemo(): void`
- **Descripcion:** Construye grafo de demostracion de COS: entidades, relaciones, chunks con embeddings

`retrieve(queryEmbedding: number[], queryEntities: string[] = []): { chunks: Chunk[]; entities: string[]; relations: Array<...> }`
- **Descripcion:** Recuperacion hibrida: ranking por similitud vectorial + KG traversal + re-ranking ponderado
- **Algoritmo:** topK por vector → KG walk depth → re-rank hybrid score

`async answer(query: string, queryEmbedding: number[], queryEntities: string[] = []): Promise<GraphRAGResult>`
- **Descripcion:** Retrieval + generacion de respuesta simulada con confianza y trazabilidad

`toMermaid(): string`

---

## L12 — Memory Graph

**Import:** `import { MemoryGraphEngine, MemoryNode, MemoryEdge, MemoryGraph, MemoryNodeType, MemoryEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type MemoryNodeType = 'conversation' | 'topic' | 'entity' | 'fact' | 'insight' | 'memory';
type MemoryEdgeType = 'evolves_to' | 'references' | 'associates' | 'contradicts' | 'confirms' | 'led_to';
```

### Clase: MemoryGraphEngine

`constructor(name: string = 'Memory Graph')`

`addNode(n: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): EntityId`
- **Descripcion:** Agrega un nodo de memoria. Genera automaticamente: id, createdAt, lastAccessed, accessCount=0

`addEdge(source: EntityId, target: EntityId, type: MemoryEdgeType, strength: number = 0.5): EntityId`
- **Descripcion:** Agrega un edge. Validacion: source y target existen

`accessNode(nodeId: EntityId): MemoryNode | undefined`
- **Descripcion:** Accede a un nodo: actualiza lastAccessed e incrementa accessCount

`buildConversation(): void`
- **Descripcion:** Construye arbol de conversacion: Roberto → Oculops/Supabase/Claude → Agentic OS → Memory System

`recall(nodeId: EntityId, maxDepth: number = 2, minStrength: number = 0.3): MemoryNode[]`
- **Descripcion:** Recupera memorias relacionadas por traversal BFS en ambas direcciones, filtrado por fuerza minima

`strongestPath(fromId: EntityId, toId: EntityId): MemoryNode[]`
- **Descripcion:** Encuentra el camino de memoria mas fuerte entre dos nodos (maximiza suma de strengths)

`forget(minConfidence: number = 0.3): number`
- **Descripcion:** Olvida memorias por debajo de un umbral de confianza. Retorna cantidad de nodos eliminados

`consolidate(): number`
- **Descripcion:** Consolida memorias duplicadas por nombre. Fusiona accessCount y confidence

`validate(): string[]`
- **Descripcion:** Valida integridad: edges colgantes, self-loops. Retorna lista de errores

`metrics(): { nodeCount, edgeCount, avgDegree, density, maxDegree }`
- **Descripcion:** Metricas del grafo de memoria

`toJSON(): MemoryGraph`
- **Descripcion:** Serializa a JSON (copia profunda)

`static fromJSON(data: MemoryGraph): MemoryGraphEngine`
- **Descripcion:** Deserializa desde JSON

`toMermaid(): string`

---

## L13 — Agent Graph

**Import:** `import { AgentGraphEngine, AgentNode, AgentEdge, AgentGraph, AgentRole, AgentEdgeType, AgentStatus } from '@cos/graph'`

### Interfaces

```typescript
type AgentRole = 'ceo' | 'planner' | 'researcher' | 'developer' | 'reviewer' | 'marketer' | 'analyst' | 'designer' | 'coordinator';
type AgentEdgeType = 'delegates_to' | 'reports_to' | 'collaborates_with' | 'reviews' | 'approves';
type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'done' | 'error';
```

### Clase: AgentGraphEngine

`constructor(name: string = 'Agent Swarm')`

`addNode(n: Omit<AgentNode, 'id' | 'createdAt' | 'status'>): EntityId`
- **Descripcion:** Agrega un agente. status se inicializa como 'idle'. Requiere: name, role, capabilities, tools, memoryIds, confidence

`addEdge(source: EntityId, target: EntityId, type: AgentEdgeType, priority: number = 5): EntityId`
- **Descripcion:** Agrega un edge de delegacion. Validacion: source y target existen. priority: 0-10

`buildDevTeam(): void`
- **Descripcion:** Construye jerarquia de equipo de desarrollo: CEO → Planner → Researcher/Developer/Marketer, Developer → Reviewer

`delegationChain(fromId: EntityId, toId: EntityId): AgentNode[]`
- **Descripcion:** Encuentra la cadena de delegacion de un agente a otro (solo edges 'delegates_to')

`findByCapability(capability: string): AgentNode[]`
- **Descripcion:** Busca agentes por capacidad (case-insensitive)

`validate(): string[]`
- **Descripcion:** Valida edges colgantes

`metrics(): { nodeCount, edgeCount, avgOutDegree, roles }`
- **Descripcion:** Metricas del grafo de agentes

`toJSON(): AgentGraph`
- **Descripcion:** Serializa a JSON

`static fromJSON(data: AgentGraph): AgentGraphEngine`
- **Descripcion:** Deserializa desde JSON

`toMermaid(): string`

---

## L14 — Tool Graph

**Import:** `import { ToolGraphEngine, ToolNode, ToolEdge, ToolGraph, ToolType, ToolEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type ToolType = 'api' | 'function' | 'database' | 'storage' | 'ai' | 'communication' | 'compute';
type ToolEdgeType = 'depends_on' | 'triggers' | 'provides_data_for' | 'authenticates_via' | 'fallback_to';
```

### Clase: ToolGraphEngine

`constructor(name: string = 'Tool Ecosystem')`

`addNode(n: Omit<ToolNode, 'id' | 'createdAt'>): EntityId`
- **Descripcion:** Agrega una herramienta. Requiere: name, type, description, requiredCapabilities, rateLimit, latency, costPerCall, enabled

`addEdge(source: EntityId, target: EntityId, type: ToolEdgeType, priority: number = 5): EntityId`
- **Descripcion:** Agrega un edge entre herramientas. priority: 0-10

`buildToolEcosystem(): void`
- **Descripcion:** Construye ecosistema: Claude API, GitHub API, Docker Engine, Supabase DB, Stripe API

`route(fromCapability: string, toTool: string): ToolNode[]`
- **Descripcion:** Encuentra la mejor ruta desde una capacidad hasta una herramienta (minimiza costo + latencia)

`findDisabled(): ToolNode[]`
- **Descripcion:** Encuentra herramientas deshabilitadas

`validate(): string[]`

`metrics(): { nodeCount, edgeCount, toolTypes, avgLatency, disabledCount }`

`toJSON(): ToolGraph`

`static fromJSON(data: ToolGraph): ToolGraphEngine`

`toMermaid(): string`

---

## L15 — Workflow Graph

**Import:** `import { WorkflowGraphEngine, WorkflowNode, WorkflowEdge, WorkflowGraph, WorkflowNodeType, WorkflowEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'transform' | 'webhook' | 'notification' | 'delay' | 'end';
type WorkflowEdgeType = 'on_success' | 'on_failure' | 'on_condition_true' | 'on_condition_false' | 'timeout';
```

### Clase: WorkflowGraphEngine

`constructor(name: string, description?: string)`

`addNode(n: Omit<WorkflowNode, 'id' | 'createdAt'>): EntityId`
- **Descripcion:** Agrega un nodo de workflow. Requiere: name, type. Opcional: service, config, retries, timeout

`addEdge(source: EntityId, target: EntityId, type: WorkflowEdgeType, condition?: string): EntityId`
- **Descripcion:** Agrega un edge. Validacion: source y target existen. condition para edges condicionales

`buildSupportWorkflow(): void`
- **Descripcion:** Construye workflow de soporte: Webhook → Claude → Condition → Slack/Email → Notion → Delay → Done

`execute(initialData: Record<string, unknown> = {}): WorkflowNode[]`
- **Descripcion:** Ejecuta el workflow en orden topologico. Retorna nodos ejecutados

`topologicalSort(): EntityId[]`
- **Descripcion:** Orden topologico (Kahn's algorithm)

`detectCycle(): EntityId[] | null`
- **Descripcion:** Detecta ciclos en el workflow

`setEnabled(enabled: boolean): void`
- **Descripcion:** Habilita/deshabilita el workflow

`validate(): string[]`
- **Descripcion:** Valida edges colgantes, ciclos, y existencia de trigger/webhook

`metrics(): { nodeCount, edgeCount, actionCount, triggerCount }`

`toJSON(): WorkflowGraph`

`static fromJSON(data: WorkflowGraph): WorkflowGraphEngine`

`toMermaid(): string`

---

## L16 — Network Graph

**Import:** `import { NetworkGraphEngine, NetworkNode, NetworkEdge, NetworkGraph, NetworkNodeType, NetworkEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type NetworkNodeType = 'server' | 'router' | 'cdn' | 'client' | 'load_balancer' | 'pod' | 'service' | 'gateway' | 'database' | 'cache';
type NetworkEdgeType = 'routes_to' | 'load_balanced_by' | 'proxies_to' | 'depends_on' | 'replicates_to' | 'connects_to';
```

### Clase: NetworkGraphEngine

`constructor(name: string = 'Network Topology')`

`addNode(n: Omit<NetworkNode, 'id' | 'createdAt'>): EntityId`
- **Descripcion:** Agrega un nodo de red. Requiere: name, type, healthy. Opcional: ip, region, latency, throughput, cpu, memory, replicas

`addEdge(source: EntityId, target: EntityId, type: NetworkEdgeType, bandwidth?: number): EntityId`
- **Descripcion:** Agrega un edge. Validacion: source y target existen

`buildInfrastructure(): void`
- **Descripcion:** Construye topologia CDN + origin: Client → Cloudflare → LB → Router → API Gateway → App Server → DB/Cache

`shortestPath(fromId: EntityId, toId: EntityId): NetworkNode[]`
- **Descripcion:** Camino mas corto (BFS) entre dos nodos

`findUnhealthy(): NetworkNode[]`
- **Descripcion:** Encuentra nodos unhealthy

`validate(): string[]`

`metrics(): { nodeCount, edgeCount, unhealthyCount, avgLatency, regionCount }`

`toJSON(): NetworkGraph`

`static fromJSON(data: NetworkGraph): NetworkGraphEngine`

`toMermaid(): string`

---

## L17 — Social Graph

**Import:** `import { SocialGraphEngine, SocialNode, SocialEdge, SocialGraph, SocialNodeType, SocialEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type SocialNodeType = 'person' | 'company' | 'event' | 'group' | 'page' | 'influencer';
type SocialEdgeType = 'friend_of' | 'follows' | 'works_at' | 'attended' | 'likes' | 'family_of' | 'mentions';
```

### Clase: SocialGraphEngine

`constructor(name: string = 'Social Network')`

`addNode(n: Omit<SocialNode, 'id' | 'joinedAt'>): EntityId`
- **Descripcion:** Agrega un nodo social. Requiere: name, type, verified. Opcional: followers, influence, interests, location

`addEdge(source: EntityId, target: EntityId, type: SocialEdgeType, strength: number = 0.5): EntityId`
- **Descripcion:** Agrega un edge. Validacion: source y target existen. strength: 0-1

`buildTechNetwork(): void`
- **Descripcion:** Construye red tech: Alice, Bob, Carol (influencer), Acme Corp, AI Summit

`mutualFriends(personA: EntityId, personB: EntityId): SocialNode[]`
- **Descripcion:** Amigos en comun entre dos personas

`mostInfluential(): SocialNode | undefined`
- **Descripcion:** Persona/influencer con mayor influence score

`recommendFriends(personId: EntityId): SocialNode[]`
- **Descripcion:** Recomienda amistades basadas en friends-of-friends (top 5)

`validate(): string[]`

`metrics(): { nodeCount, edgeCount, avgInfluence, avgFollowers, verifiedCount }`

`toJSON(): SocialGraph`

`static fromJSON(data: SocialGraph): SocialGraphEngine`

`toMermaid(): string`

---

## L18 — Biological Graph

**Import:** `import { BiologicalGraphEngine, BiologicalNode, BiologicalEdge, BiologicalGraph, BioNodeType, BioEdgeType } from '@cos/graph'`

### Interfaces

```typescript
type BioNodeType = 'neuron' | 'synapse' | 'protein' | 'gene' | 'cell' | 'receptor' | 'neurotransmitter';
type BioEdgeType = 'connects_to' | 'activates' | 'inhibits' | 'expresses' | 'binds_to' | 'regulates';
```

### Clase: BiologicalGraphEngine

`constructor(name: string = 'Biological Network')`

`addNode(n: Omit<BiologicalNode, 'id' | 'createdAt'>): EntityId`
- **Descripcion:** Agrega un nodo biologico. Opcional: weight, threshold, firingRate, concentration, location

`addEdge(source: EntityId, target: EntityId, type: BioEdgeType, strength: number = 0.5): EntityId`
- **Descripcion:** Agrega un edge. Crea automaticamente plasticity=0.5

`buildNeuralCircuit(): void`
- **Descripcion:** Circuito neuronal de 3 capas: Sensory → InterneuronA/InterneuronB → Motor, con GABA y Glutamate

`buildProteinNetwork(): void`
- **Descripcion:** Red de interaccion de proteinas: p53, MDM2, BAX, Bcl-2, Caspase-3

`simulateFiring(startNodeId: EntityId, iterations: number = 5): BiologicalNode[]`
- **Descripcion:** Simula activacion neuronal: propaga desde startNodeId, siguiendo edges con strength > 0.5

`validate(): string[]`

`metrics(): { nodeCount, edgeCount, neuronCount, avgStrength, inhibitoryEdges }`

`toJSON(): BiologicalGraph`

`static fromJSON(data: BiologicalGraph): BiologicalGraphEngine`

`toMermaid(): string`

---

## L19 — Molecular Graph

**Import:** `import { MolecularGraphEngine, AtomNode, BondEdge, MolecularGraph, AtomType, BondType, MolecularNodeType } from '@cos/graph'`

### Interfaces

```typescript
type AtomType = 'C' | 'O' | 'H' | 'N' | 'S' | 'P' | 'F' | 'Cl' | 'Br' | 'I' | 'generic';
type BondType = 'single' | 'double' | 'triple' | 'aromatic' | 'ionic' | 'hydrogen';
type MolecularNodeType = 'atom' | 'ion' | 'functional_group' | 'ring';
```

### Clase: MolecularGraphEngine

`constructor(name: string = 'Molecule')`

`addAtom(n: Omit<AtomNode, 'id' | 'createdAt'>): EntityId`
- **Descripcion:** Agrega un atomo. Requiere: element, atomicNumber, type. Opcional: charge, mass, hybridization, x/y/z, implicitHydrogens

`addBond(source: EntityId, target: EntityId, type: BondType, order: number = 1): EntityId`
- **Descripcion:** Agrega un enlace. Validacion: source y target existen. order: 1, 2, 3

`buildWater(): void`
- **Descripcion:** Construye molecula de agua: H-O-H con coordenadas 3D, formula H2O, peso 18.015

`buildBenzene(): void`
- **Descripcion:** Construye anillo de benceno: C6H6 con enlaces aromaticos (order=1.5), formula C6H6, peso 78.114

`buildAspirin(): void`
- **Descripcion:** Construye aspirina simplificada: anillo bencenico con grupos COOH y O-CH3

`findRings(): EntityId[][]`
- **Descripcion:** Detecta anillos en la molecula via DFS (ciclos de longitud ≥ 3, max 12)

`computeWeight(): number`
- **Descripcion:** Calcula peso molecular: suma de masas atomicas + hidrogenos implicitos * 1.008

`validate(): string[]`
- **Descripcion:** Valida enlaces colgantes y regla de valencia del carbono (max 4 enlaces)

`metrics(): { atomCount, bondCount, atomTypes, molecularWeight, bondTypes, ringCount }`

`toJSON(): MolecularGraph`

`static fromJSON(data: MolecularGraph): MolecularGraphEngine`

`toMermaid(): string`

---

## Indice de Importacion

```typescript
// Todos los niveles
import {
  // L0 - Visual
  VisualGraphEngine, MermaidRenderer, GraphvizRenderer, ASCIITreeRenderer, JSONGraphExporter,
  VisualGraph, VisualNode, VisualEdge,
  // L1 - Execution
  ExecutionGraphEngine, ExecNode, ExecEdge, ExecNodeResult, ExecutionGraph,
  // L2 - State
  StateMachine, StateMachineRegistry, StateConfig, StateTransition, StateContext,
  // L3 - Dependency
  DependencyResolver, DepNode, DepEdge, DependencyGraph,
  // L4 - Call
  CallGraphBuilder, CallNode, CallEdge, CallGraph,
  // L5 - CFG
  CFGBuilder, BasicBlock, CFEdge, ControlFlowGraph,
  // L6 - DataFlow
  DataFlowGraph, DataFlowNode, DataFlowEdge,
  // L7 - Compute
  ComputationalGraph, ComputeNode, ComputeEdge, ComputeGraphData,
  // L8 - Knowledge
  KnowledgeGraphEngine, KGEntity, KGRelation, SPARQLQuery,
  // L9 - Semantic
  SemanticGraph, SemanticNode, SemanticEdge,
  // L10 - Embedding
  EmbeddingGraph, EmbeddingNode, EmbeddingEdge,
  // L11 - GraphRAG
  GraphRAGEngine, Chunk, GraphRAGConfig, GraphRAGResult,
  // L12 - Memory
  MemoryGraphEngine, MemoryNode, MemoryEdge, MemoryGraph,
  // L13 - Agent
  AgentGraphEngine, AgentNode, AgentEdge, AgentGraph,
  // L14 - Tool
  ToolGraphEngine, ToolNode, ToolEdge, ToolGraph,
  // L15 - Workflow
  WorkflowGraphEngine, WorkflowNode, WorkflowEdge, WorkflowGraph,
  // L16 - Network
  NetworkGraphEngine, NetworkNode, NetworkEdge, NetworkGraph,
  // L17 - Social
  SocialGraphEngine, SocialNode, SocialEdge, SocialGraph,
  // L18 - Biological
  BiologicalGraphEngine, BiologicalNode, BiologicalEdge, BiologicalGraph,
  // L19 - Molecular
  MolecularGraphEngine, AtomNode, BondEdge, MolecularGraph,
} from '@cos/graph';
```