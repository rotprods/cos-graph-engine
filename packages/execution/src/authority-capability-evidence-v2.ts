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

export type AuthorityCapabilitySignalTypeV2 =
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

export type AuthorityCapabilityOutcomeV2 =
  | 'succeeded'
  | 'rejected'
  | 'failed'
  | 'uncertain'
  | 'repair_required';

export interface AuthorityCapabilitySignalV2 {
  schemaVersion: 2;
  signalId: string;
  type: AuthorityCapabilitySignalTypeV2;
  outcome: AuthorityCapabilityOutcomeV2;
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

export interface IAuthorityCapabilitySignalSinkV2 {
  append(signal: AuthorityCapabilitySignalV2): Promise<void> | void;
}

export interface AuthorityCapabilityTelemetryStartV2 {
  operationName: 'capability.read' | 'capability.side_effect';
  projectId: string;
  principalId: string;
  capability: string;
  resourceUri: string;
  correlationId: string | null;
  causationId: string | null;
  startedAt: string;
}

export interface AuthorityCapabilityTelemetryTerminalV2 {
  outcome: AuthorityCapabilityOutcomeV2;
  endedAt: string;
  operationId: string | null;
  errorCode: string | null;
  details: Record<string, unknown>;
}

export interface IAuthorityCapabilityTelemetryV2 {
  start(input: AuthorityCapabilityTelemetryStartV2): unknown;
  terminal(
    token: unknown,
    terminal: AuthorityCapabilityTelemetryTerminalV2,
  ): Promise<void> | void;
}

export interface AuthorityCapabilityRuntimePortV2 {
  executeRead(request: AuthorityReadCapabilityRequest): Promise<AuthorityReadCapabilityResult>;
  executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult>;
}

export interface AuthorityCapabilityObserverFailureV2 {
  channel: 'signal_build' | 'signal' | 'telemetry_start' | 'telemetry_terminal';
  operationName: 'capability.read' | 'capability.side_effect';
  occurredAt: string;
  error: string;
}

interface OperationIdentity {
  projectId: string;
  principalId: string;
  capability: string;
  resourceUri: string;
  correlationId: string | null;
  causationId: string | null;
  startedAt: string;
}

interface TerminalObservation {
  outcome: AuthorityCapabilityOutcomeV2;
  operationId: string | null;
  occurredAt: string;
  errorCode: string | null;
  signal: AuthorityCapabilitySignalV2 | null;
}

/**
 * Failure-isolated observer around the canonical capability facade.
 *
 * The protected runtime call and the evidence path are separate failure domains.
 * No signal-building, sink or telemetry failure can replace an accepted result
 * or the original rejection/error thrown by the protected runtime.
 */
export class ObservedAuthorityCapabilityRuntimeV2 {
  private readonly failures: AuthorityCapabilityObserverFailureV2[] = [];

  constructor(
    private readonly runtime: AuthorityCapabilityRuntimePortV2,
    private readonly signals?: IAuthorityCapabilitySignalSinkV2,
    private readonly telemetry?: IAuthorityCapabilityTelemetryV2,
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
    let result: AuthorityReadCapabilityResult;
    try {
      result = await this.runtime.executeRead(request);
    } catch (protectedError) {
      const classified = classifyCapabilityErrorV2(protectedError);
      const observation = this.safeBuildTerminal('capability.read', identity, {
        type: classified.type,
        outcome: classified.outcome,
        nearMiss: classified.nearMiss,
        operationId: null,
        occurredAt: canonicalTime(request.at, 'read occurredAt'),
        errorCode: classified.errorCode,
        details: { errorClass: classified.errorClass },
      });
      await this.safePublishTerminal('capability.read', token, observation);
      throw protectedError;
    }

    const observation = this.safeBuildTerminal('capability.read', identity, {
      type: 'capability_completed',
      outcome: 'succeeded',
      nearMiss: false,
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
    await this.safePublishTerminal('capability.read', token, observation);
    if (result.agentEvidence.status === 'pending_repair') {
      await this.safePublishRepair('capability.read', identity, {
        type: 'agent_evidence_repair_required',
        operationId: null,
        occurredAt: canonicalTime(request.at, 'read occurredAt'),
        errorCode: 'AGENT_EVIDENCE_REPAIR_REQUIRED',
        details: { error: result.agentEvidence.error ?? 'unknown' },
      });
    }
    return result;
  }

  async executeSideEffect(
    request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult> {
    const identity = sideEffectIdentity(request);
    const token = this.safeTelemetryStart('capability.side_effect', identity);
    let result: AuthoritySideEffectCapabilityResult;
    try {
      result = await this.runtime.executeSideEffect(request);
    } catch (protectedError) {
      const classified = classifyCapabilityErrorV2(protectedError);
      const observation = this.safeBuildTerminal('capability.side_effect', identity, {
        type: classified.type,
        outcome: classified.outcome,
        nearMiss: classified.nearMiss,
        operationId: operationIdFromError(protectedError),
        occurredAt: canonicalTime(request.timeline.outcomeAt, 'side-effect outcomeAt'),
        errorCode: classified.errorCode,
        details: { errorClass: classified.errorClass },
      });
      await this.safePublishTerminal('capability.side_effect', token, observation);
      throw protectedError;
    }

    const terminalInput = terminalInputForSideEffect(request, result);
    const observation = this.safeBuildTerminal(
      'capability.side_effect',
      identity,
      terminalInput,
    );
    await this.safePublishTerminal('capability.side_effect', token, observation);

    if (result.agentEvidence.status === 'pending_repair') {
      await this.safePublishRepair('capability.side_effect', identity, {
        type: 'agent_evidence_repair_required',
        operationId: result.operation.operationId,
        occurredAt: canonicalTime(request.timeline.outcomeAt, 'side-effect outcomeAt'),
        errorCode: 'AGENT_EVIDENCE_REPAIR_REQUIRED',
        details: { error: result.agentEvidence.error ?? 'unknown' },
      });
    }
    if (result.leaseRelease.status === 'release_failed') {
      await this.safePublishRepair('capability.side_effect', identity, {
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
  }

  getObserverFailures(limit = 100): AuthorityCapabilityObserverFailureV2[] {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('observer failure limit must be a non-negative safe integer');
    }
    return this.failures.slice(-Math.min(limit, this.maxFailures)).map(item => ({ ...item }));
  }

  private safeBuildTerminal(
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    identity: OperationIdentity,
    input: {
      type: AuthorityCapabilitySignalTypeV2;
      outcome: AuthorityCapabilityOutcomeV2;
      nearMiss: boolean;
      operationId: string | null;
      occurredAt: string;
      errorCode: string | null;
      details: Record<string, unknown>;
    },
  ): TerminalObservation {
    try {
      const signal = buildAuthorityCapabilitySignalV2({
        type: input.type,
        outcome: input.outcome,
        nearMiss: input.nearMiss,
        projectId: identity.projectId,
        principalId: identity.principalId,
        capability: identity.capability,
        resourceUri: identity.resourceUri,
        operationId: input.operationId,
        correlationId: identity.correlationId,
        causationId: identity.causationId,
        occurredAt: input.occurredAt,
        errorCode: input.errorCode,
        details: input.details,
      });
      return {
        outcome: input.outcome,
        operationId: input.operationId,
        occurredAt: signal.occurredAt,
        errorCode: input.errorCode,
        signal,
      };
    } catch (error) {
      this.recordFailure('signal_build', operationName, input.occurredAt, error);
      return {
        outcome: input.outcome,
        operationId: input.operationId,
        occurredAt: safeCanonicalTime(input.occurredAt),
        errorCode: input.errorCode,
        signal: null,
      };
    }
  }

  private async safePublishTerminal(
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    token: unknown,
    observation: TerminalObservation,
  ): Promise<void> {
    if (observation.signal) await this.safeSignal(operationName, observation.signal);
    await this.safeTelemetryTerminal(operationName, token, observation);
  }

  private async safePublishRepair(
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    identity: OperationIdentity,
    repair: {
      type: AuthorityCapabilitySignalTypeV2;
      operationId: string | null;
      occurredAt: string;
      errorCode: string;
      details: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const signal = buildAuthorityCapabilitySignalV2({
        type: repair.type,
        outcome: 'repair_required',
        nearMiss: true,
        projectId: identity.projectId,
        principalId: identity.principalId,
        capability: identity.capability,
        resourceUri: identity.resourceUri,
        operationId: repair.operationId,
        correlationId: identity.correlationId,
        causationId: identity.causationId,
        occurredAt: repair.occurredAt,
        errorCode: repair.errorCode,
        details: repair.details,
      });
      await this.safeSignal(operationName, signal);
    } catch (error) {
      this.recordFailure('signal_build', operationName, repair.occurredAt, error);
    }
  }

  private safeTelemetryStart(
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    identity: OperationIdentity,
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
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    token: unknown,
    observation: TerminalObservation,
  ): Promise<void> {
    if (!this.telemetry) return;
    try {
      await this.telemetry.terminal(token, {
        outcome: observation.outcome,
        endedAt: observation.occurredAt,
        operationId: observation.operationId,
        errorCode: observation.errorCode,
        details: observation.signal
          ? {
              signalId: observation.signal.signalId,
              signalType: observation.signal.type,
              nearMiss: observation.signal.nearMiss,
              contentHash: observation.signal.contentHash,
            }
          : { observationBuildFailed: true },
      });
    } catch (error) {
      this.recordFailure('telemetry_terminal', operationName, observation.occurredAt, error);
    }
  }

  private async safeSignal(
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    signal: AuthorityCapabilitySignalV2,
  ): Promise<void> {
    if (!this.signals) return;
    try {
      await this.signals.append(cloneSignal(signal));
    } catch (error) {
      this.recordFailure('signal', operationName, signal.occurredAt, error);
    }
  }

  private recordFailure(
    channel: AuthorityCapabilityObserverFailureV2['channel'],
    operationName: AuthorityCapabilityObserverFailureV2['operationName'],
    occurredAt: string,
    error: unknown,
  ): void {
    this.failures.push({
      channel,
      operationName,
      occurredAt: safeCanonicalTime(occurredAt),
      error: errorMessage(error),
    });
    if (this.failures.length > this.maxFailures) {
      this.failures.splice(0, this.failures.length - this.maxFailures);
    }
  }
}

export function buildAuthorityCapabilitySignalV2(
  input: Omit<AuthorityCapabilitySignalV2, 'schemaVersion' | 'signalId' | 'contentHash'>,
): AuthorityCapabilitySignalV2 {
  const semantic = {
    schemaVersion: 2 as const,
    type: input.type,
    outcome: input.outcome,
    nearMiss: Boolean(input.nearMiss),
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
  const signalId = `capsig2_${canonicalHash128(semantic)}`;
  const contentHash = canonicalHash128({ ...semantic, signalId });
  return cloneSignal({ ...semantic, signalId, contentHash });
}

export function classifyCapabilityErrorV2(error: unknown): {
  type: AuthorityCapabilitySignalTypeV2;
  outcome: AuthorityCapabilityOutcomeV2;
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

function terminalInputForSideEffect(
  request: AuthoritySideEffectCapabilityRequest,
  result: AuthoritySideEffectCapabilityResult,
) {
  const occurredAt = canonicalTime(request.timeline.outcomeAt, 'side-effect outcomeAt');
  if (result.status === 'reconciliation_required') {
    return {
      type: 'provider_outcome_uncertain' as const,
      outcome: 'uncertain' as const,
      nearMiss: true,
      operationId: result.operation.operationId,
      occurredAt,
      errorCode: result.providerError?.code ?? 'PROVIDER_OUTCOME_UNCERTAIN',
      details: {
        operationState: result.operation.state,
        effectKnowledge: result.operation.effectKnowledge,
        revision: result.operation.revision,
        fencingToken: result.operation.fencingToken,
      },
    };
  }
  if (result.status === 'resume_required') {
    return {
      type: 'capability_rejected' as const,
      outcome: 'rejected' as const,
      nearMiss: true,
      operationId: result.operation.operationId,
      occurredAt,
      errorCode: 'CAPABILITY_RESUME_REQUIRED',
      details: {
        operationState: result.operation.state,
        effectKnowledge: result.operation.effectKnowledge,
        revision: result.operation.revision,
      },
    };
  }
  return {
    type: 'capability_completed' as const,
    outcome: 'succeeded' as const,
    nearMiss: false,
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
  };
}

function readIdentity(request: AuthorityReadCapabilityRequest): OperationIdentity {
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

function sideEffectIdentity(request: AuthoritySideEffectCapabilityRequest): OperationIdentity {
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

function cloneSignal(signal: AuthorityCapabilitySignalV2): AuthorityCapabilitySignalV2 {
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

function safeCanonicalTime(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '1970-01-01T00:00:00.000Z';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
