import assert from 'node:assert/strict';
import {
  AuthorityExecutionRuntime,
} from '../packages/execution/src/authority-execution-runtime';
import {
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
} from '../packages/execution/src/authority-lease';
import {
  InMemoryAuthoritySideEffectStore,
} from '../packages/execution/src/authority-side-effect';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T16:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const operationStore = new InMemoryAuthoritySideEffectStore();
  const leaseStore = new InMemoryAuthorityLeaseStore();
  const runtime = new AuthorityExecutionRuntime(
    operationStore,
    new AuthorityLeaseService(leaseStore),
  );
  const resourceUri = 'provider://example/resource/live-operation';

  const lease = await runtime.acquireLease({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'lease-A-1',
    at: at(0),
    ttlMs: 10 * 60_000,
  });
  check(lease.revision.fencingToken === 1, 'first live-operation lease receives fencing token 1');

  const claim = await runtime.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'live-operation-1',
    principalId: 'agent://phase05/live-runtime',
    agentRunId: 'run://phase05/live-runtime/1',
    capability: 'provider.resource.update',
    resourceUri,
    input: { desiredState: 'LIVE' },
    correlationId: 'corr-live-operation-1',
    provenance: [{ source: 'github://rotprods/cos-graph-engine/pull/46' }],
    recordedAt: at(1),
  });
  const operationId = claim.revision.operationId;

  const prepared = await runtime.prepareOperation({
    operationId,
    expectedOperationRevision: 1,
    transitionKey: 'live-operation-1:prepare',
    recordedAt: at(2),
    leaseId: lease.revision.leaseId,
    leaseOwnerId: 'worker-A',
    fencingToken: 1,
    providerIdempotencyKey: 'provider-live-operation-1',
  });
  check(prepared.revision.state === 'prepared', 'active lease can prepare side effect');

  const executing = await runtime.beginOperation({
    operationId,
    expectedOperationRevision: 2,
    transitionKey: 'live-operation-1:execute',
    recordedAt: at(3),
  });
  check(executing.revision.state === 'executing', 'active lease can begin execution');

  const committed = await runtime.commitOperation({
    operationId,
    expectedOperationRevision: 3,
    transitionKey: 'live-operation-1:commit',
    recordedAt: at(4),
    result: { providerVersion: 7, state: 'LIVE' },
  });
  check(committed.revision.state === 'committed', 'live commit validates fence at commit time');

  const released = await runtime.releaseLease({
    resourceUri,
    leaseId: lease.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 1,
    operationKey: 'lease-A-release',
    at: at(5),
  });
  check(released.revision.state === 'released', 'successful operation can close its lease explicitly');

  // New worker owns a newer token; old in-flight worker cannot commit.
  const secondLease = await runtime.acquireLease({
    resourceUri,
    ownerId: 'worker-B',
    operationKey: 'lease-B-1',
    at: at(6),
    ttlMs: 2 * 60_000,
  });
  check(secondLease.revision.fencingToken === 2, 'new ownership increments fencing token');

  const staleClaim = await runtime.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'stale-live-operation',
    principalId: 'agent://phase05/stale-worker',
    agentRunId: 'run://phase05/stale-worker/1',
    capability: 'provider.resource.update',
    resourceUri,
    input: { desiredState: 'STALE_WRITE' },
    correlationId: 'corr-stale-live-operation',
    provenance: [{ source: 'test://stale-worker' }],
    recordedAt: at(6.1),
  });
  const staleOperationId = staleClaim.revision.operationId;
  await runtime.prepareOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 1,
    transitionKey: 'stale-live-operation:prepare',
    recordedAt: at(6.2),
    leaseId: secondLease.revision.leaseId,
    leaseOwnerId: 'worker-B',
    fencingToken: 2,
    providerIdempotencyKey: 'provider-stale-live-operation',
  });
  await runtime.beginOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 2,
    transitionKey: 'stale-live-operation:execute',
    recordedAt: at(6.3),
  });

  // Lease expires at minute 8; worker C reacquires with token 3.
  const thirdLease = await runtime.acquireLease({
    resourceUri,
    ownerId: 'worker-C',
    operationKey: 'lease-C-after-expiry',
    at: at(8),
    ttlMs: 10 * 60_000,
  });
  check(thirdLease.revision.fencingToken === 3, 'reacquisition after expiry invalidates old worker token');

  await assert.rejects(() => runtime.commitOperation({
    operationId: staleOperationId,
    expectedOperationRevision: 3,
    transitionKey: 'stale-live-operation:commit',
    recordedAt: at(9),
    result: { shouldNotCommit: true },
  }), /STALE_FENCING_TOKEN/);
  assertions += 1;
  check(
    (await runtime.getOperation(staleOperationId, at(9)))?.state === 'executing',
    'stale commit rejection leaves accepted operation state unchanged',
  );

  // Preparation itself rejects an obsolete lease identity.
  const wrongLeaseClaim = await runtime.claimOperation({
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'wrong-lease-operation',
    principalId: 'agent://phase05/wrong-lease',
    capability: 'provider.resource.update',
    resourceUri,
    input: { desiredState: 'NOPE' },
    correlationId: 'corr-wrong-lease',
    provenance: [{ source: 'test://wrong-lease' }],
    recordedAt: at(10),
  });
  await assert.rejects(() => runtime.prepareOperation({
    operationId: wrongLeaseClaim.revision.operationId,
    expectedOperationRevision: 1,
    transitionKey: 'wrong-lease-operation:prepare',
    recordedAt: at(10.1),
    leaseId: secondLease.revision.leaseId,
    leaseOwnerId: 'worker-B',
    fencingToken: 2,
    providerIdempotencyKey: 'wrong-lease-provider-key',
  }), /STALE_LEASE_ID/);
  assertions += 1;

  // An active owner can renew without changing the fencing token.
  const renewed = await runtime.renewLease({
    resourceUri,
    leaseId: thirdLease.revision.leaseId,
    ownerId: 'worker-C',
    fencingToken: 3,
    expectedResourceRevision: thirdLease.revision.resourceRevision,
    operationKey: 'lease-C-renew',
    at: at(11),
    ttlMs: 12 * 60_000,
  });
  check(renewed.revision.fencingToken === 3, 'renewal preserves current ownership token');
  check(renewed.revision.expiresAt === at(23), 'renewal uses explicit evaluation time and TTL');

  const operationHistory = await operationStore.getHistory(operationId);
  check(operationHistory.length === 4, 'live operation keeps append-only claim/prepare/execute/commit history');
  const leaseHistory = await leaseStore.getHistory(resourceUri);
  check(leaseHistory.length === 5, 'resource keeps release/reacquire/renew lease lineage');

  const operationCopy = await runtime.getOperation(operationId, at(12));
  const result = operationCopy?.result as { state: string };
  result.state = 'MUTATED';
  check(
    ((await runtime.getOperation(operationId, at(12)))?.result as { state: string }).state === 'LIVE',
    'operation reads remain detached after live-runtime integration',
  );

  console.log(`Authority execution runtime contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
