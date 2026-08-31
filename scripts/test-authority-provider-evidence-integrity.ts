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
    inspectorId: 'inspector://github/status-v1',
    inspectorVersion: '1.0.0',
    inspectedAt: '2026-08-31T09:30:00.000Z',
    operationId: 'op://cos/provider-evidence/1',
    providerIdempotencyKey: 'provider-attempt-1',
    fencingToken: 7,
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
  const verified = verifyAuthorityProviderEvidence(sealed);
  check(verified.sealingMode === 'canonical-v1', 'canonical evidence verifies as canonical-v1');
  check(
    verified.evidence.evidenceHash === sealed.evidenceHash,
    'verification preserves canonical evidence hash',
  );

  const reordered = sealAuthorityProviderEvidence({
    providerEvidence: base.providerEvidence,
    target: base.target,
    fencingToken: base.fencingToken,
    providerIdempotencyKey: base.providerIdempotencyKey,
    operationId: base.operationId,
    inspectedAt: base.inspectedAt,
    inspectorVersion: base.inspectorVersion,
    inspectorId: base.inspectorId,
  });
  check(reordered.evidenceHash === sealed.evidenceHash, 'key order cannot change canonical hash');

  const resealed = sealAuthorityProviderEvidence(sealed);
  check(resealed.evidenceHash === sealed.evidenceHash, 'resealing is idempotent');

  const tampered = structuredClone(sealed);
  (tampered.providerEvidence as Record<string, unknown>).applied = false;
  assert.throws(
    () => verifyAuthorityProviderEvidence(tampered),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  const forged = { ...base, evidenceHash: '0'.repeat(32) };
  assert.throws(
    () => verifyAuthorityProviderEvidence(forged),
    /EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;

  assertAuthorityProviderEvidenceBinding(verified.evidence, {
    operationId: base.operationId,
    providerIdempotencyKey: base.providerIdempotencyKey,
    fencingToken: base.fencingToken,
  });
  assertions += 1;

  assert.throws(
    () => assertAuthorityProviderEvidenceBinding(verified.evidence, {
      operationId: 'op://cos/provider-evidence/other',
      providerIdempotencyKey: base.providerIdempotencyKey,
      fencingToken: base.fencingToken,
    }),
    /EVIDENCE_OPERATION_MISMATCH/,
  );
  assertions += 1;

  assert.throws(
    () => assertAuthorityProviderEvidenceBinding(verified.evidence, {
      operationId: base.operationId,
      providerIdempotencyKey: 'provider-attempt-replayed',
      fencingToken: base.fencingToken,
    }),
    /EVIDENCE_IDEMPOTENCY_MISMATCH/,
  );
  assertions += 1;

  assert.throws(
    () => assertAuthorityProviderEvidenceBinding(verified.evidence, {
      operationId: base.operationId,
      providerIdempotencyKey: base.providerIdempotencyKey,
      fencingToken: base.fencingToken + 1,
    }),
    /EVIDENCE_FENCING_MISMATCH/,
  );
  assertions += 1;

  // Reproduce exactly the pre-T0501 retry sealing shape: the outer hash was
  // computed over a payload that still contained the previous base evidenceHash,
  // then that field was overwritten. The verifier must prove that historical
  // shape independently and normalize it to the canonical-v1 envelope.
  const baseSealed = sealAuthorityProviderEvidence(base);
  const legacyRetryPayload = {
    ...baseSealed,
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
  const normalizedAgain = verifyAuthorityProviderEvidence(verifiedLegacy.evidence);
  check(
    normalizedAgain.sealingMode === 'canonical-v1',
    'accepted legacy retry evidence is immediately normalized to canonical-v1',
  );

  assert.throws(
    () => sealAuthorityProviderEvidence({ ...base, providerEvidence: new Date() }),
    /canonical JSON-like data/,
  );
  assertions += 1;

  console.log(`Authority provider evidence integrity contract: ${assertions} assertions passed`);
}

main();
