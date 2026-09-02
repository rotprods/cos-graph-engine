import assert from 'node:assert/strict';
import {
  CSRAdapterError,
  GraphFrameworkError,
  createCSRFrameworkModule,
  createGraphDocument,
  createGraphRuntime,
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
  const csr = createCSRFrameworkModule();
  const report = inspectGraphModule(csr.module);
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.deepEqual(
    csr.module.manifest.capabilities.map((capability) => capability.id),
    ['cos.graph.csr.bfs', 'cos.graph.csr.stats'],
  );
  assert.equal(csr.bfs.descriptor.sideEffects, 'none');
  assert.equal(csr.stats.descriptor.sideEffects, 'none');

  const runtime = createGraphRuntime();
  await runtime.install(csr.module);

  const route = createGraphDocument({
    graphId: 'route',
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c', directed: false },
    ],
  });

  const traversal = await runtime.invoke(csr.bfs, { graph: route, source: 'a' }, { mode: 'stream' });
  assert.deepEqual(traversal.value.visits.map((visit) => visit.id), ['a', 'b', 'c']);
  assert.deepEqual(traversal.value.visits.map((visit) => visit.depth), [0, 1, 2]);
  assert.equal(traversal.value.nodeCount, 3);
  assert.equal(traversal.value.canonicalEdgeCount, 2);
  assert.equal(traversal.value.projectedEdgeCount, 3);
  assert.equal(traversal.receipt.capabilityId, 'cos.graph.csr.bfs');
  assert.equal(traversal.receipt.sideEffects, 'none');

  const bounded = await runtime.invoke(csr.bfs, { graph: route, source: 'a', maxDepth: 1 }, { mode: 'stream' });
  assert.deepEqual(bounded.value.visits.map((visit) => visit.id), ['a', 'b']);

  const stats = await runtime.invoke(csr.stats, { graph: route }, { mode: 'stats' });
  assert.equal(stats.value.nodeCount, 3);
  assert.equal(stats.value.canonicalEdgeCount, 2);
  assert.equal(stats.value.projectedEdgeCount, 3);
  assert.equal(stats.value.undirectedEdgeCount, 1);

  const dynamic = await runtime.invokeById('cos.graph.csr.stats', { graph: route }, { mode: 'stats' });
  const dynamicStats = dynamic.value as { readonly projectedEdgeCount: number };
  assert.equal(dynamicStats.projectedEdgeCount, 3);

  await expectFrameworkError(
    () => runtime.invoke(csr.bfs, { graph: route, source: 'a' }, { mode: 'write' }),
    'EXECUTION_MODE_UNSUPPORTED',
  );

  const parallel = createGraphDocument({
    graphId: 'parallel',
    nodes: [{ id: 'a' }, { id: 'b' }],
    edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', identityKey: 'second', source: 'a', target: 'b' },
    ],
  });
  const lossy = await expectFrameworkError(
    () => runtime.invoke(csr.stats, { graph: parallel }, { mode: 'stats' }),
    'CAPABILITY_EXECUTION_FAILED',
  );
  assert.ok(lossy.cause instanceof CSRAdapterError);
  assert.equal(lossy.cause.code, 'CSR_PARALLEL_EDGE_UNSUPPORTED');
  assert.equal((lossy.cause.details.source), 'a');
  assert.equal((lossy.cause.details.target), 'b');

  const reverseCollision = createGraphDocument({
    graphId: 'reverse-collision',
    nodes: [{ id: 'a' }, { id: 'b' }],
    edges: [
      { id: 'undirected', source: 'a', target: 'b', directed: false },
      { id: 'explicit-reverse', source: 'b', target: 'a' },
    ],
  });
  const reverseLoss = await expectFrameworkError(
    () => runtime.invoke(csr.stats, { graph: reverseCollision }, { mode: 'stats' }),
    'CAPABILITY_EXECUTION_FAILED',
  );
  assert.ok(reverseLoss.cause instanceof CSRAdapterError);
  assert.equal(reverseLoss.cause.code, 'CSR_PARALLEL_EDGE_UNSUPPORTED');

  const selfLoop = createGraphDocument({
    graphId: 'self-loop',
    nodes: [{ id: 'a' }],
    edges: [{ id: 'loop', source: 'a', target: 'a', directed: false }],
  });
  const selfStats = await runtime.invoke(csr.stats, { graph: selfLoop }, { mode: 'stats' });
  assert.equal(selfStats.value.canonicalEdgeCount, 1);
  assert.equal(selfStats.value.projectedEdgeCount, 1);
  assert.equal(selfStats.value.undirectedEdgeCount, 1);

  console.log('COS Graph Framework M1C: legacy CSR adapter suite passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
