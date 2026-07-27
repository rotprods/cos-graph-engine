# TICKETS — 14 Fixes del Adversarial Refactor

> Tickets ejecutables para el sprint de refactor
> Estado: COMPLETADOS (documentados para referencia)

---

## Como leer estos tickets

Cada ticket documenta:
- **Que se cambio** (el problema + la solucion)
- **Archivos afectados**
- **Tests asociados**
- **Verificacion** (como confirmar que funciona)

Aunque los fixes ya estan implementados, estos tickets sirven como:
1. Documentacion de auditoria para code review
2. Base para futuros refactors similares
3. Plantilla para tickets de nuevos niveles (L4-L19)

---

## L1 — Execution Graph (4 tickets)

---

### TICKET-001: Queue re-fill O(n*m) → O(n+m)

**Tipo:** Performance | **Nivel:** L1 | **Severidad:** P0

#### Problema

El planificador de batches escaneaba todos los nodos (N) y filtraba todos los
edges (M) en cada iteracion del batch:

```typescript
// ANTES: O(n*m) por batch
for (const nodeId of allNodes) {
  if (inDegree[nodeId] === 0 && !completed.has(nodeId)) { ... }
}
for (const nodeId of batch) {
  for (const edge of graph.edges) {
    if (edge.source === nodeId) inDegree[edge.target]--;
  }
}
```

En chain n=500: 124,750 iteraciones para 500 nodos.

#### Solucion

Agregar `remainingInDegree` como contador mutable. Cuando un nodo completa,
decrementar solo a sus vecinos directos via adjacency map.

```typescript
// DESPUES: O(n+m) total
const remainingInDegree = new Map(inDegree);
const readyQueue = nodes.filter(n => remainingInDegree.get(n.id) === 0);

while (readyQueue.length > 0) {
  const nodeId = readyQueue.shift()!;
  // ejecutar...
  const neighbors = adjacencyMap.get(nodeId) || [];
  for (const neighborId of neighbors) {
    const newDeg = remainingInDegree.get(neighborId)! - 1;
    remainingInDegree.set(neighborId, newDeg);
    if (newDeg === 0) readyQueue.push(neighborId);
  }
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level1-execution.ts
  - Agregar campo adjacencyMap (private)
  - Modificar execute() para usar remainingInDegree
  - La cola now solo contiene nodos listos, no todos los nodos
```

#### Tests asociados

```
NUEVO: scripts/test-level1-diamond.ts (22 tests)
  - Diamond pattern: A→B, A→C, B→D, C→D
  - Chain: 3 nodos en secuencia
  - Disconnected: 3 nodos sin conexion
  - Empty: 0 nodos
  - Single: 1 nodo
  - Verifica orden: A antes de C, A antes de D, etc.
```

#### Verificacion

- `npx tsx scripts/test-level1-diamond.ts` — 22/22 pass
- `npx tsx scripts/benchmark-perf.ts` — chain n=500: ~499 iter vs ~124,750

#### Benchmark

| Topologia | n=10 | n=100 | n=500 |
|-----------|------|-------|-------|
| Chain | 5x | 50x | **250x** |
| Diamond | 2.6x | 25x | **125x** |
| Dense | 1x | 1x | 1x |

---

### TICKET-002: Mutation API en ExecutionGraphEngine

**Tipo:** Feature | **Nivel:** L1 | **Severidad:** P0

#### Problema

No existia. Para modificar un grafo habia que reconstruirlo desde cero.

#### Solucion

Agregar 4 metodos a `ExecutionGraphEngine`:

```typescript
addNode(graphId, node): void
  - Valida que el ID no exista ya
  - Agrega al array de nodos

removeNode(graphId, nodeId): void
  - Elimina el nodo
  - Elimina todos los edges que lo referencian (source o target)

addEdge(graphId, edge): string
  - Valida source y target existen
  - Genera ID automatico
  - Agrega al array de edges

removeEdge(graphId, edgeId): void
  - Elimina por ID de edge
  - Lanza error si no existe
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level1-execution.ts
  - Agregar addNode, removeNode, addEdge, removeEdge
  - Cada metodo valida que el grafo existe
  - removeNode tambien limpia edges conectados
```

#### Tests asociados

```
NUEVO: scripts/test-level1-mutation.ts (22 tests)
  - addNode con ID unico
  - addNode con ID duplicado → throw
  - removeNode existente
  - removeNode inexistente → throw
  - removeNode limpia edges conectados
  - addEdge con source/target validos
  - addEdge con target inexistente → throw
  - removeEdge por ID
  - removeEdge inexistente → throw
  - Ejecutar DESPUES de mutar (los cambios se reflejan)
  - Grafo inexistente → throw en todos los metodos
```

#### Verificacion

- `npx tsx scripts/test-level1-mutation.ts` — 22/22 pass
- Despues de mutar, execute() debe procesar los nodos correctos

---

### TICKET-003: Validacion de IDs duplicados en createGraph

**Tipo:** Bugfix | **Nivel:** L1 | **Severidad:** P0

#### Problema

`createGraph` aceptaba nodos con IDs duplicados. El segundo nodo con el mismo
ID pisaba al primero silenciosamente, causando corrupcion de datos durante la
ejecucion.

#### Solucion

```typescript
createGraph(name: string, nodes: ProcessorNode[], edges: ProcessorEdge[]): string {
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) {
    throw new Error(`Duplicate node IDs detected`);
  }
  // ... resto
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level1-execution.ts
  - Agregar validacion al inicio de createGraph
```

#### Tests asociados

Probado indirectamente por `test-level1-mutation.ts` (test "Duplicate: throws on duplicate ID")

#### Verificacion

- `createGraph('test', [{id:'a'}, {id:'a'}], [])` → throws "Duplicate node IDs detected"

---

### TICKET-004: Documentar last-write-wins en DataFlow

**Tipo:** Documentation | **Nivel:** L1 | **Severidad:** P2

#### Problema

En patrones diamante (multiple sources → un target), `dataFlow.set(targetId, output)`
usa last-write-wins. Esto estaba indocumentado, parecia un bug.

#### Solucion

Agregar comentario JSDoc en la seccion de DataFlow explicando:

```typescript
// dataFlow.set(targetId, output)
// NOTA: En configuraciones multi-source (patron diamante), el ultimo en
// escribir gana (last-write-wins). Esto es una decision de diseño para
// grafos de valor unico donde cada nodo tiene un solo output.
// Para grafos que necesitan merge de multiples fuentes, usar un nodo
// intermedio de tipo 'merge' que combine los valores.
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level1-execution.ts
  - Comentario en la seccion de dataFlow (dentro de execute())
```

#### Verificacion

- Lectura del codigo: el comentario aparece antes del uso de `dataFlow.set()`

---

## L3 — Dependency Graph (5 tickets)

---

### TICKET-005: detectCycle con adjacency map

**Tipo:** Performance | **Nivel:** L3 | **Severidad:** P0

#### Problema

`detectCycle` filtraba `graph.edges` en cada llamada DFS:

```typescript
// ANTES: O(n*m)
function hasCycle(graph, nodeId, visited, stack) {
  for (const edge of graph.edges.filter(e => e.source === nodeId)) {
    // O(m) por llamada × n llamadas = O(n*m)
  }
}
```

#### Solucion

Construir `forwardAdj` (Map<nodeId, Edge[]>) una vez, O(m). DFS hace O(1)
lookup por vecino. O(n+m) total.

```typescript
const adj = buildForwardAdj(graph);  // O(m)
function hasCycleFast(nodeId, visited, stack) {
  for (const edge of (adj.get(nodeId) || [])) {  // O(1)
    // O(n+m) total
  }
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level3-dependency.ts
  - Agregar funcion buildForwardAdj(graph): Map
  - Modificar detectCycle para usar adj
  - Cachear adj entre llamadas (reconstruir solo si hay cambios)
```

#### Tests asociados

Probado por `test-level3-consistency.ts` (tests "Cycle: no cycle in acyclic graph",
"Cycle: detects A→B→C→A cycle", "Cycle: path has 3+ nodes")

#### Verificacion

- `npx tsx scripts/test-level3-consistency.ts` — 32/32 pass
- `npx tsx scripts/benchmark-perf.ts` — O(n+m) vs O(n*m)

---

### TICKET-006: computeDepth con reverse adjacency map

**Tipo:** Performance | **Nivel:** L3 | **Severidad:** P0

#### Problema

`computeDepth` filtraba edges para encontrar predecesores de cada nodo:

```typescript
// ANTES: O(n*m)
for (const edge of graph.edges.filter(e => e.target === nodeId)) {
  maxDepth = Math.max(maxDepth, computeDepth(graph, edge.source) + 1);
}
```

#### Solucion

Construir `reverseAdj` (predecesores → nodo) una vez, O(m). O(n+m) total.

```typescript
const revAdj = buildReverseAdj(graph);  // O(m)
function computeDepthFast(nodeId, cache) {
  if (cache.has(nodeId)) return cache.get(nodeId)!;
  let maxDepth = 0;
  for (const edge of (revAdj.get(nodeId) || [])) {  // O(1)
    maxDepth = Math.max(maxDepth, computeDepthFast(edge.source, cache) + 1);
  }
  cache.set(nodeId, maxDepth);
  return maxDepth;
}
```

Ademas usa memoization (cache de profundidades) para no recalcular.

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level3-dependency.ts
  - Agregar funcion buildReverseAdj(graph): Map
  - Modificar computeDepth para usar revAdj + cache
```

#### Tests asociados

Probado por `test-level3-consistency.ts` (tests "Depth: react = 0 (root)",
"Depth: app = 2", etc.)

#### Verificacion

- `npx tsx scripts/test-level3-consistency.ts` — 32/32 pass
- computeDepth('app') = 2, computeDepth('react') = 0

---

### TICKET-007: subgraph con adjacency map

**Tipo:** Performance | **Nivel:** L3 | **Severidad:** P0

#### Problema

`subgraph` filtraba edges en cada DFS para encontrar vecinos:

```typescript
// ANTES: O(n*m)
function subgraph(graph, rootId) {
  const dfs = (nodeId) => {
    for (const edge of graph.edges.filter(e => e.source === nodeId)) {
      // O(m) por llamada
    }
  };
}
```

#### Solucion

Usar `forwardAdj` (mismo que TICKET-005).

```typescript
const adj = buildForwardAdj(graph);  // O(m)
function subgraphFast(rootId) {
  const dfs = (nodeId) => {
    for (const edge of (adj.get(nodeId) || [])) {  // O(1)
      // O(n+m) total
    }
  };
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level3-dependency.ts
  - Modificar subgraph para usar forwardAdj existente
```

#### Tests asociados

Probado por `test-level3-consistency.ts` (tests "Subgraph: exists",
"Subgraph: contains next + its dependencies", etc.)

#### Verificacion

- `npx tsx scripts/test-level3-consistency.ts` — 32/32 pass
- subgraph('next') incluye next, react, y typescript (sus dependencias)

---

### TICKET-008: Mutation API en DependencyResolver

**Tipo:** Feature | **Nivel:** L3 | **Severidad:** P0

#### Problema

No existia. Mismo problema que L1 pero para grafos de dependencia.

#### Solucion

Agregar 4 metodos a `DependencyResolver`:

```typescript
addNode(graphId, node): void
  - Valida ID unico
  - Agrega al array

removeNode(graphId, nodeId): void
  - Elimina nodo y edges conectados

addEdge(graphId, { source, target }): void
  - Valida source y target existen
  - Agrega edge

removeEdge(graphId, source, target): void
  - Elimina por tupla (source, target)
  - Diferencia con L1: L3 usa tupla, no ID unico
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level3-dependency.ts
  - Agregar addNode, removeNode, addEdge, removeEdge
  - Cada metodo valida que el grafo existe
  - removeNode limpia edges
  - removeEdge usa (source, target) como clave
```

#### Tests asociados

```
NUEVO: scripts/test-level3-mutation.ts (25 tests)
  - addNode con ID unico
  - addNode con ID duplicado → throw
  - removeNode existente
  - removeNode inexistente → throw
  - removeNode limpia edges conectados
  - addEdge con source/target validos
  - addEdge con source inexistente → throw
  - removeEdge por tupla
  - removeEdge inexistente → throw
  - Topological sort DESPUES de mutar (los cambios se reflejan)
  - Grafo inexistente → throw en todos los metodos
```

#### Verificacion

- `npx tsx scripts/test-level3-mutation.ts` — 25/25 pass
- Despues de mutar, topologicalSort() debe devolver orden correcto

---

### TICKET-009: JSDoc documentando convencion de edges

**Tipo:** Documentation | **Nivel:** L3 | **Severidad:** P2

#### Problema

Ningun metodo explicaba que source→target significa "source depende de target".
La convencion es contraintuitiva (opuesta a L1 donde source→target es flujo de
datos).

#### Solucion

Agregar JSDoc a todos los metodos publicos de `DependencyResolver`:

```
/**
 * [nombre del metodo]
 * Convencion de edges: source → target significa "source depende de target"
 * (la flecha apunta hacia la dependencia).
 * - Roots: no tienen outgoing edges (no dependen de nada)
 * - Leaves: no tienen incoming edges (nada depende de ellas)
 * [descripcion especifica del metodo]
 */
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level3-dependency.ts
  - Agregar JSDoc en: constructor, createGraph, topologicalSort, detectCycle,
    computeDepth, findRoots, findLeaves, subgraph, addNode, removeNode,
    addEdge, removeEdge
```

#### Verificacion

- Lectura del codigo: cada metodo publico tiene JSDoc completo

---

## L7 — Computational Graph (5 tickets + 1 bug)

---

### TICKET-010: Remover parametro muerto `lossValue` de backward()

**Tipo:** Cleanup | **Nivel:** L7 | **Severidad:** P1

#### Problema

`backward(lossValue: number)` recibia un parametro que nunca se usaba.
El gradiente semilla siempre era 1.0 (estandar de autodiff).

```typescript
// ANTES: lossValue nunca referenciado
backward(lossValue: number): Map<string, number> {
  const gradients = new Map<string, number>();
  gradients.set(this.outputNodeId, 1.0);  // seed siempre 1.0
  // lossValue no aparece en ninguna linea
}
```

#### Solucion

```typescript
// DESPUES: sin parametros
backward(): Map<string, number> {
  // Gradiente semilla: d(output)/d(output) = 1.0 (estandar de autodiff)
  // La funcion de perdida ya esta incorporada en el grafo como nodo 'loss'
  const gradients = new Map<string, number>();
  gradients.set(this.outputNodeId, 1.0);
  // ...
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - Cambiar firma: backward() → backward()
  - Actualizar JSDoc
```

#### Tests asociados

Probado por `test-level7-compute.ts` (test "Backward: seed is always 1.0 (lossValue removed)")

#### Verificacion

- `npx tsx scripts/test-level7-compute.ts` — 61/61 pass
- backward() no requiere argumentos

---

### TICKET-011: buildMLP multi-logit para gradientes no-cero

**Tipo:** Bugfix/Feature | **Nivel:** L7 | **Severidad:** P0

#### Problema

`buildMLP` creaba un solo logit de salida. `cross_entropy` con una sola entrada
siempre produce loss=0 y gradientes=0. El backward pass era correcto pero no
probaba nada.

```
logit = 0.18
softmax([0.18]) = [1.0]
cross_entropy([1.0], [0]) = -ln(1.0) = 0.0
```

#### Solucion

Restructurar MLP para 2 logits:

```typescript
// logit0 = fc2 (salida de la red, clase 0)
// logit1 = parametro independiente (clase 1)
// loss = cross_entropy([logit0, logit1], target=0)

Edges:
  x, w1 → fc1
  fc1, b1 → h1
  h1 → r1
  r1, w2 → fc2
  fc2 → logit0
  logit0, logit1 → loss
```

Gradientes resultantes:
- w1: -0.140
- w2: -0.281
- logit0: -0.468
- logit1: +0.468

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - buildMLP(): agregar nodo logit1 como leaf
  - buildMLP(): agregar edge logit1 → loss
```

#### Tests asociados

Probado por `test-level7-compute.ts` (tests MLP forward/backward/gradients,
~20 tests especificos de MLP)

#### Verificacion

- `npx tsx scripts/test-level7-compute.ts` — 61/61 pass
- `forward()` devuelve loss = 0.6303 (no 0)
- `backward()` devuelve gradientes no-cero para todos los params
- w1.gradient ≈ -0.14, w2.gradient ≈ -0.28

---

### TICKET-012: Documentar forward() last-sink heuristic

**Tipo:** Documentation | **Nivel:** L7 | **Severidad:** P2

#### Problema

`forward()` encontraba el ultimo sink (nodo sin outgoing edges) y devolvia su
valor. Esto funcionaba para un solo output pero era fragil y no documentado.

#### Solucion

Agregar JSDoc en `forward()`:

```typescript
/**
 * Ejecuta forward pass completo.
 * La salida es el valor del ultimo nodo sink (sin outgoing edges) en orden
 * topologico. Esto es una heuristica que funciona para grafos con una sola
 * salida. Para grafos multi-salida, usar getNodeValue(nodeId).
 */
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - JSDoc en forward()
```

#### Verificacion

- Lectura del codigo: documentacion presente

---

### TICKET-013: Documentar computeOp('constant') como safety fallback

**Tipo:** Documentation | **Nivel:** L7 | **Severidad:** P2

#### Problema

`computeOp('constant')` era codigo muerto — `forward()` maneja nodos constantes
con early return antes de llegar a computeOp. Sin documentacion, parecia un bug.

#### Solucion

```typescript
case 'constant':
  // Safety fallback: forward() maneja constantes con early return
  // (inputEdges.length === 0 && node.value !== undefined).
  // Este handler existe por si algun camino alternativo llega aqui.
  return inputs[0];
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - Comentario en computeOp switch case 'constant'
```

#### Verificacion

- Lectura del codigo: comentario presente

---

### TICKET-014: Serializacion toJSON/fromJSON

**Tipo:** Feature | **Nivel:** L7 | **Severidad:** P0

#### Problema

`ComputationalGraph` no tenia serializacion. No se podia guardar ni restaurar
un grafo computacional.

#### Solucion

```typescript
interface ComputeGraphData {
  nodes: Array<{ id: string; op: string; value?: number }>;
  edges: Array<{ source: string; target: string }>;
}

// En ComputationalGraph:
toJSON(): ComputeGraphData {
  return {
    nodes: this.nodes.map(n => ({ id: n.id, op: n.op, value: n.value })),
    edges: this.edges.map(e => ({ source: e.source, target: e.target })),
  };
}

static fromJSON(data: ComputeGraphData): ComputationalGraph {
  const graph = new ComputationalGraph();
  for (const node of data.nodes) graph.addNode(node);
  for (const edge of data.edges) graph.addEdge(edge.source, edge.target);
  return graph;
}
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - Agregar toJSON() method
  - Agregar fromJSON() static method
```

#### Tests asociados

Probado por `test-level7-compute.ts` (tests "Serialization: toJSON preserves 11 nodes",
"Serialization: fromJSON restores 11 nodes",
"Serialization: restored graph produces same loss")

#### Verificacion

- `npx tsx scripts/test-level7-compute.ts` — 61/61 pass
- `graph.toJSON()` devuelve `{ nodes: [...], edges: [...] }`
- `ComputationalGraph.fromJSON(data).forward()` produce el mismo loss

---

### TICKET-BONUS: cross_entropy double-exponentiation bug

**Tipo:** Bugfix-CRITICAL | **Nivel:** L7 | **Severidad:** P0

#### Problema

`computeOp('cross_entropy')` aplicaba `Math.exp()` a valores YA exponenciados:

```typescript
// INCORRECTO: x ya es Math.exp(original - maxInput)
const sumExps = exps.reduce((s, x) => s + Math.exp(x - maxInput), 0);
// Resultado: sumExps computado como exp(exp(valor)) → probabilidades invertidas
```

Para inputs `[0.18, 0.05]`:
- Softmax correcto: `[0.532, 0.468]`
- Softmax con bug: `[0.234, 0.766]` — invertido

#### Solucion

Una linea de cambio:

```typescript
const sumExps = exps.reduce((s, x) => s + x, 0);
```

#### Archivos afectados

```
MODIFICADO: packages/graph/src/level7-compute.ts
  - Una linea: sumExps = exps.reduce((s, x) => s + x, 0) en lugar de
    sumExps = exps.reduce((s, x) => s + Math.exp(x - maxInput), 0)
```

#### Tests asociados

Probado por `test-level7-compute.ts` (tests MLP loss y gradients — sin el fix
los gradientes serian incorrectos)

#### Verificacion

- `npx tsx scripts/test-level7-compute.ts` — 61/61 pass
- Para inputs [0.18, 0.05], softmax produce [0.532, 0.468]
- cross_entropy loss = 0.6303 (no 1.455)
- `localGradient` NO estaba afectado (ya usaba suma correcta)

---

## Resumen de Tickets

| ID | Descripcion | Nivel | Tipo | Severidad | Archivos | Tests |
|----|-------------|-------|------|-----------|----------|-------|
| 001 | Queue re-fill O(n*m)→O(n+m) | L1 | Performance | P0 | level1-execution.ts | 22 (diamond) |
| 002 | Mutation API | L1 | Feature | P0 | level1-execution.ts | 22 (mutation) |
| 003 | Duplicate ID validation | L1 | Bugfix | P0 | level1-execution.ts | 1 (indirecto) |
| 004 | Last-write-wins doc | L1 | Documentation | P2 | level1-execution.ts | 0 |
| 005 | detectCycle adjacency | L3 | Performance | P0 | level3-dependency.ts | 3 (cycle) |
| 006 | computeDepth adjacency | L3 | Performance | P0 | level3-dependency.ts | 6 (depth) |
| 007 | subgraph adjacency | L3 | Performance | P0 | level3-dependency.ts | 4 (subgraph) |
| 008 | Mutation API | L3 | Feature | P0 | level3-dependency.ts | 25 (mutation) |
| 009 | JSDoc edge convention | L3 | Documentation | P2 | level3-dependency.ts | 0 |
| 010 | Remove dead param | L7 | Cleanup | P1 | level7-compute.ts | 1 |
| 011 | Multi-logit MLP | L7 | Bugfix/Feature | P0 | level7-compute.ts | ~20 (MLP) |
| 012 | forward() doc | L7 | Documentation | P2 | level7-compute.ts | 0 |
| 013 | constant doc | L7 | Documentation | P2 | level7-compute.ts | 0 |
| 014 | toJSON/fromJSON | L7 | Feature | P0 | level7-compute.ts | 3 (serialization) |
| BONUS | cross_entropy bug | L7 | Bugfix-CRITICAL | P0 | level7-compute.ts | todos los MLP |

### Por tipo

| Tipo | Cantidad |
|------|----------|
| Performance | 3 (001, 005, 006, 007) |
| Feature | 3 (002, 008, 014) |
| Bugfix | 2 (003, BONUS) |
| Cleanup | 1 (010) |
| Bugfix/Feature | 1 (011) |
| Documentation | 4 (004, 009, 012, 013) |

### Por nivel

| Nivel | Tickets |
|-------|---------|
| L1 Execution | 001, 002, 003, 004 |
| L3 Dependency | 005, 006, 007, 008, 009 |
| L7 Compute | 010, 011, 012, 013, 014, BONUS |

### Por severidad

| Severidad | Tickets | Descripcion |
|-----------|---------|-------------|
| P0 | 001-003, 005-008, 011, 014, BONUS | Performance critica, features faltantes, bug real |
| P1 | 010 | Cleanup de codigo muerto |
| P2 | 004, 009, 012, 013 | Documentacion faltante |
