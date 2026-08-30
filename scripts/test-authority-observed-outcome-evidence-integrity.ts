import assert from 'node:assert/strict';
import {
  AuthorityExecutionRuntime,
  AuthorityLeaseService,
  AuthorityObservedOutcomeRecorder,
  AuthoritySideEffectRuntime,
  InMemoryAuthorityLeaseStore,
  InMemoryAuthoritySideEffectStore,
  authorityProviderTargetFromOperationInput,
  sealProviderReconciliationEvidence,
  verifyProviderReconciliationEvidence,
  type ProviderSideEffectReconciler,
} from '../packages/execution/src/authority-phase05-clean';

const BASE = Date.parse('2026-08-30T12:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const firstSeal = await sealProviderReconciliationEvidence({
    operationId: 'op://seal',
    inspectorId: 'inspector://seal',
    inspectorVersion: '1.0.0',
    providerEvidence: { status: 'observed' },
  });
  const secondSeal = await sealProviderReconciliationEvidence({
    ...firstSeal,
    retryPlannerEvidence: { retry: 'planned' },
  });
  await verifyProviderReconciliationEvidence(secondSeal);
  check(
    firstSeal.evidenceHash !== secondSeal.evidenceHash,
    're-sealing an extended envelope replaces rather than recursively hides the prior top-level seal',
  );

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(leaseStore);
  const execution = new AuthorityExecutionRuntime(operationStore, leases);

  const resourceUri = 'resource://orders/evidence-integrity';
  const claim = await execution.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'evidence-integrity-v1',
    principalId: 'principal://roberto',
    agentRunId: null,
    capability: 'authority_http_write',
    resourceUri,
    input: {
      target: {
        canonicalUrl: 'https://api.example.com/orders/evidence-integrity',
        hostname: 'api.example.com',
        method: 'POST',
        decisionHash: 'decision-evidence-integrity',
      },
      providerIdempotencyKey: 'provider-evidence-integrity-v1',
    },
    correlationId: 'corr-evidence-integrity',
    causationId: null,
    provenance: [{ source: 'test://t0501/provider-evidence-integrity' }],
    recordedAt: at(0),
  });
  const lease = await execution.acquireLease({
    resourceUri,
    ownerId: 'worker://evidence-original',
    operationKey: 'lease-evidence-original',
    at: at(1),
    ttlMs: 5_000,
    metadata: {},
  });
  const prepared = await execution.prepareOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: claim.revision.revision,
    transitionKey: 'evidence:prepare',
    recordedAt: at(2),
    leaseId: lease.revision.leaseId,
    leaseOwnerId: lease.revision.ownerId,
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey: 'provider-evidence-integrity-v1',
  });
  const begun = await execution.beginOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: prepared.revision.revision,
    transitionKey: 'evidence:begin',
    recordedAt: at(3),
  });
  const live = new AuthoritySideEffectRuntime(operationStore, leases.at(at(4)));
  await live.markProviderOutcomeUnknown({
    operationId: claim.revision.operationId,
    expectedRevision: begun.revision.revision,
    transitionKey: 'evidence:uncertain',
    recordedAt: at(4),
    reason: {
      code: 'PROVIDER_OUTCOME_UNKNOWN',
      message: 'Connection closed after request transmission',
      retryable: true,
      details: {},
    },
  });

  const replacement = await execution.acquireLease({
    resourceUri,
    ownerId: 'worker://evidence-replacement',
    operationKey: 'lease-evidence-replacement',
    at: at(7),
    ttlMs: 20_000,
    metadata: {},
  });
  check(replacement.revision.fencingToken === 2, 'replacement owner receives fencing token 2');

  const recorder = new AuthorityObservedOutcomeRecorder(operationStore, leaseStore);
  const operationId = claim.revision.operationId;

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'forged-hash',
      reconciledAt: at(8),
      reconciler: {
        async inspect() {
          return {
            status: 'applied' as const,
            result: { accepted: true },
            evidence: { evidenceHash: '0'.repeat(64) },
          };
        },
      },
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;
  check(
    (await execution.getOperation(operationId, at(8)))?.state === 'reconciliation_required',
    'forged hash cannot mutate uncertain operation state',
  );

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'tampered-payload',
      reconciledAt: at(9),
      reconciler: tamperedEvidenceReconciler(at(9)),
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_HASH_MISMATCH/,
  );
  assertions += 1;
  check(
    (await execution.getOperation(operationId, at(9)))?.state === 'reconciliation_required',
    'tampered sealed payload cannot mutate uncertain operation state',
  );

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'cross-operation',
      reconciledAt: at(10),
      reconciler: sealedEvidenceReconciler(at(10), { operationId: `${operationId}:other` }),
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_BINDING_MISMATCH field=operationId/,
  );
  assertions += 1;

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'stale-inspection',
      reconciledAt: at(11),
      reconciler: sealedEvidenceReconciler(at(10)),
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_TIME_MISMATCH/,
  );
  assertions += 1;

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'wrong-target',
      reconciledAt: at(12),
      reconciler: sealedEvidenceReconciler(at(12), {
        targetDecisionHash: 'different-decision',
      }),
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_TARGET_MISMATCH/,
  );
  assertions += 1;

  await assert.rejects(
    () => recorder.recover({
      operationId,
      transitionKeyPrefix: 'wrong-content',
      reconciledAt: at(13),
      reconciler: sealedEvidenceReconciler(at(13), {
        operationContentHash: 'wrong-content-hash',
      }),
    }),
    /PROVIDER_RECONCILIATION_EVIDENCE_BINDING_MISMATCH field=operationContentHash/,
  );
  assertions += 1;

  const recovered = await recorder.recover({
    operationId,
    transitionKeyPrefix: 'valid-evidence',
    reconciledAt: at(14),
    reconciler: sealedEvidenceReconciler(at(14)),
  });
  check(recovered.disposition === 'committed', 'valid independently sealed evidence is accepted');
  check(recovered.operation.state === 'committed', 'valid evidence records provider truth');
  check(
    (await leases.inspect(resourceUri, at(14)))?.fencingToken === 2,
    'historical truth recording does not replace current ownership',
  );

  const outerEvidence = recovered.providerEvidence as {
    providerEvidence?: Record<string, unknown>;
    historicalFence?: { fencingToken?: number };
    evidenceHash?: string;
  };
  check(
    typeof outerEvidence.evidenceHash === 'string'
      && outerEvidence.evidenceHash.length === 64
      && outerEvidence.historicalFence?.fencingToken === 1
      && typeof outerEvidence.providerEvidence?.evidenceHash === 'string',
    'final evidence binds verified provider seal and historical fence with SHA-256',
  );

  console.log(`T0501 provider-evidence integrity contract: ${assertions} assertions passed`);

  function sealedEvidenceReconciler(
    inspectedAt: string,
    overrides: {
      operationId?: string;
      operationContentHash?: string;
      targetDecisionHash?: string;
    } = {},
  ): ProviderSideEffectReconciler {
    return {
      async inspect(operation) {
        const providerIdempotencyKey = operation.providerIdempotencyKey;
        if (!providerIdempotencyKey || operation.fencingToken === null) {
          throw new Error('test operation lacks provider identity/fence');
        }
        const target = authorityProviderTargetFromOperationInput(
          operation.input,
          providerIdempotencyKey,
        );
        const evidenceTarget = overrides.targetDecisionHash
          ? { ...target, targetDecisionHash: overrides.targetDecisionHash }
          : target;
        return {
          status: 'applied' as const,
          result: { accepted: true, providerReference: 'provider://result/t0501' },
          evidence: await sealProviderReconciliationEvidence({
            inspectorId: 'inspector://t0501',
            inspectorVersion: '1.0.0',
            inspectedAt,
            operationId: overrides.operationId ?? operation.operationId,
            projectId: operation.projectId,
            capability: operation.capability,
            resourceUri: operation.resourceUri,
            providerIdempotencyKey,
            fencingToken: operation.fencingToken,
            operationContentHash: overrides.operationContentHash ?? operation.contentHash,
            target: evidenceTarget,
            providerEvidence: {
              source: 'provider-idempotency-index',
              providerRevision: 51,
            },
          }),
        };
      },
    };
  }

  function tamperedEvidenceReconciler(inspectedAt: string): ProviderSideEffectReconciler {
    const delegate = sealedEvidenceReconciler(inspectedAt);
    return {
      async inspect(operation) {
        const outcome = await delegate.inspect(operation);
        const evidence = structuredClone(outcome.evidence);
        evidence.providerEvidence = {
          source: 'attacker-modified',
          providerRevision: 999,
        };
        return { ...outcome, evidence };
      },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
