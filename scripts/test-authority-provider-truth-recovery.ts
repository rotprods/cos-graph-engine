import assert from 'node:assert/strict';
import {
  AuthorityExecutionRuntime,
  AuthorityLeaseRetryPlanner,
  AuthorityLeaseService,
  AuthorityObservedOutcomeRecorder,
  AuthorityProviderReconciler,
  AuthoritySideEffectRuntime,
  InMemoryAuthorityLeaseStore,
  InMemoryAuthoritySideEffectStore,
  type AuthorityProviderInspectionPort,
  type AuthorityProviderInspectionRequest,
} from '../packages/execution/src/authority-phase05-clean';

const BASE = Date.parse('2026-09-02T09:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

let assertions = 0;
const check = (condition: unknown, message: string): void => {
  assert.ok(condition, message);
  assertions += 1;
};

async function main(): Promise<void> {
  await appliedAfterLostResponseAndTakeover();
  await unknownNeverAuthorizesRetry();
  await repeatedAbsencePreparesFreshRetry();
  await partialRequiresCompensation();
  console.log(`Authority provider truth recovery integration contract: ${assertions} assertions passed`);
}

async function appliedAfterLostResponseAndTakeover(): Promise<void> {
  const env = await createUncertainOperation('applied', 0, 5_000);
  const replacement = await env.execution.acquireLease({
    resourceUri: env.resourceUri,
    ownerId: 'worker://replacement',
    operationKey: 'applied:replacement-lease',
    at: at(7),
    ttlMs: 20_000,
    metadata: {},
  });
  check(replacement.revision.fencingToken === 2, 'replacement worker receives fencing token 2');

  await assert.rejects(
    () => env.execution.commitOperation({
      operationId: env.operationId,
      expectedOperationRevision: env.uncertainRevision,
      transitionKey: 'applied:stale-live-commit',
      recordedAt: at(8),
      result: { providerReference: 'should-not-commit' },
    }),
    /STALE_FENCING_TOKEN/,
  );
  assertions += 1;

  const inspector = new AppliedInspector();
  const recorder = new AuthorityObservedOutcomeRecorder(env.operationStore, env.leaseStore);
  const recovered = await recorder.recover({
    operationId: env.operationId,
    transitionKeyPrefix: 'applied:observed-recovery',
    reconciledAt: at(9),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(9),
      inspection: inspector,
    }),
    metadata: { failureMode: 'timeout-after-provider-acceptance' },
  });

  check(recovered.disposition === 'committed', 'observed applied truth commits the uncertain operation');
  check(recovered.operation.state === 'committed', 'applied recovery reaches committed state');
  check(recovered.operation.effectKnowledge === 'applied', 'committed recovery records applied knowledge');
  check(recovered.operation.fencingToken === 1, 'historical operation retains original execution fence');
  check(inspector.requests.length === 1, 'recovery performs exactly one read-only provider inspection');
  check(!('execute' in inspector) && !('write' in inspector), 'inspection port exposes no provider mutation method');
  const liveLease = await env.leases.inspect(env.resourceUri, at(9));
  check(liveLease?.fencingToken === 2 && liveLease.ownerId === 'worker://replacement', 'historical truth recording preserves current lease ownership');
}

async function unknownNeverAuthorizesRetry(): Promise<void> {
  const env = await createUncertainOperation('unknown', 20, 5_000);
  const historyBefore = await env.leaseStore.getHistory(env.resourceUri);
  const recorder = new AuthorityObservedOutcomeRecorder(env.operationStore, env.leaseStore);
  const inspector = new UnknownInspector();

  await assert.rejects(
    () => recorder.recover({
      operationId: env.operationId,
      transitionKeyPrefix: 'unknown:recovery',
      reconciledAt: at(25),
      reconciler: new AuthorityProviderReconciler({
        inspectedAt: at(25),
        inspection: inspector,
        retryPlanner: new AuthorityLeaseRetryPlanner(env.leases, {
          ownerId: 'worker://must-not-retry',
          ttlMs: 10_000,
        }),
      }),
    }),
    /PROVIDER_RECONCILIATION_INCONCLUSIVE/,
  );
  assertions += 1;

  const current = await env.execution.getOperation(env.operationId, at(25));
  const historyAfter = await env.leaseStore.getHistory(env.resourceUri);
  check(current?.state === 'reconciliation_required', 'unknown provider truth remains reconciliation_required');
  check(current?.effectKnowledge === 'unknown', 'unknown provider truth remains explicitly unknown');
  check(historyAfter.length === historyBefore.length, 'unknown provider truth creates no retry lease');
  check(inspector.requests.length === 1, 'unknown outcome performs one read-only inspection');
}

async function repeatedAbsencePreparesFreshRetry(): Promise<void> {
  const env = await createUncertainOperation('absence', 40, 4_000);
  const inspector = new AuthoritativeAbsenceInspector();
  const retryPlanner = new AuthorityLeaseRetryPlanner(env.leases, {
    ownerId: 'worker://retry',
    ttlMs: 10_000,
    providerKeyFactory: ({ fencingToken }) => `provider-absence-retry-${fencingToken}`,
  });
  const recorder = new AuthorityObservedOutcomeRecorder(env.operationStore, env.leaseStore);

  const recovered = await recorder.recover({
    operationId: env.operationId,
    transitionKeyPrefix: 'absence:recovery',
    reconciledAt: at(46),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(46),
      inspection: inspector,
      retryPlanner,
    }),
  });

  check(recovered.disposition === 'prepared_for_retry', 'authoritative absence prepares but does not execute a retry');
  check(recovered.operation.state === 'prepared', 'not_applied recovery returns to prepared state only');
  check(recovered.operation.attempt === 2, 'retry preparation advances attempt number exactly once');
  check(recovered.operation.fencingToken === 2, 'retry preparation binds a strictly newer fence');
  check(recovered.operation.providerIdempotencyKey === 'provider-absence-retry-2', 'retry preparation rotates provider attempt identity');
  check(inspector.requests.length === 1, 'absence path performs one provider inspection');
  const retryLease = await env.leases.inspect(env.resourceUri, at(46));
  check(retryLease?.fencingToken === 2 && retryLease.ownerId === 'worker://retry', 'retry planner owns the fresh lease it created');
  check(recovered.operation.effectKnowledge === 'not_started', 'prepared retry does not claim an external effect occurred');
}

async function partialRequiresCompensation(): Promise<void> {
  const env = await createUncertainOperation('partial', 60, 5_000);
  const inspector = new PartialInspector();
  const recorder = new AuthorityObservedOutcomeRecorder(env.operationStore, env.leaseStore);
  const recovered = await recorder.recover({
    operationId: env.operationId,
    transitionKeyPrefix: 'partial:recovery',
    reconciledAt: at(65),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(65),
      inspection: inspector,
    }),
  });

  check(recovered.disposition === 'compensation_required', 'partial provider truth requires compensation');
  check(recovered.operation.state === 'compensation_required', 'partial recovery cannot become committed or prepared retry');
  check(recovered.operation.effectKnowledge === 'partial', 'partial provider knowledge remains explicit');
  check(recovered.operation.compensation?.capability === 'authority_http_compensate', 'compensation capability is persisted');
  check(inspector.requests.length === 1, 'partial path performs one read-only inspection');
}

async function createUncertainOperation(
  suffix: string,
  offset: number,
  leaseTtlMs: number,
) {
  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(leaseStore);
  const execution = new AuthorityExecutionRuntime(operationStore, leases);
  const resourceUri = `resource://provider-truth/${suffix}`;
  const providerIdempotencyKey = `provider-${suffix}-attempt-1`;

  const claim = await execution.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: `t0502f-${suffix}-operation`,
    principalId: 'principal://cgev2-test',
    agentRunId: null,
    capability: 'authority_http_write',
    resourceUri,
    input: {
      target: {
        canonicalUrl: `https://api.example.com/provider-truth/${suffix}`,
        hostname: 'api.example.com',
        method: 'POST',
        decisionHash: `decision-${suffix}`,
      },
      providerIdempotencyKey,
    },
    correlationId: `corr-${suffix}`,
    causationId: null,
    provenance: [{ source: `test://t0502f/${suffix}` }],
    metadata: {},
    recordedAt: at(offset),
  });
  const lease = await execution.acquireLease({
    resourceUri,
    ownerId: 'worker://original',
    operationKey: `${suffix}:original-lease`,
    at: at(offset + 1),
    ttlMs: leaseTtlMs,
    metadata: {},
  });
  const prepared = await execution.prepareOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: claim.revision.revision,
    transitionKey: `${suffix}:prepare`,
    recordedAt: at(offset + 2),
    leaseId: lease.revision.leaseId,
    leaseOwnerId: lease.revision.ownerId,
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey,
  });
  const begun = await execution.beginOperation({
    operationId: claim.revision.operationId,
    expectedOperationRevision: prepared.revision.revision,
    transitionKey: `${suffix}:begin`,
    recordedAt: at(offset + 3),
  });
  const sideEffects = new AuthoritySideEffectRuntime(operationStore, leases.at(at(offset + 4)));
  const uncertain = await sideEffects.markProviderOutcomeUnknown({
    operationId: claim.revision.operationId,
    expectedRevision: begun.revision.revision,
    transitionKey: `${suffix}:uncertain`,
    recordedAt: at(offset + 4),
    reason: {
      code: 'PROVIDER_RESPONSE_LOST',
      message: 'Provider request was dispatched but no terminal response was accepted',
      retryable: true,
      details: {},
    },
  });

  return {
    operationStore,
    leaseStore,
    leases,
    execution,
    resourceUri,
    operationId: claim.revision.operationId,
    uncertainRevision: uncertain.revision.revision,
  };
}

class AppliedInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://t0502f/applied';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];

  async inspect(request: AuthorityProviderInspectionRequest) {
    this.requests.push(structuredClone(request));
    return {
      status: 'applied' as const,
      result: { providerReference: 'accepted-on-original-attempt' },
      evidence: { source: 'read-only-provider-index', providerRevision: 'applied-r1' },
    };
  }
}

class UnknownInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://t0502f/unknown';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];

  async inspect(request: AuthorityProviderInspectionRequest) {
    this.requests.push(structuredClone(request));
    return {
      status: 'unknown' as const,
      reason: 'provider read is permission-ambiguous',
      evidence: { source: 'read-only-provider-index', ambiguity: 'ACCESS_OR_ABSENCE' },
    };
  }
}

class AuthoritativeAbsenceInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://t0502f/authoritative-absence';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];

  async inspect(request: AuthorityProviderInspectionRequest) {
    this.requests.push(structuredClone(request));
    return {
      status: 'not_applied' as const,
      authoritativeAbsence: true as const,
      evidence: {
        source: 'durable-repeated-absence-store',
        observationCount: 2,
        firstObservedAt: at(40),
        lastObservedAt: at(46),
        elapsedMs: 6_000,
        absenceProofHashAlgorithm: 'sha256',
        absenceProofHash: 'f'.repeat(64),
      },
    };
  }
}

class PartialInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://t0502f/partial';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];

  async inspect(request: AuthorityProviderInspectionRequest) {
    this.requests.push(structuredClone(request));
    return {
      status: 'partial' as const,
      error: {
        code: 'PROVIDER_PARTIAL_APPLICATION',
        message: 'Provider reports a partially applied operation',
        retryable: false,
        details: {},
      },
      compensationCapability: 'authority_http_compensate',
      compensationResourceUri: request.resourceUri,
      compensationInput: { operationId: request.operationId },
      evidence: { source: 'read-only-provider-index', providerRevision: 'partial-r1' },
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
