import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DurableGraphStore,
  GraphDurabilityDriver,
  GraphDurabilityError,
  GraphPersistenceCommit,
  GraphPersistenceCompareAndSwapResult,
  GraphStateError,
  SQLiteGraphDurabilityDriver,
} from '../packages/graph/src/framework';

async function expectStateError(action: () => Promise<unknown>, code: GraphStateError['code']): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphStateError);
    assert.equal(error.code, code);
    return true;
  });
}

async function expectDurabilityError(action: () => Promise<unknown>, code: GraphDurabilityError['code']): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphDurabilityError);
    assert.equal(error.code, code);
    return true;
  });
}

class ConflictOnceDriver implements GraphDurabilityDriver {
  private conflicted = false;

  constructor(private readonly delegate: GraphDurabilityDriver) {}

  load(graphId: string): unknown | null | Promise<unknown | null> {
    return this.delegate.load(graphId);
  }

  compareAndSwap(commit: GraphPersistenceCommit): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult> {
    if (!this.conflicted) {
      this.conflicted = true;
      return { status: 'conflict' };
    }
    return this.delegate.compareAndSwap(commit);
  }

  close(): void | Promise<void> {
    return this.delegate.close?.();
  }
}

class AlwaysConflictDriver implements GraphDurabilityDriver {
  load(): null {
    return null;
  }

  compareAndSwap(): GraphPersistenceCompareAndSwapResult {
    return { status: 'conflict' };
  }
}

class TamperedReadDriver implements GraphDurabilityDriver {
  constructor(private readonly delegate: GraphDurabilityDriver) {}

  async load(graphId: string): Promise<unknown | null> {
    const image = await this.delegate.load(graphId);
    if (image === null) return null;
    const clone = JSON.parse(JSON.stringify(image)) as unknown;
    if (typeof clone !== 'object' || clone === null || !('events' in clone)) return clone;
    const events = (clone as { events?: unknown }).events;
    if (!Array.isArray(events) || events.length === 0) return clone;
    const first = events[0];
    if (typeof first === 'object' && first !== null) {
      (first as Record<string, unknown>).eventHash = '0'.repeat(64);
    }
    return clone;
  }

  compareAndSwap(commit: GraphPersistenceCommit): GraphPersistenceCompareAndSwapResult | Promise<GraphPersistenceCompareAndSwapResult> {
    return this.delegate.compareAndSwap(commit);
  }
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cos-graph-m2a-'));
  const databasePath = join(directory, 'graph-state.sqlite');

  try {
    const firstDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const firstStore = new DurableGraphStore(firstDriver, { clock: () => 1_000 });

    const first = await firstStore.commit({
      graphId: 'enterprise',
      expectedRevision: 0,
      idempotencyKey: 'enterprise-1',
      operationId: 'durable-op-1',
      recordedAt: 1_000,
      mutations: [
        { type: 'node.put', node: { id: 'tesla', type: 'company', properties: { domain: 'mobility' } } },
        { type: 'node.put', node: { id: 'spacex', type: 'company', properties: { domain: 'space' } } },
        { type: 'edge.put', edge: { source: 'tesla', target: 'spacex', type: 'shared_context' } },
      ],
    });
    assert.equal(first.revision, 1);
    assert.equal(first.idempotentReplay, false);
    assert.equal((await firstStore.snapshot('enterprise')).eventCount, 1);
    assert.equal((await firstStore.events('enterprise')).length, 1);
    await firstStore.close();

    // Crash/restart semantics: a fresh process-facing store reconstructs authority
    // from SQLite and preserves exact retry convergence even with stale CAS input.
    const restartDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const restartStore = new DurableGraphStore(restartDriver, { clock: () => 2_000 });
    const recovered = await restartStore.snapshot('enterprise');
    assert.equal(recovered.graph.revision, 1);
    assert.equal(recovered.graph.nodes.length, 2);
    assert.equal(recovered.stateHash, first.stateHash);

    const retry = await restartStore.commit({
      graphId: 'enterprise',
      expectedRevision: 0,
      idempotencyKey: 'enterprise-1',
      operationId: 'retry-operation-may-differ',
      recordedAt: 9_999,
      mutations: [
        { type: 'node.put', node: { id: 'tesla', type: 'company', properties: { domain: 'mobility' } } },
        { type: 'node.put', node: { id: 'spacex', type: 'company', properties: { domain: 'space' } } },
        { type: 'edge.put', edge: { source: 'tesla', target: 'spacex', type: 'shared_context' } },
      ],
    });
    assert.equal(retry.idempotentReplay, true);
    assert.equal(retry.eventId, first.eventId);
    assert.equal((await restartStore.events('enterprise')).length, 1);

    await expectStateError(
      () => restartStore.commit({
        graphId: 'enterprise',
        expectedRevision: 1,
        idempotencyKey: 'enterprise-1',
        recordedAt: 2_000,
        mutations: [{ type: 'node.put', node: { id: 'x' } }],
      }),
      'IDEMPOTENCY_CONFLICT',
    );

    const second = await restartStore.commit({
      graphId: 'enterprise',
      expectedRevision: 1,
      idempotencyKey: 'enterprise-2',
      operationId: 'durable-op-2',
      recordedAt: 2_000,
      mutations: [
        { type: 'node.put', node: { id: 'xai', type: 'company', properties: { domain: 'ai' } } },
        { type: 'edge.put', edge: { source: 'spacex', target: 'xai', type: 'shared_context' } },
      ],
    });
    assert.equal(second.revision, 2);
    assert.equal((await restartStore.verify('enterprise')).stateHash, second.stateHash);

    await expectStateError(
      () => restartStore.commit({
        graphId: 'enterprise',
        expectedRevision: 1,
        idempotencyKey: 'stale-writer',
        recordedAt: 2_001,
        mutations: [{ type: 'node.put', node: { id: 'stale' } }],
      }),
      'REVISION_CONFLICT',
    );
    await restartStore.close();

    // CAS retry path: the orchestration retries a storage race but does not
    // weaken graph revision semantics.
    const conflictDriver = new ConflictOnceDriver(new SQLiteGraphDurabilityDriver(databasePath));
    const conflictStore = new DurableGraphStore(conflictDriver, { maxCommitAttempts: 3, clock: () => 3_000 });
    const third = await conflictStore.commit({
      graphId: 'enterprise',
      expectedRevision: 2,
      idempotencyKey: 'enterprise-3',
      operationId: 'durable-op-3',
      recordedAt: 3_000,
      mutations: [{ type: 'metadata.merge', metadata: { authority: 'durable' } }],
    });
    assert.equal(third.revision, 3);
    assert.equal((await conflictStore.snapshot('enterprise')).eventCount, 3);
    await conflictStore.close();

    // Persisted bytes are not trusted merely because the driver is typed.
    const validDriver = new SQLiteGraphDurabilityDriver(databasePath);
    const tamperedStore = new DurableGraphStore(new TamperedReadDriver(validDriver));
    await expectDurabilityError(() => tamperedStore.get('enterprise'), 'DURABILITY_IMAGE_INVALID');
    validDriver.close();

    // A driver that can never win CAS is rejected after a bounded retry loop.
    const exhaustedStore = new DurableGraphStore(new AlwaysConflictDriver(), { maxCommitAttempts: 2, clock: () => 4_000 });
    await expectDurabilityError(
      () => exhaustedStore.commit({
        graphId: 'never-commits',
        expectedRevision: 0,
        idempotencyKey: 'never-1',
        recordedAt: 4_000,
        mutations: [{ type: 'node.put', node: { id: 'a' } }],
      }),
      'DURABILITY_CAS_RETRY_EXHAUSTED',
    );

    console.log('COS Graph Framework M2A: durable SQLite state suite passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
