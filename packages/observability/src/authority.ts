import {
  stableHash128,
  type CogError,
  type EntityId,
  type ITelemetry,
  type MetricSample,
  type TelemetryEvent,
} from '@cos/core';

export type AuthorityOperationType =
  | 'event.append'
  | 'event.deliver'
  | 'projection.apply'
  | 'graph.query'
  | 'context.compile'
  | 'policy.evaluate'
  | 'capability.execute'
  | 'lease.acquire'
  | 'lease.release'
  | 'memory.query'
  | 'memory.supersede'
  | 'snapshot.create'
  | 'recovery.restore'
  | 'agent.goal.execute';

export interface AuthorityOperationContext {
  type: AuthorityOperationType;
  source: string;
  traceId: string;
  parentSpanId?: string;
  correlationId?: string;
  causationId?: string;
  projectId?: string;
  resourceId?: string;
  projectionVersion?: number;
  evidenceHash?: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}

export interface AuthorityOperationSpan extends AuthorityOperationContext {
  id: string;
  spanId: string;
  startedAt: string;
  startedAtMs: number;
}

export interface AuthorityOperationResult<T> {
  value: T;
  span: AuthorityOperationSpan;
}

/**
 * Thin authority-grade layer over ITelemetry.
 *
 * Every operation emits exactly one terminal event and one latency metric. A
 * telemetry sink failure is counted locally but can never change the protected
 * operation result, preserving observability as a defense rather than a new
 * single point of failure.
 */
export class AuthorityTelemetry {
  private sequence = 0;
  private observerFailures = 0;

  constructor(private readonly telemetry: ITelemetry) {}

  begin(context: AuthorityOperationContext): AuthorityOperationSpan {
    const source = context.source.trim();
    const traceId = context.traceId.trim();
    if (!source) throw new Error('Authority telemetry source must not be empty');
    if (!traceId) throw new Error('Authority telemetry traceId must not be empty');
    if (context.projectionVersion !== undefined
      && (!Number.isSafeInteger(context.projectionVersion) || context.projectionVersion < 0)) {
      throw new Error('projectionVersion must be a non-negative safe integer');
    }

    const startedAtMs = Date.now();
    const sequence = ++this.sequence;
    const spanId = `authspan_${stableHash128({
      traceId,
      parentSpanId: context.parentSpanId || null,
      type: context.type,
      source,
      resourceId: context.resourceId || null,
      startedAtMs,
      sequence,
    }).slice(0, 24)}`;
    return {
      ...context,
      source,
      traceId,
      id: `authop_${stableHash128({ spanId, sequence })}`,
      spanId,
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtMs,
      attributes: { ...(context.attributes || {}) },
    };
  }

  async run<T>(
    context: AuthorityOperationContext,
    operation: (span: AuthorityOperationSpan) => Promise<T>,
  ): Promise<AuthorityOperationResult<T>> {
    const span = this.begin(context);
    try {
      const value = await operation(span);
      await this.finish(span, 'ok');
      return { value, span };
    } catch (error) {
      await this.finish(span, 'error', error);
      throw error;
    }
  }

  async finish(
    span: AuthorityOperationSpan,
    status: 'ok' | 'error',
    error?: unknown,
  ): Promise<void> {
    const completedAtMs = Date.now();
    const duration = Math.max(0, completedAtMs - span.startedAtMs);
    const attributes = compactAttributes({
      operation: span.type,
      projectId: span.projectId,
      resourceId: span.resourceId,
      correlationId: span.correlationId,
      causationId: span.causationId,
      projectionVersion: span.projectionVersion,
      evidenceHash: span.evidenceHash,
      ...span.attributes,
    });
    const event: TelemetryEvent = {
      id: span.id as EntityId,
      type: span.type,
      source: span.source as EntityId,
      timestamp: new Date(completedAtMs).toISOString(),
      traceId: span.traceId,
      spanId: span.spanId,
      duration,
      attributes,
      status,
      error: status === 'error' ? normalizeError(error, span) : undefined,
    };
    const metric: MetricSample = {
      name: 'cos_authority_operation_duration_ms',
      value: duration,
      tags: {
        operation: span.type,
        status,
        source: span.source,
        project: span.projectId || 'global',
      },
      timestamp: event.timestamp,
      unit: 'ms',
    };

    try {
      await this.telemetry.recordEvent(event);
      await this.telemetry.recordMetric(metric);
      await this.telemetry.recordMetric({
        name: 'cos_authority_operation_total',
        value: 1,
        tags: metric.tags,
        timestamp: event.timestamp,
        unit: 'count',
      });
    } catch {
      this.observerFailures += 1;
    }
  }

  get observerFailureCount(): number { return this.observerFailures; }
}

function compactAttributes(
  attributes: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(attributes).sort()) {
    const value = attributes[key];
    if (value === undefined || value === null) continue;
    output[key] = value;
  }
  return output;
}

function normalizeError(error: unknown, span: AuthorityOperationSpan): CogError {
  const value = error instanceof Error ? error : new Error(String(error));
  return {
    id: `err_${stableHash128({ spanId: span.spanId, name: value.name, message: value.message })}` as EntityId,
    code: value.name || 'AUTHORITY_OPERATION_ERROR',
    message: value.message,
    severity: 'error',
    timestamp: new Date().toISOString(),
    stack: value.stack,
    context: {
      operation: span.type,
      resourceId: span.resourceId,
      projectId: span.projectId,
      projectionVersion: span.projectionVersion,
    },
  };
}
