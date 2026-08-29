import assert from 'node:assert/strict';
import {
  AuthorityProviderReconciler,
  AuthoritySideEffectRuntime,
  InMemoryAuthoritySideEffectStore,
  type AuthorityFencingValidator,
  type AuthorityProviderInspectionOutcome,
  type AuthorityProviderInspectionPort,
  type AuthorityProviderInspectionRequest,
  type AuthorityProviderRetryPlanRequest,
  type AuthorityProviderRetryPlanner,
} from '../packages/execution/src/authority-phase05-current';

const BASE = Date.parse('2026-08-29T12:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthoritySideEffectStore();
  const fences = new MutableFence();
  const runtime = new AuthoritySideEffectRuntime(store, fences);

  const applied = await createUnknownOperation(runtime, fences, 'applied', 1, 0);
  const appliedInspector = new FakeInspector({
    status: 'applied',
    result: { providerReference: 'ref-applied', status: 'accepted' },
    evidence: { providerLookup: 'idempotency-index', rowVersion: 7 },
  });
  const appliedResult = await runtime.recoverInterrupted({
    operationId: applied.operationId,
    transitionKeyPrefix: 'recover-applied',
    interruptedAt: at(4),
    reconciledAt: at(5),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(5),
      inspection: appliedInspector,
    }),
  });
  check(appliedResult.disposition === 'committed', 'provider-applied inspection commits the existing operation');
  check(appliedResult.operation.state === 'committed' && appliedResult.operation.effectKnowledge === 'applied', 'applied recovery records provider truth');
  check(appliedInspector.requests.length === 1, 'reconciliation performs one read-only provider inspection');
  check(appliedInspector.requests[0]?.providerIdempotencyKey === 'provider-applied-v1', 'inspection uses durable provider idempotency identity');
  check(appliedInspector.requests[0]?.target.kind === 'http', 'HTTP pinned target is extracted without executing it');

  const absent = await createUnknownOperation(runtime, fences, 'absent', 10, 10);
  const absentInspector = new FakeInspector({
    status: 'not_applied',
    authoritativeAbsence: true,
    evidence: { providerLookup: 'authoritative-ledger', result: 'not-found' },
  });
  const retryPlanner = new FakeRetryPlanner(fences, 'resource://absent', 11, 'provider-absent-v2');
  const absentResult = await runtime.recoverInterrupted({
    operationId: absent.operationId,
    transitionKeyPrefix: 'recover-absent',
    interruptedAt: at(14),
    reconciledAt: at(15),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(15),
      inspection: absentInspector,
      retryPlanner,
    }),
  });
  check(absentResult.disposition === 'prepared_for_retry', 'authoritative absence prepares a new fenced attempt');
  check(absentResult.operation.state === 'prepared', 'not-applied recovery returns to prepared, never executing');
  check(absentResult.operation.fencingToken === 11, 'retry receives a strictly newer fencing token');
  check(absentResult.operation.providerIdempotencyKey === 'provider-absent-v2', 'retry rotates provider attempt identity');
  check(retryPlanner.requests.length === 1, 'retry planner runs only after authoritative absence');

  const partial = await createUnknownOperation(runtime, fences, 'partial', 20, 20);
  const partialResult = await runtime.recoverInterrupted({
    operationId: partial.operationId,
    transitionKeyPrefix: 'recover-partial',
    interruptedAt: at(24),
    reconciledAt: at(25),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(25),
      inspection: new FakeInspector({
        status: 'partial',
        error: {
          code: 'PROVIDER_PARTIAL_APPLY',
          message: 'Primary record exists but secondary index is missing',
          retryable: false,
          details: { primaryCreated: true, indexCreated: false },
        },
        compensationCapability: 'authority_http_compensate',
        compensationResourceUri: 'https://api.example.com/orders/partial',
        compensationInput: { action: 'delete-primary' },
        evidence: { primaryId: 'provider-partial-1', secondaryIndex: null },
      }),
    }),
  });
  check(partialResult.disposition === 'compensation_required', 'partial application cannot be represented as not-applied');
  check(partialResult.operation.state === 'compensation_required', 'partial recovery requires explicit compensation');
  check(partialResult.operation.compensation?.capability === 'authority_http_compensate', 'compensation plan is retained');

  const unknown = await createUnknownOperation(runtime, fences, 'unknown', 30, 30);
  await assert.rejects(() => runtime.recoverInterrupted({
    operationId: unknown.operationId,
    transitionKeyPrefix: 'recover-unknown',
    interruptedAt: at(34),
    reconciledAt: at(35),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(35),
      inspection: new FakeInspector({
        status: 'unknown',
        reason: 'provider inspection endpoint timed out',
        evidence: { timeoutMs: 3000 },
      }),
    }),
  }), /PROVIDER_RECONCILIATION_INCONCLUSIVE/);
  assertions += 1;
  const stillUnknown = await runtime.get(unknown.operationId);
  check(stillUnknown?.state === 'reconciliation_required', 'inconclusive inspection leaves operation safely uncertain');

  const badFence = await createUnknownOperation(runtime, fences, 'bad-fence', 40, 40);
  await assert.rejects(() => runtime.recoverInterrupted({
    operationId: badFence.operationId,
    transitionKeyPrefix: 'recover-bad-fence',
    interruptedAt: at(44),
    reconciledAt: at(45),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(45),
      inspection: new FakeInspector({
        status: 'not_applied',
        authoritativeAbsence: true,
        evidence: { result: 'not-found' },
      }),
      retryPlanner: new StaticRetryPlanner(40, 'provider-bad-fence-v2'),
    }),
  }), /PROVIDER_RETRY_FENCE_NOT_MONOTONIC/);
  assertions += 1;
  check((await runtime.get(badFence.operationId))?.state === 'reconciliation_required', 'invalid retry fence cannot mutate the operation');

  const sameKey = await createUnknownOperation(runtime, fences, 'same-key', 50, 50);
  await assert.rejects(() => runtime.recoverInterrupted({
    operationId: sameKey.operationId,
    transitionKeyPrefix: 'recover-same-key',
    interruptedAt: at(54),
    reconciledAt: at(55),
    reconciler: new AuthorityProviderReconciler({
      inspectedAt: at(55),
      inspection: new FakeInspector({
        status: 'not_applied',
        authoritativeAbsence: true,
        evidence: { result: 'not-found' },
      }),
      retryPlanner: new StaticRetryPlanner(51, 'provider-same-key-v1'),
    }),
  }), /PROVIDER_RETRY_IDEMPOTENCY_KEY_MUST_ROTATE/);
  assertions += 1;

  console.log(`Authority provider reconciliation contract: ${assertions} assertions passed`);
}

async function createUnknownOperation(
  runtime: AuthoritySideEffectRuntime,
  fences: MutableFence,
  suffix: string,
  token: number,
  offset: number,
) {
  const resourceUri = `resource://${suffix}`;
  fences.set(resourceUri, token);
  const claimed = await runtime.claim({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: `operation-${suffix}-v1`,
    principalId: 'principal://roberto',
    agentRunId: null,
    capability: 'authority_http_write',
    resourceUri,
    input: {
      target: {
        schemaVersion: 1,
        canonicalUrl: `https://api.example.com/orders/${suffix}`,
        protocol: 'https:',
        hostname: 'api.example.com',
        port: 443,
        method: 'POST',
        resolvedAddresses: [{ address: '93.184.216.34', family: 4 }],
        authorizedAt: at(offset),
        expiresAt: at(offset + 120),
        redirectCount: 0,
        policyHash: `policy-${suffix}`,
        decisionHash: `decision-${suffix}`,
      },
      evaluatedAt: at(offset + 2),
      providerIdempotencyKey: `provider-${suffix}-v1`,
      body: '{}',
    },
    correlationId: `corr-${suffix}`,
    causationId: null,
    provenance: [{ source: `test://provider-reconciliation/${suffix}` }],
    metadata: {},
    recordedAt: at(offset + 1),
  });
  const prepared = await runtime.prepare({
    operationId: claimed.revision.operationId,
    expectedRevision: 1,
    transitionKey: `prepare-${suffix}`,
    recordedAt: at(offset + 2),
    leaseId: `lease-${suffix}`,
    leaseOwnerId: `worker-${suffix}`,
    fencingToken: token,
    providerIdempotencyKey: `provider-${suffix}-v1`,
    metadata: {},
  });
  const begun = await runtime.beginExecution({
    operationId: claimed.revision.operationId,
    expectedRevision: prepared.revision.revision,
    transitionKey: `begin-${suffix}`,
    recordedAt: at(offset + 3),
    metadata: {},
  });
  await runtime.markProviderOutcomeUnknown({
    operationId: claimed.revision.operationId,
    expectedRevision: begun.revision.revision,
    transitionKey: `unknown-${suffix}`,
    recordedAt: at(offset + 4),
    metadata: {},
    reason: {
      code: 'PROVIDER_OUTCOME_UNKNOWN',
      message: 'Execution began but terminal provider truth is unavailable',
      retryable: true,
      details: {},
    },
  });
  const operation = await runtime.get(claimed.revision.operationId);
  if (!operation) throw new Error('test operation missing');
  return operation;
}

class MutableFence implements AuthorityFencingValidator {
  private readonly tokens = new Map<string, number>();
  set(resourceUri: string, token: number): void { this.tokens.set(resourceUri, token); }
  async validate(resourceUri: string, fencingToken: number): Promise<void> {
    const current = this.tokens.get(resourceUri);
    if (current !== fencingToken) {
      throw new Error(`STALE_FENCING_TOKEN resource=${resourceUri} expected=${String(current)} received=${fencingToken}`);
    }
  }
}

class FakeInspector implements AuthorityProviderInspectionPort {
  readonly inspectorId = 'inspector://fake-provider-ledger';
  readonly inspectorVersion = '1.0.0';
  readonly requests: AuthorityProviderInspectionRequest[] = [];
  constructor(private readonly outcome: AuthorityProviderInspectionOutcome) {}
  async inspect(request: AuthorityProviderInspectionRequest): Promise<AuthorityProviderInspectionOutcome> {
    this.requests.push(structuredClone(request));
    return structuredClone(this.outcome);
  }
}

class FakeRetryPlanner implements AuthorityProviderRetryPlanner {
  readonly requests: AuthorityProviderRetryPlanRequest[] = [];
  constructor(
    private readonly fences: MutableFence,
    private readonly resourceUri: string,
    private readonly token: number,
    private readonly providerKey: string,
  ) {}
  async planRetry(request: AuthorityProviderRetryPlanRequest) {
    this.requests.push(structuredClone(request));
    this.fences.set(this.resourceUri, this.token);
    return {
      nextFencingToken: this.token,
      nextProviderIdempotencyKey: this.providerKey,
      evidence: { leaseId: `lease-retry-${this.token}`, resourceRevision: this.token },
    };
  }
}

class StaticRetryPlanner implements AuthorityProviderRetryPlanner {
  constructor(private readonly token: number, private readonly providerKey: string) {}
  async planRetry(_request: AuthorityProviderRetryPlanRequest) {
    return {
      nextFencingToken: this.token,
      nextProviderIdempotencyKey: this.providerKey,
      evidence: {},
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
