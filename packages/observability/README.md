# @cos/observability — COS Observability Layer

Tracing, collector, profiler, and telemetry dashboard for graph operations.

## Features

- **TraceSession** — Per-hop tracing for BFS/DFS traversals
- **TraceCollector** — CircularBuffer storage with JSON/CSV export
- **Profiler** — Prometheus metrics export, ProfilingHook integration
- **TelemetryDashboard** — Built-in HTTP server (8 routes: /api/traces, /metrics, /status, /export/*)
- **OTLPExporter** — OpenTelemetry-compatible export
- **Zero Dependencies** — Pure Node.js http module

## Install

```bash
npm install @cos/observability
```

## Quick Start

```typescript
import { TelemetryDashboard } from '@cos/observability';

const dashboard = new TelemetryDashboard({ port: 9090 });
dashboard.start();
// GET http://localhost:9090/api/status
```

## License

MIT