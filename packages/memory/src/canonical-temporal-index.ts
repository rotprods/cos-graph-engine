import type { EntityId } from '@cos/core';
import type {
  ITemporalMemoryIndex,
  TemporalMemoryEnvelopeInput,
  TemporalMemoryQuery,
  VersionedTemporalMemoryEnvelope,
} from './temporal-memory';

/**
 * Canonical representation boundary for temporal-memory persistence.
 *
 * PostgreSQL normalizes timestamps and NULLs. Hashing pre-normalized caller
 * strings (e.g. `...00Z`) and later comparing them with database ISO output
 * (`...00.000Z`) creates false divergence. This adapter normalizes all temporal
 * representations before the underlying index computes/persists content hashes.
 */
export class CanonicalTemporalMemoryIndex implements ITemporalMemoryIndex {
  constructor(private readonly inner: ITemporalMemoryIndex) {}

  add(input: TemporalMemoryEnvelopeInput): Promise<VersionedTemporalMemoryEnvelope> {
    return this.inner.add(canonicalizeInput(input));
  }

  get(memoryId: EntityId): Promise<VersionedTemporalMemoryEnvelope | null> {
    return this.inner.get(memoryId);
  }

  update(
    memoryId: EntityId,
    expectedRevision: number,
    updates: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>>,
  ): Promise<VersionedTemporalMemoryEnvelope> {
    return this.inner.update(memoryId, expectedRevision, canonicalizeUpdates(updates));
  }

  remove(memoryId: EntityId, expectedRevision?: number): Promise<void> {
    return this.inner.remove(memoryId, expectedRevision);
  }

  query(query: TemporalMemoryQuery = {}): Promise<VersionedTemporalMemoryEnvelope[]> {
    return this.inner.query({
      ...query,
      validAt: canonicalTime(query.validAt),
      knownAt: canonicalTime(query.knownAt),
    });
  }

  projectionHash(query: TemporalMemoryQuery = {}): Promise<string> {
    return this.inner.projectionHash({
      ...query,
      validAt: canonicalTime(query.validAt),
      knownAt: canonicalTime(query.knownAt),
    });
  }
}

export function canonicalizeTemporalEnvelopeInput(
  input: TemporalMemoryEnvelopeInput,
): TemporalMemoryEnvelopeInput {
  return canonicalizeInput(input);
}

function canonicalizeInput(input: TemporalMemoryEnvelopeInput): TemporalMemoryEnvelopeInput {
  return {
    ...input,
    projectId: input.projectId?.trim() || undefined,
    provenanceRef: input.provenanceRef.trim(),
    validFrom: canonicalTime(input.validFrom),
    // Canonical absence is `undefined`; do not hash `null` differently from SQL NULL.
    validUntil: input.validUntil ? canonicalTime(input.validUntil) : undefined,
    observedAt: canonicalTime(input.observedAt),
    recordedAt: canonicalTime(input.recordedAt),
    sourceRevision: input.sourceRevision?.trim() || undefined,
    contradicts: input.contradicts
      ? Array.from(new Set(input.contradicts.map(String))).sort().map(id => id as EntityId)
      : undefined,
    metadata: structuredClone(input.metadata || {}),
  };
}

function canonicalizeUpdates(
  updates: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>>,
): Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>> {
  const normalized: Partial<Omit<TemporalMemoryEnvelopeInput, 'memoryId'>> = {
    ...updates,
  };
  if ('projectId' in updates) normalized.projectId = updates.projectId?.trim() || undefined;
  if ('provenanceRef' in updates && updates.provenanceRef !== undefined) normalized.provenanceRef = updates.provenanceRef.trim();
  if ('validFrom' in updates) normalized.validFrom = canonicalTime(updates.validFrom);
  if ('validUntil' in updates) normalized.validUntil = updates.validUntil ? canonicalTime(updates.validUntil) : undefined;
  if ('observedAt' in updates) normalized.observedAt = canonicalTime(updates.observedAt);
  if ('recordedAt' in updates) normalized.recordedAt = canonicalTime(updates.recordedAt);
  if ('sourceRevision' in updates) normalized.sourceRevision = updates.sourceRevision?.trim() || undefined;
  if (updates.contradicts) {
    normalized.contradicts = Array.from(new Set(updates.contradicts.map(String))).sort().map(id => id as EntityId);
  }
  if (updates.metadata) normalized.metadata = structuredClone(updates.metadata);
  return normalized;
}

function canonicalTime(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid temporal-memory timestamp: ${value}`);
  return new Date(parsed).toISOString();
}
