import assert from 'node:assert/strict';
import {
  AuthorityRepairPostgresStore,
  AuthorityRepairService,
} from '../packages/execution/src/authority-phase05-repair';
import { FakeAuthorityRepairPostgres } from './fixtures/fake-authority-repair-postgres';

const BASE = Date.parse('2026-08-29T21:00:00.000Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const db = new FakeAuthorityRepairPostgres();
  const store = new AuthorityRepairPostgresStore(db);
  await store.ensureSchema();
  const service = new AuthorityRepairService(store);

  const enqueued = await service.enqueue({
    projectId: 'COS_GRAPH_ENGINE', operationId: 'operation://repair-pg',
    correlationId: 'corr-repair-pg', kind: 'lease_release',
    dedupeKey: 'lease-release:operation-pg:lease-pg',
    payload: {
      resourceUri: 'resource://repair-pg', leaseId: 'lease-pg', ownerId: 'worker-pg',
      fencingToken: 1, expectedResourceRevision: 1,
      operationKey: 'lease-release-pg', releaseAt: at(2), metadata: {},
    },
    sensitivity: 'private', maxAttempts: 3, nextAttemptAt: at(0),
    idempotencyKey: 'repair-pg-enqueue',
    provenance: [{ source: 'test://repair-postgres' }], recordedAt: at(0),
  });
  check(enqueued.appended && enqueued.revision.revision === 1, 'Postgres repair store appends initial revision');

  const duplicate = await service.enqueue({
    projectId: 'COS_GRAPH_ENGINE', operationId: 'operation://repair-pg',
    correlationId: 'corr-repair-pg', kind: 'lease_release',
    dedupeKey: 'lease-release:operation-pg:lease-pg',
    payload: {
      resourceUri: 'resource://repair-pg', leaseId: 'lease-pg', ownerId: 'worker-pg',
      fencingToken: 1, expectedResourceRevision: 1,
      operationKey: 'lease-release-pg', releaseAt: at(2), metadata: {},
    },
    sensitivity: 'private', maxAttempts: 3, nextAttemptAt: at(0),
    idempotencyKey: 'different-enqueue-transport-key',
    provenance: [{ source: 'test://repair-postgres' }], recordedAt: at(0),
  });
  check(!duplicate.appended && db.snapshot().length === 1, 'dedupe retry does not append another row');

  const claim = await service.claim({
    repairId: enqueued.revision.repairId, expectedRevision: 1,
    ownerId: 'worker://repair-pg', at: at(1), ttlMs: 10_000,
    idempotencyKey: 'repair-pg-claim',
  });
  check(claim.revision.fencingToken === 1 && db.snapshot().length === 2, 'claim appends a leased revision');

  const resolved = await service.resolve({
    repairId: enqueued.revision.repairId, expectedRevision: 2,
    ownerId: 'worker://repair-pg', fencingToken: 1, at: at(2),
    resolution: { released: true, resourceRevision: 2 },
    idempotencyKey: 'repair-pg-resolve',
  });
  check(resolved.revision.state === 'resolved' && db.snapshot().length === 3, 'resolution appends terminal revision');
  check((await service.history(enqueued.revision.repairId)).length === 3, 'Postgres history preserves every revision');
  check((await service.listReady('COS_GRAPH_ENGINE', at(3))).length === 0, 'resolved repair is never ready again');

  const leaked = await service.history(enqueued.revision.repairId);
  leaked[0]!.payload.resourceUri = 'tampered';
  check((await service.history(enqueued.revision.repairId))[0]?.payload.resourceUri === 'resource://repair-pg', 'Postgres history reads are detached');

  check(
    !db.statements.some(sql => /^UPDATE\b|^DELETE\b|^TRUNCATE\b/i.test(sql)),
    'repair authority adapter never updates or deletes historical rows',
  );
  check(
    db.statements.some(sql => sql.includes('pg_advisory_xact_lock')),
    'repair writer serializes each repair stream with advisory lock',
  );

  db.corrupt(resolved.revision.revisionId, row => { row.content_hash = 'tampered'; });
  await assert.rejects(() => service.get(enqueued.revision.repairId, at(4)), /REPAIR_CONTENT_HASH_MISMATCH/);
  assertions += 1;

  console.log(`Authority repair Postgres contract: ${assertions} assertions passed`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
