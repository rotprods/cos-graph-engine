import assert from 'node:assert/strict';
import {
  AuthorityLeaseService,
} from '../packages/execution/src/authority-lease';
import {
  AuthorityLeasePostgresStore,
} from '../packages/execution/src/authority-lease-store-postgres';
import {
  FakeAuthorityLeasePostgres,
} from './fixtures/fake-authority-lease-postgres';

const at = (minute: number): string =>
  new Date(Date.parse('2026-08-28T17:00:00.000Z') + minute * 60_000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthorityLeasePostgres();
  const store = new AuthorityLeasePostgresStore(db);
  await store.ensureSchema();
  const leases = new AuthorityLeaseService(store);
  const resourceUri = 'provider://example/resource/postgres-lease';

  const acquired = await leases.acquire({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'pg-lease-acquire-A',
    at: at(0),
    ttlMs: 2 * 60_000,
    metadata: { adapter: 'postgres' },
  });
  check(acquired.appended && acquired.revision.fencingToken === 1, 'Postgres lease appends first fenced owner');

  const duplicate = await new AuthorityLeaseService(
    new AuthorityLeasePostgresStore(db),
  ).acquire({
    resourceUri,
    ownerId: 'worker-A',
    operationKey: 'pg-lease-acquire-A',
    at: at(0),
    ttlMs: 2 * 60_000,
    metadata: { adapter: 'postgres' },
  });
  check(!duplicate.appended && duplicate.revision.leaseId === acquired.revision.leaseId, 'restart retry resolves accepted lease acquisition');

  const renewed = await leases.renew({
    resourceUri,
    leaseId: acquired.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 1,
    operationKey: 'pg-lease-renew-A',
    at: at(1),
    ttlMs: 4 * 60_000,
  });
  check(renewed.revision.expiresAt === at(5), 'Postgres renewal extends from explicit time');
  check(renewed.revision.fencingToken === 1, 'Postgres renewal preserves token');

  const restarted = new AuthorityLeaseService(new AuthorityLeasePostgresStore(db));
  const active = await restarted.inspect(resourceUri, at(4));
  check(active?.effectiveState === 'active' && active.remainingMs === 60_000, 'fresh service reconstructs active lease from Postgres');
  await restarted.at(at(4)).assertCurrent(resourceUri, 1);
  assertions += 1;

  const second = await restarted.acquire({
    resourceUri,
    ownerId: 'worker-B',
    operationKey: 'pg-lease-acquire-B',
    at: at(5),
    ttlMs: 3 * 60_000,
  });
  check(second.revision.fencingToken === 2, 'Postgres reacquisition after expiry increments token');
  check(second.revision.resourceRevision === 3 && second.revision.leaseRevision === 1, 'Postgres resource/lease revision lineage is preserved');

  await assert.rejects(
    () => restarted.at(at(5.5)).assertCurrent(resourceUri, 1),
    /STALE_FENCING_TOKEN/,
  );
  assertions += 1;
  await restarted.at(at(5.5)).assertCurrent(resourceUri, 2);
  assertions += 1;

  const released = await restarted.release({
    resourceUri,
    leaseId: second.revision.leaseId,
    ownerId: 'worker-B',
    fencingToken: 2,
    expectedResourceRevision: 3,
    operationKey: 'pg-lease-release-B',
    at: at(6),
  });
  check(released.revision.state === 'released' && released.revision.resourceRevision === 4, 'Postgres release appends closure revision');

  const history = await restarted.history(resourceUri, at(7));
  check(history.length === 4, 'Postgres lease history is append-only');
  check(history.map(item => item.resourceRevision).join(',') === '1,2,3,4', 'Postgres lease ordering is deterministic');
  history[0]!.metadata.adapter = 'tampered';
  check((await restarted.history(resourceUri, at(7)))[0]!.metadata.adapter === 'postgres', 'Postgres lease reads are detached');

  await assert.rejects(() => restarted.renew({
    resourceUri,
    leaseId: acquired.revision.leaseId,
    ownerId: 'worker-A',
    fencingToken: 1,
    expectedResourceRevision: 4,
    operationKey: 'pg-lease-old-owner-renew',
    at: at(7),
    ttlMs: 2 * 60_000,
  }), /STALE_LEASE_ID/);
  assertions += 1;

  check(db.snapshotRows().length === 4, 'Postgres fixture contains one immutable row per accepted lease transition');
  check(
    !db.statements.some(statement => /^update\b|^delete\b|^truncate\b/i.test(statement)),
    'Postgres lease authority never mutates/deletes accepted revisions',
  );
  check(
    db.statements.some(statement => statement.includes('pg_advisory_xact_lock')),
    'Postgres lease writer serializes by resource advisory lock',
  );
  check(
    db.statements.some(statement => statement.includes('on conflict do nothing')),
    'Postgres lease conflicts are classified without aborting the transaction',
  );

  const corruptDb = new FakeAuthorityLeasePostgres();
  const corruptStore = new AuthorityLeasePostgresStore(corruptDb);
  const corruptService = new AuthorityLeaseService(corruptStore);
  const corrupt = await corruptService.acquire({
    resourceUri: 'provider://example/resource/corrupt-lease',
    ownerId: 'worker-corrupt',
    operationKey: 'corrupt-acquire',
    at: at(0),
    ttlMs: 60_000,
  });
  corruptDb.corruptRevision(corrupt.revision.revisionId, row => {
    row.content_hash = '0'.repeat(32);
  });
  await assert.rejects(
    () => corruptStore.getCurrent(corrupt.revision.resourceUri),
    /LEASE_CONTENT_HASH_MISMATCH/,
  );
  assertions += 1;

  console.log(`Authority lease Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
