# COS API Reference

## COSServer

The central entry point for the Cognitive Operating System.

### Methods

| Method | Description |
|--------|-------------|
| `process(request)` | Submit a cognitive request for processing |
| `getHealth()` | Get system and cell health status |
| `getStats()` | Get comprehensive system statistics |
| `start()` | Start all subsystems and scheduler |
| `shutdown()` | Graceful shutdown of all subsystems |

### Request Format

```typescript
{
  input: unknown;           // The input data to process
  target?: EntityId;        // Specific cell to route to
  reasoning?: string;       // Reasoning engine type to use
  context?: CellContext;    // Execution context
}
```

## Subsystems

| Subsystem | Description |
|-----------|-------------|
| `cellHost` | CogCell runtime, EventBus, scheduler |
| `memory` | 12-layer memory manager |
| `knowledge` | Knowledge graph with property graph backend |
| `embeddings` | Vector embedding storage and similarity search |
| `ontology` | Ontology definition and validation |
| `reasoning` | Plugable reasoning engine registry |
| `planning` | Plan creation and execution |
| `evaluation` | Output quality evaluation |
| `learning` | Example recording and pattern extraction |
| `tools` | Tool registry with pluggable tools |
| `agents` | Agent definition and execution |
| `workflows` | Workflow definition and execution |
| `policies` | Policy evaluation engine |
| `telemetry` | Event and metric recording |

## Configuration

Environment variables:
- `COS_HOST` — API host (default: localhost)
- `COS_PORT` — API port (default: 8080)
- `COS_MAX_MEMORY` — Max memory in MB (default: 1024)
- `COS_LOG_LEVEL` — Log level (default: info)
- `COS_PLUGINS` — Comma-separated plugin list