import {
  CogCellDefinition, CogCellState, CellLifecycle, CellContext, CellOutput,
  CellInspection, Health, HealthStatus, Cost, Latency, CogError,
  ICogCell, MemoryEntry, CogEvent, GraphEdge, EntityId, Timestamp, SubscriptionId,
} from './types';
import { generateId, generateTraceId, generateSpanId, CellError } from './errors';

// Base class for all CogCells — the fundamental unit of cognitive computation
export abstract class BaseCell implements ICogCell {
  public readonly definition: CogCellDefinition;
  public readonly state: CogCellState;

  protected eventSubscriptions: SubscriptionId[] = [];
  protected memoryEntries: Map<string, MemoryEntry> = new Map();
  protected errorLog: CogError[] = [];
  protected eventLog: CogEvent[] = [];

  constructor(def: CogCellDefinition) {
    if (!def || !def.id || !def.name) {
      throw new CellError('INVALID_DEFINITION', 'CogCellDefinition requires id, name, and purpose');
    }
    this.definition = def;
    this.state = {
      id: def.id,
      lifecycle: 'created',
      startedAt: null,
      lastActivity: null,
      health: { status: 'unknown', lastCheck: new Date().toISOString() },
      cost: { units: 'credits', amount: 0 },
      latency: { p50: 0, p95: 0, p99: 0, mean: 0 },
      metrics: {},
      currentInputs: [],
      currentOutputs: [],
      errors: [],
    };
  }

  // ---- Lifecycle ----
  async init(): Promise<void> {
    this.state.lifecycle = 'initializing';
    this.state.health = { status: 'healthy', lastCheck: new Date().toISOString(), message: 'Initializing' };
    await this.onInit();
    this.state.lifecycle = 'ready';
  }

  async start(): Promise<void> {
    if (this.state.lifecycle !== 'ready') {
      throw new CellError('INVALID_STATE', `Cannot start cell in state: ${this.state.lifecycle}`);
    }
    this.state.lifecycle = 'running';
    this.state.startedAt = new Date().toISOString();
    this.state.health = { status: 'healthy', lastCheck: new Date().toISOString(), message: 'Running' };
    await this.onStart();
  }

  async pause(): Promise<void> {
    await this.onPause();
    this.state.lifecycle = 'paused';
  }

  async resume(): Promise<void> {
    await this.onResume();
    this.state.lifecycle = 'running';
  }

  async shutdown(): Promise<void> {
    this.state.lifecycle = 'shutting_down';
    await this.onShutdown();
    this.state.lifecycle = 'terminated';
    this.state.health = { status: 'unknown', lastCheck: new Date().toISOString(), message: 'Terminated' };
  }

  // ---- Processing ----
  async process(input: unknown, context?: CellContext): Promise<CellOutput> {
    const traceId = context?.traceId || generateTraceId();
    const spanId = generateSpanId();
    const startTime = Date.now();

    this.state.currentInputs = [input];
    this.state.lastActivity = new Date().toISOString();

    try {
      const output = await this.onProcess(input, { ...context, traceId, parentSpanId: context?.parentSpanId || spanId });

      const latency = Date.now() - startTime;
      this.state.latency.mean = (this.state.latency.mean * 0.9) + (latency * 0.1);
      this.state.currentOutputs = [output.result];

      const cellOutput: CellOutput = {
        id: generateId(),
        result: output.result,
        representations: output.representations || {},
        cost: this.state.cost,
        latency,
        confidence: output.confidence || 1.0,
        memoryUpdates: output.memoryUpdates || [],
        events: output.events || [],
        errors: output.errors || [],
        metadata: { ...output.metadata, traceId, spanId },
      };

      this.state.cost.amount += cellOutput.cost.amount;
      this.state.metrics = {
        ...this.state.metrics,
        totalProcessed: (this.state.metrics.totalProcessed || 0) + 1,
        totalLatency: (this.state.metrics.totalLatency || 0) + latency,
      };

      return cellOutput;
    } catch (error) {
      const latency = Date.now() - startTime;
      const cellError = error instanceof CellError
        ? error.toJSON()
        : { id: generateId(), code: 'UNKNOWN_ERROR', message: (error as Error).message, severity: 'error' as const, timestamp: new Date().toISOString() };

      this.errorLog.push(cellError);
      this.state.errors.push(cellError);
      this.state.health = { status: 'degraded', lastCheck: new Date().toISOString(), message: cellError.message };

      return {
        id: generateId(),
        result: null,
        representations: {},
        cost: this.state.cost,
        latency,
        confidence: 0,
        memoryUpdates: [],
        events: [],
        errors: [cellError],
        metadata: { traceId, spanId, error: true },
      };
    }
  }

  // ---- Observability ----
  async getHealth(): Promise<Health> {
    return this.state.health;
  }

  async getMetrics(): Promise<Record<string, number>> {
    return this.state.metrics;
  }

  async getCost(): Promise<Cost> {
    return this.state.cost;
  }

  async inspect(): Promise<CellInspection> {
    return {
      id: this.definition.id,
      definition: this.definition,
      state: this.state,
      eventSubscriptions: this.eventSubscriptions,
      memoryStats: {
        totalEntries: this.memoryEntries.size,
        byLayer: {} as any,
        totalSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
      },
      dependencyGraph: [],
      recentEvents: this.eventLog.slice(-50),
      recentErrors: this.errorLog.slice(-50),
      configuration: this.definition.config,
    };
  }

  // ---- Hook methods (override in subclasses) ----
  protected async onInit(): Promise<void> {}
  protected async onStart(): Promise<void> {}
  protected async onPause(): Promise<void> {}
  protected async onResume(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}

  protected abstract onProcess(
    input: unknown,
    context: CellContext,
  ): Promise<Omit<CellOutput, 'id' | 'latency' | 'cost'>>;
}