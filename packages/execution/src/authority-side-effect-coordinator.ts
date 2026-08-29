import type {
  AuthorityCompensationCompleteInput,
  AuthorityFencingValidator,
  AuthorityOperationError,
  AuthorityPrepareInput,
  AuthoritySideEffectAppendResult,
  AuthoritySideEffectClaimInput,
  AuthoritySideEffectService,
  AuthoritySideEffectTransitionBase,
  AuthoritySideEffectView,
} from './authority-side-effect';

export type AuthorityProviderReconciliationOutcome =
  | {
      status: 'applied';
      result: unknown;
      evidence: Record<string, unknown>;
    }
  | {
      status: 'not_applied';
      nextFencingToken: number;
      nextProviderIdempotencyKey: string;
      evidence: Record<string, unknown>;
    }
  | {
      status: 'partial';
      error: AuthorityOperationError;
      compensationCapability: string;
      compensationResourceUri?: string;
      compensationInput: unknown;
      evidence: Record<string, unknown>;
    };

export interface AuthorityProviderReconciler {
  inspect(operation: AuthoritySideEffectView): Promise<AuthorityProviderReconciliationOutcome>;
}

export interface AuthorityCrashRecoveryInput {
  operationId: string;
  transitionKeyPrefix: string;
  recordedAt: string;
  reconciler: AuthorityProviderReconciler;
  crashError?: AuthorityOperationError;
  metadata?: Record<string, unknown>;
}

export interface AuthorityCrashRecoveryResult {
  operation: AuthoritySideEffectView;
  disposition: 'already_terminal' | 'committed' | 'prepared_for_retry' | 'compensation_required';
  providerEvidence: Record<string, unknown> | null;
}

/**
 * Canonical orchestration facade over the append-only side-effect ledger.
 *
 * AuthoritySideEffectService owns immutable revision semantics. This coordinator
 * owns crash-window recovery and deliberately does not expose a bare
 * `reconcile(partial)` call: partial provider application must include a concrete
 * compensation plan before the ledger enters compensation_required.
 */
export class AuthoritySideEffectCoordinator {
  constructor(private readonly service: AuthoritySideEffectService) {}

  claim(input: AuthoritySideEffectClaimInput): Promise<AuthoritySideEffectAppendResult> {
    return this.service.claim(input);
  }

  prepare(input: AuthorityPrepareInput): Promise<AuthoritySideEffectAppendResult> {
    return this.service.prepare(input);
  }

  beginExecution(input: AuthoritySideEffectTransitionBase): Promise<AuthoritySideEffectAppendResult> {
    return this.service.beginExecution(input);
  }

  commit(input: Parameters<AuthoritySideEffectService['commit']>[0]): Promise<AuthoritySideEffectAppendResult> {
    return this.service.commit(input);
  }

  failBeforeExternalEffect(
    input: Parameters<AuthoritySideEffectService['failWithoutEffect']>[0],
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.service.failWithoutEffect(input);
  }

  beginCompensation(
    input: AuthoritySideEffectTransitionBase,
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.service.beginCompensation(input);
  }

  completeCompensation(
    input: AuthorityCompensationCompleteInput,
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.service.completeCompensation(input);
  }

  get(operationId: string): Promise<AuthoritySideEffectView | null> {
    return this.service.get(operationId);
  }

  history(operationId: string): Promise<AuthoritySideEffectView[]> {
    return this.service.history(operationId);
  }

  /**
   * Reconciles an interrupted external effect before any retry is prepared.
   *
   * - executing is first converted into explicit reconciliation_required;
   * - applied commits the observed provider result;
   * - not_applied prepares a new monotonically fenced attempt;
   * - partial requires a content-addressed compensation plan.
   */
  async recoverAfterCrash(input: AuthorityCrashRecoveryInput): Promise<AuthorityCrashRecoveryResult> {
    let current = await this.requireOperation(input.operationId);
    if (current.terminal) {
      return {
        operation: current,
        disposition: 'already_terminal',
        providerEvidence: null,
      };
    }

    if (current.state === 'executing') {
      const crash = input.crashError ?? {
        code: 'SIDE_EFFECT_WORKER_INTERRUPTED',
        message: 'Worker stopped after execution began and before an accepted terminal outcome was recorded',
        retryable: true,
        details: {},
      };
      const marked = await this.service.markReconciliationRequired({
        operationId: current.operationId,
        expectedRevision: current.revision,
        transitionKey: `${input.transitionKeyPrefix}:reconciliation-required`,
        recordedAt: input.recordedAt,
        reason: crash,
        metadata: input.metadata,
      });
      current = await this.requireOperation(marked.revision.operationId);
    }

    if (current.state !== 'reconciliation_required') {
      throw new Error(
        `SIDE_EFFECT_RECOVERY_INVALID_STATE operation=${current.operationId} state=${current.state}`,
      );
    }

    const observation = await input.reconciler.inspect(current);
    if (observation.status === 'applied') {
      const committed = await this.service.commit({
        operationId: current.operationId,
        expectedRevision: current.revision,
        transitionKey: `${input.transitionKeyPrefix}:provider-applied`,
        recordedAt: input.recordedAt,
        metadata: {
          ...input.metadata,
          providerReconciliation: observation.evidence,
        },
        result: observation.result,
      });
      return {
        operation: await this.requireOperation(committed.revision.operationId),
        disposition: 'committed',
        providerEvidence: structuredClone(observation.evidence),
      };
    }

    if (observation.status === 'not_applied') {
      const prepared = await this.service.reconcile({
        operationId: current.operationId,
        expectedRevision: current.revision,
        transitionKey: `${input.transitionKeyPrefix}:provider-not-applied`,
        recordedAt: input.recordedAt,
        metadata: {
          ...input.metadata,
          providerReconciliation: observation.evidence,
        },
        outcome: 'not_applied',
        nextFencingToken: observation.nextFencingToken,
        nextProviderIdempotencyKey: observation.nextProviderIdempotencyKey,
      });
      return {
        operation: await this.requireOperation(prepared.revision.operationId),
        disposition: 'prepared_for_retry',
        providerEvidence: structuredClone(observation.evidence),
      };
    }

    const compensation = await this.service.requireCompensation({
      operationId: current.operationId,
      expectedRevision: current.revision,
      transitionKey: `${input.transitionKeyPrefix}:provider-partial`,
      recordedAt: input.recordedAt,
      metadata: {
        ...input.metadata,
        providerReconciliation: observation.evidence,
      },
      compensationCapability: observation.compensationCapability,
      compensationResourceUri: observation.compensationResourceUri,
      compensationInput: observation.compensationInput,
      error: observation.error,
    });
    return {
      operation: await this.requireOperation(compensation.revision.operationId),
      disposition: 'compensation_required',
      providerEvidence: structuredClone(observation.evidence),
    };
  }

  private async requireOperation(operationId: string): Promise<AuthoritySideEffectView> {
    const operation = await this.service.get(operationId);
    if (!operation) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    return operation;
  }
}

/**
 * Reference fencing authority for tests/single-process shadow mode.
 * Durable deployments must bind this interface to the resource-owning store.
 */
export class InMemoryAuthorityFencingValidator implements AuthorityFencingValidator {
  private readonly currentTokens = new Map<string, number>();

  setCurrent(resourceUri: string, token: number): void {
    const resource = normalizeResource(resourceUri);
    const normalized = positiveToken(token);
    const previous = this.currentTokens.get(resource);
    if (previous !== undefined && normalized < previous) {
      throw new Error(`FENCING_TOKEN_REGRESSION resource=${resource} previous=${previous} incoming=${normalized}`);
    }
    this.currentTokens.set(resource, normalized);
  }

  async assertCurrent(resourceUri: string, fencingToken: number): Promise<void> {
    const resource = normalizeResource(resourceUri);
    const token = positiveToken(fencingToken);
    const current = this.currentTokens.get(resource);
    if (current !== token) {
      throw new Error(
        `STALE_FENCING_TOKEN resource=${resource} expected=${String(current)} actual=${token}`,
      );
    }
  }
}

function normalizeResource(value: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error('resourceUri must not be empty');
  return normalized;
}

function positiveToken(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('fencingToken must be a positive safe integer');
  }
  return value;
}
