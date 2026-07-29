# @cos/observability

Observability layer for COS Graph Engine: tracing, profiling, and telemetry dashboard.

## Instalacion

```bash
npm install @cos/observability
```

## Componentes

### Tracing
- `TraceSession` — Per-hop tracing with start/end/annotate
- `NoopTraceSession` — Zero-cost no-op implementation
- `TraceHop` — Individual hop data structure
- `TraceCollector` — CircularBuffer-based collector with JSON export
- `Tracing` — Orchestrator with configurable sampling

### Profiling
- `Profiler` — CPU, memory, GC profiling
- `PrometheusExporter` — Metrics export in Prometheus format
- `CSRProfiler` — CSR-specific performance metrics

### Telemetry Dashboard
- HTTP server with 8 routes
- OTLP-compatible export
- Zero external dependencies

## Uso

```typescript
import { TraceSession, TraceCollector } from "@cos/observability";

const session = new TraceSession();
session.start("bfs-traversal");
// ... graph operations
session.end();
const collector = new TraceCollector();
collector.collect(session);
console.log(collector.exportJSON());
```