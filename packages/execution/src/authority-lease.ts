import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
} from '@cos/core';
import type { AuthorityFencingValidator } from './authority-side-effect';

export type AuthorityLeaseStoredState = 'active' | 'released';
export type AuthorityLeaseEffectiveState = AuthorityLeaseStoredState | 'expired';

export interface AuthorityLeaseRevision {
  revisionId: string;
  resourceUri: string;
  resourceRevision: number;
  leaseId: string;
  leaseRevision: number;
  operationKey: string;
  operationHash: string;
  ownerId: string;
  state: AuthorityLeaseStoredState;
  fencingToken: number;
  acquiredAt: string;
  expiresAt: string;
  recordedAt: string;
  previousRevisionId: string | null;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export interface AuthorityLeaseView extends AuthorityLeaseRevision {
  effectiveState: AuthorityLeaseEffectiveState;
  evaluatedAt: string;
  remainingMs: number;
}

export interface AuthorityLeaseAppendResult {
  revision: AuthorityLeaseRevision;
  appended: boolean;
}

export interface IAuthorityLeaseStore {
  append(
    revision: AuthorityLeaseRevision,
    expectedResourceRevision: number,
  ): Promise<AuthorityLeaseAppendResult>;
  getCurrent(resourceUri: string): Promise<AuthorityLeaseRevision | null>;
  getByOperationKey(resourceUri: string, operationKey: string): Promise<AuthorityLeaseRevision | null>;
  getHistory(resourceUri: string): Promise<AuthorityLeaseRevision[]>;
}

export interface AuthorityLeaseAcquireInput {
  resourceUri: string;
  ownerId: string;
  operationKey: string;
  at: string;
  ttlMs: number;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseRenewInput {
  resourceUri: string;
  leaseId: string;
  ownerId: string;
  fencingToken: number;
  expectedResourceRevision: number;
  operationKey: string;
  at: string;
  ttlMs: number;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseReleaseInput {
  resourceUri: string;
  leaseId: string;
  ownerId: string;
  fencingToken: number;
  expectedResourceRevision: number;
  operationKey: string;
  at: string;
  metadata?: Record<string, unknown>;
}

/** Append-only, serialized reference store for lease/fencing contracts. */
export class InMemoryAuthorityLeaseStore implements IAuthorityLeaseStore {
  private readonly histories = new Map<string, AuthorityLeaseRevision[]>();
  private readonly byOperation = new Map<string, AuthorityLeaseRevision>();
  private readonly revisionById = new Map<string, AuthorityLeaseRevision>();
  private readonly tails = new Map<string, Promise<void>>();

  append(
    raw: AuthorityLeaseRevision,
    expectedResourceRevision: number,
  ): Promise<AuthorityLeaseAppendResult> {
    return this.enqueue(raw.resourceUri, async () => {
      const revision = cloneAndVerify(raw);
      assertNonNegativeInteger(expectedResourceRevision, 'expectedResourceRevision');
      const operationIdentity = operationMapKey(revision.resourceUri, revision.operationKey);
      const duplicate = this.byOperation.get(operationIdentity);
      if (duplicate) {
        if (duplicate.operationHash !== revision.operationHash) {
          throw new Error(`LEASE_OPERATION_KEY_CONFLICT key=${revision.operationKey}`);
        }
        return { revision: cloneRevision(duplicate), appended: false };
      }

      const history = this.histories.get(revision.resourceUri) ?? [];
      const current = history.at(-1);
      const currentResourceRevision = current?.resourceRevision ?? 0;
      if (currentResourceRevision !== expectedResourceRevision) {
        throw new Error(
          `STALE_LEASE_RESOURCE_REVISION expected=${expectedResourceRevision} current=${currentResourceRevision}`,
        );
      }
      if (revision.resourceRevision !== currentResourceRevision + 1) {
        throw new Error(
          `LEASE_RESOURCE_REVISION_SEQUENCE expected=${currentResourceRevision + 1} incoming=${revision.resourceRevision}`,
        );
      }
      if (current) {
        if (revision.previousRevisionId !== current.revisionId) {
          throw new Error(`LEASE_REVISION_PARENT_MISMATCH resource=${revision.resourceUri}`);
        }
        if (Date.parse(revision.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`LEASE_SYSTEM_TIME_NOT_MONOTONIC resource=${revision.resourceUri}`);
        }
        if (revision.leaseId === current.leaseId) {
          if (revision.leaseRevision !== current.leaseRevision + 1) {
            throw new Error(`LEASE_REVISION_SEQUENCE lease=${revision.leaseId}`);
          }
          if (revision.fencingToken !== current.fencingToken) {
            throw new Error(`LEASE_FENCING_CHANGED_DURING_SAME_LEASE lease=${revision.leaseId}`);
          }
        } else {
          if (revision.leaseRevision !== 1) {
            throw new Error(`LEASE_NEW_ID_REVISION_INVALID lease=${revision.leaseId}`);
          }
          if (revision.fencingToken !== current.fencingToken + 1) {
            throw new Error(
              `LEASE_FENCING_SEQUENCE expected=${current.fencingToken + 1} incoming=${revision.fencingToken}`,
            );
          }
        }
      } else if (revision.resourceRevision !== 1
        || revision.leaseRevision !== 1
        || revision.previousRevisionId !== null
        || revision.fencingToken !== 1) {
        throw new Error(`LEASE_INVALID_INITIAL_REVISION resource=${revision.resourceUri}`);
      }

      const collision = this.revisionById.get(revision.revisionId);
      if (collision) {
        if (collision.contentHash !== revision.contentHash) {
          throw new Error(`LEASE_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneRevision(collision), appended: false };
      }

      const stored = cloneRevision(revision);
      history.push(stored);
      this.histories.set(stored.resourceUri, history);
      this.byOperation.set(operationIdentity, stored);
      this.revisionById.set(stored.revisionId, stored);
      return { revision: cloneRevision(stored), appended: true };
    });
  }

  async getCurrent(resourceUri: string): Promise<AuthorityLeaseRevision | null> {
    const current = this.histories.get(normalizeResource(resourceUri))?.at(-1);
    return current ? cloneRevision(current) : null;
  }

  async getByOperationKey(
    resourceUri: string,
    operationKey: string,
  ): Promise<AuthorityLeaseRevision | null> {
    const revision = this.byOperation.get(operationMapKey(resourceUri, operationKey));
    return revision ? cloneRevision(revision) : null;
  }

  async getHistory(resourceUri: string): Promise<AuthorityLeaseRevision[]> {
    return (this.histories.get(normalizeResource(resourceUri)) ?? []).map(cloneRevision);
  }

  private enqueue<T>(resourceUri: string, operation: () => Promise<T>): Promise<T> {
    const resource = normalizeResource(resourceUri);
    const previous = this.tails.get(resource) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(resource, tail);
    return result.finally(() => {
      if (this.tails.get(resource) === tail) this.tails.delete(resource);
    });
  }
}

/**
 * Explicit-time lease service. No authority decision depends on wall-clock now().
 */
export class AuthorityLeaseService implements AuthorityFencingValidator {
  constructor(private readonly store: IAuthorityLeaseStore) {}

  async acquire(input: AuthorityLeaseAcquireInput): Promise<AuthorityLeaseAppendResult> {
    const normalized = normalizeAcquire(input);
    const duplicate = await this.store.getByOperationKey(
      normalized.resourceUri,
      normalized.operationKey,
    );
    const operationHash = acquireOperationHash(normalized);
    if (duplicate) {
      if (duplicate.operationHash !== operationHash) {
        throw new Error(`LEASE_OPERATION_KEY_CONFLICT key=${normalized.operationKey}`);
      }
      return { revision: cloneRevision(duplicate), appended: false };
    }

    const current = await this.store.getCurrent(normalized.resourceUri);
    if (current && effectiveState(current, normalized.at) === 'active') {
      throw new Error(
        `LEASE_ALREADY_HELD resource=${normalized.resourceUri} owner=${current.ownerId} expiresAt=${current.expiresAt}`,
      );
    }

    const fencingToken = (current?.fencingToken ?? 0) + 1;
    const resourceRevision = (current?.resourceRevision ?? 0) + 1;
    const identity = canonicalIdentity({
      scheme: 'agentic',
      authority: 'cos-execution',
      resourceType: 'resource-lease',
      resourceId: `${normalized.resourceUri}:${fencingToken}:${normalized.operationKey}`,
    }, 'lease');
    const revision = sealRevision({
      revisionId: revisionIdentity(normalized.resourceUri, resourceRevision, normalized.at),
      resourceUri: normalized.resourceUri,
      resourceRevision,
      leaseId: String(identity.id),
      leaseRevision: 1,
      operationKey: normalized.operationKey,
      operationHash,
      ownerId: normalized.ownerId,
      state: 'active',
      fencingToken,
      acquiredAt: normalized.at,
      expiresAt: addMs(normalized.at, normalized.ttlMs),
      recordedAt: normalized.at,
      previousRevisionId: current?.revisionId ?? null,
      metadata: normalized.metadata,
    });
    return this.store.append(revision, current?.resourceRevision ?? 0);
  }

  async renew(input: AuthorityLeaseRenewInput): Promise<AuthorityLeaseAppendResult> {
    const normalized = normalizeRenew(input);
    const duplicate = await this.store.getByOperationKey(
      normalized.resourceUri,
      normalized.operationKey,
    );
    const operationHash = canonicalHash128({ action: 'renew', ...normalized });
    if (duplicate) {
      if (duplicate.operationHash !== operationHash) {
        throw new Error(`LEASE_OPERATION_KEY_CONFLICT key=${normalized.operationKey}`);
      }
      return { revision: cloneRevision(duplicate), appended: false };
    }

    const current = await this.requireCurrent(normalized.resourceUri);
    assertLeaseOwner(current, normalized.leaseId, normalized.ownerId, normalized.fencingToken);
    if (current.resourceRevision !== normalized.expectedResourceRevision) {
      throw new Error(
        `STALE_LEASE_RESOURCE_REVISION expected=${normalized.expectedResourceRevision} current=${current.resourceRevision}`,
      );
    }
    if (effectiveState(current, normalized.at) !== 'active') {
      throw new Error(`LEASE_EXPIRED resource=${normalized.resourceUri} expiresAt=${current.expiresAt}`);
    }
    const expiresAt = addMs(normalized.at, normalized.ttlMs);
    if (Date.parse(expiresAt) <= Date.parse(current.expiresAt)) {
      throw new Error(
        `LEASE_RENEWAL_MUST_EXTEND current=${current.expiresAt} incoming=${expiresAt}`,
      );
    }

    const revision = sealRevision({
      ...cloneRevision(current),
      revisionId: revisionIdentity(
        current.resourceUri,
        current.resourceRevision + 1,
        normalized.at,
      ),
      resourceRevision: current.resourceRevision + 1,
      leaseRevision: current.leaseRevision + 1,
      operationKey: normalized.operationKey,
      operationHash,
      state: 'active',
      expiresAt,
      recordedAt: normalized.at,
      previousRevisionId: current.revisionId,
      metadata: mergeMetadata(current.metadata, normalized.metadata),
    });
    return this.store.append(revision, normalized.expectedResourceRevision);
  }

  async release(input: AuthorityLeaseReleaseInput): Promise<AuthorityLeaseAppendResult> {
    const normalized = normalizeRelease(input);
    const duplicate = await this.store.getByOperationKey(
      normalized.resourceUri,
      normalized.operationKey,
    );
    const operationHash = canonicalHash128({ action: 'release', ...normalized });
    if (duplicate) {
      if (duplicate.operationHash !== operationHash) {
        throw new Error(`LEASE_OPERATION_KEY_CONFLICT key=${normalized.operationKey}`);
      }
      return { revision: cloneRevision(duplicate), appended: false };
    }

    const current = await this.requireCurrent(normalized.resourceUri);
    assertLeaseOwner(current, normalized.leaseId, normalized.ownerId, normalized.fencingToken);
    if (current.resourceRevision !== normalized.expectedResourceRevision) {
      throw new Error(
        `STALE_LEASE_RESOURCE_REVISION expected=${normalized.expectedResourceRevision} current=${current.resourceRevision}`,
      );
    }
    if (current.state === 'released') {
      throw new Error(`LEASE_ALREADY_RELEASED resource=${normalized.resourceUri}`);
    }

    const revision = sealRevision({
      ...cloneRevision(current),
      revisionId: revisionIdentity(
        current.resourceUri,
        current.resourceRevision + 1,
        normalized.at,
      ),
      resourceRevision: current.resourceRevision + 1,
      leaseRevision: current.leaseRevision + 1,
      operationKey: normalized.operationKey,
      operationHash,
      state: 'released',
      recordedAt: normalized.at,
      previousRevisionId: current.revisionId,
      metadata: mergeMetadata(current.metadata, normalized.metadata),
    });
    return this.store.append(revision, normalized.expectedResourceRevision);
  }

  async inspect(resourceUri: string, at: string): Promise<AuthorityLeaseView | null> {
    const current = await this.store.getCurrent(resourceUri);
    if (!current) return null;
    return viewOf(current, canonicalTime(at, 'lease evaluation time'));
  }

  async history(resourceUri: string, evaluatedAt: string): Promise<AuthorityLeaseView[]> {
    const at = canonicalTime(evaluatedAt, 'lease evaluation time');
    return (await this.store.getHistory(resourceUri)).map(revision => viewOf(revision, at));
  }

  async assertCurrent(
    resourceUri: string,
    fencingToken: number,
    at?: string,
  ): Promise<void> {
    if (at === undefined) {
      throw new Error('Authority lease fencing validation requires explicit evaluation time');
    }
    const current = await this.requireCurrent(resourceUri);
    const token = positiveInteger(fencingToken, 'fencingToken');
    if (current.fencingToken !== token) {
      throw new Error(
        `STALE_FENCING_TOKEN resource=${current.resourceUri} expected=${current.fencingToken} actual=${token}`,
      );
    }
    const state = effectiveState(current, canonicalTime(at, 'fencing evaluation time'));
    if (state !== 'active') {
      throw new Error(`LEASE_NOT_ACTIVE resource=${current.resourceUri} state=${state}`);
    }
  }

  /** Adapter for APIs whose fencing port lacks an explicit time argument. */
  at(evaluatedAt: string): AuthorityFencingValidator {
    const at = canonicalTime(evaluatedAt, 'fencing adapter time');
    return {
      assertCurrent: (resourceUri, fencingToken) =>
        this.assertCurrent(resourceUri, fencingToken, at),
    };
  }

  private async requireCurrent(resourceUri: string): Promise<AuthorityLeaseRevision> {
    const current = await this.store.getCurrent(resourceUri);
    if (!current) throw new Error(`LEASE_NOT_FOUND resource=${resourceUri}`);
    return current;
  }
}

function normalizeAcquire(input: AuthorityLeaseAcquireInput) {
  const resourceUri = normalizeResource(input.resourceUri);
  const ownerId = nonEmpty(input.ownerId, 'ownerId');
  const operationKey = nonEmpty(input.operationKey, 'operationKey');
  const at = canonicalTime(input.at, 'lease acquisition time');
  const ttlMs = positiveInteger(input.ttlMs, 'ttlMs');
  const metadata = canonicalClone(input.metadata ?? {}, 'lease metadata') as Record<string, unknown>;
  return { resourceUri, ownerId, operationKey, at, ttlMs, metadata };
}

function normalizeRenew(input: AuthorityLeaseRenewInput) {
  return {
    resourceUri: normalizeResource(input.resourceUri),
    leaseId: nonEmpty(input.leaseId, 'leaseId'),
    ownerId: nonEmpty(input.ownerId, 'ownerId'),
    fencingToken: positiveInteger(input.fencingToken, 'fencingToken'),
    expectedResourceRevision: nonNegativeInteger(
      input.expectedResourceRevision,
      'expectedResourceRevision',
    ),
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
    at: canonicalTime(input.at, 'lease renewal time'),
    ttlMs: positiveInteger(input.ttlMs, 'ttlMs'),
    metadata: canonicalClone(input.metadata ?? {}, 'lease metadata') as Record<string, unknown>,
  };
}

function normalizeRelease(input: AuthorityLeaseReleaseInput) {
  return {
    resourceUri: normalizeResource(input.resourceUri),
    leaseId: nonEmpty(input.leaseId, 'leaseId'),
    ownerId: nonEmpty(input.ownerId, 'ownerId'),
    fencingToken: positiveInteger(input.fencingToken, 'fencingToken'),
    expectedResourceRevision: nonNegativeInteger(
      input.expectedResourceRevision,
      'expectedResourceRevision',
    ),
    operationKey: nonEmpty(input.operationKey, 'operationKey'),
    at: canonicalTime(input.at, 'lease release time'),
    metadata: canonicalClone(input.metadata ?? {}, 'lease metadata') as Record<string, unknown>,
  };
}

function acquireOperationHash(input: ReturnType<typeof normalizeAcquire>): string {
  return canonicalHash128({ action: 'acquire', ...input });
}

function sealRevision(
  revision: Omit<AuthorityLeaseRevision, 'contentHash'>,
): AuthorityLeaseRevision {
  const normalized = {
    revisionId: nonEmpty(revision.revisionId, 'revisionId'),
    resourceUri: normalizeResource(revision.resourceUri),
    resourceRevision: positiveInteger(revision.resourceRevision, 'resourceRevision'),
    leaseId: nonEmpty(revision.leaseId, 'leaseId'),
    leaseRevision: positiveInteger(revision.leaseRevision, 'leaseRevision'),
    operationKey: nonEmpty(revision.operationKey, 'operationKey'),
    operationHash: nonEmpty(revision.operationHash, 'operationHash'),
    ownerId: nonEmpty(revision.ownerId, 'ownerId'),
    state: revision.state,
    fencingToken: positiveInteger(revision.fencingToken, 'fencingToken'),
    acquiredAt: canonicalTime(revision.acquiredAt, 'acquiredAt'),
    expiresAt: canonicalTime(revision.expiresAt, 'expiresAt'),
    recordedAt: canonicalTime(revision.recordedAt, 'recordedAt'),
    previousRevisionId: revision.previousRevisionId === null
      ? null
      : nonEmpty(revision.previousRevisionId, 'previousRevisionId'),
    metadata: canonicalClone(revision.metadata, 'lease metadata') as Record<string, unknown>,
  };
  if (Date.parse(normalized.expiresAt) <= Date.parse(normalized.acquiredAt)) {
    throw new Error('Lease expiresAt must be strictly after acquiredAt');
  }
  if (Date.parse(normalized.recordedAt) < Date.parse(normalized.acquiredAt)) {
    throw new Error('Lease recordedAt cannot precede acquiredAt');
  }
  return { ...normalized, contentHash: canonicalHash128(normalized) };
}

function cloneAndVerify(raw: AuthorityLeaseRevision): AuthorityLeaseRevision {
  const revision = structuredClone(raw);
  canonicalSerialize(revision);
  const { contentHash: _ignored, ...payload } = revision;
  if (canonicalHash128(payload) !== revision.contentHash) {
    throw new Error(`LEASE_CONTENT_HASH_MISMATCH revision=${revision.revisionId}`);
  }
  return revision;
}

function assertLeaseOwner(
  current: AuthorityLeaseRevision,
  leaseId: string,
  ownerId: string,
  fencingToken: number,
): void {
  if (current.leaseId !== leaseId) {
    throw new Error(`STALE_LEASE_ID expected=${current.leaseId} actual=${leaseId}`);
  }
  if (current.ownerId !== ownerId) {
    throw new Error(`LEASE_OWNER_MISMATCH expected=${current.ownerId} actual=${ownerId}`);
  }
  if (current.fencingToken !== fencingToken) {
    throw new Error(
      `STALE_FENCING_TOKEN resource=${current.resourceUri} expected=${current.fencingToken} actual=${fencingToken}`,
    );
  }
}

function viewOf(revision: AuthorityLeaseRevision, at: string): AuthorityLeaseView {
  const state = effectiveState(revision, at);
  return {
    ...cloneRevision(revision),
    effectiveState: state,
    evaluatedAt: at,
    remainingMs: state === 'active'
      ? Math.max(0, Date.parse(revision.expiresAt) - Date.parse(at))
      : 0,
  };
}

function effectiveState(
  revision: AuthorityLeaseRevision,
  at: string,
): AuthorityLeaseEffectiveState {
  if (revision.state === 'released') return 'released';
  return Date.parse(at) >= Date.parse(revision.expiresAt) ? 'expired' : 'active';
}

function revisionIdentity(
  resourceUri: string,
  resourceRevision: number,
  recordedAt: string,
): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: 'cos-execution',
    resourceType: 'lease-revision',
    resourceId: `${resourceUri}:${resourceRevision}:${recordedAt}`,
  }, 'lr').id);
}

function operationMapKey(resourceUri: string, operationKey: string): string {
  return `${normalizeResource(resourceUri)}\u0000${nonEmpty(operationKey, 'operationKey')}`;
}

function mergeMetadata(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return canonicalClone({ ...current, ...incoming }, 'lease metadata') as Record<string, unknown>;
}

function addMs(value: string, ttlMs: number): string {
  return new Date(Date.parse(value) + ttlMs).toISOString();
}

function cloneRevision(revision: AuthorityLeaseRevision): AuthorityLeaseRevision {
  return structuredClone(revision);
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${errorMessage(error)}`);
  }
}

function canonicalTime(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return new Date(parsed).toISOString();
}

function normalizeResource(value: string): string {
  return nonEmpty(value, 'resourceUri');
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  assertNonNegativeInteger(value, label);
  return value;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
