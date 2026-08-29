import assert from 'node:assert/strict';
import type {
  AuthorityReadCapabilityRequest,
  AuthorityReadCapabilityResult,
  AuthoritySideEffectCapabilityRequest,
  AuthoritySideEffectCapabilityResult,
} from '../packages/execution/src/authority-capability-runtime';
import {
  ObservedAuthorityCapabilityRuntime,
  buildAuthorityCapabilitySignal,
  type AuthorityCapabilitySignal,
  type AuthorityCapabilityRuntimePort,
  type AuthorityCapabilityTelemetryStart,
  type AuthorityCapabilityTelemetryTerminal,
  type IAuthorityCapabilitySignalSink,
  type IAuthorityCapabilityTelemetry,
} from '../packages/execution/src/authority-capability-evidence';

const T0 = '2026-08-29T09:00:00.000Z';
const T1 = '2026-08-29T09:00:01.000Z';
const T2 = '2026-08-29T09:00:02.000Z';
const SECRET = 'provider-secret-must-not-enter-observability';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const readRequest = makeReadRequest();
  const readResult = makeReadResult();
  const readRuntime = new FakeRuntime({ readResult });
  const sink = new MemorySignalSink();
  const telemetry = new MemoryTelemetry();
  const observedRead = new ObservedAuthorityCapabilityRuntime(readRuntime, sink, telemetry);
  const acceptedRead = await observedRead.executeRead(readRequest);
  check(acceptedRead === readResult, 'observer returns the protected read result unchanged');
  check(sink.signals.length === 1 && sink.signals[0]?.type === 'capability_completed', 'read success emits one terminal capability signal');
  check(telemetry.starts.length === 1 && telemetry.terminals.length === 1, 'read success emits exactly one telemetry start/terminal pair');
  check(telemetry.terminals[0]?.terminal.outcome === 'succeeded', 'telemetry receives accepted terminal outcome');
  check(!JSON.stringify(sink.signals).includes(SECRET), 'raw provider output is absent from capability signals');
  check(!JSON.stringify(telemetry.terminals).includes(SECRET), 'raw provider output is absent from telemetry details');

  const deterministicA = buildAuthorityCapabilitySignal({
    type: 'policy_denied', outcome: 'rejected', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_read', resourceUri: 'https://api.example.com/resource',
    operationId: null, correlationId: 'trace-1', causationId: null,
    occurredAt: T0, errorCode: 'POLICY_DENIED', details: { reason: 'default-deny' },
  });
  const deterministicB = buildAuthorityCapabilitySignal({
    type: 'policy_denied', outcome: 'rejected', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_read', resourceUri: 'https://api.example.com/resource',
    operationId: null, correlationId: 'trace-1', causationId: null,
    occurredAt: T0, errorCode: 'POLICY_DENIED', details: { reason: 'default-deny' },
  });
  check(deterministicA.signalId === deterministicB.signalId && deterministicA.contentHash === deterministicB.contentHash, 'same signal semantics produce deterministic identity and hash');

  const failingSink = new MemorySignalSink(true);
  const failingTelemetry = new MemoryTelemetry(true, true);
  const observerFailureRuntime = new ObservedAuthorityCapabilityRuntime(
    new FakeRuntime({ readResult }), failingSink, failingTelemetry,
  );
  const protectedRead = await observerFailureRuntime.executeRead(readRequest);
  check(protectedRead === readResult, 'signal/telemetry failures cannot change the protected success result');
  const observerFailures = observerFailureRuntime.getObserverFailures();
  check(observerFailures.length === 3, 'telemetry start, signal and terminal failures are retained as evidence');

  const deniedSink = new MemorySignalSink();
  const deniedTelemetry = new MemoryTelemetry();
  const denied = new ObservedAuthorityCapabilityRuntime(
    new FakeRuntime({ readError: new Error('POLICY_DENIED action=capability.read') }),
    deniedSink,
    deniedTelemetry,
  );
  await assert.rejects(() => denied.executeRead(readRequest), /POLICY_DENIED/);
  assertions += 1;
  check(deniedSink.signals[0]?.type === 'policy_denied' && deniedSink.signals[0]?.nearMiss, 'policy rejection becomes near-miss evidence');
  check(deniedTelemetry.terminals[0]?.terminal.outcome === 'rejected', 'policy rejection emits one rejected telemetry terminal');

  const isolationSink = new MemorySignalSink();
  const isolation = new ObservedAuthorityCapabilityRuntime(
    new FakeRuntime({ readError: new Error('EGRESS_ADDRESS_DENIED classification=private') }),
    isolationSink,
  );
  await assert.rejects(() => isolation.executeRead(readRequest), /EGRESS_ADDRESS_DENIED/);
  assertions += 1;
  check(isolationSink.signals[0]?.type === 'isolation_denied', 'isolation rejection is classified separately from generic execution failure');

  const uncertainSink = new MemorySignalSink();
  const uncertainTelemetry = new MemoryTelemetry();
  const uncertainResult = makeSideEffectResult({ status: 'reconciliation_required' });
  const uncertainObserved = new ObservedAuthorityCapabilityRuntime(
    new FakeRuntime({ sideEffectResult: uncertainResult }), uncertainSink, uncertainTelemetry,
  );
  const uncertain = await uncertainObserved.executeSideEffect(makeSideEffectRequest());
  check(uncertain === uncertainResult, 'uncertain protected result is returned unchanged');
  check(uncertainSink.signals[0]?.type === 'provider_outcome_uncertain', 'unknown provider outcome emits explicit near-miss signal');
  check(uncertainTelemetry.terminals[0]?.terminal.outcome === 'uncertain', 'unknown provider outcome is not mislabeled failed or succeeded');

  const repairSink = new MemorySignalSink();
  const committedWithRepairs = makeSideEffectResult({
    status: 'committed',
    agentEvidence: { status: 'pending_repair', error: 'agent store unavailable' },
    leaseRelease: { status: 'release_failed', error: 'lease store unavailable' },
  });
  const repairObserved = new ObservedAuthorityCapabilityRuntime(
    new FakeRuntime({ sideEffectResult: committedWithRepairs }), repairSink,
  );
  const protectedCommit = await repairObserved.executeSideEffect(makeSideEffectRequest());
  check(protectedCommit.operation.state === 'committed', 'post-commit repair gaps cannot rewrite provider truth');
  check(repairSink.signals.filter(item => item.type === 'capability_completed').length === 1, 'committed operation retains one primary success signal');
  check(repairSink.signals.some(item => item.type === 'agent_evidence_repair_required'), 'agent evidence repair is emitted separately');
  check(repairSink.signals.some(item => item.type === 'lease_release_repair_required'), 'lease release repair is emitted separately');

  const returnedSignals = repairSink.list();
  returnedSignals[0]!.details.status = 'tampered';
  check(repairSink.list()[0]?.details.status === 'committed', 'signal sink reads are detached');

  console.log(`Authority capability evidence contract: ${assertions} assertions passed`);
}

class FakeRuntime implements AuthorityCapabilityRuntimePort {
  constructor(private readonly behavior: {
    readResult?: AuthorityReadCapabilityResult;
    readError?: Error;
    sideEffectResult?: AuthoritySideEffectCapabilityResult;
    sideEffectError?: Error;
  }) {}

  async executeRead(_request: AuthorityReadCapabilityRequest): Promise<AuthorityReadCapabilityResult> {
    if (this.behavior.readError) throw this.behavior.readError;
    if (!this.behavior.readResult) throw new Error('fake read result missing');
    return this.behavior.readResult;
  }

  async executeSideEffect(
    _request: AuthoritySideEffectCapabilityRequest,
  ): Promise<AuthoritySideEffectCapabilityResult> {
    if (this.behavior.sideEffectError) throw this.behavior.sideEffectError;
    if (!this.behavior.sideEffectResult) throw new Error('fake side-effect result missing');
    return this.behavior.sideEffectResult;
  }
}

class MemorySignalSink implements IAuthorityCapabilitySignalSink {
  readonly signals: AuthorityCapabilitySignal[] = [];
  constructor(private readonly fail = false) {}
  append(signal: AuthorityCapabilitySignal): void {
    if (this.fail) throw new Error('signal sink unavailable');
    this.signals.push(structuredClone(signal));
  }
  list(): AuthorityCapabilitySignal[] { return structuredClone(this.signals); }
}

class MemoryTelemetry implements IAuthorityCapabilityTelemetry {
  readonly starts: AuthorityCapabilityTelemetryStart[] = [];
  readonly terminals: Array<{ token: unknown; terminal: AuthorityCapabilityTelemetryTerminal }> = [];
  constructor(
    private readonly failStart = false,
    private readonly failTerminal = false,
  ) {}
  start(input: AuthorityCapabilityTelemetryStart): unknown {
    if (this.failStart) throw new Error('telemetry start unavailable');
    this.starts.push(structuredClone(input));
    return { id: `telemetry-${this.starts.length}` };
  }
  terminal(token: unknown, terminal: AuthorityCapabilityTelemetryTerminal): void {
    if (this.failTerminal) throw new Error('telemetry terminal unavailable');
    this.terminals.push({ token: structuredClone(token), terminal: structuredClone(terminal) });
  }
}

function makeReadRequest(): AuthorityReadCapabilityRequest {
  return {
    capability: 'authority_http_read',
    projectId: 'COS_GRAPH_ENGINE',
    principal: {
      id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'],
      sensitivityClearance: 'restricted', attributes: {},
    },
    sensitivity: 'internal',
    resourceUri: 'https://api.example.com/resource',
    input: { request: 'safe-read' },
    at: T0,
    context: { traceId: 'trace-read-1', parentSpanId: 'span-parent' },
  };
}

function makeReadResult(): AuthorityReadCapabilityResult {
  return {
    status: 'read_completed',
    receipt: {
      capability: 'authority_http_read',
      sideEffecting: false,
      inputHash: 'input-hash-read',
      result: {
        success: true,
        output: { secret: SECRET, value: 42 },
        cost: { units: 'credits', amount: 0 },
        latency: 5,
        metadata: {},
      },
    },
    policy: {
      decisionId: 'policy-decision-read',
      effect: 'allow',
      allowed: true,
      requiresApproval: false,
      reason: 'explicit allow',
      matchedRuleIds: ['rule-read'],
      approvalGrantId: null,
      evaluatedAt: T0,
      requestHash: 'policy-request-hash',
      decisionHash: 'policy-decision-hash',
    },
    agentEvidence: { status: 'not_requested' },
  } as AuthorityReadCapabilityResult;
}

function makeSideEffectRequest(): AuthoritySideEffectCapabilityRequest {
  return {
    capability: 'authority_http_write',
    projectId: 'COS_GRAPH_ENGINE',
    principal: {
      id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'],
      sensitivityClearance: 'restricted', attributes: {},
    },
    sensitivity: 'internal',
    resourceUri: 'https://api.example.com/orders/42',
    input: { request: 'write' },
    idempotencyKey: 'operation-42',
    providerIdempotencyKey: 'provider-42',
    correlationId: 'correlation-42',
    causationId: null,
    provenance: [{ source: 'test://capability-evidence' }],
    context: { traceId: 'trace-write-42' },
    timeline: { claimAt: T0, leaseAt: T1, prepareAt: T2, beginAt: '2026-08-29T09:00:03.000Z', outcomeAt: '2026-08-29T09:00:04.000Z' },
    leaseOwnerId: 'worker://one',
    leaseTtlMs: 60_000,
  };
}

function makeSideEffectResult(overrides: Partial<AuthoritySideEffectCapabilityResult>): AuthoritySideEffectCapabilityResult {
  const status = overrides.status ?? 'committed';
  const uncertain = status === 'reconciliation_required';
  return {
    status,
    operation: {
      operationId: 'operation://42',
      projectId: 'COS_GRAPH_ENGINE',
      idempotencyKey: 'operation-42',
      operationKey: 'operation-42',
      operationHash: 'operation-hash',
      revisionId: 'operation-revision-5',
      revision: 5,
      previousRevisionId: 'operation-revision-4',
      state: uncertain ? 'reconciliation_required' : 'committed',
      effectKnowledge: uncertain ? 'unknown' : 'applied',
      principalId: 'principal://roberto',
      agentRunId: null,
      capability: 'authority_http_write',
      resourceUri: 'https://api.example.com/orders/42',
      input: {},
      inputHash: 'input-hash',
      providerIdempotencyKey: 'provider-42',
      leaseId: 'lease-42',
      leaseOwnerId: 'worker://one',
      fencingToken: 1,
      result: uncertain ? null : { secret: SECRET, accepted: true },
      resultHash: uncertain ? null : 'result-hash',
      error: uncertain ? { code: 'PROVIDER_OUTCOME_UNKNOWN', message: 'unknown', retryable: true, details: {} } : null,
      compensation: null,
      correlationId: 'correlation-42',
      causationId: null,
      provenance: [{ source: 'test://capability-evidence' }],
      recordedAt: '2026-08-29T09:00:04.000Z',
      metadata: {},
      contentHash: 'operation-content-hash',
      terminal: !uncertain,
    },
    receipt: uncertain ? null : {
      capability: 'authority_http_write', sideEffecting: true, inputHash: 'capability-input-hash',
      result: { success: true, output: { secret: SECRET }, cost: { units: 'credits', amount: 0 }, latency: 8, metadata: {} },
    },
    lease: null,
    policies: [],
    agentEvidence: overrides.agentEvidence ?? { status: 'not_requested' },
    leaseRelease: overrides.leaseRelease ?? { status: 'not_requested' },
    providerError: uncertain
      ? { code: 'PROVIDER_OUTCOME_UNKNOWN', message: 'unknown', retryable: true, details: {} }
      : null,
    ...overrides,
  } as AuthoritySideEffectCapabilityResult;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
