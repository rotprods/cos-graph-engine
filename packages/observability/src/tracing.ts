/**
 * Per-Hop Tracing — COS Graph Engine v2.1 Fase 3
 *
 * TraceSession recolecta hops individuales durante BFS/DFS/shortestPath.
 * NoopTraceSession es un singleton zero-overhead para produccion.
 *
 * Zero dependencias externas.
 */

import { generateId } from '@cos/core';

// ============================================================
// TraceHop
// ============================================================

export interface TraceHop {
  hopIndex: number;
  nodeId: string;
  depth: number;
  duration: number;
  source: 'forward' | 'backward' | 'pruned';
  metadata?: Record<string, unknown>;
}

// ============================================================
// TraceSummary
// ============================================================

export interface TraceSummary {
  totalHops: number;
  prunedHops: number;
  bidirectional: boolean;
  durationMs: number;
  hopsByDepth: Record<number, number>;
  hopsBySource: Record<string, number>;
}

// ============================================================
// TraceSession interface
// ============================================================

export interface TraceSession {
  readonly id: string;
  readonly hops: readonly TraceHop[];
  addHop(hop: Omit<TraceHop, 'timestamp'>): void;
  getSummary(): TraceSummary;
  reset(): void;
}

// ============================================================
// TraceSessionImpl — concrete implementation
// ============================================================

export class TraceSessionImpl implements TraceSession {
  readonly id: string;
  private _hops: TraceHop[] = [];
  private _startTime: number;
  private _bidirectional = false;

  constructor(bidirectional = false) {
    this.id = generateId();
    this._startTime = performance.now();
    this._bidirectional = bidirectional;
  }

  get hops(): readonly TraceHop[] {
    return this._hops;
  }

  addHop(hop: Omit<TraceHop, 'timestamp'>): void {
    this._hops.push({
      ...hop,
      timestamp: performance.now(),
    });
  }

  getSummary(): TraceSummary {
    const durationMs = performance.now() - this._startTime;
    const hopsByDepth: Record<number, number> = {};
    const hopsBySource: Record<string, number> = { forward: 0, backward: 0, pruned: 0 };
    let prunedHops = 0;

    for (const hop of this._hops) {
      hopsByDepth[hop.depth] = (hopsByDepth[hop.depth] || 0) + 1;
      hopsBySource[hop.source] = (hopsBySource[hop.source] || 0) + 1;
      if (hop.source === 'pruned') prunedHops++;
    }

    return {
      totalHops: this._hops.length,
      prunedHops,
      bidirectional: this._bidirectional,
      durationMs,
      hopsByDepth,
      hopsBySource,
    };
  }

  reset(): void {
    this._hops = [];
    this._startTime = performance.now();
  }
}

// ============================================================
// NoopTraceSession — singleton zero-overhead
// ============================================================

const NOOP_SUMMARY: TraceSummary = {
  totalHops: 0,
  prunedHops: 0,
  bidirectional: false,
  durationMs: 0,
  hopsByDepth: {},
  hopsBySource: {},
};

export class NoopTraceSession implements TraceSession {
  static readonly instance: NoopTraceSession = new NoopTraceSession();

  readonly id = 'noop';
  readonly hops: readonly TraceHop[] = [];

  private constructor() {}

  addHop(_hop: Omit<TraceHop, 'timestamp'>): void {
    // no-op — zero allocation
  }

  getSummary(): TraceSummary {
    return NOOP_SUMMARY;
  }

  reset(): void {
    // no-op
  }
}

// ============================================================
// Utility: format a TraceSession as a readable table
// ============================================================

export function formatTraceSummary(summary: TraceSummary): string {
  const lines: string[] = [];
  lines.push(`Trace Summary:`);
  lines.push(`  Total hops: ${summary.totalHops}`);
  lines.push(`  Pruned hops: ${summary.prunedHops}`);
  lines.push(`  Bidirectional: ${summary.bidirectional}`);
  lines.push(`  Duration: ${summary.durationMs.toFixed(2)}ms`);
  lines.push(`  Hops by depth: ${JSON.stringify(summary.hopsByDepth)}`);
  lines.push(`  Hops by source: ${JSON.stringify(summary.hopsBySource)}`);
  return lines.join('\n');
}