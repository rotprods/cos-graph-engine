import assert from 'node:assert/strict';
import { canonicalHash128 } from '../packages/core/src/identity';
import {
  assertAuthorityProviderEvidenceBinding,
  sealAuthorityProviderEvidence,
  verifyAuthorityProviderEvidence,
} from '../packages/execution/src/authority-provider-evidence-integrity';

function main(): void {
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

  const sealed = sealAuthorityProviderEvidence(base);
  check(sealed.evidenceSchemaVersion === 2, 'new evidence is explicitly schema v2');
  const verified = verifyAuthorityProviderEvidence(sealed);
  check(verified.sealingMode === 'canonical-v2', 'new evidence verifies as canonical-v2');
  check(
    verified.evidence.evidenceHash === sealed.evidenceHash,
    'verification preserves canonical evidence hash',
  );

  const reordered = sealAuthorityProviderEvidence({
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
  check(reordered.evidenceHash === sealed.evidenceHash, 'key order cannot change canonical hash');

  const resealed = sealAuthorityProviderEvidence(sealed);
  check(resealed.evidenceHash === sealed.evidenceHash, 'resealing v2 evidence is idempotent');

  const tampered = structuredClone(sealed);
  (tampered.providerEvidence as Record<string, unknown>).applied = false;
  assert.throws(
    () => verifyAuthorityProviderEvidence(tampered),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  assert.throws(
    () => verifyAuthorityProviderEvidence({ ...base }),
    /EVIDENCE_HASH_REQUIRED/,
  );
  assertions += 1;

  const forged = { ...sealed, evidenceHash: '0'.repeat(32) };
  assert.throws(
    () => verifyAuthorityProviderEvidence(forged),
    /EVIDENCE_HASH_MISMATCH/,
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

  // Historical canonical-v1 evidence was validly hashed but did not contain the
  // stronger v2 project/resource/content bindings. It remains verifiable as v1.
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
  const verifiedV1 = verifyAuthorityProviderEvidence(canonicalV1);
  check(verifiedV1.sealingMode === 'canonical-v1', 'historical canonical evidence stays v1');
  assertAuthorityProviderEvidenceBinding(verifiedV1.evidence, {
    operationId: base.operationId,
    providerIdempotencyKey: base.providerIdempotencyKey,
    fencingToken: base.fencingToken,
  });
  assertions += 1;

  // Reproduce exactly the pre-T0501 retry sealing shape. The outer hash included
  // the previous base evidenceHash before overwriting it. Verification accepts
  // that historical shape but does not relabel it as v2.
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
  const verifiedLegacy = verifyAuthorityProviderEvidence(legacyRetryEvidence);
  check(
    verifiedLegacy.sealingMode === 'legacy-retry-v1',
    'legacy retry envelope is independently recognized rather than blindly trusted',
  );
  check(
    verifiedLegacy.evidence.evidenceSchemaVersion === undefined,
    'historical evidence is not retroactively relabelled as v2',
  );

  const unsupportedPayload = {
    ...base,
    evidenceSchemaVersion: 3,
  };
  const unsupported = {
    ...unsupportedPayload,
    evidenceHash: canonicalHash128(unsupportedPayload),
  };
  assert.throws(
    () => verifyAuthorityProviderEvidence(unsupported),
    /EVIDENCE_SCHEMA_UNSUPPORTED/,
  );
  assertions += 1;

  assert.throws(
    () => sealAuthorityProviderEvidence({ ...base, providerEvidence: new Date() }),
    /canonical JSON-like data/,
  );
  assertions += 1;

  console.log(`Authority provider evidence integrity contract: ${assertions} assertions passed`);
}

main();
