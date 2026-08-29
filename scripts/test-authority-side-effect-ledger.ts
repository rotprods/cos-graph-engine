import assert from 'node:assert/strict';
import {
  DurableSideEffectCoordinator,
  DurableSideEffectLedger,
  InMemoryDurableSideEffectStore,
  durableEffectReceiptHash,
  type DurableProviderOutcome,
  type DurableSideEffectAppendResult,
  type DurableSideEffectClaimInput,
  type DurableSideEffectRevision,
  type IDurableSideEffectStore,
} from '../packages/execution/src/durable-side-effect-ledger';

const BASE = Date.parse('2026-08-28T12:00:00.000Z');

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  // Happy path: provider observation and local commit are distinct durable revisions.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE));
    let providerCalls = 0;
    const input = claimInput('happy-1');
    const receipt = await coordinator.execute(input, async () => {
      providerCalls += 1;
      return { disposition: 'succeeded', providerReference: 'provider://job/1', result: { ok: true } };
    });
    check(receipt.operation.state === 'committed', 'successful effect ends in committed');
    check(providerCalls === 1 && receipt.providerInvoked, 'provider invoked exactly once on first execution');
    const states = (await ledger.getHistory(receipt.operation.operationId)).map(item => item.state);
    assert.deepEqual(states, ['claimed', 'prepared', 'executing', 'effect_observed', 'committed']);
    assertions += 1;
    check(states.indexOf('effect_observed') < states.indexOf('committed'), 'effect observation is durably separated from commit');

    const retry = await coordinator.execute({ ...input, recordedAt: iso(BASE + 100_000) }, async () => {
      providerCalls += 1;
      throw new Error('provider must not run on committed retry');
    });
    check(retry.reusedTerminalResult && !retry.providerInvoked, 'late committed retry reuses durable terminal result');
    check(providerCalls === 1, 'late retry does not duplicate provider mutation');

    await assert.rejects(() => coordinator.execute({ ...input, request: { value: 2 } }, async () => ({
      disposition: 'succeeded', providerReference: 'provider://job/conflict',
    })), /SIDE_EFFECT_OPERATION_CONFLICT/);
    assertions += 1;

    const leaked = await ledger.getHistory(receipt.operation.operationId);
    const last = leaked.at(-1);
    if (!last) throw new Error('missing history');
    last.metadata.tampered = true;
    const pristine = await ledger.getCurrent(receipt.operation.operationId);
    check(pristine?.metadata.tampered === undefined, 'ledger reads are detached from canonical history');
  }

  // Transport ambiguity is uncertainty, never a fabricated provider failure.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE + 1_000_000));
    let calls = 0;
    const input = claimInput('uncertain-1', BASE + 1_000_000);
    const first = await coordinator.execute(input, async () => {
      calls += 1;
      throw new Error('connection reset after request body sent');
    });
    check(first.operation.state === 'uncertain', 'thrown provider callback becomes uncertain');
    check(first.operation.uncertaintyReason?.includes('connection reset') === true, 'uncertainty preserves reason');
    await assert.rejects(() => coordinator.execute({ ...input, recordedAt: iso(BASE + 1_100_000) }, async () => {
      calls += 1;
      return { disposition: 'succeeded', providerReference: 'provider://should-not-run' };
    }), /SIDE_EFFECT_RECONCILIATION_REQUIRED/);
    assertions += 1;
    check(calls === 1, 'uncertain retry never blindly invokes provider again');
  }

  // Crash/provider success before effect_observed persistence: durable state is still executing.
  {
    const backing = new InMemoryDurableSideEffectStore();
    const failStore = new FailOnStateStore(backing, 'effect_observed');
    const ledger = new DurableSideEffectLedger(failStore);
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE + 2_000_000));
    let calls = 0;
    const input = claimInput('crash-before-observed', BASE + 2_000_000);
    await assert.rejects(() => coordinator.execute(input, async () => {
      calls += 1;
      return { disposition: 'succeeded', providerReference: 'provider://effect-already-happened', result: { remote: 'done' } };
    }), /injected effect_observed persistence failure/);
    assertions += 1;
    check(calls === 1, 'provider may have run before local observation persistence failed');
    const operation = (await backing.listProjectOperations('COS_GRAPH_ENGINE')).at(-1);
    if (!operation) throw new Error('missing crashed operation');
    check(operation.state === 'executing', 'failed observation persistence leaves durable state executing, not falsely committed');
    failStore.disableFailure();
    const recovered = await ledger.recoverInterrupted(
      operation.operationId,
      operation.revision,
      iso(BASE + 2_100_000),
      'recover:uncertain',
      'provider returned success but observation revision was not durably committed',
    );
    check(recovered.revision.state === 'uncertain', 'crash-before-observation is recovered as uncertain');
  }

  // Crash after effect_observed but before committed: resume local commit without provider call.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    const input = claimInput('crash-after-observed', BASE + 3_000_000);
    let current = (await ledger.claim(input)).revision;
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'prepared',
      idempotencyKey: `${input.operationKey}:prepared`,
      recordedAt: iso(BASE + 3_000_001),
    })).revision;
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'executing',
      idempotencyKey: `${input.operationKey}:executing`,
      recordedAt: iso(BASE + 3_000_002),
    })).revision;
    const effectReceiptHash = durableEffectReceiptHash({
      operationId: current.operationId,
      providerReference: 'provider://observed/42',
      result: { remoteId: '42' },
      metadata: { provider: 'fixture' },
    });
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'effect_observed',
      idempotencyKey: `${input.operationKey}:effect_observed`,
      recordedAt: iso(BASE + 3_000_003),
      providerReference: 'provider://observed/42',
      effectReceiptHash,
      result: { remoteId: '42' },
      metadata: { provider: 'fixture' },
    })).revision;
    check(current.state === 'effect_observed', 'fixture simulates durable observation before local commit');
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE + 3_000_010));
    let providerCalls = 0;
    const resumed = await coordinator.execute({ ...input, recordedAt: iso(BASE + 3_000_010) }, async () => {
      providerCalls += 1;
      return { disposition: 'succeeded', providerReference: 'provider://duplicate' };
    });
    check(resumed.operation.state === 'committed' && resumed.resumedAfterObservedEffect, 'effect-observed operation resumes local commit');
    check(!resumed.providerInvoked && providerCalls === 0, 'resume after observation never reinvokes provider');
  }

  // Explicit provider failure means provider confirmed no accepted effect.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE + 4_000_000));
    const receipt = await coordinator.execute(claimInput('provider-failed', BASE + 4_000_000), async (): Promise<DurableProviderOutcome> => ({
      disposition: 'failed',
      providerReference: 'provider://request/failed',
      error: { code: 'REJECTED', message: 'provider rejected request', retryable: false },
    }));
    check(receipt.operation.state === 'failed' && receipt.operation.error?.code === 'REJECTED', 'explicit provider rejection becomes durable failed terminal state');
  }

  // Compensation is explicit history, never hidden rollback.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    const coordinator = new DurableSideEffectCoordinator(ledger, monotonicClock(BASE + 5_000_000));
    const committed = (await coordinator.execute(claimInput('compensate-1', BASE + 5_000_000), async () => ({
      disposition: 'succeeded', providerReference: 'provider://created/99', result: { id: 99 },
    }))).operation;
    let current = (await ledger.transition({
      operationId: committed.operationId,
      expectedRevision: committed.revision,
      state: 'compensation_required',
      idempotencyKey: 'comp:required',
      recordedAt: iso(BASE + 5_000_100),
      compensationReference: 'compensation://delete/99',
      metadata: { reason: 'downstream transaction rejected' },
    })).revision;
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'compensating',
      idempotencyKey: 'comp:running',
      recordedAt: iso(BASE + 5_000_101),
      compensationReference: 'compensation://delete/99',
    })).revision;
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'compensated',
      idempotencyKey: 'comp:done',
      recordedAt: iso(BASE + 5_000_102),
      compensationReference: 'compensation://delete/99',
    })).revision;
    check(current.state === 'compensated', 'compensation has explicit durable terminal outcome');
    const states = (await ledger.getHistory(current.operationId)).map(item => item.state);
    check(states.includes('committed') && states.includes('compensation_required') && states.includes('compensated'), 'compensation does not erase original committed effect');
  }

  // Fencing is monotonic evidence in P05.1; P05.2 must prove resource-bound validation.
  {
    const store = new InMemoryDurableSideEffectStore();
    const ledger = new DurableSideEffectLedger(store);
    let current = (await ledger.claim(claimInput('fence-evidence', BASE + 6_000_000))).revision;
    current = (await ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'prepared',
      idempotencyKey: 'fence:prepared',
      recordedAt: iso(BASE + 6_000_001),
      fencingVersion: 5,
    })).revision;
    await assert.rejects(() => ledger.transition({
      operationId: current.operationId,
      expectedRevision: current.revision,
      state: 'executing',
      idempotencyKey: 'fence:regress',
      recordedAt: iso(BASE + 6_000_002),
      fencingVersion: 4,
    }), /SIDE_EFFECT_FENCING_REGRESSION/);
    assertions += 1;
  }

  console.log(`Durable side-effect authority contract: ${assertions} assertions passed`);
}

class FailOnStateStore implements IDurableSideEffectStore {
  private enabled = true;

  constructor(
    private readonly delegate: IDurableSideEffectStore,
    private readonly state: DurableSideEffectRevision['state'],
  ) {}

  disableFailure(): void { this.enabled = false; }

  async appendRevision(
    revision: DurableSideEffectRevision,
    expectedCurrentRevision: number,
  ): Promise<DurableSideEffectAppendResult> {
    if (this.enabled && revision.state === this.state) {
      throw new Error(`injected ${this.state} persistence failure`);
    }
    return this.delegate.appendRevision(revision, expectedCurrentRevision);
  }

  getCurrent(operationId: string) { return this.delegate.getCurrent(operationId); }
  getHistory(operationId: string) { return this.delegate.getHistory(operationId); }
  getByTransitionKey(transitionKey: string) { return this.delegate.getByTransitionKey(transitionKey); }
  listProjectOperations(projectId: string) { return this.delegate.listProjectOperations(projectId); }
}

function claimInput(operationKey: string, at = BASE): DurableSideEffectClaimInput {
  return {
    principalId: 'agent://phase05/test',
    projectId: 'COS_GRAPH_ENGINE',
    resource: `github://rotprods/cos-graph-engine/resource/${operationKey}`,
    capability: 'github.repository.write',
    action: 'update_file',
    operationKey,
    request: { path: 'STATE.md', contentHash: `hash-${operationKey}` },
    sourceRef: 'test://authority-side-effect-ledger',
    recordedAt: iso(at),
    metadata: { phase: '05', test: true },
  };
}

function monotonicClock(start: number): () => string {
  let current = start;
  return () => iso(++current);
}

function iso(value: number): string {
  return new Date(value).toISOString();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
