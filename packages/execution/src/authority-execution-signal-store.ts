import {
  canonicalHash128,
  canonicalSerialize,
} from '@cos/core';
import type {
  AuthorityExecutionSignal,
  IAuthorityExecutionSignalSink,
} from './authority-execution-evidence';

/**
 * Copy-safe append-only reference sink for execution/near-miss evidence.
 * Kept separate from the observed runtime so storage can be replaced without
 * making telemetry a dependency of protected operations.
 */
export class AuthorityExecutionSignalStore implements IAuthorityExecutionSignalSink {
  private readonly signals = new Map<string, AuthorityExecutionSignal>();

  async record(raw: AuthorityExecutionSignal): Promise<void> {
    const signal = cloneAndVerify(raw);
    const existing = this.signals.get(signal.signalId);
    if (existing) {
      if (existing.evidenceHash !== signal.evidenceHash) {
        throw new Error(`EXECUTION_SIGNAL_ID_CONFLICT id=${signal.signalId}`);
      }
      return;
    }
    this.signals.set(signal.signalId, signal);
  }

  async list(): Promise<AuthorityExecutionSignal[]> {
    return Array.from(this.signals.values())
      .map(signal => structuredClone(signal))
      .sort((left, right) =>
        left.recordedAt.localeCompare(right.recordedAt)
        || left.signalId.localeCompare(right.signalId));
  }

  async findByOperation(operationId: string): Promise<AuthorityExecutionSignal[]> {
    const normalized = operationId.normalize('NFC').trim();
    if (!normalized) throw new Error('operationId must not be empty');
    return (await this.list()).filter(signal => signal.operationId === normalized);
  }
}

function cloneAndVerify(raw: AuthorityExecutionSignal): AuthorityExecutionSignal {
  const signal = structuredClone(raw);
  canonicalSerialize(signal);
  const { signalId: _signalId, evidenceHash: _evidenceHash, ...payload } = signal;
  const expected = canonicalHash128(payload);
  if (expected !== signal.evidenceHash) {
    throw new Error(`EXECUTION_SIGNAL_HASH_MISMATCH id=${signal.signalId}`);
  }
  return signal;
}
