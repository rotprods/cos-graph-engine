import assert from 'node:assert/strict';
import {
  AuthorityExecutionRuntime,
  AuthorityLeaseService,
  AuthorityObservedOutcomeRecorder,
  AuthorityProviderReconciler,
  AuthoritySideEffectRuntime,
  InMemoryAuthorityLeaseStore,
  InMemoryAuthoritySideEffectStore,
  type AuthorityProviderInspectionPort,
  type AuthorityProviderInspectionRequest,
} from '../packages/execution/src/authority-phase05-clean';

const BASE = Date.parse('2026-08-29T23:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(leaseStore);
  const execution = new AuthorityExecutionRuntime(operationStore, leases);

  const resourceUri = 'resource://orders/observed-applied';
  const claim = await execution.claimOperation({
    projectId: 'COS_GRAPH_ENGINE', idempotencyKey: 'observed-applied-v1',
    principalId: 'principal://roberto', agentRunId: null,
    capability: 'authority_http_write', resourceUri,
    input: {
      target: {
        canonicalUrl: 'https://api.example.com/orders/observed-applied',
        hostname: 'api.example.com', method: 'POST', decisionHash: 'decision-observed',
      },
      providerIdempotencyKey: 'provider-observed-v1',
    },
    correlationId: 'corr-observed-applied', causationId: null,
    provenance: [{ source: 'test://phase05f/observed-outcome' }],
    recordedAt: at(0),
  });
  const lease = await execution.acquireLease({
    resourceUri, ownerId: 'worker://original', operationKey: 'lease-original',
    at: at(1), ttlMs: 5_000, metadata: {},
  });
  const prepared = await execution.prepareOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: claim.revision.revision,
    transitionKey: 'observed:prepare', recordedAt: at(2),
    leaseId: lease.revision.leaseId, leaseOwnerId: lease.revision.ownerId,
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey: 'provider-observed-v1',
  });
  const begun = await execution.beginOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: prepared.revision.revision,
    transitionKey: 'observed:begin', recordedAt: at(3),
  });
  const liveSideEffects = new AuthoritySideEffectRuntime(operationStore, leases.at(at(4)));
  await liveSideEffects.markProviderOutcomeUnknown({
    operationId: claim.revision.operationId,
    expectedRevision: begun.revision.revision,
    transitionKey: 'observed:uncertain', recordedAt: at(4),
    reason: {
      code: 'PROVIDER_OUTCOME_UNKNOWN',
      message: 'Provider connection closed after transmission',
      retryable: true,
      details: {},
    },
  });

  // The original lease expires. A new owner legitimately acquires token 2.
  const replacement = await execution.acquireLease({
    resourceUri, ownerId: 'worker://replacement', operationKey: 'lease-replacement',
    at: at(7), ttlMs: 10_000, metadata: {},
  });
  check(replacement.revision.fencingToken === 2, 'replacement owner receives a newer fence');

  const inspector = new AppliedInspector();
  const recorder = new AuthorityObservedOutcomeRecorder(operationStore, leaseStore);
  const recovered = await recorder.recover({
    operationId: claim.revision.operationId,
    transitionKeyPrefix: 'observed:recovery',
    reconciledAt: at(8),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(8), inspection: inspector,
    }),
  });
  check(recovered.disposition === 'committed', 'observed provider truth can be recorded after original lease expiry');
  check(recovered.operation.state === 'committed' && recovered.operation.effectKnowledge === 'applied', 'recovered operation records applied truth');
  check(recovered.operation.fencingToken === 1, 'historical operation retains its original fence');
  check((await leases.inspect(resourceUri, at(8)))?.fencingToken === 2, 'recording historical truth does not mutate current ownership');
  check(inspector.requests.length === 1, 'provider is inspected once and mutation is not repeated');
  const evidence = recovered.providerEvidence as { historicalFence?: { fencingToken?: number }; evidenceHash?: string };
  check(evidence.historicalFence?.fencingToken === 1 && typeof evidence.evidenceHash === 'string', 'combined evidence binds historical fence and provider observation');

  const noHash = await createUnknownWithRealLease(execution, operationStore, leases, 'missing-hash', 20);
  await assert.rejects(() => recorder.recover({
    operationId: noHash,
    transitionKeyPrefix: 'missing-hash:recovery',
    reconciledAt: at(28),
    reconciler: {
      async inspect() {
        return { status: 'applied' as const, result: { accepted: true }, evidence: { source: 'unsealed' } };
      },
    },
  }), /EVIDENCE_HASH_REQUIRED/);
  assertions += 1;
  check((await execution.getOperation(noHash, at(28)))?.state === 'reconciliation_required', 'unsealed evidence cannot mutate uncertain state');

  const orphanStore = new InMemoryAuthoritySideEffectStore();
  const permissive = { async assertCurrent(): Promise<void> {} };
  const orphanRuntime = new AuthoritySideEffectRuntime(orphanStore, permissive);
  const orphanClaim = await orphanRuntime.claim({
    projectId: 'COS_GRAPH_ENGINE', idempotencyKey: 'orphan-fence-v1',
    principalId: 'principal://roberto', capability: 'authority_http_write',
    resourceUri: 'resource://orphan-fence',
    input: {
      target: { canonicalUrl: 'https://api.example.com/orphan', hostname: 'api.example.com', method: 'POST', decisionHash: 'orphan-decision' },
      providerIdempotencyKey: 'provider-orphan-v1',
    },
    correlationId: 'corr-orphan', provenance: [{ source: 'test://phase05f/orphan' }],
    recordedAt: at(40),
  });
  const orphanPrepared = await orphanRuntime.prepare({
    operationId: orphanClaim.revision.operationId, expectedRevision: 1,
    transitionKey: 'orphan:prepare', recordedAt: at(41),
    fencingToken: 99, providerIdempotencyKey: 'provider-orphan-v1',
  });
  const orphanBegun = await orphanRuntime.beginExecution({
    operationId: orphanClaim.revision.operationId,
    expectedRevision: orphanPrepared.revision.revision,
    transitionKey: 'orphan:begin', recordedAt: at(42),
  });
  await orphanRuntime.markProviderOutcomeUnknown({
    operationId: orphanClaim.revision.operationId,
    expectedRevision: orphanBegun.revision.revision,
    transitionKey: 'orphan:uncertain', recordedAt: at(43),
    reason: { code: 'UNKNOWN', message: 'unknown', retryable: true, details: {} },
  });
  const orphanRecorder = new AuthorityObservedOutcomeRecorder(orphanStore, leaseStore);
  await assert.rejects(() => orphanRecorder.recover({
    operationId: orphanClaim.revision.operationId,
    transitionKeyPrefix: 'orphan:recovery', reconciledAt: at(44),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(44), inspection: new AppliedInspector(),
    }),
  }), /ORIGINAL_FENCE_NOT_PROVEN/);
  assertions += 1;

  console.log(`Authority observed-outcome recorder contract: ${assertions} assertions passed`);
}

async function createUnknownWithRealLease(
  execution: AuthorityExecutionRuntime,
  store: InMemoryAuthoritySideEffectStore,
  leases: AuthorityLeaseService,
  suffix: string,
  offset: number,
): Promise<string> {
  const resourceUri = `resource://${suffix}`;
  const claim = await execution.claimOperation({
    projectId: 'COS_GRAPH_ENGINE', idempotencyKey: `${suffix}-v1`,
    principalId: 'principal://roberto', capability: 'authority_http_write', resourceUri,
    input: {
      target: { canonicalUrl: `https://api.example.com/${suffix}`, hostname: 'api.example.com', method: 'POST', decisionHash: `${suffix}-decision` },
      providerIdempotencyKey: `provider-${suffix}-v1`,
    },
    correlationId: `corr-${suffix}`, provenance: [{ source: `test://phase05f/${suffix}` }],
    recordedAt: at(offset),
  });
  const lease = await execution.acquireLease({
    resourceUri, ownerId: `worker://${suffix}`, operationKey: `${suffix}:lease`,
    at: at(offset + 1), ttlMs: 20_000, metadata: {},
  });
  const prepared = await execution.prepareOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: 1,
    transitionKey: `${suffix}:prepare`, recordedAt: at(offset + 2),
    leaseId: lease.revision.leaseId, leaseOwnerId: lease.revision.ownerId,
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey: `provider-${suffix}-v1`,
  });
  const begun = await execution.beginOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: prepared.revision.revision,
    transitionKey: `${suffix}:begin`, recordedAt: at(offset + 3),
  });
  const sideEffects = new AuthoritySideEffectRuntime(store, leases.at(at(offset + 4)));
  await sideEffects.markProviderOutcomeUnknown({
    operationId: claim.revision.operationId,
    expectedRevision: begun.revision.revision,
    transitionKey: `${suffix}:uncertain`, recordedAt: at(offset + 4),
    reason: { code: 'UNKNOWN', message: 'unknown', retryable: true, details: {} },
  });
  return claim.revision.operationId;
}

class AppliedInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://applied-provider';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];

  async inspect(request: AuthorityProviderInspectionRequest) {
    this.requests.push(structuredClone(request));
    return {
      status: 'applied' as const,
      result: { providerReference: 'provider-observed-42', status: 'accepted' },
      evidence: { source: 'provider-idempotency-index', providerRevision: 42 },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
