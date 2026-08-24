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
    if (!Number.isInteger(initialVersion) || initialVersion < 0) throw new Error('initialVersion must be a non-negative integer');
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
}

export interface Lease {
  resource: string;
  owner: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
  version: number;
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
 * Token-based lease manager with TTL and monotonically increasing lease version.
 * A stale owner cannot release/renew a lease after another owner acquires it.
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
    if (current) throw new Error(`LEASE_CONFLICT resource=${key} owner=${current.owner} expiresAt=${current.expiresAt}`);

    const version = (this.versions.get(key) || 0) + 1;
    this.versions.set(key, version);
    const token = `lease_${stableHash128({ key, principal, version, nonce: ++this.tokenCounter })}`;
    const lease: Lease = {
      resource: key,
      owner: principal,
      token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl).toISOString(),
      version,
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
