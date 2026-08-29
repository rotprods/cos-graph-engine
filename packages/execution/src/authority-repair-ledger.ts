import {
  canonicalHash128,
  canonicalIdentity,
  canonicalSerialize,
  type ProvenanceRef,
} from '@cos/core';

export type AuthorityRepairKind =
  | 'agent_evidence_append'
  | 'lease_release'
  | 'capability_signal_delivery'
  | 'telemetry_delivery';

export type AuthorityRepairState =
  | 'pending'
  | 'leased'
  | 'resolved'
  | 'abandoned';

export interface AuthorityRepairError {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export interface AuthorityRepairRevision {
  revisionId: string;
  repairId: string;
  operationKey: string;
  revision: number;
  projectId: string;
  operationId: string | null;
  correlationId: string | null;
  kind: AuthorityRepairKind;
  dedupeKey: string;
  state: AuthorityRepairState;
  payload: Record<string, unknown>;
  sensitivity: 'internal' | 'private' | 'restricted';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leaseOwnerId: string | null;
  leaseExpiresAt: string | null;
  fencingToken: number;
  error: AuthorityRepairError | null;
  resolution: Record<string, unknown> | null;
  provenance: ProvenanceRef[];
  recordedAt: string;
  previousRevisionId: string | null;
  contentHash: string;
}

export interface AuthorityRepairView extends AuthorityRepairRevision {
  effectiveState: AuthorityRepairState;
  ready: boolean;
}

export interface AuthorityRepairAppendResult {
  revision: AuthorityRepairRevision;
  appended: boolean;
}

export interface IAuthorityRepairStore {
  append(
    revision: AuthorityRepairRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityRepairAppendResult>;
  getCurrent(repairId: string): Promise<AuthorityRepairRevision | null>;
  getByDedupeKey(projectId: string, dedupeKey: string): Promise<AuthorityRepairRevision | null>;
  getHistory(repairId: string): Promise<AuthorityRepairRevision[]>;
  listProject(projectId: string): Promise<AuthorityRepairRevision[]>;
}

export interface AuthorityRepairEnqueueInput {
  projectId: string;
  operationId?: string | null;
  correlationId?: string | null;
  kind: AuthorityRepairKind;
  dedupeKey: string;
  payload: Record<string, unknown>;
  sensitivity?: 'internal' | 'private' | 'restricted';
  maxAttempts?: number;
  nextAttemptAt: string;
  idempotencyKey: string;
  provenance: ProvenanceRef[];
  recordedAt: string;
}

export interface AuthorityRepairClaimInput {
  repairId: string;
  expectedRevision: number;
  ownerId: string;
  at: string;
  ttlMs: number;
  idempotencyKey: string;
}

export interface AuthorityRepairResolveInput {
  repairId: string;
  expectedRevision: number;
  ownerId: string;
  fencingToken: number;
  at: string;
  resolution: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AuthorityRepairFailInput {
  repairId: string;
  expectedRevision: number;
  ownerId: string;
  fencingToken: number;
  at: string;
  retryAt: string;
  error: AuthorityRepairError;
  idempotencyKey: string;
}

/** Reference append-only in-memory store. */
export class InMemoryAuthorityRepairStore implements IAuthorityRepairStore {
  private readonly histories = new Map<string, AuthorityRepairRevision[]>();
  private readonly byOperation = new Map<string, AuthorityRepairRevision>();
  private readonly byDedupe = new Map<string, AuthorityRepairRevision>();
  private readonly operationTails = new Map<string, Promise<void>>();

  append(
    revision: AuthorityRepairRevision,
    expectedCurrentRevision: number,
  ): Promise<AuthorityRepairAppendResult> {
    return this.enqueue(revision.repairId, async () => {
      const incoming = validateRevision(revision);
      const operationDuplicate = this.byOperation.get(incoming.operationKey);
      if (operationDuplicate) {
        if (operationDuplicate.contentHash !== incoming.contentHash) {
          throw new Error(`REPAIR_IDEMPOTENCY_CONFLICT key=${incoming.operationKey}`);
        }
        return { revision: cloneRevision(operationDuplicate), appended: false };
      }

      const dedupeKey = scopedDedupe(incoming.projectId, incoming.dedupeKey);
      const existingDedupe = this.byDedupe.get(dedupeKey);
      const history = this.histories.get(incoming.repairId) ?? [];
      const current = history.at(-1);
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedCurrentRevision) {
        throw new Error(`STALE_REPAIR_REVISION expected=${expectedCurrentRevision} current=${currentRevision}`);
      }
      if (incoming.revision !== currentRevision + 1) {
        throw new Error(`REPAIR_REVISION_SEQUENCE expected=${currentRevision + 1} incoming=${incoming.revision}`);
      }
      if (current) {
        if (incoming.previousRevisionId !== current.revisionId) {
          throw new Error(`REPAIR_REVISION_PARENT_MISMATCH repair=${incoming.repairId}`);
        }
        if (Date.parse(incoming.recordedAt) <= Date.parse(current.recordedAt)) {
          throw new Error(`REPAIR_SYSTEM_TIME_NOT_MONOTONIC repair=${incoming.repairId}`);
        }
      } else {
        if (incoming.previousRevisionId !== null) {
          throw new Error(`REPAIR_INITIAL_REVISION_HAS_PARENT repair=${incoming.repairId}`);
        }
        if (existingDedupe && existingDedupe.repairId !== incoming.repairId) {
          throw new Error(`REPAIR_DEDUPE_COLLISION key=${incoming.dedupeKey}`);
        }
      }

      const stored = cloneRevision(incoming);
      history.push(stored);
      this.histories.set(stored.repairId, history);
      this.byOperation.set(stored.operationKey, stored);
      this.byDedupe.set(dedupeKey, stored);
      return { revision: cloneRevision(stored), appended: true };
    });
  }

  async getCurrent(repairId: string): Promise<AuthorityRepairRevision | null> {
    const revision = this.histories.get(nonEmpty(repairId, 'repairId'))?.at(-1);
    return revision ? cloneRevision(revision) : null;
  }

  async getByDedupeKey(projectId: string, dedupeKey: string): Promise<AuthorityRepairRevision | null> {
    const revision = this.byDedupe.get(scopedDedupe(projectId, dedupeKey));
    return revision ? cloneRevision(revision) : null;
  }

  async getHistory(repairId: string): Promise<AuthorityRepairRevision[]> {
    return (this.histories.get(nonEmpty(repairId, 'repairId')) ?? []).map(cloneRevision);
  }

  async listProject(projectId: string): Promise<AuthorityRepairRevision[]> {
    const project = nonEmpty(projectId, 'projectId');
    return Array.from(this.histories.values())
      .flat()
      .filter(revision => revision.projectId === project)
      .map(cloneRevision)
      .sort(compareRevisions);
  }

  private enqueue<T>(repairId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(repairId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.operationTails.set(repairId, tail);
    return result.finally(() => {
      if (this.operationTails.get(repairId) === tail) this.operationTails.delete(repairId);
    });
  }
}

/**
 * Authority repair service with monotonic worker fencing.
 *
 * Expired `leased` revisions become ready again only through a new append-only
 * claim revision with a strictly larger fencing token. A stale worker cannot
 * resolve/fail a repair after another worker has reacquired it.
 */
export class AuthorityRepairService {
  constructor(private readonly store: IAuthorityRepairStore) {}

  async enqueue(input: AuthorityRepairEnqueueInput): Promise<AuthorityRepairAppendResult> {
    const normalized = normalizeEnqueue(input);
    const repairIdentity = canonicalIdentity({
      scheme: 'agentic',
      authority: normalized.projectId,
      resourceType: 'repair',
      resourceId: `${normalized.kind}:${normalized.dedupeKey}`,
    }, 'repair');
    const existing = await this.store.getByDedupeKey(
      normalized.projectId,
      normalized.dedupeKey,
    );
    if (existing) {
      if (existing.repairId !== String(repairIdentity.id)
        || existing.kind !== normalized.kind
        || existing.projectId !== normalized.projectId) {
        throw new Error(`REPAIR_DEDUPE_CONFLICT key=${normalized.dedupeKey}`);
      }
      const expectedHash = canonicalHash128({
        kind: normalized.kind,
        payload: normalized.payload,
        sensitivity: normalized.sensitivity,
        maxAttempts: normalized.maxAttempts,
        provenance: normalized.provenance,
      });
      const existingHash = canonicalHash128({
        kind: existing.kind,
        payload: existing.payload,
        sensitivity: existing.sensitivity,
        maxAttempts: existing.maxAttempts,
        provenance: existing.provenance,
      });
      if (expectedHash !== existingHash) {
        throw new Error(`REPAIR_DEDUPE_PAYLOAD_CONFLICT key=${normalized.dedupeKey}`);
      }
      return { revision: cloneRevision(existing), appended: false };
    }

    const revision = sealRevision({
      revisionId: revisionId(String(repairIdentity.id), 1, normalized.recordedAt),
      repairId: String(repairIdentity.id),
      operationKey: normalized.idempotencyKey,
      revision: 1,
      projectId: normalized.projectId,
      operationId: normalized.operationId,
      correlationId: normalized.correlationId,
      kind: normalized.kind,
      dedupeKey: normalized.dedupeKey,
      state: 'pending',
      payload: normalized.payload,
      sensitivity: normalized.sensitivity,
      attempts: 0,
      maxAttempts: normalized.maxAttempts,
      nextAttemptAt: normalized.nextAttemptAt,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      fencingToken: 0,
      error: null,
      resolution: null,
      provenance: normalized.provenance,
      recordedAt: normalized.recordedAt,
      previousRevisionId: null,
    });
    return this.store.append(revision, 0);
  }

  async claim(input: AuthorityRepairClaimInput): Promise<AuthorityRepairAppendResult> {
    const at = canonicalTime(input.at, 'repair claim at');
    const current = await this.requireCurrent(input.repairId);
    assertExpectedRevision(current, input.expectedRevision);
    const view = deriveView(current, at);
    if (!view.ready) {
      throw new Error(`REPAIR_NOT_READY repair=${current.repairId} state=${view.effectiveState}`);
    }
    if (current.attempts >= current.maxAttempts) {
      throw new Error(`REPAIR_MAX_ATTEMPTS_REACHED repair=${current.repairId}`);
    }
    if (!Number.isSafeInteger(input.ttlMs) || input.ttlMs < 1 || input.ttlMs > 3_600_000) {
      throw new Error('repair claim ttlMs must be a safe integer in [1,3600000]');
    }
    const ownerId = nonEmpty(input.ownerId, 'repair ownerId');
    const next = sealRevision({
      ...current,
      revisionId: revisionId(current.repairId, current.revision + 1, at),
      operationKey: nonEmpty(input.idempotencyKey, 'repair claim idempotencyKey'),
      revision: current.revision + 1,
      state: 'leased',
      attempts: current.attempts + 1,
      leaseOwnerId: ownerId,
      leaseExpiresAt: new Date(Date.parse(at) + input.ttlMs).toISOString(),
      fencingToken: current.fencingToken + 1,
      error: null,
      resolution: null,
      recordedAt: at,
      previousRevisionId: current.revisionId,
    });
    return this.store.append(next, current.revision);
  }

  async resolve(input: AuthorityRepairResolveInput): Promise<AuthorityRepairAppendResult> {
    const at = canonicalTime(input.at, 'repair resolve at');
    const current = await this.requireLeasedOwner(
      input.repairId,
      input.expectedRevision,
      input.ownerId,
      input.fencingToken,
      at,
    );
    const next = sealRevision({
      ...current,
      revisionId: revisionId(current.repairId, current.revision + 1, at),
      operationKey: nonEmpty(input.idempotencyKey, 'repair resolve idempotencyKey'),
      revision: current.revision + 1,
      state: 'resolved',
      leaseOwnerId: null,
      leaseExpiresAt: null,
      error: null,
      resolution: canonicalClone(input.resolution, 'repair resolution'),
      recordedAt: at,
      previousRevisionId: current.revisionId,
    });
    return this.store.append(next, current.revision);
  }

  async fail(input: AuthorityRepairFailInput): Promise<AuthorityRepairAppendResult> {
    const at = canonicalTime(input.at, 'repair fail at');
    const retryAt = canonicalTime(input.retryAt, 'repair retryAt');
    if (Date.parse(retryAt) < Date.parse(at)) {
      throw new Error('repair retryAt cannot precede failure time');
    }
    const current = await this.requireLeasedOwner(
      input.repairId,
      input.expectedRevision,
      input.ownerId,
      input.fencingToken,
      at,
    );
    const terminal = current.attempts >= current.maxAttempts;
    const next = sealRevision({
      ...current,
      revisionId: revisionId(current.repairId, current.revision + 1, at),
      operationKey: nonEmpty(input.idempotencyKey, 'repair fail idempotencyKey'),
      revision: current.revision + 1,
      state: terminal ? 'abandoned' : 'pending',
      nextAttemptAt: terminal ? current.nextAttemptAt : retryAt,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      error: normalizeError(input.error),
      resolution: null,
      recordedAt: at,
      previousRevisionId: current.revisionId,
    });
    return this.store.append(next, current.revision);
  }

  async get(repairId: string, at: string): Promise<AuthorityRepairView | null> {
    const current = await this.store.getCurrent(repairId);
    return current ? deriveView(current, canonicalTime(at, 'repair view at')) : null;
  }

  async history(repairId: string): Promise<AuthorityRepairRevision[]> {
    return this.store.getHistory(repairId);
  }

  async listReady(projectId: string, at: string, limit = 100): Promise<AuthorityRepairView[]> {
    const timestamp = canonicalTime(at, 'repair list at');
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10_000) {
      throw new Error('repair ready limit must be a safe integer in [0,10000]');
    }
    const revisions = await this.store.listProject(projectId);
    const latest = new Map<string, AuthorityRepairRevision>();
    for (const revision of revisions) latest.set(revision.repairId, revision);
    return Array.from(latest.values())
      .map(revision => deriveView(revision, timestamp))
      .filter(view => view.ready)
      .sort((left, right) => left.nextAttemptAt.localeCompare(right.nextAttemptAt)
        || left.repairId.localeCompare(right.repairId))
      .slice(0, limit);
  }

  private async requireCurrent(repairId: string): Promise<AuthorityRepairRevision> {
    const current = await this.store.getCurrent(nonEmpty(repairId, 'repairId'));
    if (!current) throw new Error(`REPAIR_NOT_FOUND id=${repairId}`);
    return current;
  }

  private async requireLeasedOwner(
    repairId: string,
    expectedRevision: number,
    ownerId: string,
    fencingToken: number,
    at: string,
  ): Promise<AuthorityRepairRevision> {
    const current = await this.requireCurrent(repairId);
    assertExpectedRevision(current, expectedRevision);
    if (current.state !== 'leased') {
      throw new Error(`REPAIR_NOT_LEASED repair=${repairId} state=${current.state}`);
    }
    if (current.leaseOwnerId !== nonEmpty(ownerId, 'repair ownerId')) {
      throw new Error(`STALE_REPAIR_OWNER repair=${repairId}`);
    }
    if (!Number.isSafeInteger(fencingToken) || fencingToken < 1
      || current.fencingToken !== fencingToken) {
      throw new Error(`STALE_REPAIR_FENCING_TOKEN repair=${repairId}`);
    }
    if (current.leaseExpiresAt === null || Date.parse(at) > Date.parse(current.leaseExpiresAt)) {
      throw new Error(`REPAIR_LEASE_EXPIRED repair=${repairId}`);
    }
    return current;
  }
}

export interface AuthorityRepairHandlerContext {
  repair: AuthorityRepairView;
  ownerId: string;
  fencingToken: number;
  at: string;
}

export interface AuthorityRepairHandler {
  readonly kind: AuthorityRepairKind;
  handle(context: AuthorityRepairHandlerContext): Promise<Record<string, unknown>>;
}

export interface AuthorityRepairWorkerOptions {
  ownerId: string;
  leaseTtlMs: number;
  retryDelayMs?: number;
  maxBatch?: number;
}

/** Deterministic single-batch worker; scheduling belongs to orchestration. */
export class AuthorityRepairWorker {
  private readonly handlers = new Map<AuthorityRepairKind, AuthorityRepairHandler>();

  constructor(
    private readonly service: AuthorityRepairService,
    handlers: AuthorityRepairHandler[],
    private readonly options: AuthorityRepairWorkerOptions,
  ) {
    for (const handler of handlers) {
      if (this.handlers.has(handler.kind)) {
        throw new Error(`Duplicate repair handler kind=${handler.kind}`);
      }
      this.handlers.set(handler.kind, handler);
    }
    nonEmpty(options.ownerId, 'repair worker ownerId');
    if (!Number.isSafeInteger(options.leaseTtlMs) || options.leaseTtlMs < 1) {
      throw new Error('repair worker leaseTtlMs must be a positive safe integer');
    }
  }

  async runProject(projectId: string, at: string): Promise<{
    claimed: number;
    resolved: number;
    failed: number;
    abandoned: number;
    missingHandler: number;
  }> {
    const timestamp = canonicalTime(at, 'repair worker at');
    const maxBatch = this.options.maxBatch ?? 100;
    const ready = await this.service.listReady(projectId, timestamp, maxBatch);
    const report = { claimed: 0, resolved: 0, failed: 0, abandoned: 0, missingHandler: 0 };
    for (const candidate of ready) {
      const handler = this.handlers.get(candidate.kind);
      if (!handler) {
        report.missingHandler += 1;
        continue;
      }
      let claimed: AuthorityRepairView;
      try {
        const claim = await this.service.claim({
          repairId: candidate.repairId,
          expectedRevision: candidate.revision,
          ownerId: this.options.ownerId,
          at: timestamp,
          ttlMs: this.options.leaseTtlMs,
          idempotencyKey: `repair-worker-claim:${candidate.repairId}:${candidate.revision + 1}`,
        });
        claimed = deriveView(claim.revision, timestamp);
        report.claimed += 1;
      } catch {
        // Another worker won or state changed. That is expected contention.
        continue;
      }
      try {
        const resolution = await handler.handle({
          repair: claimed,
          ownerId: this.options.ownerId,
          fencingToken: claimed.fencingToken,
          at: timestamp,
        });
        await this.service.resolve({
          repairId: claimed.repairId,
          expectedRevision: claimed.revision,
          ownerId: this.options.ownerId,
          fencingToken: claimed.fencingToken,
          at: plusMs(timestamp, 1),
          resolution,
          idempotencyKey: `repair-worker-resolve:${claimed.repairId}:${claimed.revision + 1}`,
        });
        report.resolved += 1;
      } catch (error) {
        const failed = await this.service.fail({
          repairId: claimed.repairId,
          expectedRevision: claimed.revision,
          ownerId: this.options.ownerId,
          fencingToken: claimed.fencingToken,
          at: plusMs(timestamp, 1),
          retryAt: plusMs(timestamp, this.options.retryDelayMs ?? 60_000),
          error: {
            code: 'REPAIR_HANDLER_FAILED',
            message: message(error),
            retryable: true,
            details: { kind: claimed.kind },
          },
          idempotencyKey: `repair-worker-fail:${claimed.repairId}:${claimed.revision + 1}`,
        });
        report.failed += 1;
        if (failed.revision.state === 'abandoned') report.abandoned += 1;
      }
    }
    return report;
  }
}

function deriveView(revision: AuthorityRepairRevision, at: string): AuthorityRepairView {
  const expiredLease = revision.state === 'leased'
    && revision.leaseExpiresAt !== null
    && Date.parse(at) > Date.parse(revision.leaseExpiresAt);
  const effectiveState: AuthorityRepairState = expiredLease ? 'pending' : revision.state;
  const ready = effectiveState === 'pending'
    && revision.attempts < revision.maxAttempts
    && Date.parse(at) >= Date.parse(revision.nextAttemptAt);
  return { ...cloneRevision(revision), effectiveState, ready };
}

function normalizeEnqueue(input: AuthorityRepairEnqueueInput) {
  const recordedAt = canonicalTime(input.recordedAt, 'repair recordedAt');
  const nextAttemptAt = canonicalTime(input.nextAttemptAt, 'repair nextAttemptAt');
  if (Date.parse(nextAttemptAt) < Date.parse(recordedAt)) {
    throw new Error('repair nextAttemptAt cannot precede recordedAt');
  }
  const maxAttempts = input.maxAttempts ?? 10;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 1_000) {
    throw new Error('repair maxAttempts must be a safe integer in [1,1000]');
  }
  const provenance = input.provenance.map(cloneProvenance);
  if (provenance.length === 0) throw new Error('repair provenance is required');
  return {
    projectId: nonEmpty(input.projectId, 'repair projectId'),
    operationId: optional(input.operationId ?? undefined) ?? null,
    correlationId: optional(input.correlationId ?? undefined) ?? null,
    kind: input.kind,
    dedupeKey: nonEmpty(input.dedupeKey, 'repair dedupeKey'),
    payload: canonicalClone(input.payload, 'repair payload'),
    sensitivity: input.sensitivity ?? 'private',
    maxAttempts,
    nextAttemptAt,
    idempotencyKey: nonEmpty(input.idempotencyKey, 'repair idempotencyKey'),
    provenance,
    recordedAt,
  };
}

function sealRevision(
  input: Omit<AuthorityRepairRevision, 'contentHash'>,
): AuthorityRepairRevision {
  const contentHash = canonicalHash128({ ...input, contentHash: null });
  return validateRevision({ ...input, contentHash });
}

function validateRevision(input: AuthorityRepairRevision): AuthorityRepairRevision {
  canonicalSerialize(input);
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new Error('repair revision must be a positive safe integer');
  }
  if (!Number.isSafeInteger(input.attempts) || input.attempts < 0) {
    throw new Error('repair attempts must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error('repair maxAttempts must be a positive safe integer');
  }
  if (input.attempts > input.maxAttempts) {
    throw new Error('repair attempts cannot exceed maxAttempts');
  }
  if (!Number.isSafeInteger(input.fencingToken) || input.fencingToken < 0) {
    throw new Error('repair fencingToken must be a non-negative safe integer');
  }
  canonicalTime(input.recordedAt, 'repair recordedAt');
  canonicalTime(input.nextAttemptAt, 'repair nextAttemptAt');
  if (input.leaseExpiresAt !== null) canonicalTime(input.leaseExpiresAt, 'repair leaseExpiresAt');
  if (input.state === 'leased') {
    if (!input.leaseOwnerId || !input.leaseExpiresAt || input.fencingToken < 1) {
      throw new Error('leased repair requires owner, expiry and positive fencing token');
    }
  } else if (input.leaseOwnerId !== null || input.leaseExpiresAt !== null) {
    throw new Error(`repair state ${input.state} cannot retain a lease`);
  }
  if (input.state === 'resolved' && input.resolution === null) {
    throw new Error('resolved repair requires resolution evidence');
  }
  if (input.state !== 'resolved' && input.resolution !== null) {
    throw new Error(`repair state ${input.state} cannot contain resolution evidence`);
  }
  const expectedHash = canonicalHash128({ ...input, contentHash: null });
  if (input.contentHash !== expectedHash) {
    throw new Error(`REPAIR_CONTENT_HASH_MISMATCH repair=${input.repairId}`);
  }
  return cloneRevision(input);
}

function assertExpectedRevision(current: AuthorityRepairRevision, expected: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1 || current.revision !== expected) {
    throw new Error(`STALE_REPAIR_REVISION expected=${expected} current=${current.revision}`);
  }
}

function normalizeError(error: AuthorityRepairError): AuthorityRepairError {
  return {
    code: nonEmpty(error.code, 'repair error code'),
    message: nonEmpty(error.message, 'repair error message'),
    retryable: Boolean(error.retryable),
    details: canonicalClone(error.details ?? {}, 'repair error details'),
  };
}

function revisionId(repairId: string, revision: number, recordedAt: string): string {
  return `repairrev_${canonicalHash128({ repairId, revision, recordedAt })}`;
}

function scopedDedupe(projectId: string, dedupeKey: string): string {
  return `${nonEmpty(projectId, 'projectId')}\u0000${nonEmpty(dedupeKey, 'dedupeKey')}`;
}

function cloneRevision(revision: AuthorityRepairRevision): AuthorityRepairRevision {
  return structuredClone(revision);
}

function cloneProvenance(value: ProvenanceRef): ProvenanceRef {
  return canonicalClone(value, 'repair provenance');
}

function compareRevisions(left: AuthorityRepairRevision, right: AuthorityRepairRevision): number {
  return left.recordedAt.localeCompare(right.recordedAt)
    || left.repairId.localeCompare(right.repairId)
    || left.revision - right.revision;
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function plusMs(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
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
