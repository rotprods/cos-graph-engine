import { canonicalHash128, canonicalSerialize } from '@cos/core';

export const AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION = 2 as const;

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
  sealingMode: 'canonical-v2' | 'canonical-v1' | 'legacy-retry-v1';
  originalEvidenceHash: string;
}

/**
 * Canonical authority seal for all newly produced provider/reconciliation evidence.
 *
 * T0501 makes the schema version explicit. `evidenceHash` is reserved and is
 * always recomputed from the canonical payload. Re-sealing is idempotent.
 */
export function sealAuthorityProviderEvidence(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  delete canonical.evidenceHash;
  canonical.evidenceSchemaVersion = AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION;
  return {
    ...canonical,
    evidenceHash: canonicalHash128(canonical),
  };
}

/**
 * Independently verify an evidence envelope without trusting its claimed hash.
 *
 * - canonical-v2: new T0501 evidence with explicit schema version and full
 *   durable-operation binding;
 * - canonical-v1: pre-T0501 applied/partial evidence whose hash is reproducible
 *   but whose historical schema lacked the new full bindings;
 * - legacy-retry-v1: exact pre-T0501 retry shape where the outer hash included
 *   the previous base evidenceHash before overwriting it.
 *
 * Historical envelopes remain historical. They are wrapped by new v2 recovery
 * evidence but are never relabelled as if they had stronger bindings originally.
 */
export function verifyAuthorityProviderEvidence(
  value: Record<string, unknown>,
): VerifiedAuthorityProviderEvidence {
  const canonical = canonicalClone(value, 'provider reconciliation evidence');
  if (!Object.hasOwn(canonical, 'evidenceHash')) {
    throw new Error('PROVIDER_RECONCILIATION_EVIDENCE_HASH_REQUIRED');
  }
  const actual = nonEmptyString(canonical.evidenceHash, 'evidenceHash');
  const payload = { ...canonical };
  delete payload.evidenceHash;

  const expected = canonicalHash128(payload);
  if (actual === expected) {
    const version = payload.evidenceSchemaVersion;
    if (version !== undefined
      && version !== AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION) {
      throw new Error(
        `PROVIDER_RECONCILIATION_EVIDENCE_SCHEMA_UNSUPPORTED version=${String(version)}`,
      );
    }
    return {
      evidence: canonical,
      sealingMode: version === AUTHORITY_PROVIDER_EVIDENCE_SCHEMA_VERSION
        ? 'canonical-v2'
        : 'canonical-v1',
      originalEvidenceHash: actual,
    };
  }

  const legacyExpected = legacyRetryEvidenceHash(payload);
  if (legacyExpected !== null && actual === legacyExpected) {
    return {
      evidence: canonical,
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
 * Operation ID, provider idempotency key and historical fencing token always
 * bind the envelope. New v2 evidence additionally binds project, capability,
 * resource and operation content hash. The caller chooses those stronger checks
 * only after `verifyAuthorityProviderEvidence` classifies the schema as v2.
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
