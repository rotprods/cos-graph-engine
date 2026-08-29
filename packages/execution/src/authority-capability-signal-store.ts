import { canonicalHash128, canonicalSerialize } from '@cos/core';
import type {
  AuthorityCapabilitySignal,
  AuthorityCapabilitySignalType,
  IAuthorityCapabilitySignalSink,
} from './authority-capability-evidence';

export interface AuthorityCapabilitySignalQuery {
  projectId?: string;
  operationId?: string | null;
  capability?: string;
  types?: AuthorityCapabilitySignalType[];
  nearMiss?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuthorityCapabilitySignalAppendResult {
  signal: AuthorityCapabilitySignal;
  appended: boolean;
}

/** Append-only, payload-bound reference store for capability evidence. */
export class InMemoryAuthorityCapabilitySignalStore implements IAuthorityCapabilitySignalSink {
  private readonly byId = new Map<string, AuthorityCapabilitySignal>();
  private readonly ordered: AuthorityCapabilitySignal[] = [];

  append(raw: AuthorityCapabilitySignal): AuthorityCapabilitySignalAppendResult {
    const signal = validateAndClone(raw);
    const existing = this.byId.get(signal.signalId);
    if (existing) {
      if (existing.contentHash !== signal.contentHash
        || canonicalHash128(existing) !== canonicalHash128(signal)) {
        throw new Error(`CAPABILITY_SIGNAL_ID_CONFLICT id=${signal.signalId}`);
      }
      return { signal: cloneSignal(existing), appended: false };
    }
    this.byId.set(signal.signalId, signal);
    this.ordered.push(signal);
    this.ordered.sort(compareSignals);
    return { signal: cloneSignal(signal), appended: true };
  }

  get(signalId: string): AuthorityCapabilitySignal | null {
    const signal = this.byId.get(nonEmpty(signalId, 'signalId'));
    return signal ? cloneSignal(signal) : null;
  }

  query(input: AuthorityCapabilitySignalQuery = {}): AuthorityCapabilitySignal[] {
    const from = input.from === undefined ? null : canonicalTime(input.from, 'signal query from');
    const to = input.to === undefined ? null : canonicalTime(input.to, 'signal query to');
    if (from !== null && to !== null && Date.parse(to) < Date.parse(from)) {
      throw new Error('signal query to cannot precede from');
    }
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100_000) {
      throw new Error('signal query limit must be a safe integer in [0,100000]');
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new Error('signal query offset must be a non-negative safe integer');
    }
    const types = input.types ? new Set(input.types) : null;
    return this.ordered
      .filter(signal => input.projectId === undefined || signal.projectId === input.projectId)
      .filter(signal => input.operationId === undefined || signal.operationId === input.operationId)
      .filter(signal => input.capability === undefined || signal.capability === input.capability)
      .filter(signal => types === null || types.has(signal.type))
      .filter(signal => input.nearMiss === undefined || signal.nearMiss === input.nearMiss)
      .filter(signal => from === null || Date.parse(signal.occurredAt) >= Date.parse(from))
      .filter(signal => to === null || Date.parse(signal.occurredAt) <= Date.parse(to))
      .slice(offset, offset + limit)
      .map(cloneSignal);
  }

  size(): number { return this.ordered.length; }
}

function validateAndClone(signal: AuthorityCapabilitySignal): AuthorityCapabilitySignal {
  canonicalSerialize(signal);
  if (signal.schemaVersion !== 1) {
    throw new Error(`Unsupported capability signal schema ${signal.schemaVersion}`);
  }
  const expectedId = `capsig_${canonicalHash128({
    schemaVersion: signal.schemaVersion,
    type: signal.type,
    outcome: signal.outcome,
    nearMiss: signal.nearMiss,
    projectId: signal.projectId,
    principalId: signal.principalId,
    capability: signal.capability,
    resourceUri: signal.resourceUri,
    operationId: signal.operationId,
    correlationId: signal.correlationId,
    causationId: signal.causationId,
    occurredAt: canonicalTime(signal.occurredAt, 'signal occurredAt'),
    errorCode: signal.errorCode,
    details: signal.details,
  })}`;
  if (expectedId !== signal.signalId) {
    throw new Error(`CAPABILITY_SIGNAL_ID_MISMATCH expected=${expectedId} actual=${signal.signalId}`);
  }
  const expectedHash = canonicalHash128({
    schemaVersion: signal.schemaVersion,
    type: signal.type,
    outcome: signal.outcome,
    nearMiss: signal.nearMiss,
    projectId: signal.projectId,
    principalId: signal.principalId,
    capability: signal.capability,
    resourceUri: signal.resourceUri,
    operationId: signal.operationId,
    correlationId: signal.correlationId,
    causationId: signal.causationId,
    occurredAt: canonicalTime(signal.occurredAt, 'signal occurredAt'),
    errorCode: signal.errorCode,
    details: signal.details,
    signalId: signal.signalId,
  });
  if (expectedHash !== signal.contentHash) {
    throw new Error(`CAPABILITY_SIGNAL_HASH_MISMATCH id=${signal.signalId}`);
  }
  return cloneSignal(signal);
}

function cloneSignal(signal: AuthorityCapabilitySignal): AuthorityCapabilitySignal {
  return structuredClone(signal);
}

function compareSignals(left: AuthorityCapabilitySignal, right: AuthorityCapabilitySignal): number {
  return left.occurredAt.localeCompare(right.occurredAt)
    || left.signalId.localeCompare(right.signalId);
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
