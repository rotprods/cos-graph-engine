import { canonicalSerialize } from '@cos/core';
import type {
  AuthorityFencingValidator,
  AuthoritySideEffectRevision,
  AuthoritySideEffectView,
  IAuthoritySideEffectStore,
} from './authority-side-effect';
import {
  AuthoritySideEffectRuntime,
  type ProviderReconciliationResult,
  type ProviderSideEffectReconciler,
  type RecoverInterruptedSideEffectResult,
} from './authority-side-effect-runtime';
import type {
  AuthorityLeaseRevision,
  IAuthorityLeaseStore,
} from './authority-lease';
import {
  assertAuthorityProviderEvidenceBinding,
  sealAuthorityProviderEvidence,
  verifyAuthorityProviderEvidence,
} from './authority-provider-evidence-integrity';

export interface AuthorityObservedOutcomeRecoveryInput {
  operationId: string;
  transitionKeyPrefix: string;
  reconciledAt: string;
  reconciler: ProviderSideEffectReconciler;
  metadata?: Record<string, unknown>;
}

export interface AuthorityHistoricalFenceEvidence {
  resourceUri: string;
  fencingToken: number;
  leaseId: string;
  ownerId: string;
  leaseRevisionId: string;
  acquiredAt: string;
  expiresAt: string;
  executionRecordedAt: string;
  operationRevisionId: string;
}

/**
 * Records provider truth after an operation has entered an explicit uncertain
 * state, even when the original lease has since expired or a newer owner exists.
 *
 * This does not authorize a new external mutation. It proves that the original
 * operation entered `executing` under a historically valid lease/fence,
 * independently verifies provider inspection evidence, binds that evidence to
 * the exact durable operation/provider attempt and only then records the
 * applied/not-applied/partial outcome in append-only operation history.
 */
export class AuthorityObservedOutcomeRecorder {
  constructor(
    private readonly operations: IAuthoritySideEffectStore,
    private readonly leases: IAuthorityLeaseStore,
  ) {}

  async recover(
    input: AuthorityObservedOutcomeRecoveryInput,
  ): Promise<RecoverInterruptedSideEffectResult> {
    const operationId = nonEmpty(input.operationId, 'operationId');
    const transitionKeyPrefix = nonEmpty(input.transitionKeyPrefix, 'transitionKeyPrefix');
    const reconciledAt = canonicalTime(input.reconciledAt, 'reconciledAt');
    const operationHistory = await this.operations.getHistory(operationId);
    const current = operationHistory.at(-1);
    if (!current) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    assertReconcilable(current);
    if (Date.parse(reconciledAt) <= Date.parse(current.recordedAt)) {
      throw new Error('reconciledAt must be strictly later than the uncertain revision');
    }

    const execution = findExecutionRevision(operationHistory, current);
    const historicalFence = await this.proveHistoricalFence(current, execution);
    const validator = historicalFenceValidator(current, historicalFence);
    const reconciler = evidenceBoundReconciler(input.reconciler, historicalFence);
    const runtime = new AuthoritySideEffectRuntime(this.operations, validator);

    return runtime.recoverInterrupted({
      operationId,
      transitionKeyPrefix,
      interruptedAt: current.recordedAt,
      reconciledAt,
      reconciler,
      metadata: canonicalClone(input.metadata ?? {}, 'recovery metadata') as Record<string, unknown>,
    });
  }

  private async proveHistoricalFence(
    current: AuthoritySideEffectRevision,
    execution: AuthoritySideEffectRevision,
  ): Promise<AuthorityHistoricalFenceEvidence> {
    if (current.fencingToken === null) {
      throw new Error(`SIDE_EFFECT_FENCING_MISSING operation=${current.operationId}`);
    }
    const history = await this.leases.getHistory(current.resourceUri);
    const executionTime = Date.parse(execution.recordedAt);
    const lease = history
      .filter(candidate => candidate.fencingToken === current.fencingToken)
      .filter(candidate => candidate.state === 'active')
      .filter(candidate => Date.parse(candidate.acquiredAt) <= executionTime)
      .filter(candidate => executionTime < Date.parse(candidate.expiresAt))
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
    if (!lease) {
      throw new Error(
        `SIDE_EFFECT_ORIGINAL_FENCE_NOT_PROVEN operation=${current.operationId} token=${current.fencingToken}`,
      );
    }
    return {
      resourceUri: current.resourceUri,
      fencingToken: current.fencingToken,
      leaseId: lease.leaseId,
      ownerId: lease.ownerId,
      leaseRevisionId: lease.revisionId,
      acquiredAt: lease.acquiredAt,
      expiresAt: lease.expiresAt,
      executionRecordedAt: execution.recordedAt,
      operationRevisionId: execution.revisionId,
    };
  }
}

function evidenceBoundReconciler(
  delegate: ProviderSideEffectReconciler,
  historicalFence: AuthorityHistoricalFenceEvidence,
): ProviderSideEffectReconciler {
  return {
    async inspect(operation: AuthoritySideEffectView): Promise<ProviderReconciliationResult> {
      const outcome = await delegate.inspect(structuredClone(operation));
      const verified = verifyAuthorityProviderEvidence(
        canonicalClone(outcome.evidence, 'provider reconciliation evidence') as Record<string, unknown>,
      );
      const providerIdempotencyKey = nonEmpty(
        operation.providerIdempotencyKey ?? '',
        'operation providerIdempotencyKey',
      );
      assertAuthorityProviderEvidenceBinding(verified.evidence, {
        operationId: operation.operationId,
        providerIdempotencyKey,
        fencingToken: historicalFence.fencingToken,
        ...(verified.sealingMode === 'canonical-v2'
          ? {
              projectId: operation.projectId,
              capability: operation.capability,
              resourceUri: operation.resourceUri,
              operationContentHash: operation.contentHash,
            }
          : {}),
      });

      const combined = {
        providerEvidence: verified.evidence,
        providerEvidenceVerification: {
          sealingMode: verified.sealingMode,
          originalEvidenceHash: verified.originalEvidenceHash,
        },
        historicalFence: structuredClone(historicalFence),
      };
      const evidence = sealAuthorityProviderEvidence(combined);
      return { ...outcome, evidence } as ProviderReconciliationResult;
    },
  };
}

function historicalFenceValidator(
  operation: AuthoritySideEffectRevision,
  evidence: AuthorityHistoricalFenceEvidence,
): AuthorityFencingValidator {
  return {
    async assertCurrent(resourceUri: string, fencingToken: number): Promise<void> {
      if (resourceUri !== operation.resourceUri || resourceUri !== evidence.resourceUri) {
        throw new Error(`SIDE_EFFECT_HISTORICAL_FENCE_RESOURCE_MISMATCH resource=${resourceUri}`);
      }
      if (fencingToken !== operation.fencingToken || fencingToken !== evidence.fencingToken) {
        throw new Error(
          `SIDE_EFFECT_HISTORICAL_FENCE_TOKEN_MISMATCH expected=${evidence.fencingToken} actual=${fencingToken}`,
        );
      }
    },
  };
}

function findExecutionRevision(
  history: AuthoritySideEffectRevision[],
  current: AuthoritySideEffectRevision,
): AuthoritySideEffectRevision {
  const execution = [...history].reverse().find(candidate =>
    candidate.state === 'executing'
    && candidate.attempt === current.attempt
    && candidate.fencingToken === current.fencingToken,
  );
  if (!execution) {
    throw new Error(`SIDE_EFFECT_EXECUTION_REVISION_NOT_FOUND operation=${current.operationId}`);
  }
  return execution;
}

function assertReconcilable(operation: AuthoritySideEffectRevision): void {
  if (operation.state !== 'reconciliation_required'
    || operation.effectKnowledge !== 'unknown') {
    throw new Error(
      `SIDE_EFFECT_OBSERVED_RECOVERY_STATE_INVALID operation=${operation.operationId} state=${operation.state} knowledge=${operation.effectKnowledge}`,
    );
  }
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
