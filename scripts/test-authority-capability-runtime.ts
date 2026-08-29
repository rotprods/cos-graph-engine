import assert from 'node:assert/strict';
import type { CellContext } from '../packages/core/src';
import {
  AuthorityAgentRunService,
  AuthorityCapabilityRuntime,
  AuthorityExecutionRuntime,
  AuthorityFileSandbox,
  AuthorityHttpEgressGuard,
  AuthorityPinnedHttpTool,
  AuthorityPolicyEngine,
  AuthoritySideEffectRuntime,
  InMemoryAuthorityAgentRunStore,
  InMemoryAuthorityApprovalStore,
  InMemoryAuthorityLeaseStore,
  InMemoryAuthoritySideEffectStore,
  PolicyBoundAuthorityExecutionRuntime,
  createAuthorityProviderRegistry,
  type AuthorityDnsResolver,
  type AuthorityPinnedHttpTransport,
  type AuthorityPinnedHttpTransportRequest,
  type AuthorityResolvedAddress,
} from '../packages/execution/src/authority-phase05-current';
import { AuthorityLeaseService } from '../packages/execution/src/authority-lease';

const BASE = Date.parse('2026-08-29T08:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const resolver = new StaticResolver({
    'api.example.com': [{ address: '93.184.216.34', family: 4 }],
  });
  const guard = new AuthorityHttpEgressGuard({
    allowedHosts: ['api.example.com'],
    allowedPorts: [443],
    allowedMethods: ['GET', 'POST'],
    decisionTtlMs: 120_000,
    maxRedirects: 0,
  }, resolver);
  const writeTarget = await guard.authorize({
    url: 'https://api.example.com/orders/42', method: 'POST', at: at(0),
  });
  const readTarget = await guard.authorize({
    url: 'https://api.example.com/orders/42', method: 'GET', at: at(0),
  });

  const transport = new FakePinnedHttpTransport();
  const registry = createAuthorityProviderRegistry([
    new AuthorityPinnedHttpTool('mutation', guard, transport, {
      name: 'authority_http_write',
      description: 'Pinned test HTTP mutation',
    }),
    new AuthorityPinnedHttpTool('read', guard, transport, {
      name: 'authority_http_read',
      description: 'Pinned test HTTP read',
    }),
  ]);
  check(!registry.has('http_client') && !registry.has('filesystem') && !registry.has('search'), 'legacy direct tools are absent from the authority registry');

  const principal = {
    id: 'principal://roberto',
    roles: ['builder'],
    projectIds: ['COS_GRAPH_ENGINE'],
    sensitivityClearance: 'restricted' as const,
    attributes: {},
  };
  const policy = new AuthorityPolicyEngine([{
    id: 'allow-authority-capabilities-v1',
    effect: 'allow',
    priority: 100,
    actions: [
      'capability.read',
      'operation.claim',
      'operation.prepare',
      'operation.execute',
      'operation.commit',
      'lease.acquire',
      'lease.release',
    ],
    capabilities: ['authority_http_write', 'authority_http_read'],
    resourcePrefixes: ['https://api.example.com/'],
    projectIds: ['COS_GRAPH_ENGINE'],
    principalIds: [principal.id],
    anyRoles: ['builder'],
    maxSensitivity: 'restricted',
    validFrom: at(-100),
    reason: 'explicit Phase 05 test capability allow',
    provenance: [{ source: 'test://authority-capability-runtime' }],
  }], new InMemoryAuthorityApprovalStore());

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(leaseStore);
  const execution = new AuthorityExecutionRuntime(operationStore, leases);
  const policyRuntime = new PolicyBoundAuthorityExecutionRuntime(execution, policy);
  const sideEffects = new AuthoritySideEffectRuntime(operationStore, leases.at(at(60)));
  const agentRuns = new AuthorityAgentRunService(new InMemoryAuthorityAgentRunStore());
  const runtime = new AuthorityCapabilityRuntime({
    registry,
    policy,
    policyRuntime,
    execution,
    sideEffects,
    agentRuns,
  });
  const context: CellContext = {
    traceId: 'trace-capability-runtime',
    userId: principal.id,
    metadata: { projectId: 'COS_GRAPH_ENGINE' },
  };

  const createdRun = await agentRuns.create({
    projectId: 'COS_GRAPH_ENGINE',
    principalId: principal.id,
    agentId: 'agent://cos/capability-runtime-test',
    operationKey: 'run-capability-runtime-create',
    goal: {
      intent: 'Execute one pinned provider mutation',
      desiredOutcome: 'Provider result is committed and linked to run evidence',
      constraints: ['no direct provider bypass', 'no blind retry'],
      projectId: 'COS_GRAPH_ENGINE',
      requestedBy: principal.id,
      provenance: [{ source: 'test://authority-capability-runtime' }],
    },
    acceptanceCriteria: [{
      id: 'criterion-provider-committed',
      description: 'Provider effect is committed in the durable operation ledger',
      required: true,
      evaluatorId: 'evaluator://side-effect-ledger',
      evaluatorVersion: '1.0.0',
    }],
    correlationId: 'corr-capability-run',
    recordedAt: at(-30),
  });
  const plannedRun = await agentRuns.setPlan({
    runId: createdRun.revision.runId,
    expectedRevision: 1,
    operationKey: 'run-capability-runtime-plan',
    recordedAt: at(-20),
    steps: [{
      id: 'step-provider-write',
      name: 'Write order through pinned provider',
      capability: 'authority_http_write',
      critical: true,
      sideEffecting: true,
      dependencies: [],
      acceptanceCriterionIds: ['criterion-provider-committed'],
      input: { orderId: 42 },
      metadata: {},
    }],
  });
  const startedRun = await agentRuns.start({
    runId: createdRun.revision.runId,
    expectedRevision: plannedRun.revision.revision,
    operationKey: 'run-capability-runtime-start',
    recordedAt: at(-10),
  });

  const writeRequest = {
    capability: 'authority_http_write',
    projectId: 'COS_GRAPH_ENGINE',
    principal,
    sensitivity: 'internal' as const,
    resourceUri: 'https://api.example.com/orders/42',
    input: {
      target: writeTarget,
      evaluatedAt: at(4),
      headers: { 'content-type': 'application/json' },
      body: '{"status":"approved"}',
    },
    idempotencyKey: 'capability-write-order-42',
    providerIdempotencyKey: 'provider-write-order-42',
    correlationId: 'corr-write-order-42',
    provenance: [{ source: 'test://authority-capability-runtime/write' }],
    metadata: { scenario: 'success' },
    context,
    timeline: {
      claimAt: at(1),
      leaseAt: at(2),
      prepareAt: at(3),
      beginAt: at(4),
      outcomeAt: at(5),
      releaseAt: at(6),
    },
    leaseOwnerId: 'worker://phase05/a',
    leaseTtlMs: 60_000,
    agentStep: {
      runId: createdRun.revision.runId,
      expectedRevision: startedRun.revision.revision,
      operationKey: 'run-capability-runtime-step-1',
      stepId: 'step-provider-write',
      attempt: 1,
      startedAt: at(4),
      completedAt: at(5),
      evidenceRefs: ['test://provider/call/1', 'test://operation/commit/1'],
    },
  };

  const committed = await runtime.executeSideEffect(writeRequest);
  check(committed.status === 'committed', 'provider success commits the authority operation');
  check(committed.operation.state === 'committed' && committed.operation.effectKnowledge === 'applied', 'durable operation records applied outcome');
  check(committed.leaseRelease.status === 'released', 'lease is released after accepted commit');
  check(committed.agentEvidence.status === 'recorded', 'agent-run step evidence is appended after commit');
  check(transport.calls.length === 1, 'provider transport executes exactly once on initial success path');
  check(transport.calls[0]?.target.resolvedAddresses[0]?.address === '93.184.216.34', 'transport receives the pinned address set');
  check(transport.calls[0]?.providerIdempotencyKey === 'provider-write-order-42', 'provider idempotency key reaches the transport unchanged');
  check(transport.calls[0]?.target.hostname === 'api.example.com', 'original hostname remains available for SNI/Host semantics');

  const durableRun = await agentRuns.get(createdRun.revision.runId);
  check(durableRun?.stepResults.length === 1, 'agent run retains one accepted step result');
  check(durableRun?.stepResults[0]?.sideEffectOperationId === committed.operation.operationId, 'agent step points to the durable side-effect operation');

  const retried = await runtime.executeSideEffect(writeRequest);
  check(retried.status === 'already_committed', 'same logical retry resolves to durable committed outcome');
  check(transport.calls.length === 1, 'committed retry never calls the provider again');
  check(retried.agentEvidence.status === 'recorded', 'agent evidence retry converges idempotently');

  const read = await runtime.executeRead({
    capability: 'authority_http_read',
    projectId: 'COS_GRAPH_ENGINE',
    principal,
    sensitivity: 'internal',
    resourceUri: 'https://api.example.com/orders/42',
    input: { target: readTarget, evaluatedAt: at(10) },
    at: at(10),
    context,
  });
  check(read.status === 'read_completed' && read.receipt.result.success, 'read-only pinned capability executes through strict router');
  check(transport.calls.length === 2, 'read execution is distinct from side-effect retry');

  transport.mode = 'throw_after_call';
  const unknownRequest = {
    ...writeRequest,
    resourceUri: 'https://api.example.com/orders/43',
    input: {
      target: await guard.authorize({
        url: 'https://api.example.com/orders/43', method: 'POST', at: at(20),
      }),
      evaluatedAt: at(24),
      body: '{"status":"unknown"}',
    },
    idempotencyKey: 'capability-write-order-43',
    providerIdempotencyKey: 'provider-write-order-43',
    correlationId: 'corr-write-order-43',
    metadata: { scenario: 'provider-unknown' },
    timeline: {
      claimAt: at(21), leaseAt: at(22), prepareAt: at(23), beginAt: at(24), outcomeAt: at(25),
    },
    agentStep: undefined,
  };
  const unknown = await runtime.executeSideEffect(unknownRequest);
  check(unknown.status === 'reconciliation_required', 'provider exception after begin becomes reconciliation_required');
  check(unknown.operation.effectKnowledge === 'unknown', 'unknown provider effect is not mislabeled failed or not-applied');
  check(transport.calls.length === 3, 'unknown provider path executes once');
  const unknownRetry = await runtime.executeSideEffect(unknownRequest);
  check(unknownRetry.status === 'reconciliation_required', 'retry of uncertain operation requires reconciliation');
  check(transport.calls.length === 3, 'uncertain operation retry never executes provider blindly');

  const operationCountBeforeExpired = (await operationStore.getHistory(committed.operation.operationId)).length;
  await assert.rejects(() => runtime.executeSideEffect({
    ...writeRequest,
    resourceUri: 'https://api.example.com/orders/44',
    input: {
      target: await guard.authorize({
        url: 'https://api.example.com/orders/44', method: 'POST', at: at(30),
      }),
      evaluatedAt: at(200),
      body: '{}',
    },
    idempotencyKey: 'capability-write-order-44',
    providerIdempotencyKey: 'provider-write-order-44',
    timeline: {
      claimAt: at(31), leaseAt: at(32), prepareAt: at(33), beginAt: at(34), outcomeAt: at(35),
    },
    agentStep: undefined,
  }), /EGRESS_DECISION_EXPIRED/);
  assertions += 1;
  check(
    (await operationStore.getByIdempotencyKey('COS_GRAPH_ENGINE', 'capability-write-order-44')) === null,
    'expired isolation decision fails before operation claim',
  );
  check((await operationStore.getHistory(committed.operation.operationId)).length === operationCountBeforeExpired, 'expired preflight cannot mutate an unrelated operation');

  const deniedPolicy = new AuthorityPolicyEngine([], new InMemoryAuthorityApprovalStore());
  const deniedOperationStore = new InMemoryAuthoritySideEffectStore();
  const deniedLeases = new AuthorityLeaseService(new InMemoryAuthorityLeaseStore());
  const deniedExecution = new AuthorityExecutionRuntime(deniedOperationStore, deniedLeases);
  const deniedRuntime = new AuthorityCapabilityRuntime({
    registry,
    policy: deniedPolicy,
    policyRuntime: new PolicyBoundAuthorityExecutionRuntime(deniedExecution, deniedPolicy),
    execution: deniedExecution,
    sideEffects: new AuthoritySideEffectRuntime(deniedOperationStore, deniedLeases.at(at(60))),
  });
  transport.mode = 'success';
  await assert.rejects(() => deniedRuntime.executeSideEffect({
    ...writeRequest,
    idempotencyKey: 'capability-denied-write',
    providerIdempotencyKey: 'provider-denied-write',
    agentStep: undefined,
  }), /POLICY_DENIED/);
  assertions += 1;
  check(transport.calls.length === 3, 'policy denial occurs before provider execution');
  check(
    await deniedOperationStore.getByIdempotencyKey('COS_GRAPH_ENGINE', 'capability-denied-write') === null,
    'policy denial appends no side-effect operation',
  );

  // Construction-time smoke check for filesystem dependency type; it is not
  // executed here because the dedicated isolation suite owns handle semantics.
  void AuthorityFileSandbox;

  console.log(`Authority capability runtime contract: ${assertions} assertions passed`);
}

class StaticResolver implements AuthorityDnsResolver {
  constructor(private readonly records: Record<string, AuthorityResolvedAddress[]>) {}
  async resolve(hostname: string): Promise<AuthorityResolvedAddress[]> {
    return structuredClone(this.records[hostname] ?? []);
  }
}

class FakePinnedHttpTransport implements AuthorityPinnedHttpTransport {
  mode: 'success' | 'throw_after_call' = 'success';
  readonly calls: AuthorityPinnedHttpTransportRequest[] = [];

  async execute(request: AuthorityPinnedHttpTransportRequest): Promise<unknown> {
    this.calls.push(structuredClone(request));
    if (this.mode === 'throw_after_call') {
      throw new Error('provider connection closed after request transmission');
    }
    return {
      statusCode: request.target.method === 'GET' ? 200 : 202,
      orderId: request.target.canonicalUrl.split('/').at(-1),
      providerReference: `provider-ref-${this.calls.length}`,
      providerIdempotencyKey: request.providerIdempotencyKey ?? null,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
