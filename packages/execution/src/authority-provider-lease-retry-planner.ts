import { canonicalHash128 } from '@cos/core';
import { AuthorityLeaseService } from './authority-lease';
import type {
  AuthorityProviderRetryPlanRequest,
  AuthorityProviderRetryPlanner,
} from './authority-provider-reconciliation';

export interface AuthorityLeaseRetryPlannerOptions {
  ownerId: string;
  ttlMs: number;
  metadata?: Record<string, unknown>;
  providerKeyFactory?: (input: {
    operationId: string;
    previousProviderIdempotencyKey: string;
    fencingToken: number;
    inspectedAt: string;
  }) => string;
}

/**
 * Retry planner that acquires a fresh lease/fencing token after authoritative
 * provider absence. It never releases an active lease implicitly: if the prior
 * lease is still effective, planning fails and the operation remains in
 * reconciliation_required rather than allowing concurrent attempts.
 */
export class AuthorityLeaseRetryPlanner implements AuthorityProviderRetryPlanner {
  private readonly ownerId: string;
  private readonly ttlMs: number;
  private readonly metadata: Record<string, unknown>;

  constructor(
    private readonly leases: AuthorityLeaseService,
    private readonly options: AuthorityLeaseRetryPlannerOptions,
  ) {
    this.ownerId = nonEmpty(options.ownerId, 'retry planner ownerId');
    this.ttlMs = options.ttlMs;
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 1 || this.ttlMs > 3_600_000) {
      throw new Error('retry planner ttlMs must be a safe integer in [1,3600000]');
    }
    this.metadata = structuredClone(options.metadata ?? {});
  }

  async planRetry(request: AuthorityProviderRetryPlanRequest) {
    const inspectedAt = canonicalTime(request.inspectedAt, 'retry inspectedAt');
    const operationId = nonEmpty(request.operationId, 'retry operationId');
    const resourceUri = nonEmpty(request.resourceUri, 'retry resourceUri');
    const previousProviderIdempotencyKey = nonEmpty(
      request.previousProviderIdempotencyKey,
      'previousProviderIdempotencyKey',
    );
    if (!Number.isSafeInteger(request.previousFencingToken)
      || request.previousFencingToken < 1) {
      throw new Error('previousFencingToken must be a positive safe integer');
    }

    const operationKey = `provider-retry-lease:${canonicalHash128({
      operationId,
      resourceUri,
      previousFencingToken: request.previousFencingToken,
      inspectedAt,
    })}`;
    const acquired = await this.leases.acquire({
      resourceUri,
      ownerId: this.ownerId,
      operationKey,
      at: inspectedAt,
      ttlMs: this.ttlMs,
      metadata: {
        ...this.metadata,
        operationId,
        projectId: request.projectId,
        capability: request.capability,
        previousFencingToken: request.previousFencingToken,
        inspectionEvidenceHash: canonicalHash128(request.inspectionEvidence),
      },
    });
    const revision = acquired.revision;
    if (revision.fencingToken <= request.previousFencingToken) {
      throw new Error(
        `PROVIDER_RETRY_FENCE_NOT_MONOTONIC previous=${request.previousFencingToken} next=${revision.fencingToken}`,
      );
    }

    const nextProviderIdempotencyKey = nonEmpty(
      this.options.providerKeyFactory?.({
        operationId,
        previousProviderIdempotencyKey,
        fencingToken: revision.fencingToken,
        inspectedAt,
      }) ?? `provider-attempt:${canonicalHash128({
        operationId,
        previousProviderIdempotencyKey,
        fencingToken: revision.fencingToken,
        inspectedAt,
      })}`,
      'nextProviderIdempotencyKey',
    );
    if (nextProviderIdempotencyKey === previousProviderIdempotencyKey) {
      throw new Error('PROVIDER_RETRY_IDEMPOTENCY_KEY_MUST_ROTATE');
    }

    return {
      nextFencingToken: revision.fencingToken,
      nextProviderIdempotencyKey,
      evidence: {
        leaseId: revision.leaseId,
        resourceUri: revision.resourceUri,
        ownerId: revision.ownerId,
        fencingToken: revision.fencingToken,
        resourceRevision: revision.resourceRevision,
        acquiredAt: revision.acquiredAt,
        expiresAt: revision.expiresAt,
        leaseContentHash: revision.contentHash,
        operationKey,
      },
    };
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
