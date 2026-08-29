import type {
  AuthoritySideEffectAppendResult,
  AuthoritySideEffectClaimInput,
  AuthoritySideEffectView,
  IAuthoritySideEffectStore,
} from './authority-side-effect';
import { AuthoritySideEffectService } from './authority-side-effect';
import type {
  AuthorityLeaseAcquireInput,
  AuthorityLeaseAppendResult,
  AuthorityLeaseReleaseInput,
  AuthorityLeaseRenewInput,
  AuthorityLeaseView,
} from './authority-lease';
import { AuthorityLeaseService } from './authority-lease';

export interface PrepareAuthorityOperationInput {
  operationId: string;
  expectedOperationRevision: number;
  transitionKey: string;
  recordedAt: string;
  leaseId: string;
  leaseOwnerId: string;
  fencingToken: number;
  providerIdempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface BeginAuthorityOperationInput {
  operationId: string;
  expectedOperationRevision: number;
  transitionKey: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CommitAuthorityOperationInput {
  operationId: string;
  expectedOperationRevision: number;
  transitionKey: string;
  recordedAt: string;
  result: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical live-operation bridge between append-only leases and side effects.
 *
 * Fencing is evaluated at the explicit recorded time of prepare, begin and
 * commit. This prevents a fixed-clock validator from accidentally validating a
 * stale token at the wrong instant. Crash reconciliation remains a distinct
 * workflow because observing an effect after lease expiry requires provider-
 * bound evidence, not a false replay of the live commit path.
 */
export class AuthorityExecutionRuntime {
  constructor(
    private readonly operationStore: IAuthoritySideEffectStore,
    readonly leases: AuthorityLeaseService,
  ) {}

  acquireLease(input: AuthorityLeaseAcquireInput): Promise<AuthorityLeaseAppendResult> {
    return this.leases.acquire(input);
  }

  renewLease(input: AuthorityLeaseRenewInput): Promise<AuthorityLeaseAppendResult> {
    return this.leases.renew(input);
  }

  releaseLease(input: AuthorityLeaseReleaseInput): Promise<AuthorityLeaseAppendResult> {
    return this.leases.release(input);
  }

  claimOperation(input: AuthoritySideEffectClaimInput): Promise<AuthoritySideEffectAppendResult> {
    return this.serviceAt(input.recordedAt).claim(input);
  }

  async prepareOperation(
    input: PrepareAuthorityOperationInput,
  ): Promise<AuthoritySideEffectAppendResult> {
    const operation = await this.requireOperation(input.operationId, input.recordedAt);
    const lease = await this.requireActiveLease(operation.resourceUri, input.recordedAt);
    if (lease.leaseId !== input.leaseId) {
      throw new Error(`STALE_LEASE_ID expected=${lease.leaseId} actual=${input.leaseId}`);
    }
    if (lease.ownerId !== input.leaseOwnerId) {
      throw new Error(`LEASE_OWNER_MISMATCH expected=${lease.ownerId} actual=${input.leaseOwnerId}`);
    }
    if (lease.fencingToken !== input.fencingToken) {
      throw new Error(
        `STALE_FENCING_TOKEN resource=${operation.resourceUri} expected=${lease.fencingToken} actual=${input.fencingToken}`,
      );
    }
    await this.leases.at(input.recordedAt).assertCurrent(
      operation.resourceUri,
      input.fencingToken,
    );
    return this.serviceAt(input.recordedAt).prepare({
      operationId: input.operationId,
      expectedRevision: input.expectedOperationRevision,
      transitionKey: input.transitionKey,
      recordedAt: input.recordedAt,
      fencingToken: input.fencingToken,
      providerIdempotencyKey: input.providerIdempotencyKey,
      metadata: {
        ...input.metadata,
        leaseId: input.leaseId,
        leaseOwnerId: input.leaseOwnerId,
      },
    });
  }

  beginOperation(
    input: BeginAuthorityOperationInput,
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.serviceAt(input.recordedAt).beginExecution({
      operationId: input.operationId,
      expectedRevision: input.expectedOperationRevision,
      transitionKey: input.transitionKey,
      recordedAt: input.recordedAt,
      metadata: input.metadata,
    });
  }

  commitOperation(
    input: CommitAuthorityOperationInput,
  ): Promise<AuthoritySideEffectAppendResult> {
    return this.serviceAt(input.recordedAt).commit({
      operationId: input.operationId,
      expectedRevision: input.expectedOperationRevision,
      transitionKey: input.transitionKey,
      recordedAt: input.recordedAt,
      result: input.result,
      metadata: input.metadata,
    });
  }

  async getOperation(
    operationId: string,
    evaluatedAt: string,
  ): Promise<AuthoritySideEffectView | null> {
    return this.serviceAt(evaluatedAt).get(operationId);
  }

  inspectLease(resourceUri: string, at: string): Promise<AuthorityLeaseView | null> {
    return this.leases.inspect(resourceUri, at);
  }

  private serviceAt(at: string): AuthoritySideEffectService {
    return new AuthoritySideEffectService(this.operationStore, this.leases.at(at));
  }

  private async requireOperation(
    operationId: string,
    evaluatedAt: string,
  ): Promise<AuthoritySideEffectView> {
    const operation = await this.getOperation(operationId, evaluatedAt);
    if (!operation) throw new Error(`SIDE_EFFECT_OPERATION_NOT_FOUND id=${operationId}`);
    return operation;
  }

  private async requireActiveLease(
    resourceUri: string,
    at: string,
  ): Promise<AuthorityLeaseView> {
    const lease = await this.leases.inspect(resourceUri, at);
    if (!lease) throw new Error(`LEASE_NOT_FOUND resource=${resourceUri}`);
    if (lease.effectiveState !== 'active') {
      throw new Error(`LEASE_NOT_ACTIVE resource=${resourceUri} state=${lease.effectiveState}`);
    }
    return lease;
  }
}
