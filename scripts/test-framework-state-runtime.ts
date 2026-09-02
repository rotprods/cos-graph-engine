import assert from 'node:assert/strict';
import {
  GraphFrameworkError,
  InMemoryGraphStore,
  createGraphRuntime,
  createGraphStateModule,
  graphDocumentHash,
  inspectGraphModule,
} from '../packages/graph/src/framework';

async function expectFrameworkError(
  action: () => Promise<unknown>,
  code: GraphFrameworkError['code'],
): Promise<GraphFrameworkError> {
  let captured: GraphFrameworkError | undefined;
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof GraphFrameworkError);
    assert.equal(error.code, code);
    captured = error;
    return true;
  });
  assert.ok(captured);
  return captured;
}

async function main(): Promise<void> {
  const store = new InMemoryGraphStore();
  const state = createGraphStateModule(store);
  const report = inspectGraphModule(state.module);
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.deepEqual(
    state.module.manifest.capabilities.map((capability) => capability.id),
    ['cos.graph.state.commit', 'cos.graph.state.snapshot', 'cos.graph.state.verify'],
  );

  const noPolicy = createGraphRuntime();
  await noPolicy.install(state.module);
  await expectFrameworkError(
    () => noPolicy.invoke(
      state.commit,
      {
        graphId: 'enterprise',
        expectedRevision: 0,
        mutations: [{ type: 'node.put', node: { id: 'tesla' } }],
      },
      { mode: 'mutate', idempotencyKey: 'enterprise-1' },
    ),
    'EXECUTION_POLICY_REQUIRED',
  );
  assert.equal(store.has('enterprise'), false);

  let now = 1_000;
  const events: string[] = [];
  const runtime = createGraphRuntime({
    clock: () => now++,
    policy: {
      authorize(request) {
        assert.equal(request.moduleId, 'cos.graph.state.memory');
        assert.equal(request.capability.id, 'cos.graph.state.commit');
        assert.equal(request.mode, 'mutate');
        assert.ok(request.idempotencyKey?.startsWith('enterprise-'));
        return true;
      },
    },
    observers: [{ id: 'state-test-observer', observe(event) { events.push(event.type); } }],
  });
  await runtime.install(state.module);

  const input = {
    graphId: 'enterprise',
    expectedRevision: 0,
    mutations: [
      { type: 'node.put' as const, node: { id: 'tesla', type: 'company' } },
      { type: 'node.put' as const, node: { id: 'spacex', type: 'company' } },
      { type: 'edge.put' as const, edge: { source: 'tesla', target: 'spacex', type: 'shares_context' } },
    ],
  };

  const committed = await runtime.invoke(
    state.commit,
    input,
    { mode: 'mutate', idempotencyKey: 'enterprise-1', graph: { id: 'enterprise', revision: '0' } },
  );
  assert.equal(committed.value.revision, 1);
  assert.equal(committed.value.idempotentReplay, false);
  assert.equal(committed.value.stateHash, graphDocumentHash(store.get('enterprise')));
  assert.equal(committed.receipt.capabilityId, 'cos.graph.state.commit');
  assert.equal(committed.receipt.sideEffects, 'graph');
  assert.equal(committed.receipt.graph?.id, 'enterprise');
  assert.deepEqual(events, ['execution.started', 'execution.succeeded']);

  const retried = await runtime.invoke(
    state.commit,
    input,
    { mode: 'mutate', idempotencyKey: 'enterprise-1', graph: { id: 'enterprise', revision: '0' } },
  );
  assert.equal(retried.value.idempotentReplay, true);
  assert.equal(retried.value.eventId, committed.value.eventId);
  assert.equal(store.events('enterprise').length, 1);

  const snapshot = await runtime.invoke(
    state.snapshot,
    { graphId: 'enterprise' },
    { mode: 'stream', graph: { id: 'enterprise', revision: '1' } },
  );
  assert.equal(snapshot.value.graph.revision, 1);
  assert.equal(snapshot.value.stateHash, committed.value.stateHash);
  assert.equal(snapshot.value.eventCount, 1);

  const verified = await runtime.invoke(state.verify, { graphId: 'enterprise' }, { mode: 'stats' });
  assert.equal(verified.value.stateHash, snapshot.value.stateHash);
  assert.equal(verified.value.eventCount, 1);
  assert.equal(verified.value.lastEventHash, committed.value.eventHash);

  const dynamic = await runtime.invokeById(
    'cos.graph.state.snapshot',
    { graphId: 'enterprise' },
    { mode: 'stream' },
  );
  const dynamicValue = dynamic.value as { readonly graph: { readonly graphId: string } };
  assert.equal(dynamicValue.graph.graphId, 'enterprise');

  const mismatch = await expectFrameworkError(
    () => runtime.invoke(
      state.commit,
      {
        graphId: 'enterprise',
        expectedRevision: 1,
        mutations: [{ type: 'node.put', node: { id: 'x' } }],
      },
      { mode: 'mutate', idempotencyKey: 'enterprise-2', graph: { id: 'different', revision: '1' } },
    ),
    'CAPABILITY_EXECUTION_FAILED',
  );
  assert.ok(mismatch.cause instanceof TypeError);
  assert.equal(store.get('enterprise').revision, 1);

  const badRevision = await expectFrameworkError(
    () => runtime.invoke(
      state.commit,
      {
        graphId: 'enterprise',
        expectedRevision: 1,
        mutations: [{ type: 'node.put', node: { id: 'x' } }],
      },
      { mode: 'mutate', idempotencyKey: 'enterprise-3', graph: { id: 'enterprise', revision: '999' } },
    ),
    'CAPABILITY_EXECUTION_FAILED',
  );
  assert.ok(badRevision.cause instanceof TypeError);
  assert.equal(store.events('enterprise').length, 1);

  console.log('COS Graph Framework M1B: GraphRuntime state module suite passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
