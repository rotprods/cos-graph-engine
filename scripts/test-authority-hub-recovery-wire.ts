import assert from 'node:assert/strict';
import {
  CANONICAL_JSON_WIRE_VERSION,
} from '../packages/core/src';
import {
  AuthorityHub,
  AuthorityHubSnapshotManager,
  PostgresAuthorityHubSnapshotStore,
  canonicalHubSnapshotWire,
  hydrateAuthorityHubSnapshot,
} from '../packages/hub/src';
import { InMemoryEventLog } from '../packages/runtime/src';
import { FakeAuthorityHubSnapshotPostgres } from './fixtures/fake-authority-hub-snapshot-postgres';

const T0 = '2026-08-28T10:00:00.000Z';
const T1 = '2026-08-28T10:00:01.000Z';
const T2 = '2026-08-28T10:00:02.000Z';
const T3 = '2026-08-28T10:00:03.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const log = new InMemoryEventLog();
  const hub = new AuthorityHub(log);
  const globalRepo = await hub.registerRepository({
    owner: 'rotprods',
    name: 'global-authority-fixture',
    metadata: { global: true, optional: undefined },
    idempotencyKey: 'repo:global-authority-fixture',
    correlationId: 'corr-global-register',
    sourceRef: 'github://rotprods/global-authority-fixture',
    occurredAt: T0,
    recordedAt: T0,
  });
  const scopedRepo = await hub.registerRepository({
    owner: 'rotprods',
    name: 'scoped-authority-fixture',
    projectId: 'COS_GRAPH_ENGINE',
    idempotencyKey: 'repo:scoped-authority-fixture',
    correlationId: 'corr-scoped-register',
    sourceRef: 'github://rotprods/scoped-authority-fixture',
    occurredAt: T0,
    recordedAt: T0,
  });
  const initGlobal = await hub.applyRepoEvent(globalRepo.id, 'init', {
    idempotencyKey: 'cmd:global:init', correlationId: 'corr-global-init',
    sourceRef: 'fixture://global/init', occurredAt: T1, recordedAt: T1,
    expectedState: 'PENDING', expectedRevision: 0,
  });
  check(initGlobal.applied && initGlobal.revision === 1, 'initial Hub command records a canonical successful outcome');
  const cursorBeforeRetry = await log.latestCursor();
  const lateRetry = await hub.applyRepoEvent(globalRepo.id, 'init', {
    idempotencyKey: 'cmd:global:init', correlationId: 'corr-global-init',
    sourceRef: 'fixture://global/init', occurredAt: T1, recordedAt: T2,
    expectedState: 'PENDING', expectedRevision: 0,
  });
  check(lateRetry.duplicate && lateRetry.outcomeEventId === initGlobal.outcomeEventId, 'same command retry converges when only recordedAt changes');
  check((await log.latestCursor()).sequence === cursorBeforeRetry.sequence, 'late transport retry does not append duplicate durable events');

  await hub.applyRepoEvent(scopedRepo.id, 'init', {
    idempotencyKey: 'cmd:scoped:init', correlationId: 'corr-scoped-init',
    sourceRef: 'fixture://scoped/init', occurredAt: T1, recordedAt: T1,
    expectedState: 'PENDING', expectedRevision: 0,
  });

  const db = new FakeAuthorityHubSnapshotPostgres();
  const store = new PostgresAuthorityHubSnapshotStore(db);
  await store.ensureSchema();
  const manager = new AuthorityHubSnapshotManager(store, log);
  const envelope = await manager.create(hub, {
    id: 'hub-wire-snapshot-1',
    createdAt: T2,
    metadata: { reason: 'wire-roundtrip', optional: undefined },
  });
  check(envelope.serializationVersion === CANONICAL_JSON_WIRE_VERSION, 'snapshot envelope records canonical wire version');
  check(!('optional' in envelope.metadata), 'snapshot metadata is canonicalized before signing');

  const rows = db.snapshotRows();
  const row = rows.at(0);
  if (!row) throw new Error('expected persisted snapshot row');
  const wireRepositories = (row.snapshot.repositories ?? []) as Array<Record<string, unknown>>;
  const globalWire = wireRepositories.find(item => item.fullName === 'rotprods/global-authority-fixture');
  const scopedWire = wireRepositories.find(item => item.fullName === 'rotprods/scoped-authority-fixture');
  if (!globalWire || !scopedWire) throw new Error('expected both persisted repositories');
  check(!Object.prototype.hasOwnProperty.call(globalWire, 'projectId'), 'JSONB wire omits absent global projectId');
  check(scopedWire.projectId === 'COS_GRAPH_ENGINE', 'JSONB wire preserves scoped projectId');

  const loaded = await store.get(envelope.id);
  if (!loaded) throw new Error('expected verified snapshot envelope');
  const loadedGlobal = loaded.snapshot.repositories.find(item => item.fullName === 'rotprods/global-authority-fixture');
  if (!loadedGlobal) throw new Error('expected hydrated global repository');
  check(
    Object.prototype.hasOwnProperty.call(loadedGlobal, 'projectId') && loadedGlobal.projectId === undefined,
    'runtime hydration restores optional projectId shape without changing persisted wire',
  );
  check(loaded.integrityHash === envelope.integrityHash, 'JSONB roundtrip preserves SHA-256 integrity seal');
  check(loaded.semanticHash === envelope.semanticHash, 'JSONB roundtrip preserves semantic projection hash');

  const wireRoundTrip = JSON.parse(JSON.stringify(canonicalHubSnapshotWire(envelope.snapshot))) as Record<string, unknown>;
  const hydrated = hydrateAuthorityHubSnapshot(wireRoundTrip);
  const roundTripHub = new AuthorityHub(log);
  roundTripHub.restoreSnapshot(hydrated);
  check(roundTripHub.projectionHash() === envelope.semanticHash, 'raw JSON roundtrip restores the same Hub projection hash');

  const exact = await manager.restoreLatest();
  check(exact.report.postSnapshotEvents === 0 && exact.report.exactSnapshotStateRecreated, 'snapshot-only restore recreates exact state');
  check(exact.hub.projectionHash() === envelope.semanticHash, 'snapshot-only restore matches sealed semantic hash');

  const tail = await hub.applyRepoEvent(globalRepo.id, 'change', {
    idempotencyKey: 'cmd:global:change', correlationId: 'corr-global-change',
    sourceRef: 'fixture://global/change', occurredAt: T3, recordedAt: T3,
    expectedState: 'DEV', expectedRevision: 1,
  });
  check(tail.applied && tail.revision === 2, 'successful Hub outcome survives canonical EventLog payload normalization');
  const liveHash = hub.projectionHash();
  const recoveredTail = await manager.restoreLatest();
  check(recoveredTail.report.postSnapshotEvents === 2, 'tail recovery replays exactly command + outcome');
  check(recoveredTail.hub.projectionHash() === liveHash, 'snapshot + tail replay converges to live semantic hash');
  check(recoveredTail.hub.getRepository(globalRepo.id)?.stateRevision === 2, 'tail replay restores latest repository revision');

  const original = structuredClone(row);
  db.mutateRow(envelope.id, target => {
    target.snapshot = structuredClone(target.snapshot);
    target.snapshot.stateHash = 'tampered-state-hash';
  });
  await assert.rejects(() => store.get(envelope.id), /SEMANTIC_HASH_MISMATCH|INTEGRITY_FAILURE/);
  assertions += 1;
  restoreRow(db, envelope.id, original);

  db.mutateRow(envelope.id, target => { target.serialization_version = 2; });
  await assert.rejects(() => store.get(envelope.id), /Unsupported authority Hub row serialization/);
  assertions += 1;
  restoreRow(db, envelope.id, original);

  db.mutateRow(envelope.id, target => { target.schema_version = 2; });
  await assert.rejects(() => store.get(envelope.id), /Unsupported authority Hub row schema/);
  assertions += 1;
  restoreRow(db, envelope.id, original);

  db.mutateRow(envelope.id, target => { target.metadata.reason = 'tampered'; });
  await assert.rejects(() => store.get(envelope.id), /INTEGRITY_FAILURE/);
  assertions += 1;
  restoreRow(db, envelope.id, original);

  const behindManager = new AuthorityHubSnapshotManager(store, new InMemoryEventLog());
  await assert.rejects(() => behindManager.restoreLatest(), /EVENT_LOG_BEHIND_SNAPSHOT/);
  assertions += 1;

  const manifests = await store.list();
  check(manifests.at(0)?.serializationVersion === CANONICAL_JSON_WIRE_VERSION, 'snapshot manifests expose wire serialization version');
  check(manifests.at(0)?.repositoryCount === 2, 'snapshot manifest preserves repository count');

  console.log(`Authority Hub recovery/wire contract: ${assertions} assertions passed`);
}

function restoreRow(
  db: FakeAuthorityHubSnapshotPostgres,
  id: string,
  source: ReturnType<FakeAuthorityHubSnapshotPostgres['snapshotRows']>[number],
): void {
  db.mutateRow(id, target => {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, structuredClone(source));
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
