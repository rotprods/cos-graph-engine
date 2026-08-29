import {
  canonicalHash128,
  type CellContext,
  type ProvenanceRef,
} from '@cos/core';
import {
  CapabilityRouter,
  type CapabilityExecutionReceipt,
} from './capability-router';
import type {
  AuthorityAgentRunAppendResult,
} from './authority-agent-run';
import { AuthorityAgentRunService } from './authority-agent-run';
import type {
  AuthorityLeaseRevision,
} from './authority-lease';
import { AuthorityExecutionRuntime } from './authority-execution-runtime';
import type {
  AuthorityPolicyDecision,
  AuthorityPrincipal,
  AuthoritySensitivity,
} from './authority-policy';
import { AuthorityPolicyEngine } from './authority-policy';
import {
  PolicyBoundAuthorityExecutionRuntime,
  type AuthorityExecutionPolicyContext,
} from './authority-policy-bound-runtime';
import {
  isAuthorityPreflightTool,
  type AuthorityPreflightTool,
} from './authority-provider-tools';
import type {
  AuthorityOperationError,
  AuthoritySideEffectView,
} from './authority-side-effect';
import { AuthoritySideEffectRuntime } from './authority-side-effect-runtime';
import { StrictToolRegistry } from './strict-tool-registry';

export interface AuthorityAgentStepEvidenceRequest {
  runId: string;
  expectedRevision: number;
  operationKey: string;
  stepId: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  evidenceRefs: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthorityReadCapabilityRequest {
  capability: string;
  projectId: string;
  principal: AuthorityPrincipal;
  sensitivity: AuthoritySensitivity;
  resourceUri: string;
  input: unknown;
  at: string;
  context: CellContext;
  agentStep?: AuthorityAgentStepEvidenceRequest;
}

export interface AuthoritySideEffectTimeline {
  claimAt: string;
  leaseAt: string;
  prepareAt: string;
  beginAt: string;
  outcomeAt: string;
  releaseAt?: string;
}

export interface AuthoritySideEffectCapabilityRequest {
  capability: string;
  projectId: string;
  principal: AuthorityPrincipal;
  sensitivity: AuthoritySensitivity;
  resourceUri: string;
  input: unknown;
  idempotencyKey: string;
  providerIdempotencyKey: string;
  correlationId: string;
  causationId?: string | null;
  provenance: ProvenanceRef[];
  metadata?: Record<string, unknown>;
  context: CellContext;
  timeline: AuthoritySideEffectTimeline;
  leaseOwnerId: string;
  leaseTtlMs: number;
  agentStep?: AuthorityAgentStepEvidenceRequest;
}

export interface AuthorityAgentEvidenceStatus {
  status: 'not_requested' | 'recorded' | 'pending_repair';
  revision?: number;
  error?: string;
}

export interface AuthorityLeaseReleaseStatus {
  status: 'not_requested' | 'released' | 'release_failed';
  revision?: number;
  error?: string;
}

export interface AuthorityReadCapabilityResult {
  status: 'read_completed';
  receipt: CapabilityExecutionReceipt;
  policy: AuthorityPolicyDecision;
  agentEvidence: AuthorityAgentEvidenceStatus;
}

export type AuthoritySideEffectCapabilityStatus =
  | 'committed'
  | 'already_committed'
  | 'reconciliation_required'
  | 'resume_required';

export interface AuthoritySideEffectCapabilityResult {
  status: AuthoritySideEffectCapabilityStatus;
  operation: AuthoritySideEffectView;
  receipt: CapabilityExecutionReceipt | null;
  lease: AuthorityLeaseRevision | null;
  policies: AuthorityPolicyDecision[];
  agentEvidence: AuthorityAgentEvidenceStatus;
  leaseRelease: AuthorityLeaseReleaseStatus;
  providerError: AuthorityOperationError | null;
}

export interface AuthorityCapabilityRuntimeDependencies {
  registry: StrictToolRegistry;
  policy: AuthorityPolicyEngine;
  policyRuntime: PolicyBoundAuthorityExecutionRuntime;
  execution: AuthorityExecutionRuntime;
  sideEffects: AuthoritySideEffectRuntime;
  agentRuns?: AuthorityAgentRunService;
}

/**
 * Single authority capability facade.
 *
 * The registry/router remain private so authority callers cannot execute a
 * side-effecting tool directly. Provider preflight runs before the durable
 * operation enters `executing`. After begin, any tool or commit exception is
 * recorded as `reconciliation_required`; it is never converted into a blind
 * retry or false local failure.
 */
export class AuthorityCapabilityRuntime {
  private readonly router: CapabilityRouter;

  constructor(private readonly dependencies: AuthorityCapabilityRuntimeDependencies) {
    this.router = new CapabilityRouter(dependencies.registry);
    for (const legacy of ['filesystem', 'http_client', 'search']) {
      if (dependencies.registry.has(legacy)) {
        throw new Error(`AUTHORITY_REGISTRY_LEGACY_TOOL_PRESENT name=${legacy}`);
      }
    }
  }

  async executeRead(
    request: AuthorityReadCapabilityRequest,
  ): Promise<AuthorityReadCapabilityResult> {
    const normalized = normalizeReadRequest(request);
    const tool = this.requireTool(normalized.capability, 'read');
    await tool.preflight(normalized.input, normalized.context);
    const operationHash = canonicalHash128({
      action: 'capability.read',
      projectId: normalized.projectId,
      principalId: normalized.principal.id,
      capability: normalized.capability,
      resourceUri: normalized.resourceUri,
      input: normalized.input,
    });
    const policy = await this.dependencies.policy.requireAllowed({
      principal: normalized.principal,
      action: 'capability.read',
      capability: normalized.capability,
      resourceUri: normalized.resourceUri,
      projectId: normalized.projectId,
      sensitivity: normalized.sensitivity,
      operationHash,
      at: normalized.at,
      context: { sideEffecting: false },
    });
    const receipt = await this.router.execute(
      normalized.capability,
      normalized.input,
      normalized.context,
    );
    const agentEvidence = await this.recordAcceptedStep(
      normalized.agentStep,
      receipt.result.output,
      null,
      null,
    );
    return { status: 'read_completed', receipt, policy, agentEvidence };
  }

  async executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult> {
    const normalized = normalizeSideEffectRequest(request);
    const tool = this.requireTool(normalized.capability, 'mutation');
    const providerInput = bindProviderIdempotency(
      normalized.input,
      normalized.providerIdempotencyKey,
    );

    // Preflight is deliberately before claim/lease/begin. A stale isolation
    // decision or malformed pinned handle cannot create an ambiguous provider
    // crash window.
    await tool.preflight(providerInput, normalized.context);

    const policyContext: AuthorityExecutionPolicyContext = {
      principal: normalized.principal,
      sensitivity: normalized.sensitivity,
    };
    const policies: AuthorityPolicyDecision[] = [];
    const claimed = await this.dependencies.policyRuntime.claimOperation({
      projectId: normalized.projectId,
      idempotencyKey: normalized.idempotencyKey,
      principalId: normalized.principal.id,
      agentRunId: normalized.agentStep?.runId ?? null,
      capability: normalized.capability,
      resourceUri: normalized.resourceUri,
      input: providerInput,
      correlationId: normalized.correlationId,
      causationId: normalized.causationId,
      provenance: normalized.provenance,
      metadata: normalized.metadata,
      recordedAt: normalized.timeline.claimAt,
    }, policyContext);
    policies.push(claimed.policy);

    let operation = await this.requireOperation(
      claimed.result.revision.operationId,
      normalized.timeline.claimAt,
    );
    if (!claimed.result.appended) {
      if (operation.state === 'committed') {
        const agentEvidence = await this.recordAcceptedStep(
          normalized.agentStep,
          operation.result,
          operation.operationId,
          'committed',
        );
        return {
          status: 'already_committed',
          operation,
          receipt: null,
          lease: null,
          policies,
          agentEvidence,
          leaseRelease: { status: 'not_requested' },
          providerError: null,
        };
      }
      if (operation.state !== 'claimed') {
        return {
          status: operation.state === 'reconciliation_required'
            ? 'reconciliation_required'
            : 'resume_required',
          operation,
          receipt: null,
          lease: null,
          policies,
          agentEvidence: { status: 'not_requested' },
          leaseRelease: { status: 'not_requested' },
          providerError: operation.error,
        };
      }
    }

    const leasePolicy = await this.dependencies.policy.requireAllowed({
      principal: normalized.principal,
      action: 'lease.acquire',
      capability: normalized.capability,
      resourceUri: normalized.resourceUri,
      projectId: normalized.projectId,
      sensitivity: normalized.sensitivity,
      operationHash: operation.logicalHash,
      at: normalized.timeline.leaseAt,
      context: {
        operationId: operation.operationId,
        leaseOwnerId: normalized.leaseOwnerId,
      },
    });
    policies.push(leasePolicy);
    const leaseResult = await this.dependencies.execution.acquireLease({
      resourceUri: normalized.resourceUri,
      ownerId: normalized.leaseOwnerId,
      operationKey: `${normalized.idempotencyKey}:lease:acquire`,
      at: normalized.timeline.leaseAt,
      ttlMs: normalized.leaseTtlMs,
      metadata: {
        operationId: operation.operationId,
        policyDecisionId: leasePolicy.decisionId,
        policyDecisionHash: leasePolicy.decisionHash,
      },
    });
    const lease = leaseResult.revision;

    const prepared = await this.dependencies.policyRuntime.prepareOperation({
      operationId: operation.operationId,
      expectedOperationRevision: operation.revision,
      transitionKey: `${normalized.idempotencyKey}:prepare`,
      recordedAt: normalized.timeline.prepareAt,
      leaseId: lease.leaseId,
      leaseOwnerId: normalized.leaseOwnerId,
      fencingToken: lease.fencingToken,
      providerIdempotencyKey: normalized.providerIdempotencyKey,
      metadata: {
        isolationTool: normalized.capability,
        leaseResourceRevision: lease.resourceRevision,
      },
    }, policyContext);
    policies.push(prepared.policy);

    const begun = await this.dependencies.policyRuntime.beginOperation({
      operationId: operation.operationId,
      expectedOperationRevision: prepared.result.revision.revision,
      transitionKey: `${normalized.idempotencyKey}:begin`,
      recordedAt: normalized.timeline.beginAt,
      metadata: {
        isolationPreflight: 'passed',
        providerIdempotencyKey: normalized.providerIdempotencyKey,
      },
    }, policyContext);
    policies.push(begun.policy);

    let receipt: CapabilityExecutionReceipt;
    try {
      receipt = await this.router.execute(
        normalized.capability,
        providerInput,
        normalized.context,
        {
          idempotencyKey: normalized.providerIdempotencyKey,
          fencingVersion: lease.fencingToken,
        },
      );
    } catch (cause) {
      operation = await this.markUnknown(
        operation.operationId,
        begun.result.revision.revision,
        normalized,
        'CAPABILITY_PROVIDER_OUTCOME_UNKNOWN',
        cause,
      );
      return {
        status: 'reconciliation_required',
        operation,
        receipt: null,
        lease,
        policies,
        agentEvidence: { status: 'not_requested' },
        leaseRelease: { status: 'not_requested' },
        providerError: operation.error,
      };
    }

    let committed;
    try {
      committed = await this.dependencies.policyRuntime.commitOperation({
        operationId: operation.operationId,
        expectedOperationRevision: begun.result.revision.revision,
        transitionKey: `${normalized.idempotencyKey}:commit`,
        recordedAt: normalized.timeline.outcomeAt,
        result: receipt.result.output,
        metadata: {
          capabilityInputHash: receipt.inputHash,
          toolResultLatency: receipt.result.latency,
          toolResultCost: receipt.result.cost.amount,
        },
      }, policyContext);
      policies.push(committed.policy);
    } catch (cause) {
      operation = await this.markUnknown(
        operation.operationId,
        begun.result.revision.revision,
        normalized,
        'CAPABILITY_COMMIT_OUTCOME_UNKNOWN',
        cause,
      );
      return {
        status: 'reconciliation_required',
        operation,
        receipt,
        lease,
        policies,
        agentEvidence: { status: 'not_requested' },
        leaseRelease: { status: 'not_requested' },
        providerError: operation.error,
      };
    }

    operation = await this.requireOperation(
      operation.operationId,
      normalized.timeline.outcomeAt,
    );
    const agentEvidence = await this.recordAcceptedStep(
      normalized.agentStep,
      receipt.result.output,
      operation.operationId,
      'committed',
    );
    const leaseRelease = await this.releaseLease(
      normalized,
      operation,
      lease,
      policies,
    );
    return {
      status: 'committed',
      operation,
      receipt,
      lease,
      policies,
      agentEvidence,
      leaseRelease,
      providerError: null,
    };
  }

  private requireTool(
    capability: string,
    expectedMode: 'read' | 'mutation',
  ): AuthorityPreflightTool {
    const name = nonEmpty(capability, 'capability');
    const tool = this.dependencies.registry.get(name);
    if (!tool) throw new Error(`CAPABILITY_NOT_FOUND name=${name}`);
    if (!isAuthorityPreflightTool(tool)) {
      throw new Error(`AUTHORITY_PREFLIGHT_TOOL_REQUIRED name=${name}`);
    }
    if (tool.authorityMode !== expectedMode) {
      throw new Error(
        `AUTHORITY_CAPABILITY_MODE_MISMATCH name=${name} expected=${expectedMode} actual=${tool.authorityMode}`,
      );
    }
    const permissions = tool.definition.permissions;
    const sideEffecting = permissions.some(permission =>
      permission === 'write' || permission === 'execute' || permission === 'admin');
    if ((expectedMode === 'mutation') !== sideEffecting) {
      throw new Error(`AUTHORITY_CAPABILITY_PERMISSION_MISMATCH name=${name}`);
    }
    return tool;
  }

  private async markUnknown(
    operationId: string,
    expectedRevision: number,
    request: ReturnType<typeof normalizeSideEffectRequest>,
    code: string,
    cause: unknown,
  ): Promise<AuthoritySideEffectView> {
    const reason: AuthorityOperationError = {
      code,
      message: message(cause),
      retryable: true,
      details: {
        capability: request.capability,
        providerIdempotencyKey: request.providerIdempotencyKey,
      },
    };
    const marked = await this.dependencies.sideEffects.markProviderOutcomeUnknown({
      operationId,
      expectedRevision,
      transitionKey: `${request.idempotencyKey}:provider-outcome-unknown`,
      recordedAt: request.timeline.outcomeAt,
      reason,
      metadata: {
        providerOutcome: 'unknown',
        providerIdempotencyKey: request.providerIdempotencyKey,
      },
    });
    return this.requireOperation(marked.revision.operationId, request.timeline.outcomeAt);
  }

  private async releaseLease(
    request: ReturnType<typeof normalizeSideEffectRequest>,
    operation: AuthoritySideEffectView,
    lease: AuthorityLeaseRevision,
    policies: AuthorityPolicyDecision[],
  ): Promise<AuthorityLeaseReleaseStatus> {
    if (!request.timeline.releaseAt) return { status: 'not_requested' };
    try {
      const policy = await this.dependencies.policy.requireAllowed({
        principal: request.principal,
        action: 'lease.release',
        capability: request.capability,
        resourceUri: request.resourceUri,
        projectId: request.projectId,
        sensitivity: request.sensitivity,
        operationHash: operation.logicalHash,
        at: request.timeline.releaseAt,
        context: {
          operationId: operation.operationId,
          leaseId: lease.leaseId,
        },
      });
      policies.push(policy);
      const released = await this.dependencies.execution.releaseLease({
        resourceUri: request.resourceUri,
        leaseId: lease.leaseId,
        ownerId: request.leaseOwnerId,
        fencingToken: lease.fencingToken,
        expectedResourceRevision: lease.resourceRevision,
        operationKey: `${request.idempotencyKey}:lease:release`,
        at: request.timeline.releaseAt,
        metadata: {
          operationId: operation.operationId,
          policyDecisionId: policy.decisionId,
          policyDecisionHash: policy.decisionHash,
        },
      });
      return { status: 'released', revision: released.revision.resourceRevision };
    } catch (error) {
      // The provider operation is already committed. Lease-release failure is a
      // near miss/evidence repair item and cannot rewrite the operation result.
      return { status: 'release_failed', error: message(error) };
    }
  }

  private async recordAcceptedStep(
    request: AuthorityAgentStepEvidenceRequest | undefined,
    result: unknown,
    sideEffectOperationId: string | null,
    sideEffectTerminalState: 'committed' | null,
  ): Promise<AuthorityAgentEvidenceStatus> {
    if (!request) return { status: 'not_requested' };
    if (!this.dependencies.agentRuns) {
      return { status: 'pending_repair', error: 'AuthorityAgentRunService is not configured' };
    }
    try {
      const appended: AuthorityAgentRunAppendResult = await this.dependencies.agentRuns.recordStep({
        runId: request.runId,
        expectedRevision: request.expectedRevision,
        operationKey: request.operationKey,
        recordedAt: request.completedAt,
        metadata: request.metadata,
        result: {
          stepId: request.stepId,
          attempt: request.attempt,
          outcome: 'accepted',
          result: structuredClone(result),
          resultHash: null,
          error: null,
          evidenceRefs: [...request.evidenceRefs],
          sideEffectOperationId,
          sideEffectTerminalState,
          startedAt: request.startedAt,
          completedAt: request.completedAt,
          metadata: request.metadata ?? {},
        },
      });
      return { status: 'recorded', revision: appended.revision.revision };
    } catch (error) {
      return { status: 'pending_repair', error: message(error) };
    }
  }

  private async requireOperation(
    operationId: string,
    at: string,
  ): Promise<AuthoritySideEffectView> {
    const operation = await this.dependencies.execution.getOperation(operationId, at);
    if (!operation) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    return operation;
  }
}

function normalizeReadRequest(input: AuthorityReadCapabilityRequest) {
  const capability = nonEmpty(input.capability, 'capability');
  const projectId = nonEmpty(input.projectId, 'projectId');
  assertPrincipalProject(input.principal, projectId);
  return {
    capability,
    projectId,
    principal: structuredClone(input.principal),
    sensitivity: input.sensitivity,
    resourceUri: nonEmpty(input.resourceUri, 'resourceUri'),
    input: structuredClone(input.input),
    at: canonicalTime(input.at, 'read at'),
    context: structuredClone(input.context),
    agentStep: input.agentStep ? normalizeAgentStep(input.agentStep) : undefined,
  };
}

function normalizeSideEffectRequest(input: AuthoritySideEffectCapabilityRequest) {
  const capability = nonEmpty(input.capability, 'capability');
  const projectId = nonEmpty(input.projectId, 'projectId');
  assertPrincipalProject(input.principal, projectId);
  const timeline = normalizeTimeline(input.timeline);
  const providerIdempotencyKey = nonEmpty(
    input.providerIdempotencyKey,
    'providerIdempotencyKey',
  );
  const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
  if (!Number.isSafeInteger(input.leaseTtlMs) || input.leaseTtlMs < 1 || input.leaseTtlMs > 3_600_000) {
    throw new Error('leaseTtlMs must be a safe integer in [1,3600000]');
  }
  if (Date.parse(timeline.outcomeAt) >= Date.parse(timeline.leaseAt) + input.leaseTtlMs) {
    throw new Error('CAPABILITY_TIMELINE_EXCEEDS_LEASE_TTL');
  }
  return {
    capability,
    projectId,
    principal: structuredClone(input.principal),
    sensitivity: input.sensitivity,
    resourceUri: nonEmpty(input.resourceUri, 'resourceUri'),
    input: structuredClone(input.input),
    idempotencyKey,
    providerIdempotencyKey,
    correlationId: nonEmpty(input.correlationId, 'correlationId'),
    causationId: optional(input.causationId ?? undefined) ?? null,
    provenance: input.provenance.map(entry => structuredClone(entry)),
    metadata: structuredClone(input.metadata ?? {}),
    context: structuredClone(input.context),
    timeline,
    leaseOwnerId: nonEmpty(input.leaseOwnerId, 'leaseOwnerId'),
    leaseTtlMs: input.leaseTtlMs,
    agentStep: input.agentStep ? normalizeAgentStep(input.agentStep) : undefined,
  };
}

function normalizeTimeline(input: AuthoritySideEffectTimeline): Required<AuthoritySideEffectTimeline> {
  const timeline = {
    claimAt: canonicalTime(input.claimAt, 'claimAt'),
    leaseAt: canonicalTime(input.leaseAt, 'leaseAt'),
    prepareAt: canonicalTime(input.prepareAt, 'prepareAt'),
    beginAt: canonicalTime(input.beginAt, 'beginAt'),
    outcomeAt: canonicalTime(input.outcomeAt, 'outcomeAt'),
    releaseAt: input.releaseAt === undefined
      ? ''
      : canonicalTime(input.releaseAt, 'releaseAt'),
  };
  const required = [
    timeline.claimAt,
    timeline.leaseAt,
    timeline.prepareAt,
    timeline.beginAt,
    timeline.outcomeAt,
  ];
  for (let index = 1; index < required.length; index += 1) {
    if (Date.parse(required[index]!) <= Date.parse(required[index - 1]!)) {
      throw new Error('CAPABILITY_TIMELINE_NOT_STRICTLY_MONOTONIC');
    }
  }
  if (timeline.releaseAt
    && Date.parse(timeline.releaseAt) <= Date.parse(timeline.outcomeAt)) {
    throw new Error('CAPABILITY_RELEASE_TIME_INVALID');
  }
  return timeline;
}

function normalizeAgentStep(input: AuthorityAgentStepEvidenceRequest): AuthorityAgentStepEvidenceRequest {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new Error('agentStep expectedRevision must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1) {
    throw new Error('agentStep attempt must be a positive safe integer');
  }
  const startedAt = canonicalTime(input.startedAt, 'agentStep startedAt');
  const completedAt = canonicalTime(input.completedAt, 'agentStep completedAt');
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new Error('agentStep completedAt cannot precede startedAt');
  }
  const evidenceRefs = Array.from(new Set(input.evidenceRefs.map(ref => nonEmpty(ref, 'evidenceRef')))).sort();
  if (evidenceRefs.length === 0) throw new Error('agentStep requires evidenceRefs');
  return {
    runId: nonEmpty(input.runId, 'agentStep runId'),
    expectedRevision: input.expectedRevision,
    operationKey: nonEmpty(input.operationKey, 'agentStep operationKey'),
    stepId: nonEmpty(input.stepId, 'agentStep stepId'),
    attempt: input.attempt,
    startedAt,
    completedAt,
    evidenceRefs,
    metadata: structuredClone(input.metadata ?? {}),
  };
}

function bindProviderIdempotency(input: unknown, key: string): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('side-effect capability input must be an object');
  }
  const record = structuredClone(input) as Record<string, unknown>;
  if (record.providerIdempotencyKey !== undefined
    && record.providerIdempotencyKey !== key) {
    throw new Error('CAPABILITY_PROVIDER_IDEMPOTENCY_CONFLICT');
  }
  record.providerIdempotencyKey = key;
  return record;
}

function assertPrincipalProject(principal: AuthorityPrincipal, projectId: string): void {
  if (!principal.projectIds.includes(projectId)) {
    throw new Error(`CAPABILITY_PRINCIPAL_PROJECT_SCOPE_MISSING project=${projectId}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
