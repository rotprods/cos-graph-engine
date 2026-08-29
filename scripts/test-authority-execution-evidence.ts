import assert from 'node:assert/strict';
import {
  AuthorityExecutionRuntime,
} from '../packages/execution/src/authority-execution-runtime';
import {
  AuthorityExecutionObserver,
  ObservedAuthorityExecutionRuntime,
  type AuthorityExecutionSignal,
  type IAuthorityExecutionSignalSink,
} from '../packages/execution/src/authority-execution-evidence';
import {
  AuthorityExecutionSignalStore,
} from '../packages/execution/src/authority-execution-signal-store';
import {
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
} from '../packages/execution/src/authority-lease';
import {
  InMemoryAuthoritySideEffectStore,
} from '../packages/execution/src/authority-side-effect';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T18:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const execution = new AuthorityExecutionRuntime(
    operationStore,
    new AuthorityLeaseService(leaseStore),
  );
  const signalStore = new AuthorityExecutionSignalStore();
  const observer = new AuthorityExecutionObserver(signalStore);
  const observed = new ObservedAuthorityExecutionRuntime(execution, observer);
  const resourceUri = 'provider://example/resource/observed';

  const lease = await observed.acquireLease({
    resourceUri,
    ownerId: 'worker-observed',
    operationKey: 'observed-lease-acquire',
    at: at(0),
    ttlMs: 10 * 60_000,
  });
  const claim = await observed.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'observed-operation',
    principalId: 'agent://phase05/observed',
    capability: 'provider.resource.update',
    resourceUri,
    input: { desired: 'observed' },
    correlationId: 'corr-observed-operation',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    recordedAt: at(1),
  });
  const operationId = claim.revision.operationId;
  await observed.prepareOperation({
    operationId,
    expectedOperationRevision: 1,
    transitionKey: 'observed-operation:prepare',
    recordedAt: at(2),
    leaseId: lease.revision.leaseId,
    leaseOwnerId: 'worker-observed',
    fencingToken: lease.revision.fencingToken,
    providerIdempotencyKey: 'provider-observed-operation',
  });
  await observed.beginOperation({
    operationId,
    expectedOperationRevision: 2,
    transitionKey: 'observed-operation:execute',
    recordedAt: at(3),
  });
  const committed = await observed.commitOperation({
    operationId,
    expectedOperationRevision: 3,
    transitionKey: 'observed-operation:commit',
    recordedAt: at(4),
    result: { version: 1, status: 'accepted' },
  });
  check(committed.revision.state === 'committed', 'observer does not alter accepted operation result');

  const acceptedSignals = await signalStore.list();
  check(
    acceptedSignals.map(signal => signal.type).join(',')
      === 'lease_acquired,operation_claimed,operation_prepared,operation_execution_started,operation_committed',
    'accepted operation emits deterministic ordered evidence signals',
  );
  check(acceptedSignals.every(signal => signal.outcome === 'accepted'), 'success signals are explicitly accepted outcomes');
  check(acceptedSignals.every(signal => typeof signal.evidenceHash === 'string'), 'every signal is content-hashed');

  acceptedSignals[0]!.evidence.tampered = true;
  check((await signalStore.list())[0]!.evidence.tampered === undefined, 'signal reads are detached from canonical evidence');

  // Create an in-flight operation under token 1, then let token 2 supersede it.
  const staleResource = 'provider://example/resource/near-miss';
  const staleLease = await observed.acquireLease({
    resourceUri: staleResource,
    ownerId: 'worker-old',
    operationKey: 'near-miss-lease-old',
    at: at(5),
    ttlMs: 2 * 60_000,
  });
  const staleClaim = await observed.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'near-miss-operation',
    principalId: 'agent://phase05/old-worker',
    capability: 'provider.resource.update',
    resourceUri: staleResource,
    input: { stale: true },
    correlationId: 'corr-near-miss-operation',
    provenance: [{ source: 'test://near-miss' }],
    recordedAt: at(5.1),
  });
  const staleOperationId = staleClaim.revision.operationId;
  await observed.prepareOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 1,
    transitionKey: 'near-miss:prepare',
    recordedAt: at(5.2),
    leaseId: staleLease.revision.leaseId,
    leaseOwnerId: 'worker-old',
    fencingToken: 1,
    providerIdempotencyKey: 'near-miss-attempt-old',
  });
  await observed.beginOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 2,
    transitionKey: 'near-miss:execute',
    recordedAt: at(5.3),
  });
  const newLease = await observed.acquireLease({
    resourceUri: staleResource,
    ownerId: 'worker-new',
    operationKey: 'near-miss-lease-new',
    at: at(7),
    ttlMs: 10 * 60_000,
  });
  check(newLease.revision.fencingToken === 2, 'new worker supersedes expired lease with higher token');

  await assert.rejects(() => observed.commitOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 3,
    transitionKey: 'near-miss:stale-commit',
    recordedAt: at(8),
    result: { shouldNotCommit: true },
  }), /STALE_FENCING_TOKEN/);
  assertions += 1;

  const signalsAfterNearMiss = await signalStore.findByOperation(staleOperationId);
  const rejected = signalsAfterNearMiss.find(signal => signal.type === 'stale_fencing_rejected');
  check(rejected?.outcome === 'rejected', 'stale commit creates rejected near-miss evidence');
  check(rejected?.errorCode === 'STALE_FENCING_TOKEN', 'near-miss preserves machine-actionable error code');
  check(!('rootCause' in (rejected?.evidence ?? {})), 'near-miss evidence does not invent a root cause');
  check((await execution.getOperation(staleOperationId, at(8)))?.state === 'executing', 'observation does not mutate rejected operation state');

  // A broken signal sink cannot turn a successful protected operation into failure.
  const failingObserver = new AuthorityExecutionObserver(new FailingSignalSink());
  const isolatedExecution = new AuthorityExecutionRuntime(
    new InMemoryAuthoritySideEffectStore(),
    new AuthorityLeaseService(new InMemoryAuthorityLeaseStore()),
  );
  const isolatedObserved = new ObservedAuthorityExecutionRuntime(
    isolatedExecution,
    failingObserver,
  );
  const isolatedLease = await isolatedObserved.acquireLease({
    resourceUri: 'provider://example/resource/observer-failure',
    ownerId: 'worker-isolated',
    operationKey: 'observer-failure-acquire',
    at: at(9),
    ttlMs: 60_000,
  });
  check(isolatedLease.revision.state === 'active', 'observer failure cannot alter protected lease acquisition');
  check(failingObserver.getFailures().length === 1, 'observer failure is retained separately');

  console.log(`Authority execution evidence contract: ${assertions} assertions passed`);
}

class FailingSignalSink implements IAuthorityExecutionSignalSink {
  async record(_signal: AuthorityExecutionSignal): Promise<void> {
    throw new Error('injected observer store outage');
  }

  async list(): Promise<AuthorityExecutionSignal[]> {
    return [];
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
