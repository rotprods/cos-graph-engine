export interface BenchmarkSample {
  durationMs: number;
  heapDeltaBytes: number | null;
}

export interface BenchmarkDistribution {
  samples: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  stddevMs: number;
  heapDeltaMedianBytes: number | null;
  gcAvailable: boolean;
}

export type BenchmarkObjective =
  | { kind: 'latency'; maxMedianMs: number; maxP95Ms?: number }
  | { kind: 'throughput'; minOpsPerSecond: number }
  | { kind: 'speedup'; minRatio: number; baselineMedianMs: number }
  | { kind: 'pruning'; minPruningRatio: number }
  | { kind: 'memory'; maxMedianHeapDeltaBytes: number };

export interface BenchmarkEvidence {
  seed: number;
  warmups: number;
  iterations: number;
  distribution: BenchmarkDistribution;
  objective: BenchmarkObjective;
  passed: boolean;
  reason: string;
}

/** Mulberry32: deterministic PRNG for reproducible synthetic graph fixtures. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new Error('Benchmark seed must be an integer');
    this.state = seed >>> 0;
  }

  next(): number {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('maxExclusive must be a positive integer');
    return Math.floor(this.next() * maxExclusive);
  }
}

export class ScientificBenchmark {
  static run<T>(
    fn: () => T,
    objective: BenchmarkObjective,
    options: { seed?: number; warmups?: number; iterations?: number; operationsPerRun?: number } = {},
  ): BenchmarkEvidence {
    const seed = options.seed ?? 42;
    const warmups = options.warmups ?? 5;
    const iterations = options.iterations ?? 30;
    const operationsPerRun = options.operationsPerRun ?? 1;

    if (!Number.isInteger(warmups) || warmups < 0) throw new Error('warmups must be a non-negative integer');
    if (!Number.isInteger(iterations) || iterations < 5) throw new Error('iterations must be an integer >= 5');
    if (!Number.isFinite(operationsPerRun) || operationsPerRun <= 0) throw new Error('operationsPerRun must be > 0');

    for (let i = 0; i < warmups; i += 1) fn();

    const gcAvailable = typeof global !== 'undefined' && typeof (global as { gc?: () => void }).gc === 'function';
    const samples: BenchmarkSample[] = [];

    for (let i = 0; i < iterations; i += 1) {
      if (gcAvailable) (global as { gc: () => void }).gc();
      const heapBefore = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : null;
      const started = performance.now();
      fn();
      const durationMs = performance.now() - started;
      const heapAfter = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : null;

      // Memory evidence is only considered valid when explicit GC is available.
      // We preserve signed deltas; clamping negatives to zero fabricates gains.
      const heapDeltaBytes = gcAvailable && heapBefore !== null && heapAfter !== null
        ? heapAfter - heapBefore
        : null;
      samples.push({ durationMs, heapDeltaBytes });
    }

    const distribution = this.summarize(samples, gcAvailable);
    const evaluation = this.evaluate(objective, distribution, operationsPerRun);
    return {
      seed,
      warmups,
      iterations,
      distribution,
      objective,
      passed: evaluation.passed,
      reason: evaluation.reason,
    };
  }

  static summarize(samples: BenchmarkSample[], gcAvailable: boolean): BenchmarkDistribution {
    if (samples.length === 0) throw new Error('Cannot summarize an empty benchmark sample set');
    const durations = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
    const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    const variance = durations.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / durations.length;
    const memory = samples
      .map(sample => sample.heapDeltaBytes)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    return {
      samples: samples.length,
      medianMs: this.percentile(durations, 0.5),
      p95Ms: this.percentile(durations, 0.95),
      minMs: durations[0],
      maxMs: durations[durations.length - 1],
      meanMs: mean,
      stddevMs: Math.sqrt(variance),
      heapDeltaMedianBytes: memory.length > 0 ? this.percentile(memory, 0.5) : null,
      gcAvailable,
    };
  }

  private static evaluate(
    objective: BenchmarkObjective,
    distribution: BenchmarkDistribution,
    operationsPerRun: number,
  ): { passed: boolean; reason: string } {
    switch (objective.kind) {
      case 'latency': {
        const medianPass = distribution.medianMs <= objective.maxMedianMs;
        const p95Pass = objective.maxP95Ms === undefined || distribution.p95Ms <= objective.maxP95Ms;
        return {
          passed: medianPass && p95Pass,
          reason: `median=${distribution.medianMs.toFixed(3)}ms p95=${distribution.p95Ms.toFixed(3)}ms`,
        };
      }
      case 'throughput': {
        const throughput = operationsPerRun / (distribution.medianMs / 1000);
        return { passed: throughput >= objective.minOpsPerSecond, reason: `throughput=${throughput.toFixed(2)} ops/s` };
      }
      case 'speedup': {
        const ratio = objective.baselineMedianMs / Math.max(Number.EPSILON, distribution.medianMs);
        return { passed: ratio >= objective.minRatio, reason: `speedup=${ratio.toFixed(3)}x` };
      }
      case 'pruning':
        // Pruning ratios are algorithm-domain outputs and must be supplied by a
        // graph-specific wrapper; timing samples alone cannot prove them.
        return { passed: false, reason: 'pruning objective requires graph-specific pruning evidence' };
      case 'memory': {
        if (!distribution.gcAvailable || distribution.heapDeltaMedianBytes === null) {
          return { passed: false, reason: 'memory objective invalid without explicit GC evidence' };
        }
        return {
          passed: distribution.heapDeltaMedianBytes <= objective.maxMedianHeapDeltaBytes,
          reason: `medianHeapDelta=${distribution.heapDeltaMedianBytes} bytes`,
        };
      }
    }
  }

  private static percentile(sorted: number[], q: number): number {
    if (sorted.length === 1) return sorted[0];
    const position = (sorted.length - 1) * q;
    const base = Math.floor(position);
    const rest = position - base;
    const next = sorted[base + 1];
    return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
  }
}
