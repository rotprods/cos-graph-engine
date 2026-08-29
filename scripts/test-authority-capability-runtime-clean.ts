import assert from 'node:assert/strict';
import type { CellContext } from '../packages/core/src';
import {
  AuthorityCapabilityRuntime,
  AuthorityExecutionRuntime,
  AuthorityHttpEgressGuard,
  AuthorityLeaseService,
  AuthorityPinnedHttpTool,
  AuthorityPolicyEngine,
  AuthoritySideEffectRuntime,
  InMemoryAuthorityApprovalStore,
  InMemoryAuthorityLeaseStore,
  InMemoryAuthoritySideEffectStore,
  PolicyBoundAuthorityExecutionRuntime,
  createAuthorityProviderRegistry,
  type AuthorityDnsResolver,
  type AuthorityPinnedHttpTransport,
  type AuthorityPinnedHttpTransportRequest,
  type AuthorityResolvedAddress,
} from '../packages/execution/src/authority-phase05-clean';

const BASE = Date.parse('2026-08-29T08:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const guard = new AuthorityHttpEgressGuard({
    allowedHosts: ['api.example.com'],
    allowedPorts: [443],
    allowedMethods: ['GET', 'POST'],
    decisionTtlMs: 120_000,
    maxRedirects: 0,
  }, new StaticResolver({
    'api.example.com': [{ address: '93.184.216.34', family: 4 }],
  }));
  const writeTarget = await guard.authorize({
    url: 'https://api.example.com/orders/42', method: 'POST', at: at(0),
  });
  const readTarget = await guard.authorize({
    url: 'https://api.example.com/orders/42', method: 'GET', at: at(0),
  });

  const transport = new FakePinnedHttpTransport();
  const registry = createAuthorityProviderRegistry([
    new AuthorityPinnedHttpTool('mutation', guard, transport, {
      name: 'authority_http_write', description: 'Pinned test mutation',
    }),
    new AuthorityPinnedHttpTool('read', guard, transport, {
      name: 'authority_http_read', description: 'Pinned test read',
    }),
  ]);
  check(
    !registry.has('http_client') && !registry.has('filesystem') && !registry.has('search'),
    'legacy direct tools are absent from the authority registry',
  );

  const principal = {
    id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'],
    sensitivityClearance: 'restricted' as const, attributes: {},
  };
  const policy = new AuthorityPolicyEngine([{
    id: 'allow-clean-capabilities-v1', effect: 'allow', priority: 100,
    actions: [
      'capability.read', 'operation.claim', 'operation.prepare',
      'operation.execute', 'operation.commit', 'lease.acquire', 'lease.release',
    ],
    capabilities: ['authority_http_write', 'authority_http_read'],
    resourcePrefixes: ['https://api.example.com/'],
    projectIds: ['COS_GRAPH_ENGINE'], principalIds: [principal.id],
    anyRoles: ['builder'], maxSensitivity: 'restricted',
    validFrom: at(-100), reason: 'explicit clean capability allow',
    provenance: [{ source: 'test://phase05e/capability-runtime' }],
  }], new InMemoryAuthorityApprovalStore());

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leases = new AuthorityLeaseService(new InMemoryAuthorityLeaseStore());
  const execution = new AuthorityExecutionRuntime(operationStore, leases);
  const runtime = new AuthorityCapabilityRuntime({
    registry,
    policy,
    policyRuntime: new PolicyBoundAuthorityExecutionRuntime(execution, policy),
    execution,
    sideEffects: new AuthoritySideEffectRuntime(operationStore, leases.at(at(60))),
  });
  const context: CellContext = {
    traceId: 'trace-clean-capability-runtime',
    userId: principal.id,
    metadata: { projectId: 'COS_GRAPH_ENGINE' },
  };

  const writeRequest = {
    capability: 'authority_http_write', projectId: 'COS_GRAPH_ENGINE',
    principal, sensitivity: 'internal' as const,
    resourceUri: 'https://api.example.com/orders/42',
    input: {
      target: writeTarget,
      evaluatedAt: at(200),
      headers: { 'content-type': 'application/json' },
      body: '{"status":"approved"}',
    },
    idempotencyKey: 'capability-write-order-42',
    providerIdempotencyKey: 'provider-write-order-42',
    correlationId: 'corr-write-order-42',
    provenance: [{ source: 'test://phase05e/capability-runtime/write' }],
    metadata: { scenario: 'success' }, context,
    timeline: {
      claimAt: at(1), leaseAt: at(2), prepareAt: at(3),
      beginAt: at(4), outcomeAt: at(5), releaseAt: at(6),
    },
    leaseOwnerId: 'worker://phase05e/a', leaseTtlMs: 60_000,
  };

  const committed = await runtime.executeSideEffect(writeRequest);
  check(committed.status === 'committed', 'provider success commits the durable operation');
  check(committed.operation.state === 'committed' && committed.operation.effectKnowledge === 'applied', 'committed truth records applied knowledge');
  check(committed.leaseRelease.status === 'released', 'accepted operation releases its lease');
  check(transport.calls.length === 1, 'initial success calls provider once');
  check(transport.calls[0]?.target.resolvedAddresses[0]?.address === '93.184.216.34', 'transport consumes the pinned address');
  check(transport.calls[0]?.providerIdempotencyKey === 'provider-write-order-42', 'provider idempotency reaches transport unchanged');
  check(transport.calls[0]?.evaluatedAt === at(4), 'authority beginAt replaces caller-selected evaluation time');

  const retried = await runtime.executeSideEffect(writeRequest);
  check(retried.status === 'already_committed', 'same logical retry resolves durable committed truth');
  check(transport.calls.length === 1, 'committed retry never calls provider again');

  const read = await runtime.executeRead({
    capability: 'authority_http_read', projectId: 'COS_GRAPH_ENGINE',
    principal, sensitivity: 'internal',
    resourceUri: 'https://api.example.com/orders/42',
    input: { target: readTarget, evaluatedAt: at(200) },
    at: at(10), context,
  });
  check(read.status === 'read_completed' && read.receipt.result.success, 'read uses the strict authority route');
  check(transport.calls.length === 2, 'read is distinct from a side-effect retry');
  check(transport.calls[1]?.evaluatedAt === at(10), 'read request time is authority-owned');

  transport.mode = 'throw_after_call';
  const unknownRequest = {
    ...writeRequest,
    resourceUri: 'https://api.example.com/orders/43',
    input: {
      target: await guard.authorize({
        url: 'https://api.example.com/orders/43', method: 'POST', at: at(20),
      }),
      evaluatedAt: at(200), body: '{"status":"unknown"}',
    },
    idempotencyKey: 'capability-write-order-43',
    providerIdempotencyKey: 'provider-write-order-43',
    correlationId: 'corr-write-order-43',
    timeline: {
      claimAt: at(21), leaseAt: at(22), prepareAt: at(23),
      beginAt: at(24), outcomeAt: at(25),
    },
  };
  const unknown = await runtime.executeSideEffect(unknownRequest);
  check(unknown.status === 'reconciliation_required', 'provider exception after begin becomes uncertain');
  check(unknown.operation.effectKnowledge === 'unknown', 'uncertain effect is not mislabeled failed');
  check(transport.calls.length === 3 && transport.calls[2]?.evaluatedAt === at(24), 'unknown call executes once with trusted beginAt');
  const unknownRetry = await runtime.executeSideEffect(unknownRequest);
  check(unknownRetry.status === 'reconciliation_required', 'uncertain retry still requires reconciliation');
  check(transport.calls.length === 3, 'uncertain retry never executes provider blindly');

  const expiredTarget = await guard.authorize({
    url: 'https://api.example.com/orders/44', method: 'POST', at: at(30),
  });
  await assert.rejects(() => runtime.executeSideEffect({
    ...writeRequest,
    resourceUri: 'https://api.example.com/orders/44',
    input: { target: expiredTarget, evaluatedAt: at(31), body: '{}' },
    idempotencyKey: 'capability-write-order-44',
    providerIdempotencyKey: 'provider-write-order-44',
    timeline: {
      claimAt: at(151), leaseAt: at(152), prepareAt: at(153),
      beginAt: at(154), outcomeAt: at(155),
    },
  }), /EGRESS_DECISION_EXPIRED/);
  assertions += 1;
  check(
    await operationStore.getByIdempotencyKey('COS_GRAPH_ENGINE', 'capability-write-order-44') === null,
    'expired isolation decision fails before durable operation claim',
  );

  const deniedPolicy = new AuthorityPolicyEngine([], new InMemoryAuthorityApprovalStore());
  const deniedStore = new InMemoryAuthoritySideEffectStore();
  const deniedLeases = new AuthorityLeaseService(new InMemoryAuthorityLeaseStore());
  const deniedExecution = new AuthorityExecutionRuntime(deniedStore, deniedLeases);
  const deniedRuntime = new AuthorityCapabilityRuntime({
    registry,
    policy: deniedPolicy,
    policyRuntime: new PolicyBoundAuthorityExecutionRuntime(deniedExecution, deniedPolicy),
    execution: deniedExecution,
    sideEffects: new AuthoritySideEffectRuntime(deniedStore, deniedLeases.at(at(60))),
  });
  transport.mode = 'success';
  await assert.rejects(() => deniedRuntime.executeSideEffect({
    ...writeRequest,
    idempotencyKey: 'capability-denied-write',
    providerIdempotencyKey: 'provider-denied-write',
  }), /POLICY_DENIED/);
  assertions += 1;
  check(transport.calls.length === 3, 'policy denial occurs before provider execution');
  check(
    await deniedStore.getByIdempotencyKey('COS_GRAPH_ENGINE', 'capability-denied-write') === null,
    'policy denial appends no operation',
  );

  console.log(`Authority capability runtime clean contract: ${assertions} assertions passed`);
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
      providerReference: `provider-ref-${this.calls.length}`,
      providerIdempotencyKey: request.providerIdempotencyKey ?? null,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
