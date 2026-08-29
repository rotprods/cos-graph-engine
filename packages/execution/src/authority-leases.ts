import {
  CANONICAL_JSON_WIRE_VERSION,
  canonicalHash128,
  canonicalIdentity,
  canonicalizeJsonValue,
  sha256Hex,
  type CanonicalJsonValue,
} from '@cos/core';

export const AUTHORITY_LEASE_SCHEMA_VERSION = 1 as const;

export const AUTHORITY_LEASE_STATES = [
  'active',
  'released',
  'expired',
  'revoked',
] as const;

export type AuthorityLeaseState = typeof AUTHORITY_LEASE_STATES[number];

export interface AuthorityLeaseRevision {
  schemaVersion: typeof AUTHORITY_LEASE_SCHEMA_VERSION;
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  revisionId: string;
  resourceId: string;
  transitionKey: string;
  transitionIntentHash: string;
  operationKey: string;
  revision: number;
  state: AuthorityLeaseState;
  projectId: string;
  resource: string;
  owner: string;
  tokenHash: string;
  fencingVersion: number;
  acquiredAt: string;
  expiresAt: string;
  systemFrom: string;
  sourceRef: string;
  reason: string | null;
  metadata: Record<string, CanonicalJsonValue>;
  previousRevisionId: string | null;
  contentHash: string;
}

export interface AuthorityLeaseAppendResult {
  revision: AuthorityLeaseRevision;
  appended: boolean;
}

export interface IAuthorityLeaseStore {
  appendRevision(
    revision: AuthorityLeaseRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityLeaseAppendResult>;
  getCurrent(resourceId: string): Promise<AuthorityLeaseRevision | null>;
  getHistory(resourceId: string): Promise<AuthorityLeaseRevision[]>;
  getByTransitionKey(transitionKey: string): Promise<AuthorityLeaseRevision | null>;
  listProjectLeases(projectId: string): Promise<AuthorityLeaseRevision[]>;
}

export interface AuthorityLeaseAcquireInput {
  projectId: string;
  resource: string;
  owner: string;
  /** Caller-generated high-entropy bearer token; only SHA-256 is persisted. */
  token: string;
  ttlMs: number;
  recordedAt: string;
  idempotencyKey: string;
  sourceRef: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseRenewInput {
  projectId: string;
  resource: string;
  owner: string;
  token: string;
  expectedRevision: number;
  ttlMs: number;
  recordedAt: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseReleaseInput {
  projectId: string;
  resource: string;
  owner: string;
  token: string;
  expectedRevision: number;
  recordedAt: string;
  idempotencyKey: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseExpireInput {
  projectId: string;
  resource: string;
  expectedRevision: number;
  recordedAt: string;
  idempotencyKey: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseRevokeInput {
  projectId: string;
  resource: string;
  expectedRevision: number;
  recordedAt: string;
  idempotencyKey: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorityLeaseMutationResult {
  revision: AuthorityLeaseRevision;
  current: AuthorityLeaseRevision;
  appended: boolean;
}

export interface AuthorityLeaseGrant extends AuthorityLeaseMutationResult {
  token: string;
}

export interface AuthorityLeaseCommitInput {
  projectId: string;
  resource: string;
  owner: string;
  token: string;
  fencingVersion: number;
  at: string;
}

export interface AuthorityLeaseCommitProof {
  resourceId: string;
  leaseRevisionId: string;
  projectId: string;
  resource: string;
  owner: string;
  tokenHash: string;
  fencingVersion: number;
  expiresAt: string;
  validatedAt: string;
}

export interface FencedResourceSnapshot {
  resourceId: string;
  version: number;
  acceptedFencingVersion: number;
  value: CanonicalJsonValue;
  valueHash: string;
  lastCommitKey: string | null;
}

export interface FencedResourceCommitInput {
  lease: AuthorityLeaseCommitInput;
  commitKey: string;
  expectedVersion: number;
  value: unknown;
}

export interface FencedResourceCommitResult {
  snapshot: FencedResourceSnapshot;
  committed: boolean;
  leaseProof: AuthorityLeaseCommitProof;
}

/** Append-only reference lease store with per-resource serialization. */
export class InMemoryAuthorityLeaseStore implements IAuthorityLeaseStore {
  private readonly histories = new Map<string, AuthorityLeaseRevision[]>();
  private readonly revisionById = new Map<string, AuthorityLeaseRevision>();
  private readonly revisionByTransition = new Map<string, AuthorityLeaseRevision>();
  private readonly resourceTails = new Map<string, Promise<void>>();

  appendRevision(
    revision: AuthorityLeaseRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityLeaseAppendResult> {
    return this.enqueue(revision.resourceId, async () => {
      assertAuthorityLeaseRevision(revision);
      assertNonNegativeSafeInteger(expectedCurrentRevision, 'expectedCurrentRevision');

      const duplicate = this.revisionByTransition.get(revision.transitionKey);
      if (duplicate) {
        if (duplicate.transitionIntentHash !== revision.transitionIntentHash) {
          throw new Error(`LEASE_TRANSITION_CONFLICT key=${revision.transitionKey}`);
        }
        return { revision: cloneAuthorityLeaseRevision(duplicate), appended: false };
      }

      const history = this.histories.get(revision.resourceId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(
          `STALE_LEASE_REVISION resource=${revision.resourceId} expected=${expectedCurrentRevision} current=${currentRevision}`,
        );
      }
      if (current) assertAuthorityLeaseContinuity(current, revision);
      else assertInitialLeaseRevision(revision);

      const idCollision = this.revisionById.get(revision.revisionId);
      if (idCollision) {
        if (idCollision.contentHash !== revision.contentHash) {
          throw new Error(`LEASE_REVISION_ID_COLLISION id=${revision.revisionId}`);
        }
        return { revision: cloneAuthorityLeaseRevision(idCollision), appended: false };
      }

      const stored = cloneAuthorityLeaseRevision(revision);
      history.push(stored);
      this.histories.set(revision.resourceId, history);
      this.revisionById.set(revision.revisionId, stored);
      this.revisionByTransition.set(revision.transitionKey, stored);
      return { revision: cloneAuthorityLeaseRevision(stored), appended: true };
    });
  }

  async getCurrent(resourceId: string): Promise<AuthorityLeaseRevision | null> {
    const current = this.histories.get(nonEmpty(resourceId, 'resourceId'))?.at(-1);
    return current ? cloneAuthorityLeaseRevision(current) : null;
  }

  async getHistory(resourceId: string): Promise<AuthorityLeaseRevision[]> {
    return (this.histories.get(nonEmpty(resourceId, 'resourceId')) ?? [])
      .map(cloneAuthorityLeaseRevision);
  }

  async getByTransitionKey(transitionKey: string): Promise<AuthorityLeaseRevision | null> {
    const revision = this.revisionByTransition.get(nonEmpty(transitionKey, 'transitionKey'));
    return revision ? cloneAuthorityLeaseRevision(revision) : null;
  }

  async listProjectLeases(projectId: string): Promise<AuthorityLeaseRevision[]> {
    const project = nonEmpty(projectId, 'projectId');
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(cloneAuthorityLeaseRevision)
      .sort(compareAuthorityLeaseRevision);
  }

  private enqueue<T>(resourceId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.resourceTails.get(resourceId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.resourceTails.set(resourceId, tail);
    return result.finally(() => {
      if (this.resourceTails.get(resourceId) === tail) this.resourceTails.delete(resourceId);
    });
  }
}

/** Durable lease lifecycle with caller-supplied bearer tokens. */
export class AuthorityLeaseService {
  constructor(private readonly store: IAuthorityLeaseStore) {}

  async acquire(input: AuthorityLeaseAcquireInput): Promise<AuthorityLeaseGrant> {
    const normalized = await normalizeAcquire(input);
    const resourceId = authorityLeaseResourceId(normalized.projectId, normalized.resource);
    const transitionKey = authorityLeaseTransitionKey(resourceId, normalized.idempotencyKey);
    const transitionIntentHash = canonicalHash128({
      schemaVersion: AUTHORITY_LEASE_SCHEMA_VERSION,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      targetState: 'active',
      resourceId,
      owner: normalized.owner,
      tokenHash: normalized.tokenHash,
      ttlMs: normalized.ttlMs,
      acquiredAt: normalized.recordedAt,
      expiresAt: normalized.expiresAt,
      sourceRef: normalized.sourceRef,
      metadata: normalized.metadata,
    });

    const historical = await this.store.getByTransitionKey(transitionKey);
    if (historical) {
      if (historical.transitionIntentHash !== transitionIntentHash) {
        throw new Error(`LEASE_TRANSITION_CONFLICT key=${transitionKey}`);
      }
      const current = await requireCurrent(this.store, resourceId);
      return { revision: historical, current, appended: false, token: normalized.token };
    }

    const current = await this.store.getCurrent(resourceId);
    if (current?.state === 'active'
      && Date.parse(current.expiresAt) > Date.parse(normalized.recordedAt)) {
      throw new Error(
        `LEASE_CONFLICT resource=${resourceId} owner=${current.owner} expiresAt=${current.expiresAt}`,
      );
    }

    const revisionNumber = (current?.revision ?? 0) + 1;
    const fencingVersion = (current?.fencingVersion ?? 0) + 1;
    const revision = sealAuthorityLeaseRevision({
      revisionId: authorityLeaseRevisionId(resourceId, revisionNumber, transitionKey),
      resourceId,
      transitionKey,
      transitionIntentHash,
      operationKey: normalized.idempotencyKey,
      revision: revisionNumber,
      state: 'active',
      projectId: normalized.projectId,
      resource: normalized.resource,
      owner: normalized.owner,
      tokenHash: normalized.tokenHash,
      fencingVersion,
      acquiredAt: normalized.recordedAt,
      expiresAt: normalized.expiresAt,
      systemFrom: normalized.recordedAt,
      sourceRef: normalized.sourceRef,
      reason: current?.state === 'active' ? 'reacquired_after_expiry' : null,
      metadata: mergeLeaseMetadata(current?.metadata ?? {}, normalized.metadata),
      previousRevisionId: current?.revisionId ?? null,
    });
    const appended = await this.store.appendRevision(revision, current?.revision ?? 0);
    return {
      revision: appended.revision,
      current: await requireCurrent(this.store, resourceId),
      appended: appended.appended,
      token: normalized.token,
    };
  }

  async renew(input: AuthorityLeaseRenewInput): Promise<AuthorityLeaseGrant> {
    const normalized = await normalizeRenew(input);
    const resourceId = authorityLeaseResourceId(normalized.projectId, normalized.resource);
    const transitionKey = authorityLeaseTransitionKey(resourceId, normalized.idempotencyKey);
    const transitionIntentHash = canonicalHash128({
      schemaVersion: AUTHORITY_LEASE_SCHEMA_VERSION,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      targetState: 'active',
      mode: 'renew',
      resourceId,
      owner: normalized.owner,
      tokenHash: normalized.tokenHash,
      expectedRevision: normalized.expectedRevision,
      ttlMs: normalized.ttlMs,
      recordedAt: normalized.recordedAt,
      expiresAt: normalized.expiresAt,
      metadata: normalized.metadata,
    });

    const historical = await this.store.getByTransitionKey(transitionKey);
    if (historical) {
      if (historical.transitionIntentHash !== transitionIntentHash) {
        throw new Error(`LEASE_TRANSITION_CONFLICT key=${transitionKey}`);
      }
      return {
        revision: historical,
        current: await requireCurrent(this.store, resourceId),
        appended: false,
        token: normalized.token,
      };
    }

    const current = await requireCurrent(this.store, resourceId);
    assertLeaseOwnerToken(current, normalized.owner, normalized.tokenHash);
    if (current.revision !== normalized.expectedRevision) {
      throw new Error(
        `STALE_LEASE_REVISION resource=${resourceId} expected=${normalized.expectedRevision} current=${current.revision}`,
      );
    }
    if (current.state !== 'active') throw new Error(`LEASE_NOT_ACTIVE state=${current.state}`);
    if (Date.parse(current.expiresAt) <= Date.parse(normalized.recordedAt)) {
      throw new Error(`LEASE_EXPIRED resource=${resourceId} expiresAt=${current.expiresAt}`);
    }
    if (Date.parse(normalized.expiresAt) <= Date.parse(current.expiresAt)) {
      throw new Error(`LEASE_RENEWAL_MUST_EXTEND resource=${resourceId}`);
    }

    const revision = sealAuthorityLeaseRevision({
      revisionId: authorityLeaseRevisionId(resourceId, current.revision + 1, transitionKey),
      resourceId,
      transitionKey,
      transitionIntentHash,
      operationKey: normalized.idempotencyKey,
      revision: current.revision + 1,
      state: 'active',
      projectId: current.projectId,
      resource: current.resource,
      owner: current.owner,
      tokenHash: current.tokenHash,
      fencingVersion: current.fencingVersion,
      acquiredAt: current.acquiredAt,
      expiresAt: normalized.expiresAt,
      systemFrom: normalized.recordedAt,
      sourceRef: current.sourceRef,
      reason: 'renewed',
      metadata: mergeLeaseMetadata(current.metadata, normalized.metadata),
      previousRevisionId: current.revisionId,
    });
    const appended = await this.store.appendRevision(revision, current.revision);
    return {
      revision: appended.revision,
      current: await requireCurrent(this.store, resourceId),
      appended: appended.appended,
      token: normalized.token,
    };
  }

  async release(input: AuthorityLeaseReleaseInput): Promise<AuthorityLeaseMutationResult> {
    const normalized = await normalizeRelease(input);
    return this.closeLease({
      ...normalized,
      state: 'released',
      defaultReason: 'owner_released',
    });
  }

  async expire(input: AuthorityLeaseExpireInput): Promise<AuthorityLeaseMutationResult> {
    const normalized = normalizeExpire(input);
    const resourceId = authorityLeaseResourceId(normalized.projectId, normalized.resource);
    const current = await requireCurrent(this.store, resourceId);
    if (current.revision !== normalized.expectedRevision) {
      throw new Error(
        `STALE_LEASE_REVISION resource=${resourceId} expected=${normalized.expectedRevision} current=${current.revision}`,
      );
    }
    if (current.state !== 'active') throw new Error(`LEASE_NOT_ACTIVE state=${current.state}`);
    if (Date.parse(current.expiresAt) > Date.parse(normalized.recordedAt)) {
      throw new Error(`LEASE_NOT_EXPIRED resource=${resourceId} expiresAt=${current.expiresAt}`);
    }
    return this.appendClosure(current, {
      state: 'expired',
      idempotencyKey: normalized.idempotencyKey,
      recordedAt: normalized.recordedAt,
      reason: normalized.reason ?? 'ttl_elapsed',
      metadata: normalized.metadata,
    });
  }

  async revoke(input: AuthorityLeaseRevokeInput): Promise<AuthorityLeaseMutationResult> {
    const normalized = normalizeRevoke(input);
    const resourceId = authorityLeaseResourceId(normalized.projectId, normalized.resource);
    const current = await requireCurrent(this.store, resourceId);
    if (current.revision !== normalized.expectedRevision) {
      throw new Error(
        `STALE_LEASE_REVISION resource=${resourceId} expected=${normalized.expectedRevision} current=${current.revision}`,
      );
    }
    if (current.state !== 'active') throw new Error(`LEASE_NOT_ACTIVE state=${current.state}`);
    return this.appendClosure(current, {
      state: 'revoked',
      idempotencyKey: normalized.idempotencyKey,
      recordedAt: normalized.recordedAt,
      reason: normalized.reason,
      metadata: normalized.metadata,
    });
  }

  async assertCommit(input: AuthorityLeaseCommitInput): Promise<AuthorityLeaseCommitProof> {
    const projectId = nonEmpty(input.projectId, 'projectId');
    const resource = nonEmpty(input.resource, 'resource');
    const resourceId = authorityLeaseResourceId(projectId, resource);
    const current = await requireCurrent(this.store, resourceId);
    const at = canonicalTime(input.at, 'commit time');
    const owner = nonEmpty(input.owner, 'owner');
    const tokenHash = await hashLeaseToken(input.token);
    const fencingVersion = positiveSafeInteger(input.fencingVersion, 'fencingVersion');

    if (current.state !== 'active') throw new Error(`LEASE_NOT_ACTIVE state=${current.state}`);
    if (Date.parse(current.expiresAt) <= Date.parse(at)) {
      throw new Error(`LEASE_EXPIRED resource=${resourceId} expiresAt=${current.expiresAt}`);
    }
    assertLeaseOwnerToken(current, owner, tokenHash);
    if (current.fencingVersion !== fencingVersion) {
      throw new Error(
        `LEASE_FENCE_STALE resource=${resourceId} expected=${current.fencingVersion} incoming=${fencingVersion}`,
      );
    }
    return {
      resourceId,
      leaseRevisionId: current.revisionId,
      projectId,
      resource,
      owner,
      tokenHash,
      fencingVersion,
      expiresAt: current.expiresAt,
      validatedAt: at,
    };
  }

  getCurrent(projectId: string, resource: string): Promise<AuthorityLeaseRevision | null> {
    return this.store.getCurrent(authorityLeaseResourceId(projectId, resource));
  }

  getHistory(projectId: string, resource: string): Promise<AuthorityLeaseRevision[]> {
    return this.store.getHistory(authorityLeaseResourceId(projectId, resource));
  }

  private async closeLease(input: {
    projectId: string;
    resource: string;
    owner: string;
    tokenHash: string;
    expectedRevision: number;
    recordedAt: string;
    idempotencyKey: string;
    reason: string | null;
    metadata: Record<string, CanonicalJsonValue>;
    state: 'released';
    defaultReason: string;
  }): Promise<AuthorityLeaseMutationResult> {
    const resourceId = authorityLeaseResourceId(input.projectId, input.resource);
    const current = await requireCurrent(this.store, resourceId);
    assertLeaseOwnerToken(current, input.owner, input.tokenHash);
    if (current.revision !== input.expectedRevision) {
      throw new Error(
        `STALE_LEASE_REVISION resource=${resourceId} expected=${input.expectedRevision} current=${current.revision}`,
      );
    }
    if (current.state !== 'active') throw new Error(`LEASE_NOT_ACTIVE state=${current.state}`);
    return this.appendClosure(current, {
      state: input.state,
      idempotencyKey: input.idempotencyKey,
      recordedAt: input.recordedAt,
      reason: input.reason ?? input.defaultReason,
      metadata: input.metadata,
    });
  }

  private async appendClosure(
    current: AuthorityLeaseRevision,
    input: {
      state: 'released' | 'expired' | 'revoked';
      idempotencyKey: string;
      recordedAt: string;
      reason: string;
      metadata: Record<string, CanonicalJsonValue>;
    },
  ): Promise<AuthorityLeaseMutationResult> {
    const transitionKey = authorityLeaseTransitionKey(current.resourceId, input.idempotencyKey);
    const transitionIntentHash = canonicalHash128({
      schemaVersion: AUTHORITY_LEASE_SCHEMA_VERSION,
      serializationVersion: CANONICAL_JSON_WIRE_VERSION,
      targetState: input.state,
      resourceId: current.resourceId,
      expectedRevision: current.revision,
      recordedAt: input.recordedAt,
      reason: input.reason,
      metadata: input.metadata,
    });
    const historical = await this.store.getByTransitionKey(transitionKey);
    if (historical) {
      if (historical.transitionIntentHash !== transitionIntentHash) {
        throw new Error(`LEASE_TRANSITION_CONFLICT key=${transitionKey}`);
      }
      return {
        revision: historical,
        current: await requireCurrent(this.store, current.resourceId),
        appended: false,
      };
    }
    if (Date.parse(input.recordedAt) <= Date.parse(current.systemFrom)) {
      throw new Error(`LEASE_SYSTEM_TIME_NOT_MONOTONIC resource=${current.resourceId}`);
    }
    const revision = sealAuthorityLeaseRevision({
      revisionId: authorityLeaseRevisionId(current.resourceId, current.revision + 1, transitionKey),
      resourceId: current.resourceId,
      transitionKey,
      transitionIntentHash,
      operationKey: input.idempotencyKey,
      revision: current.revision + 1,
      state: input.state,
      projectId: current.projectId,
      resource: current.resource,
      owner: current.owner,
      tokenHash: current.tokenHash,
      fencingVersion: current.fencingVersion,
      acquiredAt: current.acquiredAt,
      expiresAt: current.expiresAt,
      systemFrom: input.recordedAt,
      sourceRef: current.sourceRef,
      reason: nonEmpty(input.reason, 'lease closure reason'),
      metadata: mergeLeaseMetadata(current.metadata, input.metadata),
      previousRevisionId: current.revisionId,
    });
    const appended = await this.store.appendRevision(revision, current.revision);
    return {
      revision: appended.revision,
      current: await requireCurrent(this.store, current.resourceId),
      appended: appended.appended,
    };
  }
}

/**
 * Single-process reference resource boundary.
 *
 * Lease validation and synchronous value mutation occur in one serialized
 * critical section with no await between final validation and commit. External
 * providers require their own conditional-write/fencing adapter and cannot use
 * this class as proof of provider-side atomicity.
 */
export class InMemoryFencedResourceStore {
  private readonly resources = new Map<string, FencedResourceSnapshot>();
  private readonly commits = new Map<string, { resourceId: string; payloadHash: string; snapshot: FencedResourceSnapshot }>();
  private readonly resourceTails = new Map<string, Promise<void>>();

  constructor(private readonly leases: AuthorityLeaseService) {}

  commit(input: FencedResourceCommitInput): Promise<FencedResourceCommitResult> {
    const resourceId = authorityLeaseResourceId(input.lease.projectId, input.lease.resource);
    return this.enqueue(resourceId, async () => {
      const proof = await this.leases.assertCommit(input.lease);
      const commitKey = nonEmpty(input.commitKey, 'commitKey');
      const expectedVersion = nonNegativeSafeInteger(input.expectedVersion, 'expectedVersion');
      const value = canonicalizeJsonValue(input.value);
      const payloadHash = canonicalHash128({
        resourceId,
        commitKey,
        expectedVersion,
        fencingVersion: proof.fencingVersion,
        value,
      });
      const duplicate = this.commits.get(commitKey);
      if (duplicate) {
        if (duplicate.resourceId !== resourceId || duplicate.payloadHash !== payloadHash) {
          throw new Error(`FENCED_COMMIT_CONFLICT key=${commitKey}`);
        }
        return {
          snapshot: cloneFencedSnapshot(duplicate.snapshot),
          committed: false,
          leaseProof: proof,
        };
      }

      const current = this.resources.get(resourceId) ?? {
        resourceId,
        version: 0,
        acceptedFencingVersion: 0,
        value: null,
        valueHash: canonicalHash128(null),
        lastCommitKey: null,
      };
      if (current.version !== expectedVersion) {
        throw new Error(
          `STALE_FENCED_RESOURCE resource=${resourceId} expected=${expectedVersion} current=${current.version}`,
        );
      }
      if (proof.fencingVersion < current.acceptedFencingVersion) {
        throw new Error(
          `FENCED_COMMIT_STALE resource=${resourceId} accepted=${current.acceptedFencingVersion} incoming=${proof.fencingVersion}`,
        );
      }

      const next: FencedResourceSnapshot = {
        resourceId,
        version: current.version + 1,
        acceptedFencingVersion: proof.fencingVersion,
        value,
        valueHash: canonicalHash128(value),
        lastCommitKey: commitKey,
      };
      this.resources.set(resourceId, cloneFencedSnapshot(next));
      this.commits.set(commitKey, { resourceId, payloadHash, snapshot: cloneFencedSnapshot(next) });
      return { snapshot: cloneFencedSnapshot(next), committed: true, leaseProof: proof };
    });
  }

  read(projectId: string, resource: string): FencedResourceSnapshot | null {
    const snapshot = this.resources.get(authorityLeaseResourceId(projectId, resource));
    return snapshot ? cloneFencedSnapshot(snapshot) : null;
  }

  private enqueue<T>(resourceId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.resourceTails.get(resourceId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.resourceTails.set(resourceId, tail);
    return result.finally(() => {
      if (this.resourceTails.get(resourceId) === tail) this.resourceTails.delete(resourceId);
    });
  }
}

export function authorityLeaseResourceId(projectId: string, resource: string): string {
  const project = nonEmpty(projectId, 'projectId');
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: project,
    resourceType: 'lease-resource',
    resourceId: canonicalHash128({ projectId: project, resource: nonEmpty(resource, 'resource') }),
  }, 'lsr').id);
}

export function authorityLeaseTransitionKey(resourceId: string, idempotencyKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: nonEmpty(resourceId, 'resourceId'),
    resourceType: 'lease-transition',
    resourceId: nonEmpty(idempotencyKey, 'idempotencyKey'),
  }, 'lst').id);
}

export function sealAuthorityLeaseRevision(
  input: Omit<AuthorityLeaseRevision, 'schemaVersion' | 'serializationVersion' | 'contentHash'>,
): AuthorityLeaseRevision {
  const canonical = canonicalizeJsonValue({
    schemaVersion: AUTHORITY_LEASE_SCHEMA_VERSION,
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    ...input,
  });
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error('authority lease revision must canonicalize to an object');
  }
  const revision = canonical as unknown as Omit<AuthorityLeaseRevision, 'contentHash'>;
  return { ...revision, contentHash: canonicalHash128(canonical) };
}

export function assertAuthorityLeaseRevision(revision: AuthorityLeaseRevision): void {
  if (revision.schemaVersion !== AUTHORITY_LEASE_SCHEMA_VERSION) {
    throw new Error(`Unsupported authority lease schema ${revision.schemaVersion}`);
  }
  if (revision.serializationVersion !== CANONICAL_JSON_WIRE_VERSION) {
    throw new Error(`Unsupported authority lease serialization ${revision.serializationVersion}`);
  }
  if (!isLeaseState(revision.state)) throw new Error(`Unsupported lease state ${String(revision.state)}`);
  positiveSafeInteger(revision.revision, 'revision');
  positiveSafeInteger(revision.fencingVersion, 'fencingVersion');
  nonEmpty(revision.revisionId, 'revisionId');
  nonEmpty(revision.resourceId, 'resourceId');
  nonEmpty(revision.transitionKey, 'transitionKey');
  nonEmpty(revision.transitionIntentHash, 'transitionIntentHash');
  nonEmpty(revision.operationKey, 'operationKey');
  nonEmpty(revision.projectId, 'projectId');
  nonEmpty(revision.resource, 'resource');
  nonEmpty(revision.owner, 'owner');
  if (!/^[0-9a-f]{64}$/i.test(revision.tokenHash)) throw new Error('lease tokenHash must be SHA-256 hex');
  const acquiredAt = canonicalTime(revision.acquiredAt, 'acquiredAt');
  const expiresAt = canonicalTime(revision.expiresAt, 'expiresAt');
  canonicalTime(revision.systemFrom, 'systemFrom');
  if (Date.parse(expiresAt) <= Date.parse(acquiredAt)) throw new Error('lease expiresAt must be after acquiredAt');
  if (revision.state === 'active' && revision.reason === null && revision.revision > 1) {
    throw new Error('non-initial active lease revision requires reason');
  }
  if (revision.state !== 'active' && !revision.reason) {
    throw new Error(`lease ${revision.state} revision requires reason`);
  }
  if (revision.revision === 1 && revision.previousRevisionId !== null) {
    throw new Error('initial lease revision cannot have parent');
  }
  if (revision.revision > 1 && !revision.previousRevisionId) {
    throw new Error('non-initial lease revision requires parent');
  }
  const expectedResourceId = authorityLeaseResourceId(revision.projectId, revision.resource);
  if (revision.resourceId !== expectedResourceId) {
    throw new Error(`LEASE_RESOURCE_ID_MISMATCH expected=${expectedResourceId} actual=${revision.resourceId}`);
  }
  const expectedRevisionId = authorityLeaseRevisionId(
    revision.resourceId,
    revision.revision,
    revision.transitionKey,
  );
  if (revision.revisionId !== expectedRevisionId) {
    throw new Error(`LEASE_REVISION_ID_MISMATCH expected=${expectedRevisionId} actual=${revision.revisionId}`);
  }
  const expectedHash = sealAuthorityLeaseRevision({
    revisionId: revision.revisionId,
    resourceId: revision.resourceId,
    transitionKey: revision.transitionKey,
    transitionIntentHash: revision.transitionIntentHash,
    operationKey: revision.operationKey,
    revision: revision.revision,
    state: revision.state,
    projectId: revision.projectId,
    resource: revision.resource,
    owner: revision.owner,
    tokenHash: revision.tokenHash,
    fencingVersion: revision.fencingVersion,
    acquiredAt: revision.acquiredAt,
    expiresAt: revision.expiresAt,
    systemFrom: revision.systemFrom,
    sourceRef: revision.sourceRef,
    reason: revision.reason,
    metadata: revision.metadata,
    previousRevisionId: revision.previousRevisionId,
  }).contentHash;
  if (revision.contentHash !== expectedHash) {
    throw new Error(`LEASE_REVISION_HASH_MISMATCH id=${revision.revisionId}`);
  }
}

export function assertInitialLeaseRevision(revision: AuthorityLeaseRevision): void {
  assertAuthorityLeaseRevision(revision);
  if (revision.revision !== 1
    || revision.state !== 'active'
    || revision.fencingVersion !== 1
    || revision.previousRevisionId !== null) {
    throw new Error(`LEASE_INITIAL_REVISION_INVALID resource=${revision.resourceId}`);
  }
}

export function assertAuthorityLeaseContinuity(
  current: AuthorityLeaseRevision,
  next: AuthorityLeaseRevision,
): void {
  assertAuthorityLeaseRevision(current);
  assertAuthorityLeaseRevision(next);
  if (next.previousRevisionId !== current.revisionId) {
    throw new Error(`LEASE_PARENT_MISMATCH resource=${next.resourceId}`);
  }
  if (next.revision !== current.revision + 1) {
    throw new Error(
      `LEASE_REVISION_SEQUENCE resource=${next.resourceId} expected=${current.revision + 1} incoming=${next.revision}`,
    );
  }
  if (next.resourceId !== current.resourceId
    || next.projectId !== current.projectId
    || next.resource !== current.resource
    || next.sourceRef !== current.sourceRef) {
    throw new Error(`LEASE_RESOURCE_IDENTITY_MUTATION resource=${next.resourceId}`);
  }
  if (Date.parse(next.systemFrom) <= Date.parse(current.systemFrom)) {
    throw new Error(`LEASE_SYSTEM_TIME_NOT_MONOTONIC resource=${next.resourceId}`);
  }

  if (next.state === 'active') {
    if (current.state === 'active' && next.fencingVersion === current.fencingVersion) {
      if (next.owner !== current.owner
        || next.tokenHash !== current.tokenHash
        || next.acquiredAt !== current.acquiredAt) {
        throw new Error(`LEASE_RENEWAL_IDENTITY_MUTATION resource=${next.resourceId}`);
      }
      if (Date.parse(next.systemFrom) >= Date.parse(current.expiresAt)) {
        throw new Error(`LEASE_RENEWAL_AFTER_EXPIRY resource=${next.resourceId}`);
      }
      if (Date.parse(next.expiresAt) <= Date.parse(current.expiresAt)) {
        throw new Error(`LEASE_RENEWAL_MUST_EXTEND resource=${next.resourceId}`);
      }
      return;
    }

    if (next.fencingVersion !== current.fencingVersion + 1) {
      throw new Error(
        `LEASE_FENCE_SEQUENCE resource=${next.resourceId} expected=${current.fencingVersion + 1} incoming=${next.fencingVersion}`,
      );
    }
    if (current.state === 'active'
      && Date.parse(next.systemFrom) < Date.parse(current.expiresAt)) {
      throw new Error(`LEASE_REACQUIRE_BEFORE_EXPIRY resource=${next.resourceId}`);
    }
    if (next.acquiredAt !== next.systemFrom) {
      throw new Error(`LEASE_REACQUIRE_ACQUIRED_AT_MISMATCH resource=${next.resourceId}`);
    }
    return;
  }

  if (current.state !== 'active') {
    throw new Error(`LEASE_TERMINAL_TRANSITION_INVALID from=${current.state} to=${next.state}`);
  }
  if (next.owner !== current.owner
    || next.tokenHash !== current.tokenHash
    || next.fencingVersion !== current.fencingVersion
    || next.acquiredAt !== current.acquiredAt
    || next.expiresAt !== current.expiresAt) {
    throw new Error(`LEASE_CLOSURE_IDENTITY_MUTATION resource=${next.resourceId}`);
  }
}

export function cloneAuthorityLeaseRevision(
  revision: AuthorityLeaseRevision,
): AuthorityLeaseRevision {
  assertAuthorityLeaseRevision(revision);
  return structuredClone(revision);
}

async function normalizeAcquire(input: AuthorityLeaseAcquireInput) {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const resource = nonEmpty(input.resource, 'resource');
  const owner = nonEmpty(input.owner, 'owner');
  const token = assertLeaseToken(input.token);
  const ttlMs = leaseTtl(input.ttlMs);
  const recordedAt = canonicalTime(input.recordedAt, 'recordedAt');
  return {
    projectId,
    resource,
    owner,
    token,
    tokenHash: await hashLeaseToken(token),
    ttlMs,
    recordedAt,
    expiresAt: new Date(Date.parse(recordedAt) + ttlMs).toISOString(),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    sourceRef: nonEmpty(input.sourceRef, 'sourceRef'),
    metadata: canonicalLeaseMetadata(input.metadata ?? {}),
  };
}

async function normalizeRenew(input: AuthorityLeaseRenewInput) {
  const projectId = nonEmpty(input.projectId, 'projectId');
  const resource = nonEmpty(input.resource, 'resource');
  const owner = nonEmpty(input.owner, 'owner');
  const token = assertLeaseToken(input.token);
  const ttlMs = leaseTtl(input.ttlMs);
  const recordedAt = canonicalTime(input.recordedAt, 'recordedAt');
  return {
    projectId,
    resource,
    owner,
    token,
    tokenHash: await hashLeaseToken(token),
    expectedRevision: nonNegativeSafeInteger(input.expectedRevision, 'expectedRevision'),
    ttlMs,
    recordedAt,
    expiresAt: new Date(Date.parse(recordedAt) + ttlMs).toISOString(),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    metadata: canonicalLeaseMetadata(input.metadata ?? {}),
  };
}

async function normalizeRelease(input: AuthorityLeaseReleaseInput) {
  return {
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    owner: nonEmpty(input.owner, 'owner'),
    tokenHash: await hashLeaseToken(assertLeaseToken(input.token)),
    expectedRevision: nonNegativeSafeInteger(input.expectedRevision, 'expectedRevision'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    reason: optionalString(input.reason, 'reason'),
    metadata: canonicalLeaseMetadata(input.metadata ?? {}),
  };
}

function normalizeExpire(input: AuthorityLeaseExpireInput) {
  return {
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    expectedRevision: nonNegativeSafeInteger(input.expectedRevision, 'expectedRevision'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    reason: optionalString(input.reason, 'reason'),
    metadata: canonicalLeaseMetadata(input.metadata ?? {}),
  };
}

function normalizeRevoke(input: AuthorityLeaseRevokeInput) {
  return {
    projectId: nonEmpty(input.projectId, 'projectId'),
    resource: nonEmpty(input.resource, 'resource'),
    expectedRevision: nonNegativeSafeInteger(input.expectedRevision, 'expectedRevision'),
    recordedAt: canonicalTime(input.recordedAt, 'recordedAt'),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
    reason: nonEmpty(input.reason, 'reason'),
    metadata: canonicalLeaseMetadata(input.metadata ?? {}),
  };
}

function authorityLeaseRevisionId(resourceId: string, revision: number, transitionKey: string): string {
  return String(canonicalIdentity({
    scheme: 'agentic',
    authority: resourceId,
    resourceType: 'lease-revision',
    resourceId: canonicalHash128({ revision, transitionKey }),
  }, 'lsv').id);
}

async function requireCurrent(
  store: IAuthorityLeaseStore,
  resourceId: string,
): Promise<AuthorityLeaseRevision> {
  const current = await store.getCurrent(resourceId);
  if (!current) throw new Error(`LEASE_NOT_FOUND resource=${resourceId}`);
  return current;
}

function assertLeaseOwnerToken(
  current: AuthorityLeaseRevision,
  owner: string,
  tokenHash: string,
): void {
  if (current.owner !== owner) throw new Error(`LEASE_OWNER_MISMATCH resource=${current.resourceId}`);
  if (current.tokenHash !== tokenHash) throw new Error(`LEASE_TOKEN_MISMATCH resource=${current.resourceId}`);
}

async function hashLeaseToken(token: string): Promise<string> {
  return sha256Hex({ token: assertLeaseToken(token) });
}

function assertLeaseToken(value: string): string {
  const token = nonEmpty(value, 'lease token');
  if (token.length < 16 || token.length > 4096) {
    throw new Error('lease token length must be in [16,4096]');
  }
  return token;
}

function leaseTtl(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 86_400_000) {
    throw new Error('lease ttlMs must be a safe integer in [1000,86400000]');
  }
  return value;
}

function canonicalLeaseMetadata(value: unknown): Record<string, CanonicalJsonValue> {
  const canonical = canonicalizeJsonValue(value);
  if (!canonical || Array.isArray(canonical) || typeof canonical !== 'object') {
    throw new Error('lease metadata must canonicalize to an object');
  }
  return canonical as Record<string, CanonicalJsonValue>;
}

function mergeLeaseMetadata(
  current: Record<string, CanonicalJsonValue>,
  next: Record<string, CanonicalJsonValue>,
): Record<string, CanonicalJsonValue> {
  return canonicalLeaseMetadata({ ...current, ...next });
}

function cloneFencedSnapshot(snapshot: FencedResourceSnapshot): FencedResourceSnapshot {
  return structuredClone(snapshot);
}

function compareAuthorityLeaseRevision(
  left: AuthorityLeaseRevision,
  right: AuthorityLeaseRevision,
): number {
  return left.systemFrom.localeCompare(right.systemFrom)
    || left.resourceId.localeCompare(right.resourceId)
    || left.revision - right.revision
    || left.revisionId.localeCompare(right.revisionId);
}

function isLeaseState(value: unknown): value is AuthorityLeaseState {
  return typeof value === 'string'
    && (AUTHORITY_LEASE_STATES as readonly string[]).includes(value);
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  nonNegativeSafeInteger(value, label);
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

function optionalString(value: string | undefined, label: string): string | null {
  if (value === undefined) return null;
  return nonEmpty(value, label);
}
