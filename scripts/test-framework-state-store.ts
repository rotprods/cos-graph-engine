import assert from 'node:assert/strict';
import {
  GraphModelError,
  GraphStateError,
  InMemoryGraphStore,
  canonicalGraphHash,
  createGraphDocument,
  deriveGraphEdgeId,
  graphDocumentHash,
  normalizeGraphProperties,
  parseGraphDocument,
  replayGraphEvents,
} from '../packages/graph/src/framework';

function expectStateError(action: () => unknown, code: GraphStateError['code']): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof GraphStateError);
    assert.equal(error.code, code);
    return true;
  });
}

function expectModelError(action: () => unknown, code: GraphModelError['code']): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof GraphModelError);
    assert.equal(error.code, code);
    return true;
  });
}

function main(): void {
  assert.equal(canonicalGraphHash({ b: 2, a: 1 }), canonicalGraphHash({ a: 1, b: 2 }));

  const protoData = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(protoData, '__proto__', { value: 'canonical-data', enumerable: true });
  const normalizedProto = normalizeGraphProperties(protoData);
  assert.equal(normalizedProto.__proto__, 'canonical-data');
  assert.equal(Object.getPrototypeOf(normalizedProto), null);

  assert.equal(
    deriveGraphEdgeId({ source: 'a', target: 'b', properties: { changed: false } }),
    deriveGraphEdgeId({ source: 'a', target: 'b', properties: { changed: true } }),
  );
  assert.notEqual(
    deriveGraphEdgeId({ source: 'a', target: 'b', identityKey: 'one' }),
    deriveGraphEdgeId({ source: 'a', target: 'b', identityKey: 'two' }),
  );

  const orderedA = createGraphDocument({
    graphId: 'canonical',
    nodes: [{ id: 'z' }, { id: 'a' }],
    edges: [{ source: 'a', target: 'z', type: 'depends' }],
    metadata: { b: 2, a: 1 },
  });
  const orderedB = createGraphDocument({
    graphId: 'canonical',
    nodes: [{ id: 'a' }, { id: 'z' }],
    edges: [{ source: 'a', target: 'z', type: 'depends' }],
    metadata: { a: 1, b: 2 },
  });
  assert.equal(graphDocumentHash(orderedA), graphDocumentHash(orderedB));
  assert.deepEqual(orderedA.nodes.map((node) => node.id), ['a', 'z']);

  expectModelError(
    () => parseGraphDocument({ schema: 'cos.graph/document/v1alpha1', graphId: 123, revision: 0, nodes: [], edges: [] }),
    'INVALID_GRAPH_ID',
  );
  expectModelError(
    () => createGraphDocument({ graphId: 'bad', nodes: [{ id: 'a' }], edges: [{ source: 'a', target: 'missing' }] }),
    'DANGLING_EDGE',
  );

  const store = new InMemoryGraphStore({ clock: () => 100 });
  const first = store.commit({
    graphId: 'fleet',
    expectedRevision: 0,
    idempotencyKey: 'create-fleet',
    operationId: 'op-1',
    recordedAt: 100,
    mutations: [
      { type: 'node.put', node: { id: 'tesla', type: 'company', properties: { sector: 'auto' } } },
      { type: 'node.put', node: { id: 'spacex', type: 'company', properties: { sector: 'space' } } },
      { type: 'edge.put', edge: { source: 'tesla', target: 'spacex', type: 'shares_decision_context' } },
    ],
  });
  assert.equal(first.revision, 1);
  assert.equal(first.idempotentReplay, false);
  assert.equal(store.get('fleet').nodes.length, 2);
  assert.equal(store.get('fleet').edges.length, 1);
  assert.equal(store.events('fleet').length, 1);
  assert.equal(first.stateHash, graphDocumentHash(store.get('fleet')));
  assert.ok(Object.isFrozen(store.get('fleet')));
  assert.ok(Object.isFrozen(store.get('fleet').nodes));

  const retry = store.commit({
    graphId: 'fleet',
    expectedRevision: 0,
    idempotencyKey: 'create-fleet',
    operationId: 'retry-operation-can-differ',
    recordedAt: 999,
    mutations: [
      { type: 'node.put', node: { id: 'tesla', type: 'company', properties: { sector: 'auto' } } },
      { type: 'node.put', node: { id: 'spacex', type: 'company', properties: { sector: 'space' } } },
      { type: 'edge.put', edge: { source: 'tesla', target: 'spacex', type: 'shares_decision_context' } },
    ],
  });
  assert.equal(retry.idempotentReplay, true);
  assert.equal(retry.eventId, first.eventId);
  assert.equal(store.events('fleet').length, 1);

  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 1, idempotencyKey: 'create-fleet', recordedAt: 101, mutations: [{ type: 'node.put', node: { id: 'x' } }] }),
    'IDEMPOTENCY_CONFLICT',
  );
  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 0, idempotencyKey: 'stale-writer', recordedAt: 101, mutations: [{ type: 'node.put', node: { id: 'x' } }] }),
    'REVISION_CONFLICT',
  );

  const beforeDangling = store.snapshot('fleet');
  assert.throws(() => store.commit({ graphId: 'fleet', expectedRevision: 1, idempotencyKey: 'dangling', recordedAt: 101, mutations: [{ type: 'edge.put', edge: { source: 'tesla', target: 'missing' } }] }));
  assert.equal(store.snapshot('fleet').stateHash, beforeDangling.stateHash);
  assert.equal(store.events('fleet').length, 1);

  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 1, idempotencyKey: 'remove-missing-edge', recordedAt: 101, mutations: [{ type: 'edge.remove', edgeId: 'missing' }] }),
    'EDGE_NOT_FOUND',
  );
  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 1, idempotencyKey: 'remove-with-edge', recordedAt: 101, mutations: [{ type: 'node.remove', nodeId: 'tesla' }] }),
    'NODE_HAS_EDGES',
  );

  const second = store.commit({ graphId: 'fleet', expectedRevision: 1, idempotencyKey: 'remove-cascade', operationId: 'op-2', recordedAt: 101, mutations: [{ type: 'node.remove', nodeId: 'tesla', cascade: true }] });
  assert.equal(second.revision, 2);
  assert.equal(store.get('fleet').nodes.length, 1);
  assert.equal(store.get('fleet').edges.length, 0);
  assert.equal(store.events('fleet').length, 2);

  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 2, idempotencyKey: 'remove-missing-node', recordedAt: 102, mutations: [{ type: 'node.remove', nodeId: 'tesla' }] }),
    'NODE_NOT_FOUND',
  );

  const verified = store.verify('fleet');
  assert.equal(verified.stateHash, store.snapshot('fleet').stateHash);
  assert.equal(verified.eventCount, 2);

  const originalEvents = store.events('fleet');
  const tamperedRequest = [{ ...originalEvents[0], requestHash: '0'.repeat(64) }, originalEvents[1]];
  expectStateError(() => replayGraphEvents('fleet', tamperedRequest), 'EVENT_HASH_INVALID');
  const tamperedChain = [originalEvents[0], { ...originalEvents[1], previousEventHash: 'f'.repeat(64) }];
  expectStateError(() => replayGraphEvents('fleet', tamperedChain), 'EVENT_CHAIN_INVALID');

  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 2, idempotencyKey: 'time-regression', recordedAt: 99, mutations: [{ type: 'node.put', node: { id: 'boring' } }] }),
    'EVENT_TIME_REGRESSION',
  );
  expectStateError(
    () => store.commit({ graphId: 'fleet', expectedRevision: 2, idempotencyKey: '', recordedAt: 102, mutations: [{ type: 'node.put', node: { id: 'boring' } }] }),
    'INVALID_TRANSACTION',
  );

  console.log('COS Graph Framework M1A: canonical graph state store suite passed');
}

main();
