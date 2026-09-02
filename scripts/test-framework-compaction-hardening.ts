import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
  COS_GRAPH_SNAPSHOT_VERSION,
  DurableGraphStore,
  GraphDurabilityError,
  GraphPersistedIdempotencyRecord,
  SQLiteGraphDurabilityDriver,
  canonicalGraphHash,
  createGraphDocument,
  graphDocumentHash,
  graphIdempotencyHash,
  parseGraphPersistenceImage,
} from '../packages/graph/src/framework';

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectInvalidImage(action: () => unknown): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof GraphDurabilityError);
    assert.equal(error.code, 'DURABILITY_IMAGE_INVALID');
    return true;
  });
}

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cos-graph-m2d-hardening-'));
  const databasePath = join(directory, 'compaction-hardening.sqlite');

  try {
    const driver = new SQLiteGraphDurabilityDriver(databasePath);
    const store = new DurableGraphStore(driver);
    await store.commit({
      graphId: 'terminal-binding',
      expectedRevision: 0,
      idempotencyKey: 'terminal-1',
      operationId: 'terminal-op-1',
      recordedAt: 1_000,
      mutations: [{ type: 'node.put', node: { id: 'a' } }],
    });
    await store.commit({
      graphId: 'terminal-binding',
      expectedRevision: 1,
      idempotencyKey: 'terminal-2',
      operationId: 'terminal-op-2',
      recordedAt: 2_000,
      mutations: [{ type: 'node.put', node: { id: 'b' } }],
    });
    await store.compact('terminal-binding');

    const raw = await driver.load('terminal-binding');
    assert.ok(raw && typeof raw === 'object' && !Array.isArray(raw));
    const clone = JSON.parse(JSON.stringify(raw)) as unknown;
    const image = asRecord(clone, 'persistence image');
    const idempotencyValue = image.idempotency;
    assert.ok(Array.isArray(idempotencyValue));
    assert.equal(idempotencyValue.length, 2);

    const terminal = asRecord(idempotencyValue[1], 'terminal idempotency record');
    const receipt = asRecord(terminal.receipt, 'terminal receipt');
    receipt.eventHash = 'e'.repeat(64);
    receipt.stateHash = 'd'.repeat(64);

    // Recompute every aggregate digest an attacker/bug might reasonably update.
    // The parser must still reject because the terminal receipt no longer binds
    // the canonical anchor/head snapshot terminal values.
    const idempotency = idempotencyValue as unknown as readonly GraphPersistedIdempotencyRecord[];
    const anchor = asRecord(image.anchor, 'persistence anchor');
    anchor.idempotencyHash = graphIdempotencyHash(idempotency);
    const { anchorHash: _oldAnchorHash, ...anchorPayload } = anchor;
    anchor.anchorHash = canonicalGraphHash(anchorPayload);

    expectInvalidImage(() => parseGraphPersistenceImage(image, 'terminal-binding'));

    // A current persistence authority cannot manufacture a storage revision
    // without any semantic graph event. Real authorities are born on commit 1.
    const emptyGraph = createGraphDocument({ graphId: 'empty-authority' });
    const emptySnapshot = {
      schema: COS_GRAPH_SNAPSHOT_VERSION,
      graph: emptyGraph,
      stateHash: graphDocumentHash(emptyGraph),
      lastEventHash: null,
      eventCount: 0,
    } as const;
    expectInvalidImage(() => parseGraphPersistenceImage({
      schema: COS_GRAPH_PERSISTENCE_IMAGE_VERSION,
      graphId: 'empty-authority',
      storageVersion: 1,
      snapshot: emptySnapshot,
      anchor: null,
      events: [],
      idempotency: [],
    }, 'empty-authority'));

    await store.close();
    console.log('COS Graph Framework M2D: compaction terminal-binding hardening suite passed');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main();
