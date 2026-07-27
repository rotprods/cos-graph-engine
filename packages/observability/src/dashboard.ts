/**
 * Telemetry Dashboard — COS Graph Engine v2.1 Fase 3 T-3.3
 *
 * Dashboard HTTP + Export JSON/CSV + OTLP Exporter.
 * Zero dependencias externas (Node http module).
 */

import { TraceCollector, StoredTrace } from './collector';
import { Profiler, ProfilerSummary } from './profiler';
import { TelemetrySystem } from './telemetry';

// ============================================================
// ExportService — JSON/CSV export
// ============================================================

export class ExportService {
  constructor(private _collector: TraceCollector) {}

  /** Exportar todas las trazas como JSON */
  exportJSON(): string {
    return this._collector.exportJSONPretty();
  }

  /** Exportar trazas como CSV */
  exportCSV(): string {
    const traces = this._collector.getAll();
    if (traces.length === 0) return '';

    const header = 'sessionId,startTime,endTime,totalHops,prunedHops,bidirectional,durationMs\n';
    const rows = traces.map(t =>
      `${t.sessionId},${t.startTime},${t.endTime},${t.summary.totalHops},${t.summary.prunedHops},${t.summary.bidirectional},${t.summary.durationMs.toFixed(3)}`
    );
    return header + rows.join('\n') + '\n';
  }

  /** Exportar hops como CSV */
  exportHopsCSV(): string {
    const traces = this._collector.getAll();
    if (traces.length === 0) return '';

    const header = 'sessionId,hopIndex,nodeId,depth,duration,source\n';
    const rows: string[] = [];
    for (const t of traces) {
      for (let i = 0; i < t.hops.length; i++) {
        const h = t.hops[i];
        rows.push(`${t.sessionId},${i},${h.nodeId},${h.depth},${h.duration.toFixed(3)},${h.source}`);
      }
    }
    return header + rows.join('\n') + '\n';
  }
}

// ============================================================
// OTLPExporter — exportacion OpenTelemetry via HTTP JSON
// ============================================================

export interface OTLPConfig {
  endpoint: string;
  headers?: Record<string, string>;
  exportIntervalMs?: number;
}

export class OTLPExporter {
  private _config: OTLPConfig;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _running = false;

  constructor(config: OTLPConfig) {
    this._config = {
      exportIntervalMs: 10000,
      ...config,
    };
  }

  get running(): boolean { return this._running; }

  /** Iniciar export periodico */
  start(collector: TraceCollector): void {
    if (this._running) return;
    this._running = true;
    this._intervalId = setInterval(() => {
      this.flush(collector).catch(() => {});
    }, this._config.exportIntervalMs);
  }

  /** Detener export periodico */
  stop(): void {
    this._running = false;
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Exportar todas las trazas ahora */
  async flush(collector: TraceCollector): Promise<boolean> {
    if (!this._running) return false;
    try {
      const traces = collector.getAll();
      if (traces.length === 0) return true;

      const body = JSON.stringify(this._toOTLPFormat(traces));
      const { fetch } = await import('node:http');
      // Use https if endpoint starts with https
      const mod = this._config.endpoint.startsWith('https') ? await import('node:https') : await import('node:http');

      return new Promise((resolve) => {
        const url = new URL(this._config.endpoint);
        const req = mod.request(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this._config.headers,
            },
          },
          (res: any) => {
            resolve(res.statusCode === 200 || res.statusCode === 202);
          }
        );
        req.on('error', () => resolve(false));
        req.write(body);
        req.end();
      });
    } catch {
      return false;
    }
  }

  private _toOTLPFormat(traces: StoredTrace[]): Record<string, unknown> {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'cos-graph-engine' } }],
          },
          scopeSpans: traces.map(t => ({
            scope: { name: 'cos.graph.traversal' },
            spans: [
              {
                traceId: t.sessionId.replace(/-/g, '').padEnd(32, '0').slice(0, 32),
                spanId: t.sessionId.replace(/-/g, '').slice(0, 16),
                name: `traversal_${t.summary.bidirectional ? 'bidirectional' : 'forward'}`,
                startTimeUnixNano: (t.startTime * 1e6).toString(),
                endTimeUnixNano: (t.endTime * 1e6).toString(),
                attributes: [
                  { key: 'total.hops', value: { intValue: t.summary.totalHops } },
                  { key: 'pruned.hops', value: { intValue: t.summary.prunedHops } },
                  { key: 'duration.ms', value: { doubleValue: t.summary.durationMs } },
                ],
              },
            ],
          })),
        },
      ],
    };
  }
}

// ============================================================
// TelemetryDashboard — HTTP server para monitoreo
// ============================================================

export interface DashboardOptions {
  port: number;
  collector: TraceCollector;
  profiler?: Profiler;
  telemetry?: TelemetrySystem;
}

export class TelemetryDashboard {
  private _server: any = null;
  private _options: DashboardOptions;
  private _exportService: ExportService;

  constructor(options: DashboardOptions) {
    this._options = options;
    this._exportService = new ExportService(options.collector);
  }

  /** Iniciar servidor HTTP */
  async start(): Promise<void> {
    const http = await import('node:http');
    const { collector, profiler, telemetry } = this._options;

    this._server = http.createServer((req: any, res: any) => {
      const url = req.url || '/';
      const method = req.method || 'GET';

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Route handling
      if (url === '/' || url === '/dashboard') {
        this._serveHTML(res);
      } else if (url === '/api/traces') {
        this._serveJSON(res, collector.exportJSONPretty());
      } else if (url === '/api/summary') {
        this._serveJSON(res, collector.exportSummaryJSON());
      } else if (url === '/api/metrics' && profiler) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.writeHead(200);
        res.end(profiler.exportPrometheus());
      } else if (url === '/api/status') {
        const all = collector.getAll();
        const status = {
          sessions: collector.size,
          capacity: collector.capacity,
          totalHops: all.reduce((s, t) => s + t.summary.totalHops, 0),
          totalPruned: all.reduce((s, t) => s + t.summary.prunedHops, 0),
          avgDurationMs: all.length > 0
            ? all.reduce((s, t) => s + t.summary.durationMs, 0) / all.length
            : 0,
          telemetry: telemetry ? { events: telemetry.eventCount, metrics: telemetry.metricCount } : null,
        };
        this._serveJSON(res, JSON.stringify(status, null, 2));
      } else if (url === '/export/json') {
        this._serveDownload(res, this._exportService.exportJSON(), 'traces.json', 'application/json');
      } else if (url === '/export/csv') {
        this._serveDownload(res, this._exportService.exportCSV(), 'traces.csv', 'text/csv');
      } else if (url === '/export/hops.csv') {
        this._serveDownload(res, this._exportService.exportHopsCSV(), 'hops.csv', 'text/csv');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    return new Promise((resolve) => {
      this._server.listen(this._options.port, () => {
        const addr = this._server.address();
        this._options.port = addr && typeof addr === 'object' ? addr.port : this._options.port;
        resolve();
      });
    });
  }

  /** Detener servidor */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  get port(): number { return this._options.port; }

  private _serveHTML(res: any): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>COS Graph Engine — Telemetry Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0d1117; color: #c9d1d9; padding: 2rem; }
    h1 { color: #58a6ff; font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { color: #8b949e; font-size: 1rem; margin: 1.5rem 0 0.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; }
    .card .value { font-size: 2rem; font-weight: 600; color: #58a6ff; }
    .card .label { font-size: 0.8rem; color: #8b949e; margin-top: 0.25rem; }
    .card .value.pruned { color: #f0883e; }
    .card .value.duration { color: #7ee787; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .links { display: flex; gap: 1rem; flex-wrap: wrap; }
    .links a { background: #21262d; border: 1px solid #30363d; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; }
    .links a:hover { background: #30363d; }
    pre { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.8rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>COS Graph Engine</h1>
  <p style="color: #8b949e; margin-bottom: 1.5rem;">Telemetry Dashboard — v2.1</p>

  <div class="stats" id="stats">
    <div class="card"><div class="value" id="sessions">0</div><div class="label">Trace Sessions</div></div>
    <div class="card"><div class="value" id="hops">0</div><div class="label">Total Hops</div></div>
    <div class="card"><div class="value pruned" id="pruned">0</div><div class="label">Pruned Hops</div></div>
    <div class="card"><div class="value duration" id="avgDuration">0ms</div><div class="label">Avg Duration</div></div>
  </div>

  <h2>Exports</h2>
  <div class="links">
    <a href="/api/traces" target="_blank">API: Traces JSON</a>
    <a href="/api/summary" target="_blank">API: Summary JSON</a>
    <a href="/api/metrics" target="_blank">API: Prometheus Metrics</a>
    <a href="/api/status" target="_blank">API: Status JSON</a>
    <a href="/export/json" download>Download: traces.json</a>
    <a href="/export/csv" download>Download: traces.csv</a>
    <a href="/export/hops.csv" download>Download: hops.csv</a>
  </div>

  <div id="raw" style="display:none;">
    <h2>Raw Data</h2>
    <pre id="rawContent"></pre>
  </div>

  <script>
    async function refresh() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('sessions').textContent = data.sessions;
        document.getElementById('hops').textContent = data.totalHops;
        document.getElementById('pruned').textContent = data.totalPruned;
        document.getElementById('avgDuration').textContent = data.avgDurationMs.toFixed(2) + 'ms';
      } catch (e) { /* ignore */ }
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(html);
  }

  private _serveJSON(res: any, data: string): void {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(data);
  }

  private _serveDownload(res: any, data: string, filename: string, mime: string): void {
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.writeHead(200);
    res.end(data);
  }
}