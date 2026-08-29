import assert from 'node:assert/strict';
import {
  AuthorityLeaseService,
  InMemoryAuthorityLeaseStore,
} from '../packages/execution/src/authority-lease';

const time = (ms: number): string =>
  new Date(Date.parse('2026-08-28T15:00:00.000Z') + ms).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const store = new InMemoryAuthorityLeaseStore();
  const leases = new AuthorityLeaseService(store);
  const resourceUri = 'provider://example/resource/lease-test';

  const acquired = await leases.acquire({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'acquire-A-1',
    at: time(0),
    ttlMs: 1_000,
    metadata: { reason: 'phase05-contract' },
  });
  check(acquired.appended, 'first lease acquisition is appended');
  check(acquired.revision.fencingToken === 1, 'first acquisition receives fencing token 1');
  check(acquired.revision.resourceRevision === 1 && acquired.revision.leaseRevision === 1, 'initial resource/lease revisions start at 1');

  const duplicate = await leases.acquire({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'acquire-A-1',
    at: time(0),
    ttlMs: 1_000,
    metadata: { reason: 'phase05-contract' },
  });
  check(!duplicate.appended && duplicate.revision.leaseId === acquired.revision.leaseId, 'identical acquisition retry converges');

  await assert.rejects(() => leases.acquire({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'acquire-A-1',
    at: time(0),
    ttlMs: 2_000,
    metadata: { reason: 'changed-payload' },
  }), /LEASE_OPERATION_KEY_CONFLICT/);
  assertions += 1;

  await assert.rejects(() => leases.acquire({
    resourceUri,
    ownerId: 'worker-B',
    operationKey: 'acquire-B-too-early',
    at: time(500),
    ttlMs: 1_000,
  }), /LEASE_ALREADY_HELD/);
  assertions += 1;

  const renewed = await leases.renew({
    resourceUri,
    leaseId: acquired.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 1,
    operationKey: 'renew-A-1',
    at: time(500),
    ttlMs: 2_000,
    metadata: { heartbeat: 1 },
  });
  check(renewed.revision.fencingToken === 1, 'renewal preserves fencing token');
  check(renewed.revision.resourceRevision === 2 && renewed.revision.leaseRevision === 2, 'renewal appends resource and lease revisions');
  check(renewed.revision.expiresAt === time(2_500), 'renewal extends expiry from explicit renewal time');

  const renewedRetry = await leases.renew({
    resourceUri,
    leaseId: acquired.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 1,
    operationKey: 'renew-A-1',
    at: time(500),
    ttlMs: 2_000,
    metadata: { heartbeat: 1 },
  });
  check(!renewedRetry.appended && renewedRetry.revision.revisionId === renewed.revision.revisionId, 'renewal retry resolves historical accepted revision');

  await assert.rejects(() => leases.renew({
    resourceUri,
    leaseId: acquired.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 1,
    operationKey: 'renew-A-stale',
    at: time(600),
    ttlMs: 2_000,
  }), /STALE_LEASE_RESOURCE_REVISION/);
  assertions += 1;

  const active = await leases.inspect(resourceUri, time(2_000));
  check(active?.effectiveState === 'active' && active.remainingMs === 500, 'inspection derives active state and bounded remaining time');
  await leases.at(time(2_000)).assertCurrent(resourceUri, 1);
  assertions += 1;

  await assert.rejects(
    () => leases.assertCurrent(resourceUri, 1),
    /requires explicit evaluation time/,
  );
  assertions += 1;

  const expired = await leases.inspect(resourceUri, time(2_500));
  check(expired?.effectiveState === 'expired', 'expiry is derived at the exact exclusive boundary');
  await assert.rejects(
    () => leases.at(time(2_500)).assertCurrent(resourceUri, 1),
    /LEASE_NOT_ACTIVE/,
  );
  assertions += 1;

  const reacquired = await leases.acquire({
    resourceUri,
    ownerId: 'worker-B',
    operationKey: 'acquire-B-after-expiry',
    at: time(3_000),
    ttlMs: 1_000,
    metadata: { takeover: 'expired' },
  });
  check(reacquired.revision.fencingToken === 2, 'reacquisition increments monotonic fencing token');
  check(reacquired.revision.leaseId !== acquired.revision.leaseId, 'reacquisition creates a new lease identity');
  check(reacquired.revision.resourceRevision === 3 && reacquired.revision.leaseRevision === 1, 'new lease continues resource history and resets lease revision');

  await assert.rejects(
    () => leases.at(time(3_100)).assertCurrent(resourceUri, 1),
    /STALE_FENCING_TOKEN/,
  );
  assertions += 1;
  await leases.at(time(3_100)).assertCurrent(resourceUri, 2);
  assertions += 1;

  const released = await leases.release({
    resourceUri,
    leaseId: reacquired.revision.leaseId,
    ownerId: 'worker-B',
    fencingToken: 2,
    expectedResourceRevision: 3,
    operationKey: 'release-B-1',
    at: time(3_500),
    metadata: { reason: 'completed' },
  });
  check(released.revision.state === 'released', 'release appends explicit closure revision');
  check((await leases.inspect(resourceUri, time(3_600)))?.effectiveState === 'released', 'released state remains distinguishable from expiry');

  const third = await leases.acquire({
    resourceUri,
    ownerId: 'worker-C',
    operationKey: 'acquire-C-after-release',
    at: time(3_600),
    ttlMs: 1_000,
  });
  check(third.revision.fencingToken === 3, 'acquisition after release continues monotonic fencing');
  check(third.revision.resourceRevision === 5, 'resource history remains append-only across release/reacquire');

  const leakedHistory = await leases.history(resourceUri, time(3_700));
  check(leakedHistory.length === 5, 'resource history contains acquire/renew/reacquire/release/reacquire revisions');
  leakedHistory[0].metadata.reason = 'tampered';
  const pristineHistory = await leases.history(resourceUri, time(3_700));
  check(pristineHistory[0].metadata.reason === 'phase05-contract', 'lease history reads are detached');

  await assert.rejects(() => leases.renew({
    resourceUri,
    leaseId: reacquired.revision.leaseId,
    ownerId: 'worker-B',
    fencingToken: 2,
    expectedResourceRevision: 5,
    operationKey: 'old-worker-renew',
    at: time(3_800),
    ttlMs: 2_000,
  }), /STALE_LEASE_ID/);
  assertions += 1;

  console.log(`Authority lease/fencing contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
