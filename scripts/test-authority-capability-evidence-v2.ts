import assert from 'node:assert/strict';
import type {
  AuthorityReadCapabilityRequest,
  AuthorityReadCapabilityResult,
  AuthoritySideEffectCapabilityRequest,
  AuthoritySideEffectCapabilityResult,
} from '../packages/execution/src/authority-capability-runtime';
import {
  ObservedAuthorityCapabilityRuntimeV2,
  buildAuthorityCapabilitySignalV2,
  type AuthorityCapabilityRuntimePortV2,
  type AuthorityCapabilitySignalV2,
  type AuthorityCapabilityTelemetryStartV2,
  type AuthorityCapabilityTelemetryTerminalV2,
  type IAuthorityCapabilitySignalSinkV2,
  type IAuthorityCapabilityTelemetryV2,
} from '../packages/execution/src/authority-capability-evidence-v2';

const T0 = '2026-08-29T17:00:00.000Z';
const T1 = '2026-08-29T17:00:01.000Z';
const T2 = '2026-08-29T17:00:02.000Z';
const SECRET = 'provider-secret-not-observable';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const sink = new SignalSink();
  const telemetry = new TelemetrySink();
  const readResult = makeReadResult();
  const observed = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ readResult }), sink, telemetry,
  );
  const accepted = await observed.executeRead(makeReadRequest());
  check(accepted === readResult, 'accepted result is returned unchanged');
  check(sink.signals.length === 1 && sink.signals[0]?.type === 'capability_completed', 'accepted read emits one terminal signal');
  check(telemetry.terminals.length === 1 && telemetry.terminals[0]?.terminal.outcome === 'succeeded', 'accepted read emits one successful telemetry terminal');
  check(!JSON.stringify(sink.signals).includes(SECRET), 'raw provider result does not enter signal evidence');
  check(!JSON.stringify(telemetry.terminals).includes(SECRET), 'raw provider result does not enter telemetry evidence');

  const deterministicA = buildAuthorityCapabilitySignalV2({
    type: 'policy_denied', outcome: 'rejected', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_read', resourceUri: 'https://api.example.com/resource',
    operationId: null, correlationId: 'trace-1', causationId: null,
    occurredAt: T0, errorCode: 'POLICY_DENIED', details: { reason: 'default-deny' },
  });
  const deterministicB = buildAuthorityCapabilitySignalV2({
    type: 'policy_denied', outcome: 'rejected', nearMiss: true,
    projectId: 'COS_GRAPH_ENGINE', principalId: 'principal://roberto',
    capability: 'authority_http_read', resourceUri: 'https://api.example.com/resource',
    operationId: null, correlationId: 'trace-1', causationId: null,
    occurredAt: T0, errorCode: 'POLICY_DENIED', details: { reason: 'default-deny' },
  });
  check(deterministicA.signalId === deterministicB.signalId && deterministicA.contentHash === deterministicB.contentHash, 'V2 signal identity is deterministic');

  const brokenObservers = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ readResult }), new SignalSink(true), new TelemetrySink(true, true),
  );
  const protectedRead = await brokenObservers.executeRead(makeReadRequest());
  check(protectedRead === readResult, 'sink and telemetry failures cannot change accepted result');
  check(brokenObservers.getObserverFailures().length === 3, 'observer failures are retained without escaping');

  const policySink = new SignalSink();
  const policyError = new Error('POLICY_DENIED action=capability.read');
  const policyObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ readError: policyError }), policySink,
  );
  let caught: unknown;
  try { await policyObserved.executeRead(makeReadRequest()); } catch (error) { caught = error; }
  check(caught === policyError, 'original protected policy error identity is preserved');
  check(policySink.signals[0]?.type === 'policy_denied' && policySink.signals[0]?.nearMiss, 'policy denial emits explicit near-miss evidence');

  const isolationSink = new SignalSink();
  const isolationObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ readError: new Error('EGRESS_ADDRESS_DENIED classification=private') }),
    isolationSink,
  );
  await assert.rejects(() => isolationObserved.executeRead(makeReadRequest()), /EGRESS_ADDRESS_DENIED/);
  assertions += 1;
  check(isolationSink.signals[0]?.type === 'isolation_denied', 'isolation denial is classified separately');

  const uncertainSink = new SignalSink();
  const uncertainResult = makeSideEffectResult('reconciliation_required');
  const uncertainObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ sideEffectResult: uncertainResult }), uncertainSink,
  );
  const uncertain = await uncertainObserved.executeSideEffect(makeSideEffectRequest());
  check(uncertain === uncertainResult, 'uncertain protected result is returned unchanged');
  check(uncertainSink.signals[0]?.type === 'provider_outcome_uncertain', 'uncertain provider result emits explicit near miss');

  const repairSink = new SignalSink();
  const repairResult = makeSideEffectResult('committed', {
    agentEvidence: { status: 'pending_repair', error: 'agent store unavailable' },
    leaseRelease: { status: 'release_failed', error: 'lease store unavailable' },
  });
  const repairObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ sideEffectResult: repairResult }), repairSink,
  );
  const committed = await repairObserved.executeSideEffect(makeSideEffectRequest());
  check(committed.operation.state === 'committed', 'repair gaps do not rewrite provider commit');
  check(repairSink.signals.some(item => item.type === 'agent_evidence_repair_required'), 'agent evidence repair is separate');
  check(repairSink.signals.some(item => item.type === 'lease_release_repair_required'), 'lease release repair is separate');

  // Deliberately feed a protected result containing a non-canonical value in a
  // field used only for observability. Signal construction must fail internally
  // while the provider result remains accepted and returned.
  const nonCanonical = makeSideEffectResult('committed');
  (nonCanonical.operation as unknown as { resultHash: unknown }).resultHash = 1n;
  const buildFailureTelemetry = new TelemetrySink();
  const buildFailureObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ sideEffectResult: nonCanonical }), new SignalSink(), buildFailureTelemetry,
  );
  const stillCommitted = await buildFailureObserved.executeSideEffect(makeSideEffectRequest());
  check(stillCommitted === nonCanonical, 'signal construction failure cannot replace accepted provider result');
  check(buildFailureObserved.getObserverFailures().some(item => item.channel === 'signal_build'), 'signal build failure is retained');
  check(buildFailureTelemetry.terminals[0]?.terminal.details.observationBuildFailed === true, 'telemetry records bounded observation-build failure without raw data');

  const originalFailure = new Error('ORIGINAL_PROTECTED_FAILURE operation=operation://original');
  const invalidIdentityRequest = { ...makeReadRequest(), resourceUri: '   ' };
  const originalFailureObserved = new ObservedAuthorityCapabilityRuntimeV2(
    new FakeRuntime({ readError: originalFailure }), new SignalSink(), new TelemetrySink(),
  );
  let originalCaught: unknown;
  try { await originalFailureObserved.executeRead(invalidIdentityRequest); } catch (error) { originalCaught = error; }
  check(originalCaught === originalFailure, 'signal-build failure during error observation cannot replace original protected error');
  check(originalFailureObserved.getObserverFailures().some(item => item.channel === 'signal_build'), 'error-observation build failure is retained');

  console.log(`Authority capability evidence V2 contract: ${assertions} assertions passed`);
}

class FakeRuntime implements AuthorityCapabilityRuntimePortV2 {
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
  async executeSideEffect(_request: AuthoritySideEffectCapabilityRequest): Promise<AuthoritySideEffectCapabilityResult> {
    if (this.behavior.sideEffectError) throw this.behavior.sideEffectError;
    if (!this.behavior.sideEffectResult) throw new Error('fake side-effect result missing');
    return this.behavior.sideEffectResult;
  }
}

class SignalSink implements IAuthorityCapabilitySignalSinkV2 {
  readonly signals: AuthorityCapabilitySignalV2[] = [];
  constructor(private readonly fail = false) {}
  append(signal: AuthorityCapabilitySignalV2): void {
    if (this.fail) throw new Error('signal sink unavailable');
    this.signals.push(structuredClone(signal));
  }
}

class TelemetrySink implements IAuthorityCapabilityTelemetryV2 {
  readonly starts: AuthorityCapabilityTelemetryStartV2[] = [];
  readonly terminals: Array<{ token: unknown; terminal: AuthorityCapabilityTelemetryTerminalV2 }> = [];
  constructor(private readonly failStart = false, private readonly failTerminal = false) {}
  start(input: AuthorityCapabilityTelemetryStartV2): unknown {
    if (this.failStart) throw new Error('telemetry start unavailable');
    this.starts.push(structuredClone(input));
    return { id: `telemetry-${this.starts.length}` };
  }
  terminal(token: unknown, terminal: AuthorityCapabilityTelemetryTerminalV2): void {
    if (this.failTerminal) throw new Error('telemetry terminal unavailable');
    this.terminals.push({ token: structuredClone(token), terminal: structuredClone(terminal) });
  }
}

function makeReadRequest(): AuthorityReadCapabilityRequest {
  return {
    capability: 'authority_http_read', projectId: 'COS_GRAPH_ENGINE',
    principal: { id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'], sensitivityClearance: 'restricted', attributes: {} },
    sensitivity: 'internal', resourceUri: 'https://api.example.com/resource',
    input: { request: 'safe-read' }, at: T0,
    context: { traceId: 'trace-read-1', parentSpanId: 'span-parent' },
  };
}

function makeReadResult(): AuthorityReadCapabilityResult {
  return {
    status: 'read_completed',
    receipt: {
      capability: 'authority_http_read', sideEffecting: false, inputHash: 'input-hash-read',
      result: { success: true, output: { secret: SECRET }, cost: { units: 'credits', amount: 0 }, latency: 5, metadata: {} },
    },
    policy: {
      decisionId: 'policy-read', effect: 'allow', allowed: true, requiresApproval: false,
      reason: 'allow', matchedRuleIds: ['rule-read'], approvalGrantId: null,
      evaluatedAt: T0, requestHash: 'request-hash', decisionHash: 'decision-hash',
    },
    agentEvidence: { status: 'not_requested' },
  } as AuthorityReadCapabilityResult;
}

function makeSideEffectRequest(): AuthoritySideEffectCapabilityRequest {
  return {
    capability: 'authority_http_write', projectId: 'COS_GRAPH_ENGINE',
    principal: { id: 'principal://roberto', roles: ['builder'], projectIds: ['COS_GRAPH_ENGINE'], sensitivityClearance: 'restricted', attributes: {} },
    sensitivity: 'internal', resourceUri: 'https://api.example.com/orders/42', input: {},
    idempotencyKey: 'operation-42', providerIdempotencyKey: 'provider-42',
    correlationId: 'correlation-42', causationId: null,
    provenance: [{ source: 'test://capability-evidence-v2' }], context: { traceId: 'trace-write-42' },
    timeline: { claimAt: T0, leaseAt: T1, prepareAt: T2, beginAt: '2026-08-29T17:00:03.000Z', outcomeAt: '2026-08-29T17:00:04.000Z' },
    leaseOwnerId: 'worker://one', leaseTtlMs: 60_000,
  };
}

function makeSideEffectResult(
  status: 'committed' | 'reconciliation_required',
  overrides: Partial<AuthoritySideEffectCapabilityResult> = {},
): AuthoritySideEffectCapabilityResult {
  const uncertain = status === 'reconciliation_required';
  return {
    status,
    operation: {
      operationId: 'operation://42', projectId: 'COS_GRAPH_ENGINE', idempotencyKey: 'operation-42',
      operationKey: 'operation-42', operationHash: 'operation-hash', revisionId: 'operation-revision-5', revision: 5,
      previousRevisionId: 'operation-revision-4', state: uncertain ? 'reconciliation_required' : 'committed',
      effectKnowledge: uncertain ? 'unknown' : 'applied', principalId: 'principal://roberto', agentRunId: null,
      capability: 'authority_http_write', resourceUri: 'https://api.example.com/orders/42', input: {}, inputHash: 'input-hash',
      providerIdempotencyKey: 'provider-42', leaseId: 'lease-42', leaseOwnerId: 'worker://one', fencingToken: 1,
      result: uncertain ? null : { secret: SECRET }, resultHash: uncertain ? null : 'result-hash',
      error: uncertain ? { code: 'PROVIDER_OUTCOME_UNKNOWN', message: 'unknown', retryable: true, details: {} } : null,
      compensation: null, correlationId: 'correlation-42', causationId: null,
      provenance: [{ source: 'test://capability-evidence-v2' }], recordedAt: '2026-08-29T17:00:04.000Z',
      metadata: {}, contentHash: 'operation-content-hash', terminal: !uncertain,
    },
    receipt: uncertain ? null : {
      capability: 'authority_http_write', sideEffecting: true, inputHash: 'capability-input-hash',
      result: { success: true, output: { secret: SECRET }, cost: { units: 'credits', amount: 0 }, latency: 8, metadata: {} },
    },
    lease: null,
    policies: [],
    agentEvidence: { status: 'not_requested' },
    leaseRelease: { status: 'not_requested' },
    providerError: uncertain ? { code: 'PROVIDER_OUTCOME_UNKNOWN', message: 'unknown', retryable: true, details: {} } : null,
    ...overrides,
  } as AuthoritySideEffectCapabilityResult;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
