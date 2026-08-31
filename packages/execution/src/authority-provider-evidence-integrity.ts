import { canonicalHash128, canonicalSerialize } from '@cos/core';

export interface AuthorityProviderEvidenceBinding {
  operationId: string;
  providerIdempotencyKey: string;
  fencingToken: number;
}

export interface VerifiedAuthorityProviderEvidence {
  evidence: Record<string, unknown>;
  sealingMode: 'canonical-v1' | 'legacy-retry-v1';
  originalEvidenceHash: string;
}

/**
 * Canonical authority seal for provider/reconciliation evidence.
 *
 * `evidenceHash` is a reserved top-level field. Any caller-supplied value is
 * removed before hashing so resealing an already sealed envelope is stable and
 * independently reproducible.
 */
export function sealAuthorityProviderEvidence(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  delete canonical.evidenceHash;
  return {
    ...canonical,
    evidenceHash: canonicalHash128(canonical),
  };
}

/**
 * Verify provider evidence without trusting the supplied hash.
 *
 * The primary contract is canonical-v1: hash(all top-level fields except
 * `evidenceHash`). A bounded compatibility verifier also recognizes the exact
 * retry-envelope shape produced by the pre-T0501 reconciler, whose outer hash
 * included the previous base evidence hash before overwriting that field.
 * Accepted legacy evidence is normalized immediately to canonical-v1 before it
 * is persisted by the observed-outcome recorder.
 */
export function verifyAuthorityProviderEvidence(
  value: Record<string, unknown>,
): VerifiedAuthorityProviderEvidence {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  const actual = nonEmptyString(canonical.evidenceHash, 'evidenceHash');
  const payload = { ...canonical };
  delete payload.evidenceHash;

  const expected = canonicalHash128(payload);
  if (actual === expected) {
    return {
      evidence: sealAuthorityProviderEvidence(payload),
      sealingMode: 'canonical-v1',
      originalEvidenceHash: actual,
    };
  }

  const legacyExpected = legacyRetryEvidenceHash(payload);
  if (legacyExpected !== null && actual === legacyExpected) {
    return {
      evidence: sealAuthorityProviderEvidence(payload),
      sealingMode: 'legacy-retry-v1',
      originalEvidenceHash: actual,
    };
  }

  throw new Error(
    `PROVIDER_RECONCILIATION_EVIDENCE_HASH_MISMATCH expected=${expected} actual=${actual}`,
  );
}

/**
 * Bind verified evidence to the exact durable operation attempt.
 *
 * Operation ID is the primary anti-replay identity. Provider idempotency key and
 * historical fencing token are independently checked so evidence from another
 * provider attempt or owner cannot be transplanted onto this operation.
 */
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

function legacyRetryEvidenceHash(payload: Record<string, unknown>): string | null {
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
