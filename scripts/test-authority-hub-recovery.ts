import assert from 'node:assert/strict';
import { sha256Hex } from '../packages/core/src';
import { InMemoryEventLog } from '../packages/runtime/src';
import { AuthorityHub } from '../packages/hub/src/authority-hub';
import {
  AuthorityHubSnapshotManager,
  InMemoryAuthorityHubSnapshotStore,
  PostgresAuthorityHubSnapshotStore,
  assertAuthorityHubEnvelopeIntegrity,
  type AuthorityHubSnapshotEnvelope,
} from '../packages/hub/src/authority-store';
import { FakeAuthorityHubSnapshotPostgres } from './fixtures/fake-authority-hub-postgres';

const T0 = '2026-08-28T10:00:00.000Z';
const T1 = '2026-08-28T10:01:00.000Z';
const T2 = '2026-08-28T10:02:00.000Z';
const T3 = '2026-08-28T10:03:00.000Z';
const T4 = '2026-08-28T10:04:00.000Z';
const T5 = '2026-08-28T10:05:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const eventLog = new InMemoryEventLog();
  const hub = new AuthorityHub(eventLog);
  const repository = await hub.registerRepository({
    owner: 'rotprods',
    name: 'cos-graph-engine',
    projectId: 'COS_GRAPH_ENGINE',
    metadata: { authority: 'shadow', phase: 4 },
    idempotencyKey: 'hub-register-1',
    correlationId: 'corr-hub-recovery',
    sourceRef: 'github://rotprods/cos-graph-engine/pull/45',
    occurredAt: T0,
    recordedAt: T1,
    actor: 'test-authority-hub-recovery',
  });
  const initialized = await hub.applyRepoEvent(repository.id, 'init', {
    idempotencyKey: 'hub-init-1',
    correlationId: 'corr-hub-recovery',
    sourceRef: 'github://rotprods/cos-graph-engine/pull/45',
    occurredAt: T1,
    recordedAt: T2,
    expectedState: 'PENDING',
    expectedRevision: 0,
    actor: 'test-authority-hub-recovery',
  });
  check(initialized.applied && initialized.state === 'DEV' && initialized.revision === 1, 'repository reaches DEV before snapshot');

  const memoryStore = new InMemoryAuthorityHubSnapshotStore();
  const manager = new AuthorityHubSnapshotManager(memoryStore, eventLog);
  const envelope = await manager.create(hub, {
    id: 'hub-snapshot-phase04-1',
    createdAt: T3,
    metadata: { projectId: 'COS_GRAPH_ENGINE', purpose: 'authority-recovery-contract' },
  });
  check(envelope.semanticHash === hub.projectionHash(), 'snapshot semantic hash matches source projection');
  check(envelope.snapshot.eventCursor.sequence === (await eventLog.latestCursor()).sequence, 'snapshot cursor is the accepted event-log cursor');
  await assertAuthorityHubEnvelopeIntegrity(envelope);
  assertions += 1;

  const exact = await manager.restoreLatest();
  check(exact.report.exactSnapshotStateRecreated, 'restore with no tail recreates exact snapshot state');
  check(exact.report.postSnapshotEvents === 0, 'exact restore observes no post-snapshot events');
  check(exact.hub.projectionHash() === envelope.semanticHash, 'exact restore reproduces snapshot semantic hash');

  await memoryStore.save(envelope);
  check((await memoryStore.list()).length === 1, 'identical in-memory snapshot save is idempotent');

  const collision = await reseal({
    ...structuredClone(envelope),
    metadata: { projectId: 'COS_GRAPH_ENGINE', purpose: 'conflicting-same-id' },
  });
  await assert.rejects(() => memoryStore.save(collision), /AUTHORITY_HUB_SNAPSHOT_ID_COLLISION/);
  assertions += 1;

  const tampered = structuredClone(envelope);
  tampered.snapshot.repositories[0].metadata.phase = 999;
  await assert.rejects(() => assertAuthorityHubEnvelopeIntegrity(tampered), /AUTHORITY_HUB_SNAPSHOT_INTEGRITY_FAILURE/);
  assertions += 1;

  const wrongEnvelopeSchema = structuredClone(envelope) as AuthorityHubSnapshotEnvelope & { schemaVersion: number };
  wrongEnvelopeSchema.schemaVersion = 2;
  await assert.rejects(
    () => assertAuthorityHubEnvelopeIntegrity(wrongEnvelopeSchema as AuthorityHubSnapshotEnvelope),
    /Unsupported authority Hub envelope schema/,
  );
  assertions += 1;

  const nonEmptyProjection = new AuthorityHub(new InMemoryEventLog());
  await nonEmptyProjection.registerRepository({
    owner: 'rotprods', name: 'other-repo', projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'other-register', correlationId: 'other-corr', sourceRef: 'test://other',
    occurredAt: T0, recordedAt: T1,
  });
  assert.throws(() => nonEmptyProjection.restoreSnapshot(envelope.snapshot), /HUB_RESTORE_REQUIRES_EMPTY_PROJECTION/);
  assertions += 1;

  const wrongSnapshotSchema = structuredClone(envelope.snapshot) as typeof envelope.snapshot & { schemaVersion: number };
  wrongSnapshotSchema.schemaVersion = 2;
  assert.throws(
    () => new AuthorityHub(new InMemoryEventLog()).restoreSnapshot(wrongSnapshotSchema as typeof envelope.snapshot),
    /Unsupported AuthorityHub snapshot schema/,
  );
  assertions += 1;

  const deployed = await hub.applyRepoEvent(repository.id, 'deployment_succeeded', {
    idempotencyKey: 'hub-deploy-1',
    correlationId: 'corr-hub-recovery',
    sourceRef: 'github://rotprods/cos-graph-engine/pull/45',
    occurredAt: T4,
    recordedAt: T5,
    expectedState: 'DEV',
    expectedRevision: 1,
    actor: 'test-authority-hub-recovery',
  });
  check(deployed.applied && deployed.state === 'LIVE' && deployed.revision === 2, 'tail transition reaches LIVE');

  const tailRestore = await manager.restoreLatest();
  check(tailRestore.report.postSnapshotEvents === 2, 'restore replays command and recorded outcome after snapshot');
  check(tailRestore.report.replay.commands === 1 && tailRestore.report.replay.outcomes === 1, 'tail replay consumes one command/outcome pair');
  check(tailRestore.report.finalCursor === (await eventLog.latestCursor()).sequence, 'tail restore reaches latest durable cursor');
  check(tailRestore.report.finalSemanticHash === hub.projectionHash(), 'tail restore converges to live projection hash');
  check(tailRestore.hub.getRepository(repository.id)?.state === 'LIVE', 'restored projection contains final LIVE state');

  const behindManager = new AuthorityHubSnapshotManager(memoryStore, new InMemoryEventLog());
  await assert.rejects(() => behindManager.restoreLatest(), /AUTHORITY_HUB_EVENT_LOG_BEHIND_SNAPSHOT/);
  assertions += 1;

  const pg = new FakeAuthorityHubSnapshotPostgres();
  const pgStore = new PostgresAuthorityHubSnapshotStore(pg);
  await pgStore.ensureSchema();
  await pgStore.save(envelope);
  const pgLoaded = await pgStore.get(envelope.id);
  check(pgLoaded?.integrityHash === envelope.integrityHash, 'Postgres snapshot round-trip preserves integrity hash');
  check(pgLoaded?.semanticHash === envelope.semanticHash, 'Postgres snapshot round-trip preserves semantic hash');
  check((await pgStore.list())[0]?.eventSequence === envelope.snapshot.eventCursor.sequence, 'Postgres manifest preserves snapshot cursor');
  await pgStore.save(envelope);
  check(pg.snapshotRows().length === 1, 'identical Postgres snapshot save is idempotent');
  await assert.rejects(() => pgStore.save(collision), /AUTHORITY_HUB_SNAPSHOT_ID_COLLISION/);
  assertions += 1;

  const pgManager = new AuthorityHubSnapshotManager(pgStore, eventLog);
  const pgRestored = await pgManager.restoreLatest();
  check(pgRestored.report.finalSemanticHash === hub.projectionHash(), 'Postgres-backed snapshot plus tail replay converges');

  await assertRowCorruptionRejected(envelope, row => { row.event_sequence += 1; }, /CURSOR_ROW_MISMATCH/);
  assertions += 1;
  await assertRowCorruptionRejected(envelope, row => { row.repository_count += 1; }, /COUNT_ROW_MISMATCH/);
  assertions += 1;
  await assertRowCorruptionRejected(envelope, row => { row.integrity_hash = '0'.repeat(64); }, /SNAPSHOT_INTEGRITY_FAILURE/);
  assertions += 1;
  await assertRowCorruptionRejected(envelope, row => { row.schema_version = 2; }, /Unsupported authority Hub row schema/);
  assertions += 1;

  check(
    !pg.statements.some(sql => /^update\b|^delete\b|^truncate\b/i.test(sql)),
    'snapshot authority adapter never mutates or deletes accepted snapshots',
  );

  console.log(`Authority Hub recovery contract: ${assertions} assertions passed`);
}

async function assertRowCorruptionRejected(
  envelope: AuthorityHubSnapshotEnvelope,
  corrupt: Parameters<FakeAuthorityHubSnapshotPostgres['corruptRow']>[1],
  pattern: RegExp,
): Promise<void> {
  const db = new FakeAuthorityHubSnapshotPostgres();
  const store = new PostgresAuthorityHubSnapshotStore(db);
  await store.save(envelope);
  db.corruptRow(envelope.id, corrupt);
  await assert.rejects(() => store.get(envelope.id), pattern);
}

async function reseal(envelope: AuthorityHubSnapshotEnvelope): Promise<AuthorityHubSnapshotEnvelope> {
  const payload = {
    id: envelope.id,
    schemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    snapshot: envelope.snapshot,
    semanticHash: envelope.semanticHash,
    metadata: envelope.metadata,
  };
  return {
    ...structuredClone(envelope),
    integrityAlgorithm: 'sha256',
    integrityHash: await sha256Hex(payload),
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
