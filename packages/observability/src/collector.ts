/**
 * Trace Collector — COS Graph Engine v2.1 Fase 3 T-3.2
 *
 * Collector centralizado que agrega sesiones de tracing de multiples
 * hops en un buffer circular con memoria acotada. Exporta a JSON.
 *
 * Zero dependencias externas.
 */

import { TraceSession, TraceHop, TraceSummary } from './tracing';

// ============================================================
// CircularBuffer — ring buffer de capacidad fija
// ============================================================

export class CircularBuffer<T> {
  private _buffer: (T | undefined)[];
  private _head = 0; // indice del elemento mas antiguo
  private _tail = 0; // indice del proximo slot libre
  private _count = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error('Capacity must be >= 1');
    this._buffer = new Array(capacity);
  }

  /** Push: sobreescribe el mas antiguo si esta lleno */
  push(item: T): void {
    this._buffer[this._tail] = item;
    this._tail = (this._tail + 1) % this._buffer.length;
    if (this._count === this._buffer.length) {
      // Buffer lleno: head avanza (pierde el mas antiguo)
      this._head = (this._head + 1) % this._buffer.length;
    } else {
      this._count++;
    }
  }

  /** Obtener todos los elementos en orden FIFO */
  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._count; i++) {
      const idx = (this._head + i) % this._buffer.length;
      const item = this._buffer[idx];
      if (item !== undefined) result.push(item);
    }
    return result;
  }

  /** Obtener los ultimos N elementos */
  getLast(n: number): T[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  /** Vaciar el buffer */
  clear(): void {
    this._buffer = new Array(this._buffer.length);
    this._head = 0;
    this._tail = 0;
    this._count = 0;
  }

  get size(): number { return this._count; }
  get capacity(): number { return this._buffer.length; }
  get isEmpty(): boolean { return this._count === 0; }
  get isFull(): boolean { return this._count === this._buffer.length; }
}

// ============================================================
// StoredTrace — formato serializable de una sesion de tracing
// ============================================================

export interface StoredTrace {
  sessionId: string;
  startTime: number;
  endTime: number;
  summary: TraceSummary;
  hops: TraceHop[];
}

// ============================================================
// TraceCollector — collector centralizado
// ============================================================

export interface TraceCollector {
  readonly capacity: number;
  readonly size: number;
  readonly isEmpty: boolean;

  /** Registrar una sesion completa de tracing */
  record(session: TraceSession): void;

  /** Registrar una sesion manualmente (datos ya calculados) */
  recordDirect(sessionId: string, startTime: number, endTime: number, summary: TraceSummary, hops: TraceHop[]): void;

  /** Obtener todas las trazas almacenadas */
  getAll(): StoredTrace[];

  /** Obtener las ultimas N trazas */
  getLast(n: number): StoredTrace[];

  /** Buscar trazas por id de sesion */
  findById(sessionId: string): StoredTrace | undefined;

  /** Filtrar trazas por operacion o metadata */
  filter(predicate: (trace: StoredTrace) => boolean): StoredTrace[];

  /** Exportar a JSON compacto */
  exportJSON(): string;

  /** Exportar a JSON pretty-printed */
  exportJSONPretty(): string;

  /** Exportar resumen agregado (sin hops individuales) */
  exportSummaryJSON(): string;

  /** Limpiar todas las trazas */
  clear(): void;
}

// ============================================================
// TraceCollectorImpl — implementacion concreta
// ============================================================

export class TraceCollectorImpl implements TraceCollector {
  private _buffer: CircularBuffer<StoredTrace>;
  private _sessionStartTimes: Map<string, number> = new Map();

  constructor(capacity = 1000) {
    this._buffer = new CircularBuffer<StoredTrace>(capacity);
  }

  get capacity(): number { return this._buffer.capacity; }
  get size(): number { return this._buffer.size; }
  get isEmpty(): boolean { return this._buffer.isEmpty; }

  record(session: TraceSession): void {
    const summary = session.getSummary();
    const hops = [...session.hops];
    const startTime = this._sessionStartTimes.get(session.id) ?? (Date.now() - summary.durationMs);
    this._sessionStartTimes.delete(session.id);

    this._buffer.push({
      sessionId: session.id,
      startTime,
      endTime: Date.now(),
      summary,
      hops,
    });
  }

  recordDirect(
    sessionId: string,
    startTime: number,
    endTime: number,
    summary: TraceSummary,
    hops: TraceHop[]
  ): void {
    this._buffer.push({ sessionId, startTime, endTime, summary, hops });
  }

  getAll(): StoredTrace[] {
    return this._buffer.getAll();
  }

  getLast(n: number): StoredTrace[] {
    return this._buffer.getLast(n);
  }

  findById(sessionId: string): StoredTrace | undefined {
    return this._buffer.getAll().find(t => t.sessionId === sessionId);
  }

  filter(predicate: (trace: StoredTrace) => boolean): StoredTrace[] {
    return this._buffer.getAll().filter(predicate);
  }

  exportJSON(): string {
    return JSON.stringify(this._buffer.getAll());
  }

  exportJSONPretty(): string {
    return JSON.stringify(this._buffer.getAll(), null, 2);
  }

  exportSummaryJSON(): string {
    const summaries = this._buffer.getAll().map(t => ({
      sessionId: t.sessionId,
      startTime: t.startTime,
      endTime: t.endTime,
      summary: t.summary,
    }));
    return JSON.stringify(summaries, null, 2);
  }

  clear(): void {
    this._buffer.clear();
    this._sessionStartTimes.clear();
  }

  /** Marcar el inicio de una sesion para trackear startTime */
  markStart(sessionId: string): void {
    this._sessionStartTimes.set(sessionId, Date.now());
  }
}

// ============================================================
// NoopTraceCollector — singleton zero-overhead
// ============================================================

const NOOP_COLLECTOR_STORED: StoredTrace[] = [];

export class NoopTraceCollector implements TraceCollector {
  static readonly instance: NoopTraceCollector = new NoopTraceCollector();

  readonly capacity = 0;
  readonly size = 0;
  readonly isEmpty = true;

  private constructor() {}

  record(_session: TraceSession): void { /* no-op */ }
  recordDirect(_sessionId: string, _startTime: number, _endTime: number, _summary: TraceSummary, _hops: TraceHop[]): void { /* no-op */ }

  getAll(): StoredTrace[] { return NOOP_COLLECTOR_STORED; }
  getLast(_n: number): StoredTrace[] { return NOOP_COLLECTOR_STORED; }
  findById(_sessionId: string): StoredTrace | undefined { return undefined; }
  filter(_predicate: (trace: StoredTrace) => boolean): StoredTrace[] { return NOOP_COLLECTOR_STORED; }

  exportJSON(): string { return '[]'; }
  exportJSONPretty(): string { return '[]'; }
  exportSummaryJSON(): string { return '[]'; }
  clear(): void { /* no-op */ }
}

// ============================================================
// Utility: merge multiple collectors into one JSON export
// ============================================================

export function mergeCollectorsExport(collectors: TraceCollector[]): string {
  const all: StoredTrace[] = [];
  for (const c of collectors) {
    all.push(...c.getAll());
  }
  all.sort((a, b) => a.startTime - b.startTime);
  return JSON.stringify(all, null, 2);
}