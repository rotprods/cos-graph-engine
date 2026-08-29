import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  AuthorityAgentRunService,
} from './authority-agent-run';
import type {
  AuthorityCapabilityRuntimePortV2,
} from './authority-capability-evidence-v2';
import type {
  AuthorityAgentStepEvidenceRequest,
  AuthorityReadCapabilityRequest,
  AuthorityReadCapabilityResult,
  AuthoritySideEffectCapabilityRequest,
  AuthoritySideEffectCapabilityResult,
} from './authority-capability-runtime';
import type { AuthorityExecutionRuntime } from './authority-execution-runtime';
import {
  AuthorityRepairService,
  type AuthorityRepairHandler,
  type AuthorityRepairHandlerContext,
} from './authority-repair-ledger';

export interface AuthorityRepairEnqueueFailure {
  kind: 'agent_evidence_append' | 'lease_release';
  projectId: string;
  operationId: string | null;
  occurredAt: string;
  error: string;
}

/**
 * Adds durable repair intents after the protected capability result is known.
 * Repair-ledger failure is isolated and cannot rewrite provider/operation truth.
 */
export class RepairingAuthorityCapabilityRuntime implements AuthorityCapabilityRuntimePortV2 {
  private readonly enqueueFailures: AuthorityRepairEnqueueFailure[] = [];

  constructor(
    private readonly runtime: AuthorityCapabilityRuntimePortV2,
    private readonly repairs: AuthorityRepairService,
    private readonly maxFailures = 1_000,
  ) {
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1 || maxFailures > 100_000) {
      throw new Error('maxFailures must be a safe integer in [1,100000]');
    }
  }

  async executeRead(
    request: AuthorityReadCapabilityRequest,
  ): Promise<AuthorityReadCapabilityResult> {
    const result = await this.runtime.executeRead(request);
    if (result.agentEvidence.status === 'pending_repair' && request.agentStep) {
      await this.enqueueAgentRepair({
        request: request.agentStep,
        projectId: request.projectId,
        correlationId: request.context.traceId,
        sensitivity: request.sensitivity,
        recordedAt: request.at,
        resultSource: {
          kind: 'inline',
          result: canonicalClone(result.receipt.result.output, 'read repair result'),
        },
      });
    }
    return result;
  }

  async executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult> {
    const result = await this.runtime.executeSideEffect(request);
    const operationId = result.operation.operationId;

    if (result.agentEvidence.status === 'pending_repair' && request.agentStep) {
      await this.enqueueAgentRepair({
        request: request.agentStep,
        projectId: request.projectId,
        correlationId: request.correlationId,
        sensitivity: request.sensitivity,
        recordedAt: request.timeline.outcomeAt,
        resultSource: { kind: 'operation', operationId },
      });
    }

    if (result.leaseRelease.status === 'release_failed'
      && result.lease
      && request.timeline.releaseAt) {
      const dedupeKey = `lease-release:${operationId}:${result.lease.leaseId}`;
      await this.safeEnqueue('lease_release', request.projectId, operationId, request.timeline.releaseAt, async () => {
        await this.repairs.enqueue({
          projectId: request.projectId,
          operationId,
          correlationId: request.correlationId,
          kind: 'lease_release',
          dedupeKey,
          payload: {
            resourceUri: request.resourceUri,
            leaseId: result.lease!.leaseId,
            ownerId: request.leaseOwnerId,
            fencingToken: result.lease!.fencingToken,
            expectedResourceRevision: result.lease!.resourceRevision,
            operationKey: `${request.idempotencyKey}:lease:release`,
            releaseAt: request.timeline.releaseAt,
            metadata: {
              operationId,
              originalError: result.leaseRelease.error ?? 'unknown',
            },
          },
          sensitivity: repairSensitivity(request.sensitivity),
          maxAttempts: 20,
          nextAttemptAt: request.timeline.releaseAt,
          idempotencyKey: `repair-enqueue:${canonicalHash128({
            projectId: request.projectId,
            kind: 'lease_release',
            dedupeKey,
          })}`,
          provenance: request.provenance.map(item => structuredClone(item)),
          recordedAt: request.timeline.releaseAt,
        });
      });
    }

    return result;
  }

  getEnqueueFailures(limit = 100): AuthorityRepairEnqueueFailure[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('repair enqueue failure limit must be a non-negative safe integer');
    }
    return this.enqueueFailures.slice(-Math.min(limit, this.maxFailures)).map(item => ({ ...item }));
  }

  private async enqueueAgentRepair(input: {
    request: AuthorityAgentStepEvidenceRequest;
    projectId: string;
    correlationId: string;
    sensitivity: string;
    recordedAt: string;
    resultSource:
      | { kind: 'inline'; result: unknown }
      | { kind: 'operation'; operationId: string };
  }): Promise<void> {
    const dedupeKey = `agent-evidence:${input.request.runId}:${input.request.operationKey}`;
    await this.safeEnqueue(
      'agent_evidence_append',
      input.projectId,
      input.resultSource.kind === 'operation' ? input.resultSource.operationId : null,
      input.recordedAt,
      async () => {
        await this.repairs.enqueue({
          projectId: input.projectId,
          operationId: input.resultSource.kind === 'operation'
            ? input.resultSource.operationId
            : null,
          correlationId: input.correlationId,
          kind: 'agent_evidence_append',
          dedupeKey,
          payload: {
            step: canonicalClone(input.request, 'agent evidence repair step'),
            resultSource: canonicalClone(input.resultSource, 'agent evidence repair source'),
          },
          sensitivity: repairSensitivity(input.sensitivity),
          maxAttempts: 20,
          nextAttemptAt: canonicalTime(input.recordedAt, 'agent evidence repair recordedAt'),
          idempotencyKey: `repair-enqueue:${canonicalHash128({
            projectId: input.projectId,
            kind: 'agent_evidence_append',
            dedupeKey,
          })}`,
          provenance: [{
            source: `agentic://run/${input.request.runId}/step/${input.request.stepId}`,
            locator: `attempt=${input.request.attempt}`,
          }],
          recordedAt: canonicalTime(input.recordedAt, 'agent evidence repair recordedAt'),
        });
      },
    );
  }

  private async safeEnqueue(
    kind: AuthorityRepairEnqueueFailure['kind'],
    projectId: string,
    operationId: string | null,
    occurredAt: string,
    enqueue: () => Promise<void>,
  ): Promise<void> {
    try {
      await enqueue();
    } catch (error) {
      this.enqueueFailures.push({
        kind,
        projectId,
        operationId,
        occurredAt: canonicalTime(occurredAt, 'repair enqueue failure occurredAt'),
        error: message(error),
      });
      if (this.enqueueFailures.length > this.maxFailures) {
        this.enqueueFailures.splice(0, this.enqueueFailures.length - this.maxFailures);
      }
    }
  }
}

interface AgentEvidenceRepairPayload {
  step: AuthorityAgentStepEvidenceRequest;
  resultSource:
    | { kind: 'inline'; result: unknown }
    | { kind: 'operation'; operationId: string };
}

export class AuthorityAgentEvidenceRepairHandler implements AuthorityRepairHandler {
  readonly kind = 'agent_evidence_append' as const;

  constructor(
    private readonly runs: AuthorityAgentRunService,
    private readonly execution?: AuthorityExecutionRuntime,
  ) {}

  async handle(context: AuthorityRepairHandlerContext): Promise<Record<string, unknown>> {
    const payload = parseAgentPayload(context.repair.payload);
    let result: unknown;
    let operationId: string | null = null;
    let terminalState: 'committed' | null = null;
    if (payload.resultSource.kind === 'inline') {
      result = canonicalClone(payload.resultSource.result, 'inline repair result');
    } else {
      if (!this.execution) {
        throw new Error('AGENT_EVIDENCE_REPAIR_EXECUTION_RUNTIME_REQUIRED');
      }
      operationId = nonEmpty(payload.resultSource.operationId, 'repair operationId');
      const operation = await this.execution.getOperation(operationId, context.at);
      if (!operation) throw new Error(`AGENT_EVIDENCE_REPAIR_OPERATION_NOT_FOUND id=${operationId}`);
      if (operation.state !== 'committed' || operation.effectKnowledge !== 'applied') {
        throw new Error(`AGENT_EVIDENCE_REPAIR_OPERATION_NOT_COMMITTED id=${operationId}`);
      }
      result = canonicalClone(operation.result, 'operation repair result');
      terminalState = 'committed';
    }

    const step = payload.step;
    const appended = await this.runs.recordStep({
      runId: step.runId,
      expectedRevision: step.expectedRevision,
      operationKey: step.operationKey,
      recordedAt: step.completedAt,
      metadata: step.metadata,
      result: {
        stepId: step.stepId,
        attempt: step.attempt,
        outcome: 'accepted',
        result,
        resultHash: null,
        error: null,
        evidenceRefs: [...step.evidenceRefs],
        sideEffectOperationId: operationId,
        sideEffectTerminalState: terminalState,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        metadata: step.metadata ?? {},
      },
    });
    return {
      repairKind: this.kind,
      runId: step.runId,
      stepId: step.stepId,
      agentRunRevision: appended.revision.revision,
      appended: appended.appended,
      operationId,
      fencingToken: context.fencingToken,
    };
  }
}

export class AuthorityLeaseReleaseRepairHandler implements AuthorityRepairHandler {
  readonly kind = 'lease_release' as const;

  constructor(private readonly execution: AuthorityExecutionRuntime) {}

  async handle(context: AuthorityRepairHandlerContext): Promise<Record<string, unknown>> {
    const payload = parseLeasePayload(context.repair.payload);
    const released = await this.execution.releaseLease({
      resourceUri: payload.resourceUri,
      leaseId: payload.leaseId,
      ownerId: payload.ownerId,
      fencingToken: payload.fencingToken,
      expectedResourceRevision: payload.expectedResourceRevision,
      operationKey: payload.operationKey,
      at: payload.releaseAt,
      metadata: payload.metadata,
    });
    return {
      repairKind: this.kind,
      leaseId: payload.leaseId,
      resourceUri: payload.resourceUri,
      releasedState: released.revision.state,
      resourceRevision: released.revision.resourceRevision,
      leaseContentHash: released.revision.contentHash,
      repairFencingToken: context.fencingToken,
    };
  }
}

function parseAgentPayload(value: Record<string, unknown>): AgentEvidenceRepairPayload {
  canonicalSerialize(value);
  const step = value.step;
  const source = value.resultSource;
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new Error('agent evidence repair step is required');
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('agent evidence repair resultSource is required');
  }
  const typedSource = source as Record<string, unknown>;
  if (typedSource.kind !== 'inline' && typedSource.kind !== 'operation') {
    throw new Error('agent evidence repair resultSource kind is invalid');
  }
  return structuredClone({ step, resultSource: source }) as AgentEvidenceRepairPayload;
}

function parseLeasePayload(value: Record<string, unknown>) {
  canonicalSerialize(value);
  const fencingToken = Number(value.fencingToken);
  const expectedResourceRevision = Number(value.expectedResourceRevision);
  if (!Number.isSafeInteger(fencingToken) || fencingToken < 1) {
    throw new Error('lease repair fencingToken must be a positive safe integer');
  }
  if (!Number.isSafeInteger(expectedResourceRevision) || expectedResourceRevision < 1) {
    throw new Error('lease repair expectedResourceRevision must be positive');
  }
  return {
    resourceUri: nonEmpty(String(value.resourceUri ?? ''), 'lease repair resourceUri'),
    leaseId: nonEmpty(String(value.leaseId ?? ''), 'lease repair leaseId'),
    ownerId: nonEmpty(String(value.ownerId ?? ''), 'lease repair ownerId'),
    fencingToken,
    expectedResourceRevision,
    operationKey: nonEmpty(String(value.operationKey ?? ''), 'lease repair operationKey'),
    releaseAt: canonicalTime(String(value.releaseAt ?? ''), 'lease repair releaseAt'),
    metadata: canonicalClone((value.metadata ?? {}) as Record<string, unknown>, 'lease repair metadata'),
  };
}

function repairSensitivity(value: string): 'internal' | 'private' | 'restricted' {
  if (value === 'restricted') return 'restricted';
  if (value === 'private') return 'private';
  return 'internal';
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

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
