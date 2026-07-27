import { CogError, Severity, EntityId } from './types';

export class CellError extends Error implements CogError {
  public readonly id: EntityId;
  public readonly code: string;
  public readonly severity: Severity;
  public readonly timestamp: string;
  public readonly context?: unknown;

  constructor(
    code: string,
    message: string,
    severity: Severity = 'error',
    context?: unknown,
  ) {
    super(message);
    this.name = 'CellError';
    this.id = generateId();
    this.code = code;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.context = context;
  }

  toJSON(): CogError {
    return {
      id: this.id,
      code: this.code,
      message: this.message,
      severity: this.severity,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

export class ValidationError extends CellError {
  constructor(message: string, context?: unknown) {
    super('VALIDATION_ERROR', message, 'warn', context);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends CellError {
  constructor(message: string = 'Operation timed out') {
    super('TIMEOUT_ERROR', message, 'error');
    this.name = 'TimeoutError';
  }
}

export class PermissionDeniedError extends CellError {
  constructor(action: string, resource: string) {
    super('PERMISSION_DENIED', `Permission denied: ${action} on ${resource}`, 'warn');
    this.name = 'PermissionDeniedError';
  }
}

export class ResourceExhaustedError extends CellError {
  constructor(resource: string, limit: number, current: number) {
    super('RESOURCE_EXHAUSTED', `Resource exhausted: ${resource} (limit: ${limit}, current: ${current})`, 'error');
    this.name = 'ResourceExhaustedError';
  }
}

export class PolicyViolationError extends CellError {
  constructor(policyId: string, reason: string) {
    super('POLICY_VIOLATION', `Policy violation: ${policyId} — ${reason}`, 'fatal');
    this.name = 'PolicyViolationError';
  }
}

// Counter for ID generation
let idCounter = 0;

export function generateId(): EntityId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const counter = (idCounter++).toString(36);
  return `cos_${timestamp}_${random}_${counter}` as EntityId;
}

export function generateTraceId(): string {
  return `trace_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

export function generateSpanId(): string {
  return `span_${Math.random().toString(36).substring(2, 10)}`;
}