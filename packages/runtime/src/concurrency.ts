import { stableHash128 } from '@cos/core';

export interface VersionedValue<T> {
  value: T;
  version: number;
  contentHash: string;
}

export interface CompareAndSwapResult<T> {
  previous: VersionedValue<T>;
  current: VersionedValue<T>;
}

/**
 * In-memory reference CAS store. Persistent adapters must preserve the same
 * expected-version semantics transactionally.
 */
export class VersionedStore<T> {
  private state: VersionedValue<T>;

  constructor(initialValue: T, initialVersion = 0) {
    if (!Number.isInteger(initialVersion) || initialVersion < 0) {
      throw new Error('initialVersion must be a non-negative integer');
    }
    this.state = {
      value: initialValue,
      version: initialVersion,
      contentHash: stableHash128(initialValue),
    };
  }

  read(): VersionedValue<T> {
    return { ...this.state };
  }

  compareAndSwap(expectedVersion: number, nextValue: T): CompareAndSwapResult<T> {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new Error(`Invalid expectedVersion ${expectedVersion}`);
    }
    if (this.state.version !== expectedVersion) {
      throw new Error(`STALE_VERSION expected=${expectedVersion} current=${this.state.version}`);
    }

    const previous = this.read();
    this.state = {
      value: nextValue,
      version: previous.version + 1,
      contentHash: stableHash128(nextValue),
    };
    return { previous, current: this.read() };
  }

  /**
   * Update only when both version and content hash match the caller's view.
   * This protects callers that accidentally reuse a version across imported
   * state with different contents.
   */
  compareHashAndSwap(expectedVersion: number, expectedHash: string, nextValue: T): CompareAndSwapResult<T> {
    if (this.state.contentHash !== expectedHash) {
      throw new Error(`STALE_CONTENT expected=${expectedHash} current=${this.state.contentHash}`);
    }
    return this.compareAndSwap(expectedVersion, nextValue);
  }
}

export interface Lease {
  resource: string;
  owner: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
  /**
   * Monotonic fencing token for the resource. Persistent side-effect targets
   * should reject writes carrying a fencingVersion lower than the last seen
   * version, protecting against a paused worker waking after lease expiry.
   */
  fencingVersion: number;
}

export interface LeaseAcquireOptions {
  ttlMs?: number;
  nowMs?: number;
}

export interface ILeaseManager {
  acquire(resource: string, owner: string, options?: LeaseAcquireOptions): Lease;
  renew(resource: string, token: string, ttlMs?: number, nowMs?: number): Lease;
  release(resource: string, token: string): void;
  get(resource: string, nowMs?: number): Lease | null;
  assertHeld(resource: string, token: string, nowMs?: number): Lease;
}

/**
 * Token-based lease manager with TTL and monotonically increasing fencing
 * version. A stale owner cannot release/renew a lease after another owner
 * acquires it, and downstream stores can reject stale fencing versions.
 */
export class InMemoryLeaseManager implements ILeaseManager {
  private leases = new Map<string, Lease>();
  private versions = new Map<string, number>();
  private tokenCounter = 0;

  acquire(resource: string, owner: string, options: LeaseAcquireOptions = {}): Lease {
    const key = resource.trim();
    const principal = owner.trim();
    if (!key) throw new Error('Lease resource must not be empty');
    if (!principal) throw new Error('Lease owner must not be empty');

    const now = options.nowMs ?? Date.now();
    const ttl = this.validateTtl(options.ttlMs ?? 30_000);
    const current = this.get(key, now);
    if (current) {
      throw new Error(`LEASE_CONFLICT resource=${key} owner=${current.owner} expiresAt=${current.expiresAt}`);
    }

    const fencingVersion = (this.versions.get(key) || 0) + 1;
    this.versions.set(key, fencingVersion);
    const token = `lease_${stableHash128({ key, principal, fencingVersion, nonce: ++this.tokenCounter })}`;
    const lease: Lease = {
      resource: key,
      owner: principal,
      token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl).toISOString(),
      fencingVersion,
    };
    this.leases.set(key, lease);
    return { ...lease };
  }

  renew(resource: string, token: string, ttlMs = 30_000, nowMs = Date.now()): Lease {
    const lease = this.assertHeld(resource, token, nowMs);
    const ttl = this.validateTtl(ttlMs);
    const renewed: Lease = {
      ...lease,
      expiresAt: new Date(nowMs + ttl).toISOString(),
    };
    this.leases.set(resource, renewed);
    return { ...renewed };
  }

  release(resource: string, token: string): void {
    const current = this.leases.get(resource);
    if (!current) return;
    if (current.token !== token) throw new Error(`LEASE_TOKEN_MISMATCH resource=${resource}`);
    this.leases.delete(resource);
  }

  get(resource: string, nowMs = Date.now()): Lease | null {
    const current = this.leases.get(resource);
    if (!current) return null;
    if (Date.parse(current.expiresAt) <= nowMs) {
      this.leases.delete(resource);
      return null;
    }
    return { ...current };
  }

  assertHeld(resource: string, token: string, nowMs = Date.now()): Lease {
    const current = this.get(resource, nowMs);
    if (!current) throw new Error(`LEASE_NOT_HELD resource=${resource}`);
    if (current.token !== token) throw new Error(`LEASE_TOKEN_MISMATCH resource=${resource}`);
    return current;
  }

  private validateTtl(ttlMs: number): number {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 24 * 60 * 60 * 1000) {
      throw new Error(`Invalid lease TTL ${ttlMs}`);
    }
    return Math.floor(ttlMs);
  }
}

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface IdempotencyRecord<T = unknown> {
  key: string;
  payloadHash: string;
  status: IdempotencyStatus;
  owner: string;
  startedAt: string;
  completedAt?: string;
  result?: T;
  error?: string;
}

export interface IdempotencyClaim<T = unknown> {
  fresh: boolean;
  record: IdempotencyRecord<T>;
}

/**
 * Reference idempotency registry. Reusing the same key with a different
 * payload is a hard conflict rather than being silently treated as a retry.
 */
export class InMemoryIdempotencyRegistry {
  private records = new Map<string, IdempotencyRecord>();

  claim<T = unknown>(key: string, payload: unknown, owner: string, nowMs = Date.now()): IdempotencyClaim<T> {
    const normalizedKey = key.trim();
    const normalizedOwner = owner.trim();
    if (!normalizedKey) throw new Error('Idempotency key must not be empty');
    if (!normalizedOwner) throw new Error('Idempotency owner must not be empty');

    const payloadHash = stableHash128(payload);
    const existing = this.records.get(normalizedKey) as IdempotencyRecord<T> | undefined;
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new Error(`IDEMPOTENCY_CONFLICT key=${normalizedKey} expectedPayload=${existing.payloadHash} actualPayload=${payloadHash}`);
      }
      return { fresh: false, record: this.clone(existing) };
    }

    const record: IdempotencyRecord<T> = {
      key: normalizedKey,
      payloadHash,
      status: 'in_progress',
      owner: normalizedOwner,
      startedAt: new Date(nowMs).toISOString(),
    };
    this.records.set(normalizedKey, record);
    return { fresh: true, record: this.clone(record) };
  }

  complete<T = unknown>(key: string, owner: string, result: T, nowMs = Date.now()): IdempotencyRecord<T> {
    const record = this.requireOwned<T>(key, owner);
    const completed: IdempotencyRecord<T> = {
      ...record,
      status: 'completed',
      completedAt: new Date(nowMs).toISOString(),
      result,
      error: undefined,
    };
    this.records.set(key, completed);
    return this.clone(completed);
  }

  fail(key: string, owner: string, error: unknown, nowMs = Date.now()): IdempotencyRecord {
    const record = this.requireOwned(key, owner);
    const failed: IdempotencyRecord = {
      ...record,
      status: 'failed',
      completedAt: new Date(nowMs).toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    this.records.set(key, failed);
    return this.clone(failed);
  }

  get<T = unknown>(key: string): IdempotencyRecord<T> | null {
    const record = this.records.get(key) as IdempotencyRecord<T> | undefined;
    return record ? this.clone(record) : null;
  }

  private requireOwned<T = unknown>(key: string, owner: string): IdempotencyRecord<T> {
    const record = this.records.get(key) as IdempotencyRecord<T> | undefined;
    if (!record) throw new Error(`IDEMPOTENCY_NOT_CLAIMED key=${key}`);
    if (record.owner !== owner) throw new Error(`IDEMPOTENCY_OWNER_MISMATCH key=${key}`);
    if (record.status !== 'in_progress') throw new Error(`IDEMPOTENCY_ALREADY_TERMINAL key=${key} status=${record.status}`);
    return record;
  }

  private clone<T>(record: IdempotencyRecord<T>): IdempotencyRecord<T> {
    return { ...record };
  }
}
