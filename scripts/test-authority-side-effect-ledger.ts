import assert from 'node:assert/strict';
import {
  InMemorySideEffectLedgerStore,
  SideEffectCoordinator,
  SideEffectLedger,
  sideEffectOperationId,
  type SideEffectOperationRevision,
} from '../packages/execution/src/side-effect-ledger';
import { PostgresSideEffectLedgerStore } from '../packages/execution/src/postgres-side-effect-ledger';
import { FakeSideEffectLedgerPostgres } from './fixtures/fake-side-effect-ledger-postgres';

const T0 = '2026-08-28T12:00:00.000Z';
const T1 = '2026-08-28T12:00:01.000Z';
const T2 = '2026-08-28T12:00:02.000Z';
const T3 = '2026-08-28T12:00:03.000Z';
const T4 = '2026-08-28T12:00:04.000Z';
const T5 = '2026-08-28T12:00:05.000Z';
const T6 = '2026-08-28T12:00:06.000Z';

const BASE = {
  principalId: 'agent://rot/authority-worker',
  projectId: 'COS_GRAPH_ENGINE',
  resource: 'github://rotprods/cos-graph-engine/branch/hardening',
  action: 'github.commit',
  operationKey: 'delivery-001',
  request: { branch: 'hardening', files: ['STATE.md'], optional: undefined },
  sourceRef: 'agentic://run/RUN-P05-001',
  recordedAt: T0,
  metadata: { phase: '05', attemptClass: 'authority' },
} as const;

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  // Operation identity is scoped by principal+project+operation key. Reusing the
  // same key for a different effect must collide instead of producing a second ID.
  const operationId = sideEffectOperationId(BASE);
  const conflictingIdentity = sideEffectOperationId({
    principalId: BASE.principalId,
    projectId: BASE.projectId,
    operationKey: BASE.operationKey,
  });
  check(operationId === conflictingIdentity, 'resource/action do not create a second operation for reused operation key');

  const store = new InMemorySideEffectLedgerStore();
  const ledger = new SideEffectLedger(store);
  const claim = await ledger.claim(BASE);
  check(claim.appended && claim.revision.state === 'claimed', 'initial operation claim is appended');
  check(claim.revision.operationId === operationId, 'claim uses deterministic scoped operation identity');
  check(!('optional' in (claim.revision.request as Record<string, unknown>)), 'wire request omits optional undefined');

  const duplicateClaim = await ledger.claim({ ...BASE, recordedAt: T1 });
  check(!duplicateClaim.appended && duplicateClaim.revision.revision === 1, 'later transport retry reuses accepted claim');

  await assert.rejects(() => ledger.claim({
    ...BASE,
    resource: 'github://rotprods/cos-graph-engine/branch/other',
    recordedAt: T1,
  }), /SIDE_EFFECT_OPERATION_CONFLICT/);
  assertions += 1;
  await assert.rejects(() => ledger.claim({
    ...BASE,
    request: { branch: 'other', files: ['STATE.md'] },
    recordedAt: T1,
  }), /SIDE_EFFECT_OPERATION_CONFLICT/);
  assertions += 1;

  // A same-intent race converges at the store boundary even with different
  // recordedAt evidence, because transition intent excludes transport timing.
  const raceStore = new InMemorySideEffectLedgerStore();
  const raceLedger = new SideEffectLedger(raceStore);
  const [raceA, raceB] = await Promise.all([
    raceLedger.claim(BASE),
    raceLedger.claim({ ...BASE, recordedAt: T1 }),
  ]);
  check(Number(raceA.appended) + Number(raceB.appended) === 1, 'concurrent identical claims append exactly one revision');
  check(raceA.revision.operationId === raceB.revision.operationId, 'concurrent claim retries converge to one operation');

  const prepared = await ledger.transition({
    operationId,
    expectedRevision: 1,
    state: 'prepared',
    idempotencyKey: 'delivery-001:prepared',
    recordedAt: T1,
    fencingVersion: 7,
  });
  check(prepared.appended && prepared.revision.revision === 2, 'claim transitions to prepared');
  const preparedRetry = await ledger.transition({
    operationId,
    expectedRevision: 1,
    state: 'prepared',
    idempotencyKey: 'delivery-001:prepared',
    recordedAt: T4,
    fencingVersion: 7,
  });
  check(!preparedRetry.appended && preparedRetry.revision.revisionId === prepared.revision.revisionId, 'old transition retry resolves historical accepted revision');

  await assert.rejects(() => ledger.transition({
    operationId,
    expectedRevision: 1,
    state: 'failed',
    idempotencyKey: 'delivery-001:prepared',
    recordedAt: T2,
    error: { code: 'CONFLICT', message: 'different intent' },
  }), /SIDE_EFFECT_TRANSITION_CONFLICT/);
  assertions += 1;
  await assert.rejects(() => ledger.transition({
    operationId,
    expectedRevision: 1,
    state: 'executing',
    idempotencyKey: 'delivery-001:wrong-revision',
    recordedAt: T2,
    fencingVersion: 7,
  }), /STALE_SIDE_EFFECT_REVISION/);
  assertions += 1;

  const executing = await ledger.transition({
    operationId,
    expectedRevision: 2,
    state: 'executing',
    idempotencyKey: 'delivery-001:executing',
    recordedAt: T2,
    fencingVersion: 7,
  });
  check(executing.revision.state === 'executing', 'prepared operation enters executing before provider call');
  await assert.rejects(() => ledger.transition({
    operationId,
    expectedRevision: 3,
    state: 'succeeded',
    idempotencyKey: 'delivery-001:invalid-success',
    recordedAt: T3,
    fencingVersion: 7,
  }), /SIDE_EFFECT_SUCCESS_REQUIRES_PROVIDER_REFERENCE/);
  assertions += 1;

  const succeeded = await ledger.transition({
    operationId,
    expectedRevision: 3,
    state: 'succeeded',
    idempotencyKey: 'delivery-001:succeeded',
    recordedAt: T3,
    fencingVersion: 7,
    providerReference: 'github://rotprods/cos-graph-engine/commit/abc123',
    result: { commitSha: 'abc123', nested: { accepted: true } },
  });
  check(succeeded.revision.state === 'succeeded' && succeeded.revision.revision === 4, 'provider success becomes terminal durable revision');

  const leaked = await ledger.getCurrent(operationId);
  assert.ok(leaked);
  (leaked.result as { nested: { accepted: boolean } }).nested.accepted = false;
  leaked.metadata.phase = 'tampered';
  const pristine = await ledger.getCurrent(operationId);
  check((pristine?.result as { nested: { accepted: boolean } }).nested.accepted, 'result reads are detached from ledger truth');
  check(pristine?.metadata.phase === '05', 'metadata reads are detached from ledger truth');

  // Compensation retains provider evidence/result while appending independent
  // compensation state and reference.
  const compensating = await ledger.transition({
    operationId,
    expectedRevision: 4,
    state: 'compensating',
    idempotencyKey: 'delivery-001:compensating',
    recordedAt: T4,
    fencingVersion: 8,
    compensationReference: 'github://rotprods/cos-graph-engine/revert/revert-abc123',
  });
  check(compensating.revision.providerReference?.endsWith('abc123'), 'compensation preserves original provider reference');
  check((compensating.revision.result as { commitSha: string }).commitSha === 'abc123', 'compensation preserves original accepted result evidence');
  const compensated = await ledger.transition({
    operationId,
    expectedRevision: 5,
    state: 'compensated',
    idempotencyKey: 'delivery-001:compensated',
    recordedAt: T5,
    fencingVersion: 8,
  });
  check(compensated.revision.state === 'compensated' && compensated.revision.compensationReference !== null, 'compensation reaches terminal state with retained reference');

  // Coordinator invokes provider once, then serves the terminal ledger result.
  const coordinatorStore = new InMemorySideEffectLedgerStore();
  const coordinatorLedger = new SideEffectLedger(coordinatorStore);
  const times = [T1, T2, T3, T4, T5, T6];
  const coordinator = new SideEffectCoordinator(coordinatorLedger, () => times.shift() ?? T6);
  let providerCalls = 0;
  const executionInput = {
    ...BASE,
    operationKey: 'delivery-coordinator-success',
    recordedAt: T0,
    fencingVersion: 11,
  };
  const firstExecution = await coordinator.execute(executionInput, async operation => {
    providerCalls += 1;
    check(operation.state === 'executing' && operation.fencingVersion === 11, 'provider receives durable executing revision and fence');
    return {
      disposition: 'succeeded',
      providerReference: 'github://rotprods/cos-graph-engine/commit/coordinator',
      result: { accepted: true },
    };
  });
  const secondExecution = await coordinator.execute({ ...executionInput, recordedAt: T6 }, async () => {
    providerCalls += 1;
    return { disposition: 'failed', error: { code: 'SHOULD_NOT_RUN', message: 'duplicate provider invocation' } };
  });
  check(providerCalls === 1, 'terminal retry does not invoke provider twice');
  check(firstExecution.operation.state === 'succeeded' && secondExecution.reusedTerminalResult, 'terminal result is durably reused');

  // A thrown provider call may have mutated the provider before transport loss;
  // therefore the ledger records uncertainty and refuses automatic re-execution.
  const uncertainStore = new InMemorySideEffectLedgerStore();
  const uncertainLedger = new SideEffectLedger(uncertainStore);
  const uncertainTimes = [T1, T2, T3, T4];
  const uncertainCoordinator = new SideEffectCoordinator(uncertainLedger, () => uncertainTimes.shift() ?? T4);
  const uncertainInput = {
    ...BASE,
    operationKey: 'delivery-uncertain',
    recordedAt: T0,
    fencingVersion: 15,
  };
  const uncertainReceipt = await uncertainCoordinator.execute(uncertainInput, async () => {
    throw new Error('connection lost after provider may have accepted request');
  });
  check(uncertainReceipt.operation.state === 'uncertain', 'thrown provider callback records uncertain rather than false failure');
  await assert.rejects(() => uncertainCoordinator.execute({ ...uncertainInput, recordedAt: T4 }, async () => ({
    disposition: 'succeeded', providerReference: 'should-not-run',
  })), /SIDE_EFFECT_RECONCILIATION_REQUIRED/);
  assertions += 1;

  // Simulated process interruption after executing is explicitly recovered to
  // uncertain before any provider retry.
  const interruptedStore = new InMemorySideEffectLedgerStore();
  const interruptedLedger = new SideEffectLedger(interruptedStore);
  const interruptedClaim = await interruptedLedger.claim({ ...BASE, operationKey: 'delivery-interrupted' });
  const interruptedPrepared = await interruptedLedger.transition({
    operationId: interruptedClaim.revision.operationId,
    expectedRevision: 1,
    state: 'prepared',
    idempotencyKey: 'delivery-interrupted:prepared',
    recordedAt: T1,
    fencingVersion: 21,
  });
  const interruptedExecuting = await interruptedLedger.transition({
    operationId: interruptedClaim.revision.operationId,
    expectedRevision: interruptedPrepared.revision.revision,
    state: 'executing',
    idempotencyKey: 'delivery-interrupted:executing',
    recordedAt: T2,
    fencingVersion: 21,
  });
  const recovered = await interruptedLedger.recoverInterrupted(
    interruptedClaim.revision.operationId,
    interruptedExecuting.revision.revision,
    T3,
    'delivery-interrupted:recovered',
  );
  check(recovered.revision.state === 'uncertain' && recovered.revision.fencingVersion === 21, 'interrupted execution becomes uncertain with fence evidence preserved');

  // Postgres candidate implements the same append-only semantics.
  const db = new FakeSideEffectLedgerPostgres();
  const postgresStore = new PostgresSideEffectLedgerStore(db);
  await postgresStore.ensureSchema();
  const postgresLedger = new SideEffectLedger(postgresStore);
  const postgresTimes = [T1, T2, T3, T4, T5];
  const postgresCoordinator = new SideEffectCoordinator(postgresLedger, () => postgresTimes.shift() ?? T5);
  const postgresInput = {
    ...BASE,
    operationKey: 'delivery-postgres',
    recordedAt: T0,
    fencingVersion: 31,
  };
  let postgresProviderCalls = 0;
  const postgresResult = await postgresCoordinator.execute(postgresInput, async () => {
    postgresProviderCalls += 1;
    return {
      disposition: 'succeeded',
      providerReference: 'github://rotprods/cos-graph-engine/commit/postgres',
      result: { commitSha: 'postgres', nested: { durable: true } },
    };
  });
  const postgresRetry = await postgresCoordinator.execute({ ...postgresInput, recordedAt: T5 }, async () => {
    postgresProviderCalls += 1;
    return { disposition: 'failed', error: { code: 'DUPLICATE', message: 'must not execute' } };
  });
  check(postgresProviderCalls === 1 && postgresRetry.reusedTerminalResult, 'Postgres terminal retry does not re-invoke provider');
  check(postgresResult.operation.state === 'succeeded', 'Postgres path reaches succeeded revision');

  const rows = db.snapshotRows();
  check(rows.length === 4, 'Postgres operation is four immutable revisions: claim/prepare/execute/success');
  check(rows.every((row, index) => Number(row.revision) === index + 1), 'Postgres revisions are contiguous');
  check(rows.every(row => row.operation_id === postgresResult.operation.operationId), 'all rows belong to one deterministic operation');
  check(
    !db.statements.some(sql => /^(update|delete|truncate)\b/i.test(sql)),
    'Postgres authority ledger never mutates or deletes historical rows',
  );
  check(
    db.statements.some(sql => sql.includes('pg_advisory_xact_lock')),
    'Postgres writer serializes operations with transaction advisory lock',
  );

  const postgresLeaked = await postgresStore.getCurrent(postgresResult.operation.operationId);
  assert.ok(postgresLeaked);
  (postgresLeaked.result as { nested: { durable: boolean } }).nested.durable = false;
  const postgresPristine = await postgresStore.getCurrent(postgresResult.operation.operationId);
  check((postgresPristine?.result as { nested: { durable: boolean } }).nested.durable, 'Postgres row mapping returns detached result evidence');

  db.corruptRevision(rows[3].revision_id, row => { row.content_hash = 'corrupt'; });
  await assert.rejects(
    () => postgresStore.getCurrent(postgresResult.operation.operationId),
    /SIDE_EFFECT_REVISION_HASH_MISMATCH/,
  );
  assertions += 1;

  const history = await ledger.getHistory(operationId);
  assertHistory(history);
  assertions += 1;

  console.log(`Authority side-effect ledger contract: ${assertions} assertions passed`);
}

function assertHistory(history: SideEffectOperationRevision[]): void {
  assert.deepEqual(
    history.map(revision => revision.state),
    ['claimed', 'prepared', 'executing', 'succeeded', 'compensating', 'compensated'],
  );
  for (let index = 1; index < history.length; index += 1) {
    assert.equal(history[index].previousRevisionId, history[index - 1].revisionId);
    assert.ok(Date.parse(history[index].systemFrom) > Date.parse(history[index - 1].systemFrom));
    assert.ok((history[index].fencingVersion ?? 0) >= (history[index - 1].fencingVersion ?? 0));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
