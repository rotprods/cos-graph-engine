# SMB — Shared Memory Bus Integration

> El sistema nervioso central de COS. Conecta motores de grafos con memoria persistente y eventos.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                    Shared Memory Bus                      │
│  ┌────────────────────┐    ┌──────────────────────────┐  │
│  │    EventBus         │    │     MemoryManager         │  │
│  │  - publish/subscribe│    │  - store/retrieve/query   │  │
│  │  - history tracking │    │  - TTL/consolidation      │  │
│  │  - wildcard subs    │    │  - 12 memory layers       │  │
│  └────────────────────┘    └──────────────────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Graph Index (key → id)                  │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         ▲                    ▲
         │                    │
  ┌──────┴──────┐     ┌──────┴──────┐
  │ L7 Compute  │     │ L12 Memory  │
  │ Graph       │     │ Graph       │
  │ - forward   │     │ - recall    │
  │ - backward  │     │ - consolidate│
  │ - save/load │     │ - save/load │
  └─────────────┘     └─────────────┘
```

---

## Componentes

### SMB (core)

**Archivo:** `packages/graph/src/smb.ts`

La clase central que combina EventBus y MemoryManager:

```typescript
import { SMB } from '@cos/graph';

const smb = new SMB();

// Publicar eventos
await smb.publish({ type: 'compute:forward', source: 'L7', payload: { result: 42 } });

// Suscribirse
await smb.subscribe('compute:forward', (evt) => console.log(evt.payload));

// Persistir grafos
await smb.saveGraph('compute-graph:my-model', graphData);
const loaded = await smb.loadGraph('compute-graph:my-model');

// Listar grafos guardados
const graphs = await smb.listGraphs();
```

**Metodos:**

| Metodo | Descripcion | Retorno |
|--------|-------------|---------|
| `publish(event)` | Publica un evento en el bus | `EntityId` |
| `subscribe(type, handler)` | Se suscribe a eventos por tipo | `SubscriptionId` |
| `saveGraph(key, data, options?)` | Guarda estado de grafo en memoria | `EntityId` |
| `loadGraph(key)` | Carga estado de grafo desde memoria | `data \| null` |
| `listGraphs(key?)` | Lista snapshots guardados | `Array<{id, key, timestamp}>` |
| `getState()` | Metricas del bus | `SMBState` |
| `clear()` | Limpia indices de grafos | `void` |

### L7-SMB: SMBComputeGraph

**Archivo:** `packages/graph/src/level7-smb.ts`

Wrapper de ComputationalGraph con persistencia y eventos:

```typescript
import { SMB, SMBComputeGraph } from '@cos/graph';

const smb = new SMB();
const cg = new SMBComputeGraph(smb, 'my-model');
cg.buildMLP(784, 256, 2);

// Forward (publica compute:forward)
const loss = await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });

// Backward (publica compute:backward)
const grads = await cg.backward();

// Persistencia
await cg.save();           // Guarda en SMB
await cg.load();           // Recupera desde SMB
```

**Eventos publicados:**
- `compute:forward` — cuando se ejecuta forward pass
- `compute:backward` — cuando se ejecuta backward pass

### L12-SMB: SMBMemoryGraph

**Archivo:** `packages/graph/src/level12-smb.ts`

Wrapper de MemoryGraphEngine con persistencia y eventos:

```typescript
import { SMB, SMBMemoryGraph } from '@cos/graph';

const smb = new SMB();
const mg = new SMBMemoryGraph(smb, 'conversation');
mg.buildConversation();

// Las operaciones publican eventos automaticamente
const node = mg.accessNode(someId);
const related = mg.recall(someId, 2, 0.3);

// Persistencia
await mg.save();           // Guarda en SMB
await mg.load();           // Recupera desde SMB
```

**Eventos publicados:**
- `memory:addNode` — cuando se agrega un nodo
- `memory:addEdge` — cuando se agrega un edge
- `memory:accessNode` — cuando se accede a un nodo
- `memory:buildConversation` — cuando se construye el arbol

---

## Eventos SMB

Todos los eventos siguen la interfaz:

```typescript
interface SMBEvent {
  type: string;       // Tipo de evento: "compute:forward", "memory:addNode", etc.
  source: string;     // Origen: "L7", "L12", etc.
  payload: unknown;   // Datos del evento
  graphId?: string;   // ID del grafo asociado
  nodeId?: string;    // ID del nodo asociado
  timestamp?: string; // ISO timestamp
}
```

---

## Tests

**Archivo:** `scripts/test-smb-integration.ts`

28 tests divididos en 3 grupos:

1. **SMB Core** (6 tests) — publicacion, suscripcion, save/load, list, edge cases
2. **L7-SMB** (8 tests) — MLP, forward/backward con eventos, save/load, parametros
3. **L12-SMB** (14 tests) — conversacion, eventos, recall, forger, save/load, metricas

```bash
npx tsx scripts/test-smb-integration.ts
```

---

## Integracion en el Pipeline CI

Agregar al `.github/workflows/ci.yml`:

```yaml
test-smb:
  name: SMB Integration (28 tests)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 18 }
    - run: npm ci
    - name: Run SMB integration tests
      run: npx tsx scripts/test-smb-integration.ts
```

---

## AI Employee: Memory Manager

El Memory Manager esta disponible como AI Employee para gestionar la memoria de COS.

**Nombre:** COS Memory Manager
**Funcion:** Gestiona el ciclo de vida de la memoria: almacenamiento, recuperacion, consolidacion, y olvido.
**Capacidades:**
- Store/Retrieve/Query en 12 capas de memoria
- Consolidacion automatica de corto a largo plazo
- TTL y olvido basado en importancia
- Cross-linking entre entradas de memoria
- Integracion con el bus de eventos SMB

Ver `docs/SMB-INTEGRATION.md` para detalles de implementacion.