/**
 * Profiler — COS Graph Engine v2.1 Fase 3 T-3.2b
 *
 * Profiler de operaciones con exportacion Prometheus.
 * Zero dependencias externas.
 */

// ============================================================
// ProfileSample
// ============================================================

export interface ProfileSample {
  label: string;
  elapsed: number;
  timestamp: number;
  memoryDelta: number;
  metadata?: Record<string, unknown>;
}

// ============================================================
// ProfilerSummary
// ============================================================

export interface ProfilerSummary {
  label: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  totalMemoryDelta: number;
}

// ============================================================
// Profiler — concrete implementation
// ============================================================

export class Profiler {
  private _samples: ProfileSample[] = [];
  private _startTimes: Map<string, number> = new Map();
  private _startMemory: Map<string, number> = new Map();

  /** Iniciar medicion para una operacion */
  start(label: string): void {
    this._startTimes.set(label, performance.now());
    this._startMemory.set(label, this._getMemory());
  }

  /** Tomar snapshot de una operacion */
  snapshot(label: string, metadata?: Record<string, unknown>): ProfileSample {
    const now = performance.now();
    const startTime = this._startTimes.get(label);
    const startMem = this._startMemory.get(label);
    const elapsed = startTime !== undefined ? now - startTime : 0;
    const memDelta = startMem !== undefined ? this._getMemory() - startMem : 0;

    const sample: ProfileSample = {
      label,
      elapsed,
      timestamp: now,
      memoryDelta: Math.max(0, memDelta),
      metadata,
    };
    this._samples.push(sample);
    return sample;
  }

  /** Obtener resumen agregado por label */
  summary(): ProfilerSummary[] {
    const grouped = new Map<string, ProfileSample[]>();
    for (const s of this._samples) {
      const arr = grouped.get(s.label) || [];
      arr.push(s);
      grouped.set(s.label, arr);
    }

    const result: ProfilerSummary[] = [];
    for (const [label, samples] of grouped) {
      let totalTime = 0;
      let totalMem = 0;
      let minTime = Infinity;
      let maxTime = -Infinity;
      for (const s of samples) {
        totalTime += s.elapsed;
        totalMem += s.memoryDelta;
        if (s.elapsed < minTime) minTime = s.elapsed;
        if (s.elapsed > maxTime) maxTime = s.elapsed;
      }
      result.push({
        label,
        count: samples.length,
        totalTime,
        avgTime: totalTime / samples.length,
        minTime: minTime === Infinity ? 0 : minTime,
        maxTime: maxTime === -Infinity ? 0 : maxTime,
        totalMemoryDelta: totalMem,
      });
    }
    result.sort((a, b) => b.totalTime - a.totalTime);
    return result;
  }

  /** Exportar metricas en formato Prometheus */
  exportPrometheus(): string {
    const lines: string[] = [];
    const summaries = this.summary();

    // Metadata del engine
    lines.push('# HELP cos_graph_profiler_samples_total Total profiling samples collected');
    lines.push('# TYPE cos_graph_profiler_samples_total counter');
    lines.push(`cos_graph_profiler_samples_total ${this._samples.length}`);

    lines.push('# HELP cos_graph_profiler_operation_labels Unique operation labels');
    lines.push('# TYPE cos_graph_profiler_operation_labels gauge');
    lines.push(`cos_graph_profiler_operation_labels ${summaries.length}`);

    // Por operacion
    for (const s of summaries) {
      const label = s.label.replace(/[^a-zA-Z0-9_]/g, '_');

      lines.push(`# HELP cos_graph_${label}_count Total executions of ${s.label}`);
      lines.push('# TYPE cos_graph_${label}_count counter');
      lines.push(`cos_graph_${label}_count{operation="${s.label}"} ${s.count}`);

      lines.push(`# HELP cos_graph_${label}_duration_ms Total duration of ${s.label}`);
      lines.push('# TYPE cos_graph_${label}_duration_ms histogram');
      lines.push(`cos_graph_${label}_duration_ms_sum{operation="${s.label}"} ${s.totalTime.toFixed(3)}`);
      lines.push(`cos_graph_${label}_duration_ms_count{operation="${s.label}"} ${s.count}`);

      lines.push(`# HELP cos_graph_${label}_avg_ms Average duration of ${s.label}`);
      lines.push('# TYPE cos_graph_${label}_avg_ms gauge');
      lines.push(`cos_graph_${label}_avg_ms{operation="${s.label}"} ${s.avgTime.toFixed(3)}`);

      if (s.minTime < Infinity) {
        lines.push(`# HELP cos_graph_${label}_min_ms Minimum duration of ${s.label}`);
        lines.push('# TYPE cos_graph_${label}_min_ms gauge');
        lines.push(`cos_graph_${label}_min_ms{operation="${s.label}"} ${s.minTime.toFixed(3)}`);
      }

      if (s.maxTime > 0) {
        lines.push(`# HELP cos_graph_${label}_max_ms Maximum duration of ${s.label}`);
        lines.push('# TYPE cos_graph_${label}_max_ms gauge');
        lines.push(`cos_graph_${label}_max_ms{operation="${s.label}"} ${s.maxTime.toFixed(3)}`);
      }

      if (s.totalMemoryDelta > 0) {
        lines.push(`# HELP cos_graph_${label}_memory_bytes Memory delta of ${s.label}`);
        lines.push('# TYPE cos_graph_${label}_memory_bytes gauge');
        lines.push(`cos_graph_${label}_memory_bytes{operation="${s.label}"} ${s.totalMemoryDelta}`);
      }
    }

    // Raw samples
    for (const sample of this._samples) {
      const label = sample.label.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`cos_graph_sample_duration_ms{operation="${sample.label}"} ${sample.elapsed.toFixed(3)}`);
    }

    return lines.join('\n') + '\n';
  }

  /** Resetear todas las muestras */
  reset(): void {
    this._samples = [];
    this._startTimes.clear();
    this._startMemory.clear();
  }

  get sampleCount(): number {
    return this._samples.length;
  }

  get samples(): readonly ProfileSample[] {
    return this._samples;
  }

  private _getMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}

// ============================================================
// NoopProfiler — singleton zero-overhead
// ============================================================

const NOOP_SUMMARIES: ProfilerSummary[] = [];

export class NoopProfiler {
  static readonly instance: NoopProfiler = new NoopProfiler();

  readonly sampleCount = 0;
  readonly samples: readonly ProfileSample[] = [];

  private constructor() {}

  start(_label: string): void { /* no-op */ }
  snapshot(_label: string, _metadata?: Record<string, unknown>): ProfileSample {
    return { label: '', elapsed: 0, timestamp: 0, memoryDelta: 0 };
  }
  summary(): ProfilerSummary[] { return NOOP_SUMMARIES; }
  exportPrometheus(): string { return ''; }
  reset(): void { /* no-op */ }
}

// ============================================================
// ProfilingHook — interface para integracion en CSRGraph
// ============================================================

export interface ProfilingHook {
  onStart(source: string, operation: string): void;
  onNodeVisit(nodeId: string, depth: number, elapsed: number): void;
  onComplete(operation: string, duration: number, nodesVisited: number): void;
}

// ============================================================
// ProfilingHookImpl — concrete implementation
// ============================================================

export class ProfilingHookImpl implements ProfilingHook {
  private _profiler: Profiler;
  private _startTime = 0;
  private _nodeCount = 0;

  constructor(profiler?: Profiler) {
    this._profiler = profiler ?? new Profiler();
  }

  onStart(source: string, operation: string): void {
    this._startTime = performance.now();
    this._nodeCount = 0;
    this._profiler.start(`${operation}(${source})`);
  }

  onNodeVisit(_nodeId: string, _depth: number, _elapsed: number): void {
    this._nodeCount++;
  }

  onComplete(operation: string, duration: number, nodesVisited: number): void {
    this._profiler.snapshot(`${operation}(${this._nodeCount}n)`, {
      nodesVisited: nodesVisited || this._nodeCount,
      duration,
    });
  }

  get profiler(): Profiler { return this._profiler; }
}

// ============================================================
// NoopProfilingHook — singleton zero-overhead
// ============================================================

export class NoopProfilingHook implements ProfilingHook {
  static readonly instance: NoopProfilingHook = new NoopProfilingHook();

  private constructor() {}

  onStart(_source: string, _operation: string): void { /* no-op */ }
  onNodeVisit(_nodeId: string, _depth: number, _elapsed: number): void { /* no-op */ }
  onComplete(_operation: string, _duration: number, _nodesVisited: number): void { /* no-op */ }
}