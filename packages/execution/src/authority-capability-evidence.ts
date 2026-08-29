import {
  canonicalHash128,
  canonicalSerialize,
} from '@cos/core';
import type {
  AuthorityReadCapabilityRequest,
  AuthorityReadCapabilityResult,
  AuthoritySideEffectCapabilityRequest,
  AuthoritySideEffectCapabilityResult,
} from './authority-capability-runtime';

export type AuthorityCapabilitySignalType =
  | 'capability_completed'
  | 'capability_rejected'
  | 'capability_failed'
  | 'policy_denied'
  | 'isolation_denied'
  | 'lease_conflict'
  | 'lease_expired'
  | 'stale_fencing_rejected'
  | 'provider_outcome_uncertain'
  | 'provider_reconciliation_applied'
  | 'provider_reconciliation_not_applied'
  | 'provider_partial_application'
  | 'lease_release_repair_required'
  | 'agent_evidence_repair_required';

export type AuthorityCapabilityOutcome =
  | 'succeeded'
  | 'rejected'
  | 'failed'
  | 'uncertain'
  | 'repair_required';

export interface AuthorityCapabilitySignal {
  schemaVersion: 1;
  signalId: string;
  type: AuthorityCapabilitySignalType;
  outcome: AuthorityCapabilityOutcome;
  nearMiss: boolean;
  projectId: string;
  principalId: string;
  capability: string;
  resourceUri: string;
  operationId: string | null;
  correlationId: string | null;
  causationId: string | null;
  occurredAt: string;
  errorCode: string | null;
  details: Record<string, unknown>;
  contentHash: string;
}

export interface IAuthorityCapabilitySignalSink {
  append(signal: AuthorityCapabilitySignal): Promise<void> | void;
}

export interface AuthorityCapabilityTelemetryStart {
  operationName: 'capability.read' | 'capability.side_effect';
  projectId: string;
  principalId: string;
  capability: string;
  resourceUri: string;
  correlationId: string | null;
  causationId: string | null;
  startedAt: string;
}

export interface AuthorityCapabilityTelemetryTerminal {
  outcome: AuthorityCapabilityOutcome;
  endedAt: string;
  operationId: string | null;
  errorCode: string | null;
  details: Record<string, unknown>;
}

/**
 * Structural bridge intentionally kept free of an @cos/observability package
 * dependency. A deployment adapter can map this contract to AuthorityTelemetry.
 */
export interface IAuthorityCapabilityTelemetry {
  start(input: AuthorityCapabilityTelemetryStart): unknown;
  terminal(
    token: unknown,
    terminal: AuthorityCapabilityTelemetryTerminal,
  ): Promise<void> | void;
}

export interface AuthorityCapabilityRuntimePort {
  executeRead(request: AuthorityReadCapabilityRequest): Promise<AuthorityReadCapabilityResult>;
  executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult>;
}

export interface AuthorityCapabilityObserverFailure {
  channel: 'signal' | 'telemetry_start' | 'telemetry_terminal';
  operationName: 'capability.read' | 'capability.side_effect';
  occurredAt: string;
  error: string;
}

/**
 * Failure-isolated observer around the canonical capability facade.
 *
 * Signals and telemetry are evidence defenses, never execution dependencies:
 * observer failure is retained locally but cannot convert an accepted provider
 * result into a failed operation or turn a rejected operation into an allow.
 * Raw provider results, capability inputs and secrets are never copied into
 * telemetry/signal details.
 */
export class ObservedAuthorityCapabilityRuntime {
  private readonly failures: AuthorityCapabilityObserverFailure[] = [];

  constructor(
    private readonly runtime: AuthorityCapabilityRuntimePort,
    private readonly signals?: IAuthorityCapabilitySignalSink,
    private readonly telemetry?: IAuthorityCapabilityTelemetry,
    private readonly maxFailures = 1_000,
  ) {
    if (!Number.isSafeInteger(maxFailures) || maxFailures < 1 || maxFailures > 100_000) {
      throw new Error('maxFailures must be a safe integer in [1,100000]');
    }
  }

  async executeRead(
    request: AuthorityReadCapabilityRequest,
  ): Promise<AuthorityReadCapabilityResult> {
    const identity = readIdentity(request);
    const token = this.safeTelemetryStart('capability.read', identity);
    try {
      const result = await this.runtime.executeRead(request);
      const signal = buildAuthorityCapabilitySignal({
        type: 'capability_completed',
        outcome: 'succeeded',
        nearMiss: false,
        ...identity,
        operationId: null,
        occurredAt: canonicalTime(request.at, 'read occurredAt'),
        errorCode: null,
        details: {
          status: result.status,
          inputHash: result.receipt.inputHash,
          policyDecisionId: result.policy.decisionId,
          policyDecisionHash: result.policy.decisionHash,
          agentEvidenceStatus: result.agentEvidence.status,
        },
      });
      await this.safeSignal('capability.read', signal);
      await this.safeTelemetryTerminal('capability.read', token, signal);
      if (result.agentEvidence.status === 'pending_repair') {
        await this.emitRepairSignal('capability.read', identity, {
          type: 'agent_evidence_repair_required',
          operationId: null,
          occurredAt: canonicalTime(request.at, 'read occurredAt'),
          errorCode: 'AGENT_EVIDENCE_REPAIR_REQUIRED',
          details: { error: result.agentEvidence.error ?? 'unknown' },
        });
      }
      return result;
    } catch (error) {
      const classified = classifyCapabilityError(error);
      const signal = buildAuthorityCapabilitySignal({
        type: classified.type,
        outcome: classified.outcome,
        nearMiss: classified.nearMiss,
        ...identity,
        operationId: null,
        occurredAt: canonicalTime(request.at, 'read occurredAt'),
        errorCode: classified.errorCode,
        details: { errorClass: classified.errorClass },
      });
      await this.safeSignal('capability.read', signal);
      await this.safeTelemetryTerminal('capability.read', token, signal);
      throw error;
    }
  }

  async executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult> {
    const identity = sideEffectIdentity(request);
    const token = this.safeTelemetryStart('capability.side_effect', identity);
    try {
      const result = await this.runtime.executeSideEffect(request);
      const terminal = terminalSignalForSideEffect(request, result, identity);
      await this.safeSignal('capability.side_effect', terminal);
      await this.safeTelemetryTerminal('capability.side_effect', token, terminal);

      if (result.agentEvidence.status === 'pending_repair') {
        await this.emitRepairSignal('capability.side_effect', identity, {
          type: 'agent_evidence_repair_required',
          operationId: result.operation.operationId,
          occurredAt: canonicalTime(request.timeline.outcomeAt, 'side-effect outcomeAt'),
          errorCode: 'AGENT_EVIDENCE_REPAIR_REQUIRED',
          details: { error: result.agentEvidence.error ?? 'unknown' },
        });
      }
      if (result.leaseRelease.status === 'release_failed') {
        await this.emitRepairSignal('capability.side_effect', identity, {
          type: 'lease_release_repair_required',
          operationId: result.operation.operationId,
          occurredAt: canonicalTime(
            request.timeline.releaseAt ?? request.timeline.outcomeAt,
            'lease release evidence time',
          ),
          errorCode: 'LEASE_RELEASE_REPAIR_REQUIRED',
          details: { error: result.leaseRelease.error ?? 'unknown' },
        });
      }
      return result;
    } catch (error) {
      const classified = classifyCapabilityError(error);
      const signal = buildAuthorityCapabilitySignal({
        type: classified.type,
        outcome: classified.outcome,
        nearMiss: classified.nearMiss,
        ...identity,
        operationId: operationIdFromError(error),
        occurredAt: canonicalTime(
          request.timeline.outcomeAt,
          'side-effect outcomeAt',
        ),
        errorCode: classified.errorCode,
        details: { errorClass: classified.errorClass },
      });
      await this.safeSignal('capability.side_effect', signal);
      await this.safeTelemetryTerminal('capability.side_effect', token, signal);
      throw error;
    }
  }

  getObserverFailures(limit = 100): AuthorityCapabilityObserverFailure[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('observer failure limit must be a non-negative safe integer');
    }
    return this.failures.slice(-Math.min(limit, this.maxFailures)).map(item => ({ ...item }));
  }

  private safeTelemetryStart(
    operationName: 'capability.read' | 'capability.side_effect',
    identity: ReturnType<typeof readIdentity>,
  ): unknown {
    if (!this.telemetry) return null;
    try {
      return this.telemetry.start({
        operationName,
        projectId: identity.projectId,
        principalId: identity.principalId,
        capability: identity.capability,
        resourceUri: identity.resourceUri,
        correlationId: identity.correlationId,
        causationId: identity.causationId,
        startedAt: identity.startedAt,
      });
    } catch (error) {
      this.recordFailure('telemetry_start', operationName, identity.startedAt, error);
      return null;
    }
  }

  private async safeTelemetryTerminal(
    operationName: 'capability.read' | 'capability.side_effect',
    token: unknown,
    signal: AuthorityCapabilitySignal,
  ): Promise<void> {
    if (!this.telemetry) return;
    try {
      await this.telemetry.terminal(token, {
        outcome: signal.outcome,
        endedAt: signal.occurredAt,
        operationId: signal.operationId,
        errorCode: signal.errorCode,
        details: {
          signalId: signal.signalId,
          signalType: signal.type,
          nearMiss: signal.nearMiss,
          contentHash: signal.contentHash,
        },
      });
    } catch (error) {
      this.recordFailure('telemetry_terminal', operationName, signal.occurredAt, error);
    }
  }

  private async safeSignal(
    operationName: 'capability.read' | 'capability.side_effect',
    signal: AuthorityCapabilitySignal,
  ): Promise<void> {
    if (!this.signals) return;
    try {
      await this.signals.append(cloneSignal(signal));
    } catch (error) {
      this.recordFailure('signal', operationName, signal.occurredAt, error);
    }
  }

  private async emitRepairSignal(
    operationName: 'capability.read' | 'capability.side_effect',
    identity: ReturnType<typeof readIdentity>,
    repair: Pick<AuthorityCapabilitySignal, 'type' | 'operationId' | 'occurredAt' | 'errorCode' | 'details'>,
  ): Promise<void> {
    await this.safeSignal(operationName, buildAuthorityCapabilitySignal({
      type: repair.type,
      outcome: 'repair_required',
      nearMiss: true,
      ...identity,
      operationId: repair.operationId,
      occurredAt: repair.occurredAt,
      errorCode: repair.errorCode,
      details: repair.details,
    }));
  }

  private recordFailure(
    channel: AuthorityCapabilityObserverFailure['channel'],
    operationName: AuthorityCapabilityObserverFailure['operationName'],
    occurredAt: string,
    error: unknown,
  ): void {
    this.failures.push({
      channel,
      operationName,
      occurredAt: canonicalTime(occurredAt, 'observer failure occurredAt'),
      error: errorMessage(error),
    });
    if (this.failures.length > this.maxFailures) {
      this.failures.splice(0, this.failures.length - this.maxFailures);
    }
  }
}

export function buildAuthorityCapabilitySignal(
  input: Omit<AuthorityCapabilitySignal, 'schemaVersion' | 'signalId' | 'contentHash'>,
): AuthorityCapabilitySignal {
  const normalized = {
    ...input,
    projectId: nonEmpty(input.projectId, 'signal projectId'),
    principalId: nonEmpty(input.principalId, 'signal principalId'),
    capability: nonEmpty(input.capability, 'signal capability'),
    resourceUri: nonEmpty(input.resourceUri, 'signal resourceUri'),
    operationId: optional(input.operationId) ?? null,
    correlationId: optional(input.correlationId) ?? null,
    causationId: optional(input.causationId) ?? null,
    occurredAt: canonicalTime(input.occurredAt, 'signal occurredAt'),
    errorCode: optional(input.errorCode) ?? null,
    details: canonicalDetails(input.details),
  };
  const semantic = { schemaVersion: 1 as const, ...normalized };
  const signalId = `capsig_${canonicalHash128(semantic)}`;
  const contentHash = canonicalHash128({ ...semantic, signalId });
  return cloneSignal({ ...semantic, signalId, contentHash });
}

function terminalSignalForSideEffect(
  request: AuthoritySideEffectCapabilityRequest,
  result: AuthoritySideEffectCapabilityResult,
  identity: ReturnType<typeof sideEffectIdentity>,
): AuthorityCapabilitySignal {
  const occurredAt = canonicalTime(
    request.timeline.outcomeAt,
    'side-effect outcomeAt',
  );
  if (result.status === 'reconciliation_required') {
    return buildAuthorityCapabilitySignal({
      type: 'provider_outcome_uncertain',
      outcome: 'uncertain',
      nearMiss: true,
      ...identity,
      operationId: result.operation.operationId,
      occurredAt,
      errorCode: result.providerError?.code ?? 'PROVIDER_OUTCOME_UNCERTAIN',
      details: {
        operationState: result.operation.state,
        effectKnowledge: result.operation.effectKnowledge,
        revision: result.operation.revision,
        fencingToken: result.operation.fencingToken,
      },
    });
  }
  if (result.status === 'resume_required') {
    return buildAuthorityCapabilitySignal({
      type: 'capability_rejected',
      outcome: 'rejected',
      nearMiss: true,
      ...identity,
      operationId: result.operation.operationId,
      occurredAt,
      errorCode: 'CAPABILITY_RESUME_REQUIRED',
      details: {
        operationState: result.operation.state,
        effectKnowledge: result.operation.effectKnowledge,
        revision: result.operation.revision,
      },
    });
  }
  return buildAuthorityCapabilitySignal({
    type: 'capability_completed',
    outcome: 'succeeded',
    nearMiss: false,
    ...identity,
    operationId: result.operation.operationId,
    occurredAt,
    errorCode: null,
    details: {
      status: result.status,
      operationState: result.operation.state,
      effectKnowledge: result.operation.effectKnowledge,
      revision: result.operation.revision,
      resultHash: result.operation.resultHash,
      policyDecisionIds: result.policies.map(item => item.decisionId).sort(),
      leaseReleaseStatus: result.leaseRelease.status,
      agentEvidenceStatus: result.agentEvidence.status,
      capabilityInputHash: result.receipt?.inputHash ?? null,
    },
  });
}

function classifyCapabilityError(error: unknown): {
  type: AuthorityCapabilitySignalType;
  outcome: AuthorityCapabilityOutcome;
  nearMiss: boolean;
  errorCode: string;
  errorClass: string;
} {
  const message = errorMessage(error);
  const errorCode = extractErrorCode(message);
  if (/POLICY_(DENIED|APPROVAL_REQUIRED)|PRINCIPAL_.*DENIED|PROJECT_.*DENIED/i.test(message)) {
    return { type: 'policy_denied', outcome: 'rejected', nearMiss: true, errorCode, errorClass: 'policy' };
  }
  if (/EGRESS_|FILESYSTEM_|AUTHORITY_HTTP_|AUTHORITY_FILE_/i.test(message)) {
    return { type: 'isolation_denied', outcome: 'rejected', nearMiss: true, errorCode, errorClass: 'isolation' };
  }
  if (/STALE_FENCING|STALE_.*TOKEN/i.test(message)) {
    return { type: 'stale_fencing_rejected', outcome: 'rejected', nearMiss: true, errorCode, errorClass: 'fencing' };
  }
  if (/LEASE_.*EXPIRED|EXPIRED_LEASE/i.test(message)) {
    return { type: 'lease_expired', outcome: 'rejected', nearMiss: true, errorCode, errorClass: 'lease_expiry' };
  }
  if (/LEASE_|STALE_RESOURCE_REVISION/i.test(message)) {
    return { type: 'lease_conflict', outcome: 'rejected', nearMiss: true, errorCode, errorClass: 'lease' };
  }
  if (/RECONCILIATION|OUTCOME_UNKNOWN|INCONCLUSIVE/i.test(message)) {
    return { type: 'provider_outcome_uncertain', outcome: 'uncertain', nearMiss: true, errorCode, errorClass: 'provider_uncertainty' };
  }
  return { type: 'capability_failed', outcome: 'failed', nearMiss: false, errorCode, errorClass: 'execution' };
}

function readIdentity(request: AuthorityReadCapabilityRequest) {
  return {
    projectId: request.projectId,
    principalId: request.principal.id,
    capability: request.capability,
    resourceUri: request.resourceUri,
    correlationId: request.context.traceId ?? null,
    causationId: request.context.parentSpanId ?? null,
    startedAt: canonicalTime(request.at, 'read startedAt'),
  };
}

function sideEffectIdentity(request: AuthoritySideEffectCapabilityRequest) {
  return {
    projectId: request.projectId,
    principalId: request.principal.id,
    capability: request.capability,
    resourceUri: request.resourceUri,
    correlationId: request.correlationId,
    causationId: request.causationId ?? null,
    startedAt: canonicalTime(request.timeline.claimAt, 'side-effect startedAt'),
  };
}

function canonicalDetails(details: Record<string, unknown>): Record<string, unknown> {
  canonicalSerialize(details);
  return structuredClone(details);
}

function cloneSignal(signal: AuthorityCapabilitySignal): AuthorityCapabilitySignal {
  const clone = structuredClone(signal);
  canonicalSerialize(clone);
  return clone;
}

function operationIdFromError(error: unknown): string | null {
  const match = /operation(?:=|\s)([A-Za-z0-9_:/.~-]+)/i.exec(errorMessage(error));
  return match?.[1] ?? null;
}

function extractErrorCode(message: string): string {
  const token = message.match(/[A-Z][A-Z0-9_]{2,}/)?.[0];
  return token ?? 'CAPABILITY_ERROR';
}

function optional(value: string | null | undefined): string | undefined {
  const normalized = value?.normalize('NFC').trim();
  return normalized || undefined;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
