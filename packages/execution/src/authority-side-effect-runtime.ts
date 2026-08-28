import type {
  AuthorityFencingValidator,
  AuthorityOperationError,
  AuthorityPrepareInput,
  AuthoritySideEffectAppendResult,
  AuthoritySideEffectClaimInput,
  AuthoritySideEffectTransitionBase,
  AuthoritySideEffectView,
  IAuthoritySideEffectStore,
} from './authority-side-effect';
import { AuthoritySideEffectService } from './authority-side-effect';

export type ProviderReconciliationResult =
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

export interface ProviderSideEffectReconciler {
  inspect(operation: AuthoritySideEffectView): Promise<ProviderReconciliationResult>;
}

export interface RecoverInterruptedSideEffectInput {
  operationId: string;
  transitionKeyPrefix: string;
  /** Time at which interruption/uncertainty is durably recorded. */
  interruptedAt: string;
  /** Later time at which provider/resource inspection is recorded. */
  reconciledAt: string;
  reconciler: ProviderSideEffectReconciler;
  interruptionError?: AuthorityOperationError;
  metadata?: Record<string, unknown>;
}

export interface RecoverInterruptedSideEffectResult {
  operation: AuthoritySideEffectView;
  disposition: 'already_terminal' | 'committed' | 'prepared_for_retry' | 'compensation_required';
  providerEvidence: Record<string, unknown> | null;
}

/**
 * Single authority facade for external side effects.
 *
 * The underlying service/store are append-only primitives. This runtime exposes
 * only workflows that preserve the crash-window rule: an interrupted provider
 * call is inspected before a retry is prepared. Partial application cannot be
 * represented without a compensation plan.
 */
export class AuthoritySideEffectRuntime {
  private readonly service: AuthoritySideEffectService;

  constructor(
    store: IAuthoritySideEffectStore,
    fencing: AuthorityFencingValidator,
  ) {
    this.service = new AuthoritySideEffectService(store, fencing);
  }

  claim(input: AuthoritySideEffectClaimInput): Promise<AuthoritySideEffectAppendResult> {
    return this.service.claim(input);
  }

  prepare(input: AuthorityPrepareInput): Promise<AuthoritySideEffectAppendResult> {
    return this.service.prepare(input);
  }

  beginExecution(input: AuthoritySideEffectTransitionBase): Promise<AuthoritySideEffectAppendResult> {
    return this.service.beginExecution(input);
  }

  commit(
    input: Parameters<AuthoritySideEffectService['commit']>[0],
  ): Promise<AuthoritySideEffectAppendResult> {
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
    input: Parameters<AuthoritySideEffectService['completeCompensation']>[0],
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.service.completeCompensation(input);
  }

  get(operationId: string): Promise<AuthoritySideEffectView | null> {
    return this.service.get(operationId);
  }

  history(operationId: string): Promise<AuthoritySideEffectView[]> {
    return this.service.history(operationId);
  }

  async recoverInterrupted(
    input: RecoverInterruptedSideEffectInput,
  ): Promise<RecoverInterruptedSideEffectResult> {
    assertStrictlyLater(input.interruptedAt, input.reconciledAt);
    let current = await this.requireOperation(input.operationId);
    if (current.terminal) {
      return { operation: current, disposition: 'already_terminal', providerEvidence: null };
    }

    if (current.state === 'executing') {
      const marked = await this.service.markReconciliationRequired({
        operationId: current.operationId,
        expectedRevision: current.revision,
        transitionKey: `${input.transitionKeyPrefix}:interrupted`,
        recordedAt: input.interruptedAt,
        metadata: input.metadata,
        reason: input.interruptionError ?? {
          code: 'SIDE_EFFECT_EXECUTION_INTERRUPTED',
          message: 'Execution began but no accepted terminal provider outcome was recorded',
          retryable: true,
          details: {},
        },
      });
      current = await this.requireOperation(marked.revision.operationId);
    }

    if (current.state !== 'reconciliation_required') {
      throw new Error(
        `SIDE_EFFECT_RECOVERY_INVALID_STATE operation=${current.operationId} state=${current.state}`,
      );
    }

    const observation = await input.reconciler.inspect(current);
    const metadata = {
      ...input.metadata,
      providerReconciliation: structuredClone(observation.evidence),
    };

    if (observation.status === 'applied') {
      const committed = await this.service.commit({
        operationId: current.operationId,
        expectedRevision: current.revision,
        transitionKey: `${input.transitionKeyPrefix}:applied`,
        recordedAt: input.reconciledAt,
        metadata,
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
        transitionKey: `${input.transitionKeyPrefix}:not-applied`,
        recordedAt: input.reconciledAt,
        metadata,
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

    const required = await this.service.requireCompensation({
      operationId: current.operationId,
      expectedRevision: current.revision,
      transitionKey: `${input.transitionKeyPrefix}:partial`,
      recordedAt: input.reconciledAt,
      metadata,
      compensationCapability: observation.compensationCapability,
      compensationResourceUri: observation.compensationResourceUri,
      compensationInput: observation.compensationInput,
      error: observation.error,
    });
    return {
      operation: await this.requireOperation(required.revision.operationId),
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

function assertStrictlyLater(earlier: string, later: string): void {
  const first = Date.parse(earlier);
  const second = Date.parse(later);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    throw new Error(`Invalid recovery timestamps interruptedAt=${earlier} reconciledAt=${later}`);
  }
  if (second <= first) {
    throw new Error('reconciledAt must be strictly later than interruptedAt');
  }
}
