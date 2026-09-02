import assert from 'node:assert/strict';
import { canonicalHash128 } from '../packages/core/src/identity';
import {
  assertAuthorityProviderEvidenceBinding,
  sealAuthorityProviderEvidence,
  verifyAuthorityProviderEvidence,
} from '../packages/execution/src/authority-provider-evidence-integrity';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const base = {
    inspectorId: 'inspector://github/status-v2',
    inspectorVersion: '2.0.0',
    inspectedAt: '2026-08-31T09:30:00.000Z',
    operationId: 'op://cos/provider-evidence/1',
    projectId: 'COS_GRAPH_ENGINE',
    capability: 'authority_http_write',
    resourceUri: 'resource://github/issues/39',
    providerIdempotencyKey: 'provider-attempt-1',
    fencingToken: 7,
    operationContentHash: 'operation-content-hash-1',
    target: {
      kind: 'http',
      canonicalUrl: 'https://api.github.com/repos/rotprods/cos-graph-engine/issues/39',
      hostname: 'api.github.com',
      method: 'PATCH',
      targetDecisionHash: 'decision-123',
    },
    providerEvidence: {
      source: 'github://issue/39',
      revision: 12,
      applied: true,
    },
  };

  const sealed = await sealAuthorityProviderEvidence(base);
  check(sealed.evidenceSchemaVersion === 2, 'new evidence is explicitly schema v2');
  check(sealed.evidenceHashAlgorithm === 'sha256', 'new evidence declares SHA-256');
  check(
    typeof sealed.evidenceHash === 'string' && /^[0-9a-f]{64}$/.test(sealed.evidenceHash),
    'new evidence carries a 64-hex SHA-256 digest',
  );
  const verified = await verifyAuthorityProviderEvidence(sealed);
  check(verified.sealingMode === 'canonical-v2-sha256', 'new evidence verifies as canonical-v2-sha256');
  check(verified.hashAlgorithm === 'sha256', 'verification reports the cryptographic algorithm');
  check(
    verified.evidence.evidenceHash === sealed.evidenceHash,
    'verification preserves canonical evidence hash',
  );

  const reordered = await sealAuthorityProviderEvidence({
    providerEvidence: base.providerEvidence,
    target: base.target,
    operationContentHash: base.operationContentHash,
    fencingToken: base.fencingToken,
    providerIdempotencyKey: base.providerIdempotencyKey,
    resourceUri: base.resourceUri,
    capability: base.capability,
    projectId: base.projectId,
    operationId: base.operationId,
    inspectedAt: base.inspectedAt,
    inspectorVersion: base.inspectorVersion,
    inspectorId: base.inspectorId,
  });
  check(reordered.evidenceHash === sealed.evidenceHash, 'key order cannot change SHA-256 evidence hash');

  const resealed = await sealAuthorityProviderEvidence(sealed);
  check(resealed.evidenceHash === sealed.evidenceHash, 'resealing v2 evidence is idempotent');

  const tampered = structuredClone(sealed);
  (tampered.providerEvidence as Record<string, unknown>).applied = false;
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(tampered),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  await assert.rejects(
    () => verifyAuthorityProviderEvidence({ ...base }),
    /EVIDENCE_HASH_REQUIRED/,
  );
  assertions += 1;

  const forged = { ...sealed, evidenceHash: '0'.repeat(64) };
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(forged),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  const fnvV2Payload = {
    ...base,
    evidenceSchemaVersion: 2,
    evidenceHashAlgorithm: 'sha256',
  };
  const fnvPretendingToBeV2 = {
    ...fnvV2Payload,
    evidenceHash: canonicalHash128(fnvV2Payload),
  };
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(fnvPretendingToBeV2),
    /EVIDENCE_SHA256_INVALID/,
  );
  assertions += 1;

  const wrongAlgorithmPayload = {
    ...base,
    evidenceSchemaVersion: 2,
    evidenceHashAlgorithm: 'fnv128',
  };
  const wrongAlgorithm = {
    ...wrongAlgorithmPayload,
    evidenceHash: '0'.repeat(64),
  };
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(wrongAlgorithm),
    /EVIDENCE_HASH_ALGORITHM_UNSUPPORTED/,
  );
  assertions += 1;

  const fullBinding = {
    operationId: base.operationId,
    providerIdempotencyKey: base.providerIdempotencyKey,
    fencingToken: base.fencingToken,
    projectId: base.projectId,
    capability: base.capability,
    resourceUri: base.resourceUri,
    operationContentHash: base.operationContentHash,
  };
  assertAuthorityProviderEvidenceBinding(verified.evidence, fullBinding);
  assertions += 1;

  for (const [field, value, pattern] of [
    ['operationId', 'op://cos/provider-evidence/other', /EVIDENCE_OPERATION_MISMATCH/],
    ['providerIdempotencyKey', 'provider-attempt-replayed', /EVIDENCE_IDEMPOTENCY_MISMATCH/],
    ['fencingToken', base.fencingToken + 1, /EVIDENCE_FENCING_MISMATCH/],
    ['projectId', 'OTHER_PROJECT', /EVIDENCE_PROJECT_MISMATCH/],
    ['capability', 'authority_other_write', /EVIDENCE_CAPABILITY_MISMATCH/],
    ['resourceUri', 'resource://github/issues/40', /EVIDENCE_RESOURCE_MISMATCH/],
    ['operationContentHash', 'other-content-hash', /EVIDENCE_CONTENT_HASH_MISMATCH/],
  ] as const) {
    assert.throws(
      () => assertAuthorityProviderEvidenceBinding(verified.evidence, {
        ...fullBinding,
        [field]: value,
      }),
      pattern,
    );
    assertions += 1;
  }

  // Historical canonical-v1 evidence was validly FNV-hashed but did not contain
  // the stronger v2 project/resource/content bindings. It remains readable as
  // explicit legacy provenance and never becomes v2.
  const legacyBase = {
    inspectorId: 'inspector://github/status-v1',
    inspectorVersion: '1.0.0',
    inspectedAt: '2026-08-30T09:30:00.000Z',
    operationId: base.operationId,
    providerIdempotencyKey: base.providerIdempotencyKey,
    fencingToken: base.fencingToken,
    target: base.target,
    providerEvidence: base.providerEvidence,
  };
  const canonicalV1 = {
    ...legacyBase,
    evidenceHash: canonicalHash128(legacyBase),
  };
  const verifiedV1 = await verifyAuthorityProviderEvidence(canonicalV1);
  check(verifiedV1.sealingMode === 'canonical-v1-fnv128', 'historical canonical evidence stays FNV v1');
  check(verifiedV1.hashAlgorithm === 'fnv128-legacy', 'historical v1 reports legacy hash algorithm');
  assertAuthorityProviderEvidenceBinding(verifiedV1.evidence, {
    operationId: base.operationId,
    providerIdempotencyKey: base.providerIdempotencyKey,
    fencingToken: base.fencingToken,
  });
  assertions += 1;

  const legacyRetryPayload = {
    ...canonicalV1,
    retryPlannerEvidence: {
      leaseId: 'lease-2',
      nextFence: 8,
    },
    nextFencingToken: 8,
    nextProviderIdempotencyKey: 'provider-attempt-2',
  };
  const legacyRetryEvidence = {
    ...legacyRetryPayload,
    evidenceHash: canonicalHash128(legacyRetryPayload),
  };
  const verifiedLegacy = await verifyAuthorityProviderEvidence(legacyRetryEvidence);
  check(
    verifiedLegacy.sealingMode === 'legacy-retry-v1-fnv128',
    'legacy retry envelope is independently recognized rather than blindly trusted',
  );
  check(
    verifiedLegacy.hashAlgorithm === 'fnv128-legacy',
    'legacy retry reports legacy hash algorithm',
  );
  check(
    verifiedLegacy.evidence.evidenceSchemaVersion === undefined,
    'historical evidence is not retroactively relabelled as v2',
  );

  const unsupportedPayload = {
    ...base,
    evidenceSchemaVersion: 3,
    evidenceHashAlgorithm: 'sha256',
  };
  const unsupported = {
    ...unsupportedPayload,
    evidenceHash: '0'.repeat(64),
  };
  await assert.rejects(
    () => verifyAuthorityProviderEvidence(unsupported),
    /EVIDENCE_SCHEMA_UNSUPPORTED/,
  );
  assertions += 1;

  await assert.rejects(
    () => sealAuthorityProviderEvidence({ ...base, providerEvidence: new Date() }),
    /canonical JSON-like data/,
  );
  assertions += 1;

  console.log(`Authority provider evidence integrity contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
