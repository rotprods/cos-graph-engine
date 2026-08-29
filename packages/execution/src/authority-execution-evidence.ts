import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
} from '@cos/core';
import type {
  AuthorityLeaseAcquireInput,
  AuthorityLeaseReleaseInput,
  AuthorityLeaseRenewInput,
} from './authority-lease';
import type {
  AuthoritySideEffectClaimInput,
} from './authority-side-effect';
import type {
  BeginAuthorityOperationInput,
  CommitAuthorityOperationInput,
  PrepareAuthorityOperationInput,
} from './authority-execution-runtime';
import { AuthorityExecutionRuntime } from './authority-execution-runtime';

export type AuthorityExecutionSignalType =
  | 'lease_acquired'
  | 'lease_renewed'
  | 'lease_released'
  | 'operation_claimed'
  | 'operation_prepared'
  | 'operation_execution_started'
  | 'operation_committed'
  | 'stale_fencing_rejected'
  | 'stale_lease_rejected'
  | 'lease_not_active_rejected'
  | 'lease_conflict'
  | 'idempotency_conflict'
  | 'stale_revision_rejected'
  | 'operation_failed';

export interface AuthorityExecutionSignal {
  signalId: string;
  type: AuthorityExecutionSignalType;
  operation: string;
  projectId: string | null;
  operationId: string | null;
  resourceUri: string | null;
  correlationId: string | null;
  occurredAt: string;
  recordedAt: string;
  outcome: 'accepted' | 'rejected';
  errorCode: string | null;
  errorMessage: string | null;
  evidence: Record<string, unknown>;
  evidenceHash: string;
}

export interface IAuthorityExecutionSignalSink {
  record(signal: AuthorityExecutionSignal): Promise<void>;
  list(): Promise<AuthorityExecutionSignal[]>;
}

export interface AuthorityObserverFailure {
  operation: string;
  signalType: AuthorityExecutionSignalType;
  recordedAt: string;
  error: string;
}

/** Append-only, payload-bound in-memory signal sink. */
export class InMemoryAuthorityExecutionSignalSink implements IAuthorityExecutionSignalSink {
  private readonly signals = new Map<string, AuthorityExecutionSignal>();

  async record(raw: AuthorityExecutionSignal): Promise<void> {
    const signal = cloneAndVerifySignal(raw);
    const existing = this.signals.get(signal.signalId);
    if (existing) {
      if (existing.evidenceHash !== signal.evidenceHash) {
        throw new Error(`EXECUTION_SIGNAL_ID_CONFLICT id=${signal.signalId}`);
      }
      return;
    }
    this.signals.set(signal.signalId, signal);
  }

  async list(): Promise<AuthorityExecutionSignal[]> {
    return Array.from(this.signals.values(), structuredClone)
      .sort((left, right) =>
        left.recordedAt.localeCompare(right.recordedAt)
        || left.signalId.localeCompare(right.signalId));
  }
}

/**
 * Failure-isolated observer. Signal persistence is a defense, not an execution
 * dependency: observer failure never changes the protected operation result.
 */
export class AuthorityExecutionObserver {
  private readonly failures: AuthorityObserverFailure[] = [];

  constructor(private readonly sink: IAuthorityExecutionSignalSink) {}

  async observe(input: Omit<AuthorityExecutionSignal, 'signalId' | 'evidenceHash'>): Promise<void> {
    const signal = sealSignal(input);
    try {
      await this.sink.record(signal);
    } catch (error) {
      this.failures.push({
        operation: input.operation,
        signalType: input.type,
        recordedAt: canonicalTime(input.recordedAt, 'observer recordedAt'),
        error: message(error),
      });
    }
  }

  getFailures(): AuthorityObserverFailure[] {
    return structuredClone(this.failures);
  }
}

/**
 * Observed facade around AuthorityExecutionRuntime.
 *
 * It records accepted operations and rejected near-miss signals, then returns or
 * rethrows the original protected result/error. It never substitutes observer
 * failures for domain outcomes and never claims a root cause.
 */
export class ObservedAuthorityExecutionRuntime {
  constructor(
    private readonly runtime: AuthorityExecutionRuntime,
    private readonly observer: AuthorityExecutionObserver,
  ) {}

  async acquireLease(input: AuthorityLeaseAcquireInput) {
    return this.run(
      'acquireLease',
      input.at,
      {
        projectId: null,
        operationId: null,
        resourceUri: input.resourceUri,
        correlationId: null,
        evidence: { ownerId: input.ownerId, operationKey: input.operationKey },
      },
      () => this.runtime.acquireLease(input),
      'lease_acquired',
    );
  }

  async renewLease(input: AuthorityLeaseRenewInput) {
    return this.run(
      'renewLease',
      input.at,
      {
        projectId: null,
        operationId: null,
        resourceUri: input.resourceUri,
        correlationId: null,
        evidence: {
          ownerId: input.ownerId,
          leaseId: input.leaseId,
          fencingToken: input.fencingToken,
          operationKey: input.operationKey,
        },
      },
      () => this.runtime.renewLease(input),
      'lease_renewed',
    );
  }

  async releaseLease(input: AuthorityLeaseReleaseInput) {
    return this.run(
      'releaseLease',
      input.at,
      {
        projectId: null,
        operationId: null,
        resourceUri: input.resourceUri,
        correlationId: null,
        evidence: {
          ownerId: input.ownerId,
          leaseId: input.leaseId,
          fencingToken: input.fencingToken,
          operationKey: input.operationKey,
        },
      },
      () => this.runtime.releaseLease(input),
      'lease_released',
    );
  }

  async claimOperation(input: AuthoritySideEffectClaimInput) {
    return this.run(
      'claimOperation',
      input.recordedAt,
      {
        projectId: input.projectId,
        operationId: null,
        resourceUri: input.resourceUri,
        correlationId: input.correlationId,
        evidence: {
          principalId: input.principalId,
          capability: input.capability,
          idempotencyKey: input.idempotencyKey,
          inputHash: canonicalHash128(input.input),
        },
      },
      () => this.runtime.claimOperation(input),
      'operation_claimed',
    );
  }

  async prepareOperation(input: PrepareAuthorityOperationInput) {
    return this.run(
      'prepareOperation',
      input.recordedAt,
      {
        projectId: null,
        operationId: input.operationId,
        resourceUri: null,
        correlationId: null,
        evidence: {
          leaseId: input.leaseId,
          leaseOwnerId: input.leaseOwnerId,
          fencingToken: input.fencingToken,
          transitionKey: input.transitionKey,
        },
      },
      () => this.runtime.prepareOperation(input),
      'operation_prepared',
    );
  }

  async beginOperation(input: BeginAuthorityOperationInput) {
    return this.run(
      'beginOperation',
      input.recordedAt,
      {
        projectId: null,
        operationId: input.operationId,
        resourceUri: null,
        correlationId: null,
        evidence: { transitionKey: input.transitionKey },
      },
      () => this.runtime.beginOperation(input),
      'operation_execution_started',
    );
  }

  async commitOperation(input: CommitAuthorityOperationInput) {
    return this.run(
      'commitOperation',
      input.recordedAt,
      {
        projectId: null,
        operationId: input.operationId,
        resourceUri: null,
        correlationId: null,
        evidence: {
          transitionKey: input.transitionKey,
          resultHash: canonicalHash128(input.result),
        },
      },
      () => this.runtime.commitOperation(input),
      'operation_committed',
    );
  }

  private async run<T>(
    operation: string,
    recordedAt: string,
    context: {
      projectId: string | null;
      operationId: string | null;
      resourceUri: string | null;
      correlationId: string | null;
      evidence: Record<string, unknown>;
    },
    execute: () => Promise<T>,
    successType: AuthorityExecutionSignalType,
  ): Promise<T> {
    try {
      const result = await execute();
      await this.observer.observe({
        type: successType,
        operation,
        ...context,
        occurredAt: canonicalTime(recordedAt, 'signal occurredAt'),
        recordedAt: canonicalTime(recordedAt, 'signal recordedAt'),
        outcome: 'accepted',
        errorCode: null,
        errorMessage: null,
      });
      return result;
    } catch (error) {
      const classification = classifyError(error);
      await this.observer.observe({
        type: classification.type,
        operation,
        ...context,
        occurredAt: canonicalTime(recordedAt, 'signal occurredAt'),
        recordedAt: canonicalTime(recordedAt, 'signal recordedAt'),
        outcome: 'rejected',
        errorCode: classification.code,
        errorMessage: classification.message,
      });
      throw error;
    }
  }
}

function sealSignal(
  input: Omit<AuthorityExecutionSignal, 'signalId' | 'evidenceHash'>,
): AuthorityExecutionSignal {
  const normalized = {
    type: input.type,
    operation: nonEmpty(input.operation, 'signal operation'),
    projectId: optional(input.projectId),
    operationId: optional(input.operationId),
    resourceUri: optional(input.resourceUri),
    correlationId: optional(input.correlationId),
    occurredAt: canonicalTime(input.occurredAt, 'signal occurredAt'),
    recordedAt: canonicalTime(input.recordedAt, 'signal recordedAt'),
    outcome: input.outcome,
    errorCode: optional(input.errorCode),
    errorMessage: optional(input.errorMessage),
    evidence: canonicalClone(input.evidence, 'signal evidence') as Record<string, unknown>,
  };
  const evidenceHash = canonicalHash128(normalized);
  const signalId = String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-execution',
    resourceType: 'operation-signal',
    resourceId: `${normalized.type}:${normalized.operationId ?? normalized.resourceUri ?? normalized.operation}:${normalized.recordedAt}:${evidenceHash}`,
  }, 'sig').id);
  return { signalId, ...normalized, evidenceHash };
}

function cloneAndVerifySignal(raw: AuthorityExecutionSignal): AuthorityExecutionSignal {
  const signal = structuredClone(raw);
  canonicalSerialize(signal);
  const { signalId: _signalId, evidenceHash: _evidenceHash, ...payload } = signal;
  const expectedHash = canonicalHash128(payload);
  if (expectedHash !== signal.evidenceHash) {
    throw new Error(`EXECUTION_SIGNAL_HASH_MISMATCH id=${signal.signalId}`);
  }
  return signal;
}

function classifyError(error: unknown): {
  type: AuthorityExecutionSignalType;
  code: string;
  message: string;
} {
  const text = message(error);
  const code = errorCode(text);
  if (text.includes('STALE_FENCING_TOKEN')) return { type: 'stale_fencing_rejected', code, message: text };
  if (text.includes('STALE_LEASE_ID') || text.includes('LEASE_OWNER_MISMATCH')) {
    return { type: 'stale_lease_rejected', code, message: text };
  }
  if (text.includes('LEASE_NOT_ACTIVE') || text.includes('LEASE_EXPIRED')) {
    return { type: 'lease_not_active_rejected', code, message: text };
  }
  if (text.includes('LEASE_ALREADY_HELD')) return { type: 'lease_conflict', code, message: text };
  if (text.includes('IDEMPOTENCY_CONFLICT') || text.includes('OPERATION_KEY_CONFLICT')) {
    return { type: 'idempotency_conflict', code, message: text };
  }
  if (text.includes('STALE_') || text.includes('_REVISION')) {
    return { type: 'stale_revision_rejected', code, message: text };
  }
  return { type: 'operation_failed', code, message: text };
}

function errorCode(messageValue: string): string {
  const token = messageValue.trim().split(/[\s:]/, 1)[0];
  return token || 'UNKNOWN_OPERATION_ERROR';
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optional(value: string | null): string | null {
  if (value === null) return null;
  return nonEmpty(value, 'optional signal string');
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
