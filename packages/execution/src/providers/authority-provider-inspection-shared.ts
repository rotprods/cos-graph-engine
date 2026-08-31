import { canonicalHash128, canonicalSerialize, sha256Hex } from '@cos/core';
import type {
  AuthorityProviderInspectionOutcome,
  AuthorityProviderInspectionRequest,
} from '../authority-provider-reconciliation';

export type AuthorityReadOnlyProvider = 'github' | 'google_drive';
export const AUTHORITY_ABSENCE_HASH_ALGORITHM = 'sha256' as const;

export interface AuthorityProviderReadCandidate {
  providerResourceId: string;
  operationId?: string;
  providerIdempotencyKey?: string;
  operationContentHash?: string;
  result: unknown;
  evidence: Record<string, unknown>;
}

export interface AuthorityProviderExplicitPartial {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  compensationCapability: string;
  compensationResourceUri?: string;
  compensationInput: unknown;
  evidence: Record<string, unknown>;
}

export interface AuthorityProviderReadObservation {
  authoritativeAbsence: boolean;
  providerRevision?: string | number | null;
  candidates: AuthorityProviderReadCandidate[];
  evidence: Record<string, unknown>;
  partial?: AuthorityProviderExplicitPartial;
}

export interface AuthorityProviderReadTarget {
  provider: AuthorityReadOnlyProvider;
  targetKey: string;
  minimumConsistencyWindowMs: number;
  descriptor: Record<string, unknown>;
}

export interface AuthorityAbsenceObservation {
  /** Deterministic identity only; never an integrity primitive. */
  observationId: string;
  provider: AuthorityReadOnlyProvider;
  targetKey: string;
  operationId: string;
  providerIdempotencyKey: string;
  operationContentHash: string;
  observedAt: string;
  providerRevision: string | number | null;
  /** Canonical provider read evidence retained so its digest can be recomputed after restore. */
  evidence: Record<string, unknown>;
  evidenceHashAlgorithm: typeof AUTHORITY_ABSENCE_HASH_ALGORITHM;
  evidenceHash: string;
  contentHashAlgorithm: typeof AUTHORITY_ABSENCE_HASH_ALGORITHM;
  contentHash: string;
}

export interface AuthorityAbsenceObservationStore {
  append(observation: AuthorityAbsenceObservation): Promise<void>;
  list(input: {
    provider: AuthorityReadOnlyProvider;
    targetKey: string;
    operationId: string;
    providerIdempotencyKey: string;
    operationContentHash: string;
  }): Promise<AuthorityAbsenceObservation[]>;
}

/** Reference/test store. Authority deployments must inject durable persistence. */
export class InMemoryAuthorityAbsenceObservationStore implements AuthorityAbsenceObservationStore {
  private readonly records = new Map<string, AuthorityAbsenceObservation>();

  async append(observation: AuthorityAbsenceObservation): Promise<void> {
    const value = await normalizeObservation(observation);
    const existing = this.records.get(value.observationId);
    if (existing) {
      if (existing.contentHash !== value.contentHash) {
        throw new Error(`ABSENCE_OBSERVATION_CONFLICT id=${value.observationId}`);
      }
      return;
    }
    this.records.set(value.observationId, structuredClone(value));
  }

  async list(input: {
    provider: AuthorityReadOnlyProvider;
    targetKey: string;
    operationId: string;
    providerIdempotencyKey: string;
    operationContentHash: string;
  }): Promise<AuthorityAbsenceObservation[]> {
    const selected = [...this.records.values()]
      .filter(record => record.provider === input.provider)
      .filter(record => record.targetKey === input.targetKey)
      .filter(record => record.operationId === input.operationId)
      .filter(record => record.providerIdempotencyKey === input.providerIdempotencyKey)
      .filter(record => record.operationContentHash === input.operationContentHash)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const verified: AuthorityAbsenceObservation[] = [];
    for (const record of selected) verified.push(await normalizeObservation(record));
    return verified.map(record => structuredClone(record));
  }
}

export class AuthorityRepeatedAbsenceGate {
  constructor(private readonly store: AuthorityAbsenceObservationStore) {}

  async observe(input: {
    provider: AuthorityReadOnlyProvider;
    targetKey: string;
    minimumConsistencyWindowMs: number;
    request: AuthorityProviderInspectionRequest;
    providerRevision?: string | number | null;
    evidence: Record<string, unknown>;
  }): Promise<{ proven: boolean; evidence: Record<string, unknown> }> {
    const provider = input.provider;
    const targetKey = nonEmpty(input.targetKey, 'absence targetKey');
    const minimumConsistencyWindowMs = boundedWindow(input.minimumConsistencyWindowMs);
    const observedAt = canonicalTime(input.request.inspectedAt, 'absence observedAt');
    const operationContentHash = nonEmpty(input.request.operationContentHash, 'operationContentHash');
    const evidence = canonicalClone(input.evidence, 'absence provider evidence');
    const evidenceHash = await sha256Hex(evidence);
    const identity = {
      provider,
      targetKey,
      operationId: nonEmpty(input.request.operationId, 'operationId'),
      providerIdempotencyKey: nonEmpty(input.request.providerIdempotencyKey, 'providerIdempotencyKey'),
      operationContentHash,
      observedAt,
    };
    const content = {
      ...identity,
      providerRevision: normalizeRevision(input.providerRevision),
      evidence,
      evidenceHashAlgorithm: AUTHORITY_ABSENCE_HASH_ALGORITHM,
      evidenceHash,
      contentHashAlgorithm: AUTHORITY_ABSENCE_HASH_ALGORITHM,
    };
    const observation: AuthorityAbsenceObservation = {
      observationId: `absence_${canonicalHash128(identity)}`,
      ...content,
      contentHash: await sha256Hex(content),
    };
    await this.store.append(observation);

    const history = await this.store.list({
      provider,
      targetKey,
      operationId: identity.operationId,
      providerIdempotencyKey: identity.providerIdempotencyKey,
      operationContentHash,
    });
    const distinct = distinctByObservedAt(history);
    const first = distinct[0];
    const last = distinct.at(-1);
    const elapsedMs = first && last ? Date.parse(last.observedAt) - Date.parse(first.observedAt) : 0;
    const proven = distinct.length >= 2 && elapsedMs >= minimumConsistencyWindowMs;
    const proof = canonicalClone({
      provider,
      targetKey,
      minimumConsistencyWindowMs,
      observationCount: distinct.length,
      firstObservedAt: first?.observedAt ?? null,
      lastObservedAt: last?.observedAt ?? null,
      elapsedMs,
      observations: distinct.map(record => ({
        observationId: record.observationId,
        observedAt: record.observedAt,
        providerRevision: record.providerRevision,
        evidenceHashAlgorithm: record.evidenceHashAlgorithm,
        evidenceHash: record.evidenceHash,
        contentHashAlgorithm: record.contentHashAlgorithm,
        contentHash: record.contentHash,
      })),
      proven,
    }, 'absence proof');
    return {
      proven,
      evidence: {
        ...proof,
        absenceProofHashAlgorithm: AUTHORITY_ABSENCE_HASH_ALGORITHM,
        absenceProofHash: await sha256Hex(proof),
      },
    };
  }
}

/** Shared fail-closed classification for read-only provider adapters. */
export async function classifyAuthorityProviderRead(input: {
  request: AuthorityProviderInspectionRequest;
  target: AuthorityProviderReadTarget;
  observation: AuthorityProviderReadObservation;
  absenceGate: AuthorityRepeatedAbsenceGate;
}): Promise<AuthorityProviderInspectionOutcome> {
  const request = canonicalClone(input.request, 'provider inspection request');
  const target = normalizeTarget(input.target);
  const observation = normalizeReadObservation(input.observation);
  const exact = observation.candidates.filter(candidate =>
    candidate.operationId === request.operationId
    && candidate.providerIdempotencyKey === request.providerIdempotencyKey,
  );

  const commonEvidence = canonicalClone({
    provider: target.provider,
    targetKey: target.targetKey,
    target: target.descriptor,
    providerRevision: observation.providerRevision ?? null,
    candidateCount: observation.candidates.length,
    exactMatchCount: exact.length,
    candidates: observation.candidates.map(candidate => ({
      providerResourceId: candidate.providerResourceId,
      operationId: candidate.operationId ?? null,
      providerIdempotencyKey: candidate.providerIdempotencyKey ?? null,
      operationContentHash: candidate.operationContentHash ?? null,
      evidence: candidate.evidence,
    })),
    readEvidence: observation.evidence,
  }, 'provider read classification evidence');

  if (exact.length > 1) {
    return {
      status: 'unknown',
      reason: 'multiple provider resources match the same operation/provider attempt',
      evidence: { ...commonEvidence, ambiguity: 'MULTIPLE_EXACT_MATCHES' },
    };
  }

  if (exact.length === 1) {
    const candidate = exact[0];
    if (candidate.operationContentHash === undefined) {
      return {
        status: 'unknown',
        reason: 'provider marker matches the operation attempt but lacks operation content hash',
        evidence: { ...commonEvidence, ambiguity: 'CONTENT_HASH_MISSING' },
      };
    }
    if (candidate.operationContentHash !== request.operationContentHash) {
      return {
        status: 'unknown',
        reason: 'provider marker matches operation identity but not operation content hash',
        evidence: { ...commonEvidence, ambiguity: 'CONTENT_HASH_MISMATCH' },
      };
    }
    return {
      status: 'applied',
      result: canonicalClone(candidate.result, 'provider applied result'),
      evidence: { ...commonEvidence, selectedProviderResourceId: candidate.providerResourceId },
    };
  }

  if (observation.partial) {
    return {
      status: 'partial',
      error: normalizeError(observation.partial.error),
      compensationCapability: nonEmpty(observation.partial.compensationCapability, 'compensationCapability'),
      ...(optional(observation.partial.compensationResourceUri) === undefined
        ? {}
        : { compensationResourceUri: optional(observation.partial.compensationResourceUri) }),
      compensationInput: canonicalClone(observation.partial.compensationInput, 'compensationInput'),
      evidence: { ...commonEvidence, partialEvidence: observation.partial.evidence },
    };
  }

  if (observation.candidates.length > 0) {
    return {
      status: 'unknown',
      reason: 'provider resource exists but does not uniquely bind to this operation attempt',
      evidence: { ...commonEvidence, ambiguity: 'MISMATCHED_EXISTING_RESOURCE' },
    };
  }

  if (!observation.authoritativeAbsence) {
    return {
      status: 'unknown',
      reason: 'provider read cannot authoritatively prove absence',
      evidence: { ...commonEvidence, ambiguity: 'NON_AUTHORITATIVE_ABSENCE' },
    };
  }

  const absence = await input.absenceGate.observe({
    provider: target.provider,
    targetKey: target.targetKey,
    minimumConsistencyWindowMs: target.minimumConsistencyWindowMs,
    request,
    providerRevision: observation.providerRevision,
    evidence: commonEvidence,
  });
  if (!absence.proven) {
    return {
      status: 'unknown',
      reason: 'authoritative absence observed but consistency window is not yet satisfied',
      evidence: { ...commonEvidence, absence: absence.evidence },
    };
  }
  return {
    status: 'not_applied',
    authoritativeAbsence: true,
    evidence: { ...commonEvidence, absence: absence.evidence },
  };
}

function normalizeReadObservation(input: AuthorityProviderReadObservation): AuthorityProviderReadObservation {
  const value = canonicalClone(input, 'provider read observation');
  return {
    authoritativeAbsence: Boolean(value.authoritativeAbsence),
    providerRevision: normalizeRevision(value.providerRevision),
    candidates: value.candidates.map(candidate => ({
      providerResourceId: nonEmpty(candidate.providerResourceId, 'providerResourceId'),
      ...(optional(candidate.operationId) === undefined ? {} : { operationId: optional(candidate.operationId) }),
      ...(optional(candidate.providerIdempotencyKey) === undefined
        ? {}
        : { providerIdempotencyKey: optional(candidate.providerIdempotencyKey) }),
      ...(optional(candidate.operationContentHash) === undefined
        ? {}
        : { operationContentHash: optional(candidate.operationContentHash) }),
      result: canonicalClone(candidate.result, 'provider candidate result'),
      evidence: canonicalClone(candidate.evidence, 'provider candidate evidence'),
    })),
    evidence: canonicalClone(value.evidence, 'provider read evidence'),
    ...(value.partial === undefined ? {} : { partial: normalizePartial(value.partial) }),
  };
}

function normalizeTarget(input: AuthorityProviderReadTarget): AuthorityProviderReadTarget {
  return {
    provider: input.provider,
    targetKey: nonEmpty(input.targetKey, 'provider targetKey'),
    minimumConsistencyWindowMs: boundedWindow(input.minimumConsistencyWindowMs),
    descriptor: canonicalClone(input.descriptor, 'provider target descriptor'),
  };
}

function normalizePartial(input: AuthorityProviderExplicitPartial): AuthorityProviderExplicitPartial {
  return {
    error: normalizeError(input.error),
    compensationCapability: nonEmpty(input.compensationCapability, 'compensationCapability'),
    ...(optional(input.compensationResourceUri) === undefined
      ? {}
      : { compensationResourceUri: optional(input.compensationResourceUri) }),
    compensationInput: canonicalClone(input.compensationInput, 'compensationInput'),
    evidence: canonicalClone(input.evidence, 'partial evidence'),
  };
}

function normalizeError(error: AuthorityProviderExplicitPartial['error']) {
  return {
    code: nonEmpty(error.code, 'partial error code'),
    message: nonEmpty(error.message, 'partial error message'),
    retryable: Boolean(error.retryable),
    details: canonicalClone(error.details ?? {}, 'partial error details'),
  };
}

async function normalizeObservation(input: AuthorityAbsenceObservation): Promise<AuthorityAbsenceObservation> {
  const copy = canonicalClone(input, 'absence observation');
  if (copy.evidenceHashAlgorithm !== AUTHORITY_ABSENCE_HASH_ALGORITHM
    || copy.contentHashAlgorithm !== AUTHORITY_ABSENCE_HASH_ALGORITHM) {
    throw new Error('ABSENCE_OBSERVATION_HASH_ALGORITHM_UNSUPPORTED');
  }
  if (!/^[0-9a-f]{64}$/.test(copy.evidenceHash) || !/^[0-9a-f]{64}$/.test(copy.contentHash)) {
    throw new Error('ABSENCE_OBSERVATION_SHA256_INVALID');
  }
  const evidence = canonicalClone(copy.evidence, 'absence observation evidence');
  const expectedEvidenceHash = await sha256Hex(evidence);
  if (copy.evidenceHash !== expectedEvidenceHash) {
    throw new Error(`ABSENCE_OBSERVATION_EVIDENCE_HASH_MISMATCH expected=${expectedEvidenceHash} actual=${copy.evidenceHash}`);
  }
  const content = {
    provider: copy.provider,
    targetKey: nonEmpty(copy.targetKey, 'absence targetKey'),
    operationId: nonEmpty(copy.operationId, 'operationId'),
    providerIdempotencyKey: nonEmpty(copy.providerIdempotencyKey, 'providerIdempotencyKey'),
    operationContentHash: nonEmpty(copy.operationContentHash, 'operationContentHash'),
    observedAt: canonicalTime(copy.observedAt, 'absence observedAt'),
    providerRevision: normalizeRevision(copy.providerRevision),
    evidence,
    evidenceHashAlgorithm: AUTHORITY_ABSENCE_HASH_ALGORITHM,
    evidenceHash: expectedEvidenceHash,
    contentHashAlgorithm: AUTHORITY_ABSENCE_HASH_ALGORITHM,
  };
  const expectedId = `absence_${canonicalHash128({
    provider: content.provider,
    targetKey: content.targetKey,
    operationId: content.operationId,
    providerIdempotencyKey: content.providerIdempotencyKey,
    operationContentHash: content.operationContentHash,
    observedAt: content.observedAt,
  })}`;
  if (copy.observationId !== expectedId) {
    throw new Error(`ABSENCE_OBSERVATION_ID_MISMATCH expected=${expectedId} actual=${copy.observationId}`);
  }
  const expectedHash = await sha256Hex(content);
  if (copy.contentHash !== expectedHash) {
    throw new Error(`ABSENCE_OBSERVATION_HASH_MISMATCH expected=${expectedHash} actual=${copy.contentHash}`);
  }
  return { observationId: expectedId, ...content, contentHash: expectedHash };
}

function distinctByObservedAt(records: AuthorityAbsenceObservation[]): AuthorityAbsenceObservation[] {
  const byTime = new Map<string, AuthorityAbsenceObservation>();
  for (const record of records) {
    const existing = byTime.get(record.observedAt);
    if (existing && existing.contentHash !== record.contentHash) {
      throw new Error(`ABSENCE_OBSERVATION_TIME_CONFLICT at=${record.observedAt}`);
    }
    byTime.set(record.observedAt, record);
  }
  return [...byTime.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

function boundedWindow(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 86_400_000) {
    throw new Error('minimumConsistencyWindowMs must be a safe integer in [1000,86400000]');
  }
  return value;
}

function normalizeRevision(value: string | number | null | undefined): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('providerRevision number must be a non-negative safe integer');
    }
    return value;
  }
  return nonEmpty(value, 'providerRevision');
}

function canonicalClone<T>(value: T, label: string): T {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
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
