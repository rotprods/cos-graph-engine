import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_PERSISTENCE_IMAGE_LEGACY_VERSION,
  DurableGraphStore,
  GraphDurabilityDriver,
  GraphDurabilityError,
  GraphPersistenceCommit,
  GraphPersistenceCompaction,
  GraphPersistenceCompactionResult,
  GraphPersistenceCompareAndSwapResult,
  GraphStateError,
  GraphTransaction,
  SQLiteGraphDurabilityDriver,
  canonicalGraphHash,
  parseGraphPersistenceImage,
} from '../packages/graph/src/framework';

async function expectDurabilityError(
  action: () => Promise<unknown>,
  code: GraphDurabilityError['code'],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphDurabilityError);
    assert.equal(error.code, code);
    return true;
  });
}

async function expectStateError(
  action: () => Promise<unknown>,
  code: GraphStateError['code'],
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphStateError);
    assert.equal(error.code, code);
    return true;
  });
}

class CompactionConflictOnceDriver implements GraphDurabilityDriver {
  private conflicted = false;

  constructor(private readonly delegate: GraphDurabilityDriver) {}

  load(graphId: string): unknown | null | Promise<unknown | null> {
    return this.delegate.load(graphId);
  }

  compareAndSwap(
    commit: GraphPersistenceCommit,
  ): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult> {
    return this.delegate.compareAndSwap(commit);
  }

  compact(compaction: GraphPersistenceCompaction): GraphPersistenceCompactionResult | Promise<GraphPersistenceCompactionResult> {
    if (!this.conflicted) {
      this.conflicted = true;
      return { status: 'conflict' };
    }
    if (!this.delegate.compact) throw new Error('delegate unexpectedly lacks compaction');
    return this.delegate.compact(compaction);
  }

  close(): void | Promise<void> {
    return this.delegate.close?.();
  }
}

class TamperedAnchorDriver implements GraphDurabilityDriver {
  constructor(
    private readonly delegate: GraphDurabilityDriver,
    private readonly mode: 'anchor-hash' | 'idempotency-hash' | 'drop-idempotency' | 'tail-chain',
  ) {}

  async load(graphId: string): Promise<unknown | null> {
    const value = await this.delegate.load(graphId);
    if (value === null) return null;
    const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

    if (this.mode === 'drop-idempotency') {
      const idempotency = clone.idempotency;
      if (Array.isArray(idempotency) && idempotency.length > 0) idempotency.shift();
      return clone;
    }

    const anchorValue = clone.anchor;
    if (typeof anchorValue !== 'object' || anchorValue === null || Array.isArray(anchorValue)) return clone;
    const anchor = anchorValue as Record<string, unknown>;
    if (this.mode === 'anchor-hash') {
      anchor.anchorHash = '0'.repeat(64);
      return clone;
    }
    if (this.mode === 'idempotency-hash') {
      anchor.idempotencyHash = 'f'.repeat(64);
      const { anchorHash: _ignored, ...payload } = anchor;
      anchor.anchorHash = canonicalGraphHash(payload);
      return clone;
    }

    const events = clone.events;
    if (this.mode === 'tail-chain' && Array.isArray(events) && events.length > 0) {
      const first = events[0];
      if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
        (first as Record<string, unknown>).previousEventHash = 'b'.repeat(64);
      }
    }
    return clone;
  }

  compareAndSwap(
    commit: GraphPersistenceCommit,
  ): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult> {
    return this.delegate.compareAndSwap(commit);
  }

  compact(compaction: GraphPersistenceCompaction): GraphPersistenceCompactionResult | Promise<GraphPersistenceCompactionResult> {
    if (!this.delegate.compact) throw new Error('delegate unexpectedly lacks compaction');
    return this.delegate.compact(compaction);
  }
}

function transaction(
  revision: number,
  key: string,
  recordedAt: number,
  nodeId: string,
): GraphTransaction {
  return {
    graphId: 'enterprise',
    expectedRevision: revision,
    idempotencyKey: key,
    operationId: `op-${key}`,
    recordedAt,
    mutations: [{
      type: 'node.put',
      node: { id: nodeId, type: 'company', properties: { ordinal: revision + 1 } },
    }],
  };
}

interface RawSQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): { run(...params: unknown[]): unknown };
  close(): void;
}

type RawSQLiteDatabaseConstructor = new (path: string) => RawSQLiteDatabase;

function sqliteConstructor(): RawSQLiteDatabaseConstructor {
  const loaded = require('node:sqlite') as unknown;
  if (typeof loaded !== 'object' || loaded === null || !('DatabaseSync' in loaded)) {
    throw new Error('node:sqlite DatabaseSync unavailable');
  }
  return (loaded as { readonly DatabaseSync: RawSQLiteDatabaseConstructor }).DatabaseSync;
}

function installLegacyDatabase(databasePath: string, imageValue: unknown): void {
  const image = imageValue as {
    readonly graphId: string;
    readonly storageVersion: number;
    readonly snapshot: unknown;
    readonly events: readonly Record<string, unknown>[];
    readonly idempotency: readonly {
      readonly idempotencyKey: string;
      readonly requestHash: string;
      readonly receipt: unknown;
    }[];
  };
  const DatabaseSync = sqliteConstructor();
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE cos_graph_heads (
      graph_id TEXT PRIMARY KEY,
      storage_version INTEGER NOT NULL CHECK (storage_version >= 1),
      snapshot_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE cos_graph_events (
      graph_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 1),
      event_id TEXT NOT NULL,
      event_json TEXT NOT NULL,
      PRIMARY KEY (graph_id, revision),
      UNIQUE (event_id)
    ) STRICT;
    CREATE TABLE cos_graph_idempotency (
      graph_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      PRIMARY KEY (graph_id, idempotency_key)
    ) STRICT;
  `);
  database.prepare(
    'INSERT INTO cos_graph_heads (graph_id, storage_version, snapshot_json) VALUES (?, ?, ?)',
  ).run(image.graphId, image.storageVersion, JSON.stringify(image.snapshot));
  for (const event of image.events) {
    database.prepare(
      'INSERT INTO cos_graph_events (graph_id, revision, event_id, event_json) VALUES (?, ?, ?, ?)',
    ).run(image.graphId, event.revision, event.eventId, JSON.stringify(event));
  }
  for (const record of image.idempotency) {
    database.prepare(
      'INSERT INTO cos_graph_idempotency (graph_id, idempotency_key, request_hash, receipt_json) VALUES (?, ?, ?, ?)',
    ).run(image.graphId, record.idempotencyKey, record.requestHash, JSON.stringify(record.receipt));
  }
  database.close();
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cos-graph-m2d-'));
  const databasePath = join(directory, 'compaction.sqlite');
  const legacyDatabasePath = join(directory, 'legacy-m2a.sqlite');

  try {
    const driver = new SQLiteGraphDurabilityDriver(databasePath);
    const store = new DurableGraphStore(driver, { clock: () => 9_999 });
    const tx1 = transaction(0, 'enterprise-1', 1_000, 'tesla');
    const tx2 = transaction(1, 'enterprise-2', 2_000, 'spacex');
    const tx3 = transaction(2, 'enterprise-3', 3_000, 'xai');
    const first = await store.commit(tx1);
    const second = await store.commit(tx2);
    const third = await store.commit(tx3);
    assert.equal(first.revision, 1);
    assert.equal(second.revision, 2);
    assert.equal(third.revision, 3);

    const before = await store.history('enterprise');
    assert.equal(before.graphRevision, 3);
    assert.equal(before.eventCount, 3);
    assert.equal(before.storageVersion, 3);
    assert.equal(before.compactedEventCount, 0);
    assert.equal(before.retainedEvents.length, 3);
    assert.equal(before.anchor, null);
    const beforeStateHash = (await store.snapshot('enterprise')).stateHash;

    // Capture an exact M2A-compatible legacy image before any storage-only transition.
    const currentRaw = await driver.load('enterprise');
    assert.ok(currentRaw && typeof currentRaw === 'object' && !Array.isArray(currentRaw));
    const legacyRaw = JSON.parse(JSON.stringify(currentRaw)) as Record<string, unknown>;
    legacyRaw.schema = COS_GRAPH_PERSISTENCE_IMAGE_LEGACY_VERSION;
    delete legacyRaw.anchor;
    const legacyParsed = parseGraphPersistenceImage(legacyRaw, 'enterprise');
    assert.equal(legacyParsed.schema, 'cos.graph/persistence-image/v1alpha2');
    assert.equal(legacyParsed.anchor, null);
    assert.equal(legacyParsed.events.length, 3);
    installLegacyDatabase(legacyDatabasePath, legacyRaw);

    const compacted = await store.compact('enterprise');
    assert.equal(compacted.graphRevision, 3);
    assert.equal(compacted.eventCount, 3);
    assert.equal(compacted.storageVersion, 4, 'compaction advances storage clock without changing graph revision');
    assert.equal(compacted.prunedEvents, 3);
    assert.equal(compacted.retainedEvents, 0);
    assert.equal(compacted.idempotencyCount, 3);
    assert.equal(compacted.noOp, false);

    const after = await store.history('enterprise');
    assert.equal(after.graphRevision, 3);
    assert.equal(after.eventCount, 3);
    assert.equal(after.storageVersion, 4);
    assert.ok(after.storageVersion > after.graphRevision);
    assert.equal(after.compactedEventCount, 3);
    assert.equal(after.retainedEvents.length, 0);
    assert.equal(after.anchor?.snapshot.graph.revision, 3);
    assert.equal(after.anchor?.snapshot.stateHash, beforeStateHash);
    assert.equal((await store.events('enterprise')).length, 0, 'events() exposes only physically retained tail after compaction');
    assert.equal((await store.verify('enterprise')).eventCount, 3);
    assert.equal((await store.verify('enterprise')).stateHash, beforeStateHash);
    await store.close();

    // Full process-facing restart from anchor-only event storage.
    const restartDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const restart = new DurableGraphStore(restartDriver, { clock: () => 4_000 });
    assert.equal((await restart.snapshot('enterprise')).stateHash, beforeStateHash);
    assert.equal((await restart.verify('enterprise')).eventCount, 3);

    // Exact retry of a transaction whose event envelope was physically deleted.
    const retryOld = await restart.commit(tx1);
    assert.equal(retryOld.idempotentReplay, true);
    assert.equal(retryOld.eventId, first.eventId);
    assert.equal(retryOld.eventHash, first.eventHash);
    assert.equal((await restart.history('enterprise')).storageVersion, 4);
    assert.equal((await restart.history('enterprise')).retainedEvents.length, 0);

    await expectStateError(
      () => restart.commit({ ...tx1, mutations: [{ type: 'node.put', node: { id: 'changed' } }] }),
      'IDEMPOTENCY_CONFLICT',
    );

    const tx4 = transaction(3, 'enterprise-4', 4_000, 'neuralink');
    const fourth = await restart.commit(tx4);
    assert.equal(fourth.revision, 4);
    const withTail = await restart.history('enterprise');
    assert.equal(withTail.storageVersion, 5);
    assert.equal(withTail.eventCount, 4);
    assert.equal(withTail.compactedEventCount, 3);
    assert.equal(withTail.retainedEvents.length, 1);
    assert.equal(withTail.retainedEvents[0]?.previousEventHash, withTail.anchor?.snapshot.lastEventHash);
    assert.equal((await restart.verify('enterprise')).stateHash, fourth.stateHash);

    // The anchor's lastRecordedAt remains part of time monotonicity after all old envelopes are gone.
    await expectStateError(
      () => restart.commit(transaction(4, 'time-regression', 3_999, 'too-early')),
      'EVENT_TIME_REGRESSION',
    );
    await restart.close();

    // Compaction CAS conflict is retried from durable truth, without changing graph revision.
    const conflictDriver = new CompactionConflictOnceDriver(new SQLiteGraphDurabilityDriver(databasePath));
    const conflictStore = new DurableGraphStore(conflictDriver, { maxCommitAttempts: 3 });
    const compactedAgain = await conflictStore.compact('enterprise');
    assert.equal(compactedAgain.graphRevision, 4);
    assert.equal(compactedAgain.storageVersion, 6);
    assert.equal(compactedAgain.prunedEvents, 1);
    assert.equal(compactedAgain.noOp, false);
    const noOp = await conflictStore.compact('enterprise');
    assert.equal(noOp.noOp, true);
    assert.equal(noOp.storageVersion, 6, 'already anchored head does not manufacture storage revisions');
    await conflictStore.close();

    // The original old idempotency keys remain authoritative after repeated compaction.
    const postCompactionDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const postCompactionStore = new DurableGraphStore(postCompactionDriver);
    const retryAfterSecondCompaction = await postCompactionStore.commit(tx2);
    assert.equal(retryAfterSecondCompaction.idempotentReplay, true);
    assert.equal(retryAfterSecondCompaction.eventId, second.eventId);
    assert.equal((await postCompactionStore.history('enterprise')).eventCount, 4);
    await postCompactionStore.close();

    // Anchor hash tampering fails closed.
    const anchorBase1 = new SQLiteGraphDurabilityDriver(databasePath);
    const badAnchorHash = new DurableGraphStore(new TamperedAnchorDriver(anchorBase1, 'anchor-hash'));
    await expectDurabilityError(() => badAnchorHash.get('enterprise'), 'DURABILITY_IMAGE_INVALID');
    anchorBase1.close();

    // Recomputing the outer anchor hash does not hide a corrupted idempotency digest.
    const anchorBase2 = new SQLiteGraphDurabilityDriver(databasePath);
    const badIdempotencyHash = new DurableGraphStore(new TamperedAnchorDriver(anchorBase2, 'idempotency-hash'));
    await expectDurabilityError(() => badIdempotencyHash.get('enterprise'), 'DURABILITY_IMAGE_INVALID');
    anchorBase2.close();

    // Losing a compacted idempotency row is detectable even though its event was pruned.
    const anchorBase3 = new SQLiteGraphDurabilityDriver(databasePath);
    const lostIdempotency = new DurableGraphStore(new TamperedAnchorDriver(anchorBase3, 'drop-idempotency'));
    await expectDurabilityError(() => lostIdempotency.get('enterprise'), 'DURABILITY_IMAGE_INVALID');
    anchorBase3.close();

    // Create a new retained tail and prove its first previousEventHash is anchored.
    const tailDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const tailStore = new DurableGraphStore(tailDriver);
    await tailStore.commit(transaction(4, 'enterprise-5', 5_000, 'boring-company'));
    await tailStore.close();
    const tailBase = new SQLiteGraphDurabilityDriver(databasePath);
    const brokenTail = new DurableGraphStore(new TamperedAnchorDriver(tailBase, 'tail-chain'));
    await expectDurabilityError(() => brokenTail.verify('enterprise'), 'DURABILITY_IMAGE_INVALID');
    tailBase.close();

    // A real old M2A SQLite file is migrated in-place by adding anchor_json.
    const migratedDriver = new SQLiteGraphDurabilityDriver(legacyDatabasePath);
    const migratedStore = new DurableGraphStore(migratedDriver);
    const migratedHistory = await migratedStore.history('enterprise');
    assert.equal(migratedHistory.graphRevision, 3);
    assert.equal(migratedHistory.storageVersion, 3);
    assert.equal(migratedHistory.compactedEventCount, 0);
    assert.equal(migratedHistory.retainedEvents.length, 3);
    assert.equal((await migratedStore.verify('enterprise')).stateHash, beforeStateHash);
    const migratedCompaction = await migratedStore.compact('enterprise');
    assert.equal(migratedCompaction.storageVersion, 4);
    assert.equal(migratedCompaction.prunedEvents, 3);
    await migratedStore.close();

    console.log('COS Graph Framework M2D: anchored compaction/migration suite passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
