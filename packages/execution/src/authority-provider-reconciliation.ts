import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  ProviderReconciliationResult,
  ProviderSideEffectReconciler,
} from './authority-side-effect-runtime';
import type {
  AuthorityOperationError,
  AuthoritySideEffectView,
} from './authority-side-effect';

export type AuthorityProviderTarget =
  | {
      kind: 'http';
      canonicalUrl: string;
      hostname: string;
      method: string;
      targetDecisionHash: string;
    }
  | {
      kind: 'filesystem';
      canonicalTargetUri: string;
      operation: string;
      targetDecisionHash: string;
      handleHash: string;
    };

export interface AuthorityProviderInspectionRequest {
  operationId: string;
  projectId: string;
  capability: string;
  resourceUri: string;
  providerIdempotencyKey: string;
  fencingToken: number;
  inspectedAt: string;
  target: AuthorityProviderTarget;
  input: unknown;
  operationContentHash: string;
}

export type AuthorityProviderInspectionOutcome =
  | {
      status: 'applied';
      result: unknown;
      evidence: Record<string, unknown>;
    }
  | {
      status: 'not_applied';
      /** The provider/resource supplied authoritative absence evidence. */
      authoritativeAbsence: true;
      evidence: Record<string, unknown>;
    }
  | {
      status: 'partial';
      error: AuthorityOperationError;
      compensationCapability: string;
      compensationResourceUri?: string;
      compensationInput: unknown;
      evidence: Record<string, unknown>;
    }
  | {
      status: 'unknown';
      reason: string;
      evidence: Record<string, unknown>;
    };

/**
 * Provider-specific read-only inspection port. Implementations inspect by
 * provider idempotency/resource identity and must not repeat the original
 * mutation while reconciling.
 */
export interface AuthorityProviderInspectionPort {
  readonly inspectorId: string;
  readonly inspectorVersion: string;
  inspect(request: AuthorityProviderInspectionRequest): Promise<AuthorityProviderInspectionOutcome>;
}

export interface AuthorityProviderRetryPlanRequest {
  operationId: string;
  projectId: string;
  capability: string;
  resourceUri: string;
  previousFencingToken: number;
  previousProviderIdempotencyKey: string;
  inspectedAt: string;
  inspectionEvidence: Record<string, unknown>;
}

/**
 * Acquires the next resource fence and provider attempt identity only after
 * authoritative absence has been proven. It is not called for unknown outcomes.
 */
export interface AuthorityProviderRetryPlanner {
  planRetry(request: AuthorityProviderRetryPlanRequest): Promise<{
    nextFencingToken: number;
    nextProviderIdempotencyKey: string;
    evidence: Record<string, unknown>;
  }>;
}

export interface AuthorityProviderReconcilerOptions {
  inspectedAt: string;
  inspection: AuthorityProviderInspectionPort;
  retryPlanner?: AuthorityProviderRetryPlanner;
}

/**
 * Adapts provider-native inspection into the side-effect recovery protocol.
 *
 * Unknown evidence throws and leaves the operation in reconciliation_required.
 * `not_applied` is accepted only with explicit authoritative-absence evidence
 * and a new monotonic fence/provider attempt identity. No branch executes the
 * original provider mutation.
 */
export class AuthorityProviderReconciler implements ProviderSideEffectReconciler {
  private readonly inspectedAt: string;

  constructor(private readonly options: AuthorityProviderReconcilerOptions) {
    this.inspectedAt = canonicalTime(options.inspectedAt, 'provider inspectedAt');
    nonEmpty(options.inspection.inspectorId, 'inspectorId');
    nonEmpty(options.inspection.inspectorVersion, 'inspectorVersion');
  }

  async inspect(operation: AuthoritySideEffectView): Promise<ProviderReconciliationResult> {
    assertReconcilable(operation);
    const providerIdempotencyKey = nonEmpty(
      operation.providerIdempotencyKey ?? '',
      'operation providerIdempotencyKey',
    );
    const fencingToken = positiveSafeInteger(
      operation.fencingToken,
      'operation fencingToken',
    );
    const target = extractProviderTarget(operation.input, providerIdempotencyKey);
    const request: AuthorityProviderInspectionRequest = {
      operationId: operation.operationId,
      projectId: operation.projectId,
      capability: operation.capability,
      resourceUri: operation.resourceUri,
      providerIdempotencyKey,
      fencingToken,
      inspectedAt: this.inspectedAt,
      target,
      input: canonicalClone(operation.input, 'provider inspection input'),
      operationContentHash: operation.contentHash,
    };
    const outcome = await this.options.inspection.inspect(canonicalClone(request, 'provider inspection request'));
    const baseEvidence = sealEvidence({
      inspectorId: this.options.inspection.inspectorId,
      inspectorVersion: this.options.inspection.inspectorVersion,
      inspectedAt: this.inspectedAt,
      operationId: operation.operationId,
      providerIdempotencyKey,
      fencingToken,
      target,
      providerEvidence: outcome.evidence,
    });

    if (outcome.status === 'applied') {
      return {
        status: 'applied',
        result: canonicalClone(outcome.result, 'provider applied result'),
        evidence: baseEvidence,
      };
    }

    if (outcome.status === 'partial') {
      return {
        status: 'partial',
        error: normalizeOperationError(outcome.error),
        compensationCapability: nonEmpty(
          outcome.compensationCapability,
          'compensationCapability',
        ),
        ...(optional(outcome.compensationResourceUri) === undefined
          ? {}
          : { compensationResourceUri: optional(outcome.compensationResourceUri) }),
        compensationInput: canonicalClone(
          outcome.compensationInput,
          'compensation input',
        ),
        evidence: baseEvidence,
      };
    }

    if (outcome.status === 'unknown') {
      const reason = nonEmpty(outcome.reason, 'provider unknown reason');
      throw new Error(
        `PROVIDER_RECONCILIATION_INCONCLUSIVE operation=${operation.operationId} reason=${reason} evidenceHash=${String(baseEvidence.evidenceHash)}`,
      );
    }

    if (outcome.authoritativeAbsence !== true) {
      throw new Error(
        `PROVIDER_ABSENCE_EVIDENCE_REQUIRED operation=${operation.operationId}`,
      );
    }
    if (!this.options.retryPlanner) {
      throw new Error(
        `PROVIDER_RETRY_PLANNER_REQUIRED operation=${operation.operationId}`,
      );
    }
    const plan = await this.options.retryPlanner.planRetry({
      operationId: operation.operationId,
      projectId: operation.projectId,
      capability: operation.capability,
      resourceUri: operation.resourceUri,
      previousFencingToken: fencingToken,
      previousProviderIdempotencyKey: providerIdempotencyKey,
      inspectedAt: this.inspectedAt,
      inspectionEvidence: baseEvidence,
    });
    const nextFencingToken = positiveSafeInteger(
      plan.nextFencingToken,
      'next fencingToken',
    );
    if (nextFencingToken <= fencingToken) {
      throw new Error(
        `PROVIDER_RETRY_FENCE_NOT_MONOTONIC previous=${fencingToken} next=${nextFencingToken}`,
      );
    }
    const nextProviderIdempotencyKey = nonEmpty(
      plan.nextProviderIdempotencyKey,
      'nextProviderIdempotencyKey',
    );
    if (nextProviderIdempotencyKey === providerIdempotencyKey) {
      throw new Error('PROVIDER_RETRY_IDEMPOTENCY_KEY_MUST_ROTATE');
    }
    const retryEvidence = sealEvidence({
      ...baseEvidence,
      retryPlannerEvidence: plan.evidence,
      nextFencingToken,
      nextProviderIdempotencyKey,
    });
    return {
      status: 'not_applied',
      nextFencingToken,
      nextProviderIdempotencyKey,
      evidence: retryEvidence,
    };
  }
}

function assertReconcilable(operation: AuthoritySideEffectView): void {
  if (operation.state !== 'reconciliation_required') {
    throw new Error(
      `PROVIDER_RECONCILIATION_STATE_INVALID operation=${operation.operationId} state=${operation.state}`,
    );
  }
  if (operation.effectKnowledge !== 'unknown') {
    throw new Error(
      `PROVIDER_RECONCILIATION_KNOWLEDGE_INVALID operation=${operation.operationId} knowledge=${operation.effectKnowledge}`,
    );
  }
  if (operation.terminal) {
    throw new Error(`PROVIDER_RECONCILIATION_TERMINAL_OPERATION id=${operation.operationId}`);
  }
}

function extractProviderTarget(
  input: unknown,
  providerIdempotencyKey: string,
): AuthorityProviderTarget {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('PROVIDER_RECONCILIATION_INPUT_INVALID');
  }
  const record = input as Record<string, unknown>;
  if (record.providerIdempotencyKey !== providerIdempotencyKey) {
    throw new Error('PROVIDER_RECONCILIATION_IDEMPOTENCY_MISMATCH');
  }
  const target = record.target;
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error('PROVIDER_RECONCILIATION_TARGET_REQUIRED');
  }
  const value = target as Record<string, unknown>;
  const targetDecisionHash = nonEmpty(
    String(value.decisionHash ?? ''),
    'target decisionHash',
  );

  if (typeof value.canonicalUrl === 'string'
    && typeof value.hostname === 'string'
    && typeof value.method === 'string') {
    return {
      kind: 'http',
      canonicalUrl: nonEmpty(value.canonicalUrl, 'target canonicalUrl'),
      hostname: nonEmpty(value.hostname, 'target hostname'),
      method: nonEmpty(value.method, 'target method'),
      targetDecisionHash,
    };
  }

  if (typeof value.canonicalTargetUri === 'string'
    && typeof value.operation === 'string'
    && typeof value.handleHash === 'string') {
    return {
      kind: 'filesystem',
      canonicalTargetUri: nonEmpty(
        value.canonicalTargetUri,
        'target canonicalTargetUri',
      ),
      operation: nonEmpty(value.operation, 'target operation'),
      targetDecisionHash,
      handleHash: nonEmpty(value.handleHash, 'target handleHash'),
    };
  }

  throw new Error('PROVIDER_RECONCILIATION_TARGET_UNSUPPORTED');
}

function sealEvidence(value: Record<string, unknown>): Record<string, unknown> {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  return {
    ...canonical,
    evidenceHash: canonicalHash128(canonical),
  };
}

function normalizeOperationError(error: AuthorityOperationError): AuthorityOperationError {
  return {
    code: nonEmpty(error.code, 'operation error code'),
    message: nonEmpty(error.message, 'operation error message'),
    retryable: Boolean(error.retryable),
    details: canonicalClone(error.details ?? {}, 'operation error details'),
  };
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function positiveSafeInteger(value: number | null, label: string): number {
  if (!Number.isSafeInteger(value) || value === null || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
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
