import { canonicalHash128, canonicalSerialize, sha256Hex } from '@cos/core';

export const AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION = 2 as const;
export const AUTHORITY_PROVIDER_EVIDENCE_HASH_ALGORITHM = 'sha256' as const;

export interface AuthorityProviderEvidenceBinding {
  operationId: string;
  providerIdempotencyKey: string;
  fencingToken: number;
  projectId?: string;
  capability?: string;
  resourceUri?: string;
  operationContentHash?: string;
}

export interface VerifiedAuthorityProviderEvidence {
  evidence: Record<string, unknown>;
  sealingMode: 'canonical-v2-sha256' | 'canonical-v1-fnv128' | 'legacy-retry-v1-fnv128';
  originalEvidenceHash: string;
  hashAlgorithm: 'sha256' | 'fnv128-legacy';
}

/**
 * Canonical cryptographic integrity seal for newly produced provider evidence.
 *
 * Compact canonicalHash128 remains an identity/dedup primitive only. V2 evidence
 * is explicitly algorithm-labelled and SHA-256 sealed over strict canonical
 * JSON-like content. Re-sealing strips all reserved seal fields first.
 */
export async function sealAuthorityProviderEvidence(
  value: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  delete canonical.evidenceHash;
  delete canonical.evidenceHashAlgorithm;
  canonical.evidenceSchemaVersion = AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION;
  canonical.evidenceHashAlgorithm = AUTHORITY_PROVIDER_EVIDENCE_HASH_ALGORITHM;
  return {
    ...canonical,
    evidenceHash: await sha256Hex(canonical),
  };
}

/**
 * Independently verify an evidence envelope without trusting its claimed hash.
 *
 * New v2 envelopes MUST be SHA-256. Historical v1 envelopes remain readable
 * through the exact legacy FNV-128 verification path but are never upgraded to
 * v2 guarantees merely because a newer runtime reads them.
 */
export async function verifyAuthorityProviderEvidence(
  value: Record<string, unknown>,
): Promise<VerifiedAuthorityProviderEvidence> {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  if (!Object.hasOwn(canonical, 'evidenceHash')) {
    throw new Error('PROVIDER_RECONCILIATION_EVIDENCE_HASH_REQUIRED');
  }
  const actual = nonEmptyString(canonical.evidenceHash, 'evidenceHash');
  const payload = { ...canonical };
  delete payload.evidenceHash;

  const version = payload.evidenceSchemaVersion;
  if (version !== undefined) {
    if (version !== AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION) {
      throw new Error(
        `PROVIDER_RECONCILIATION_EVIDENCE_SCHEMA_UNSUPPORTED version=${String(version)}`,
      );
    }
    if (payload.evidenceHashAlgorithm !== AUTHORITY_PROVIDER_EVIDENCE_HASH_ALGORITHM) {
      throw new Error(
        `PROVIDER_RECONCILIATION_EVIDENCE_HASH_ALGORITHM_UNSUPPORTED algorithm=${String(payload.evidenceHashAlgorithm)}`,
      );
    }
    if (!/^[0-9a-f]{64}$/.test(actual)) {
      throw new Error('PROVIDER_RECONCILIATION_EVIDENCE_SHA256_INVALID');
    }
    const expected = await sha256Hex(payload);
    if (actual !== expected) {
      throw new Error(
        `PROVIDER_RECONCILIATION_EVIDENCE_HASH_MISMATCH expected=${expected} actual=${actual}`,
      );
    }
    return {
      evidence: canonical,
      sealingMode: 'canonical-v2-sha256',
      originalEvidenceHash: actual,
      hashAlgorithm: 'sha256',
    };
  }

  const expectedLegacy = canonicalHash128(payload);
  if (actual === expectedLegacy) {
    return {
      evidence: canonical,
      sealingMode: 'canonical-v1-fnv128',
      originalEvidenceHash: actual,
      hashAlgorithm: 'fnv128-legacy',
    };
  }

  const legacyRetryExpected = legacyRetryEvidenceHash(payload);
  if (legacyRetryExpected !== null && actual === legacyRetryExpected) {
    return {
      evidence: canonical,
      sealingMode: 'legacy-retry-v1-fnv128',
      originalEvidenceHash: actual,
      hashAlgorithm: 'fnv128-legacy',
    };
  }

  throw new Error(
    `PROVIDER_RECONCILIATION_EVIDENCE_HASH_MISMATCH expectedLegacy=${expectedLegacy} actual=${actual}`,
  );
}

/** Bind already-verified evidence to the exact durable operation attempt. */
export function assertAuthorityProviderEvidenceBinding(
  evidence: Record<string, unknown>,
  expected: AuthorityProviderEvidenceBinding,
): void {
  const operationId = nonEmptyString(evidence.operationId, 'evidence operationId');
  if (operationId !== expected.operationId) {
    throw new Error(
      `PROVIDER_RECONCILIATION_EVIDENCE_OPERATION_MISMATCH expected=${expected.operationId} actual=${operationId}`,
    );
  }

  const providerIdempotencyKey = nonEmptyString(
    evidence.providerIdempotencyKey,
    'evidence providerIdempotencyKey',
  );
  if (providerIdempotencyKey !== expected.providerIdempotencyKey) {
    throw new Error(
      `PROVIDER_RECONCILIATION_EVIDENCE_IDEMPOTENCY_MISMATCH expected=${expected.providerIdempotencyKey} actual=${providerIdempotencyKey}`,
    );
  }

  if (!Number.isSafeInteger(evidence.fencingToken) || Number(evidence.fencingToken) < 1) {
    throw new Error('PROVIDER_RECONCILIATION_EVIDENCE_FENCING_INVALID');
  }
  if (evidence.fencingToken !== expected.fencingToken) {
    throw new Error(
      `PROVIDER_RECONCILIATION_EVIDENCE_FENCING_MISMATCH expected=${expected.fencingToken} actual=${String(evidence.fencingToken)}`,
    );
  }

  assertOptionalBinding(evidence, 'projectId', expected.projectId);
  assertOptionalBinding(evidence, 'capability', expected.capability);
  assertOptionalBinding(evidence, 'resourceUri', expected.resourceUri);
  assertOptionalBinding(evidence, 'operationContentHash', expected.operationContentHash);

  nonEmptyString(evidence.inspectorId, 'evidence inspectorId');
  nonEmptyString(evidence.inspectorVersion, 'evidence inspectorVersion');
  const inspectedAt = nonEmptyString(evidence.inspectedAt, 'evidence inspectedAt');
  if (!Number.isFinite(Date.parse(inspectedAt))) {
    throw new Error(`PROVIDER_RECONCILIATION_EVIDENCE_TIME_INVALID value=${inspectedAt}`);
  }
  if (!evidence.target || typeof evidence.target !== 'object' || Array.isArray(evidence.target)) {
    throw new Error('PROVIDER_RECONCILIATION_EVIDENCE_TARGET_REQUIRED');
  }
  if (!Object.hasOwn(evidence, 'providerEvidence')) {
    throw new Error('PROVIDER_RECONCILIATION_PROVIDER_EVIDENCE_REQUIRED');
  }
}

function assertOptionalBinding(
  evidence: Record<string, unknown>,
  field: 'projectId' | 'capability' | 'resourceUri' | 'operationContentHash',
  expected: string | undefined,
): void {
  if (expected === undefined) return;
  const actual = nonEmptyString(evidence[field], `evidence ${field}`);
  if (actual !== expected) {
    throw new Error(
      `PROVIDER_RECONCILIATION_EVIDENCE_${fieldToCode(field)}_MISMATCH expected=${expected} actual=${actual}`,
    );
  }
}

function fieldToCode(
  field: 'projectId' | 'capability' | 'resourceUri' | 'operationContentHash',
): string {
  if (field === 'projectId') return 'PROJECT';
  if (field === 'capability') return 'CAPABILITY';
  if (field === 'resourceUri') return 'RESOURCE';
  return 'CONTENT_HASH';
}

function legacyRetryEvidenceHash(payload: Record<string, unknown>): string | null {
  if (Object.hasOwn(payload, 'evidenceSchemaVersion')) return null;
  if (!Object.hasOwn(payload, 'retryPlannerEvidence')
    || !Object.hasOwn(payload, 'nextFencingToken')
    || !Object.hasOwn(payload, 'nextProviderIdempotencyKey')) {
    return null;
  }

  const base = { ...payload };
  const retryPlannerEvidence = base.retryPlannerEvidence;
  const nextFencingToken = base.nextFencingToken;
  const nextProviderIdempotencyKey = base.nextProviderIdempotencyKey;
  delete base.retryPlannerEvidence;
  delete base.nextFencingToken;
  delete base.nextProviderIdempotencyKey;

  const previousBaseHash = canonicalHash128(base);
  return canonicalHash128({
    ...base,
    evidenceHash: previousBaseHash,
    retryPlannerEvidence,
    nextFencingToken,
    nextProviderIdempotencyKey,
  });
}

function canonicalClone(
  value: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  try {
    canonicalSerialize(value);
    return structuredClone(value);
  } catch (error) {
    throw new Error(`${label} must be canonical JSON-like data: ${message(error)}`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const normalized = value.normalize('NFC').trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
