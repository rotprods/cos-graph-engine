import type { EntityId, Timestamp } from './types';

export type EpistemicType =
  | 'observed'
  | 'derived'
  | 'inferred'
  | 'hypothesis'
  | 'decision'
  | 'unknown';

export interface ProvenanceRef {
  /** Canonical source identity (episode, event, document, commit, message, etc.). */
  source: string;
  /** Optional immutable revision/hash of the source material. */
  revision?: string;
  /** Agent/tool/run that produced this record. */
  actor?: string;
  /** Optional source-native locator (line range, message id, event offset, etc.). */
  locator?: string;
}

export interface BitemporalWindow {
  /** Domain time: when the assertion became true in the represented world. */
  validFrom: Timestamp;
  /** Domain time: exclusive end of validity. null means still valid. */
  validUntil: Timestamp | null;
  /** Observation time: when the system/source observed the assertion. */
  observedAt: Timestamp;
  /** System time: when COS recorded the assertion. */
  recordedAt: Timestamp;
  /** System time: when this revision was superseded. */
  supersededAt: Timestamp | null;
}

export interface TemporalEnvelope<T> {
  id: EntityId;
  value: T;
  temporal: BitemporalWindow;
  provenance: ProvenanceRef[];
  epistemicType: EpistemicType;
  confidence: number;
  supersedes: EntityId | null;
}

function instant(value: Timestamp): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO timestamp: ${value}`);
  return timestamp;
}

export function assertValidTemporalWindow(window: BitemporalWindow): void {
  const validFrom = instant(window.validFrom);
  const observedAt = instant(window.observedAt);
  const recordedAt = instant(window.recordedAt);

  if (window.validUntil !== null && instant(window.validUntil) <= validFrom) {
    throw new Error('validUntil must be strictly after validFrom');
  }
  if (window.supersededAt !== null && instant(window.supersededAt) < recordedAt) {
    throw new Error('supersededAt cannot precede recordedAt');
  }
  // observedAt may legitimately be after or before validFrom; late discovery is
  // a first-class requirement. recordedAt however cannot precede observation in
  // the normal ingestion model.
  if (recordedAt < observedAt) {
    throw new Error('recordedAt cannot precede observedAt');
  }
}

/** Was the record true in domain time T? */
export function isValidAt(window: BitemporalWindow, at: Timestamp): boolean {
  assertValidTemporalWindow(window);
  const t = instant(at);
  return t >= instant(window.validFrom)
    && (window.validUntil === null || t < instant(window.validUntil));
}

/** Had COS recorded this revision by system time T without superseding it yet? */
export function wasKnownAt(window: BitemporalWindow, at: Timestamp): boolean {
  assertValidTemporalWindow(window);
  const t = instant(at);
  return t >= instant(window.recordedAt)
    && (window.supersededAt === null || t < instant(window.supersededAt));
}

export function isCurrent<T>(record: TemporalEnvelope<T>): boolean {
  return record.temporal.validUntil === null && record.temporal.supersededAt === null;
}

/**
 * Creates a replacement revision without mutating historical evidence.
 * The caller persists both returned envelopes atomically in durable adapters.
 */
export function supersedeTemporal<T>(
  current: TemporalEnvelope<T>,
  replacementId: EntityId,
  replacementValue: T,
  at: Timestamp,
  provenance: ProvenanceRef[],
  options: { validFrom?: Timestamp; observedAt?: Timestamp; epistemicType?: EpistemicType; confidence?: number } = {},
): { previous: TemporalEnvelope<T>; replacement: TemporalEnvelope<T> } {
  if (!isCurrent(current)) throw new Error(`Temporal record ${current.id} is already closed or superseded`);
  instant(at);

  const previous: TemporalEnvelope<T> = {
    ...current,
    temporal: {
      ...current.temporal,
      validUntil: options.validFrom || at,
      supersededAt: at,
    },
  };

  const replacement: TemporalEnvelope<T> = {
    id: replacementId,
    value: replacementValue,
    temporal: {
      validFrom: options.validFrom || at,
      validUntil: null,
      observedAt: options.observedAt || at,
      recordedAt: at,
      supersededAt: null,
    },
    provenance: [...provenance],
    epistemicType: options.epistemicType || current.epistemicType,
    confidence: options.confidence ?? current.confidence,
    supersedes: current.id,
  };

  assertValidTemporalWindow(previous.temporal);
  assertValidTemporalWindow(replacement.temporal);
  return { previous, replacement };
}
