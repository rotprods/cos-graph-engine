// L1 Mutation API Test — addNode, removeNode, addEdge, removeEdge, duplicate validation

import { ExecutionGraphEngine, ExecNode, ExecEdge } from '../packages/graph/src/level1-execution';
import { EntityId } from '@cos/core';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { p++; console.log(`  ✅ ${msg}`); }
  else { f++; console.log(`  ❌ ${msg}`); }
}

async function main() {
  console.log('🔧 L1 Mutation API Test\n');

  const engine = new ExecutionGraphEngine();

  // ─── TEST 1: Duplicate node ID rejection ───
  try {
    await engine.createGraph('DupTest', [
      { id: 'a' as EntityId, name: 'A', type: 'function', fn: async (i) => i },
      { id: 'a' as EntityId, name: 'A dup', type: 'function', fn: async (i) => i },
    ], []);
    assert(false, 'Duplicate: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('Duplicate'), `Duplicate: throws on duplicate ID (${(e as Error).message})`);
  }

  // ─── TEST 2: Edge referencing nonexistent node ───
  try {
    await engine.createGraph('BadEdge', [
      { id: 'a' as EntityId, name: 'A', type: 'function', fn: async (i) => i },
    ], [{ source: 'a' as EntityId, target: 'nonexistent' as EntityId } as ExecEdge]);
    assert(false, 'BadEdge: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `BadEdge: throws on invalid target (${(e as Error).message})`);
  }

  // ─── TEST 3: addNode ───
  const gid = await engine.createGraph('MutationTest', [], []);
  engine.addNode(gid, { id: 'n1' as EntityId, name: 'Node 1', type: 'function', fn: async (i) => i });
  engine.addNode(gid, { id: 'n2' as EntityId, name: 'Node 2', type: 'function', fn: async (i) => i });
  const graph = engine.getGraph(gid)!;
  assert(graph.nodes.length === 2, 'addNode: graph has 2 nodes');
  assert(graph.nodes.some(n => n.id === 'n1'), 'addNode: n1 present');
  assert(graph.nodes.some(n => n.id === 'n2'), 'addNode: n2 present');

  // ─── TEST 4: addNode duplicate rejection ───
  try {
    engine.addNode(gid, { id: 'n1' as EntityId, name: 'Node 1 dup', type: 'function', fn: async (i) => i });
    assert(false, 'addDup: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('already exists'), `addDup: throws on duplicate (${(e as Error).message})`);
  }

  // ─── TEST 5: addEdge ───
  engine.addEdge(gid, { source: 'n1' as EntityId, target: 'n2' as EntityId } as ExecEdge);
  const graph2 = engine.getGraph(gid)!;
  assert(graph2.edges.length === 1, 'addEdge: graph has 1 edge');
  assert(graph2.edges.some(e => e.source === 'n1' && e.target === 'n2'), 'addEdge: n1→n2 present');

  // ─── TEST 6: addEdge with invalid source ───
  try {
    engine.addEdge(gid, { source: 'n1' as EntityId, target: 'ghost' as EntityId } as ExecEdge);
    assert(false, 'addEdgeBad: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `addEdgeBad: throws on invalid target (${(e as Error).message})`);
  }

  // ─── TEST 7: removeEdge by id ───
  const edgeId = graph2.edges[0].id;
  engine.removeEdge(gid, edgeId);
  assert(engine.getGraph(gid)!.edges.length === 0, 'removeEdge: edge removed');
  assert(engine.getGraph(gid)!.nodes.length === 2, 'removeEdge: nodes preserved');

  // ─── TEST 8: removeEdge nonexistent ───
  try {
    engine.removeEdge(gid, 'nonexistent' as EntityId);
    assert(false, 'removeEdgeBad: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `removeEdgeBad: throws (${(e as Error).message})`);
  }

  // ─── TEST 9: removeNode ───
  engine.removeNode(gid, 'n1' as EntityId);
  const graph3 = engine.getGraph(gid)!;
  assert(graph3.nodes.length === 1, 'removeNode: 1 node remains');
  assert(graph3.nodes[0].id === 'n2', 'removeNode: n2 preserved');
  assert(graph3.edges.length === 0, 'removeNode: connected edges also removed');

  // ─── TEST 10: removeNode nonexistent ───
  try {
    engine.removeNode(gid, 'ghost' as EntityId);
    assert(false, 'removeNodeBad: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `removeNodeBad: throws (${(e as Error).message})`);
  }

  // ─── TEST 11: addEdge auto-generates edge id ───
  engine.addNode(gid, { id: 'n3' as EntityId, name: 'Node 3', type: 'function', fn: async (i) => i });
  engine.addEdge(gid, { source: 'n2' as EntityId, target: 'n3' as EntityId } as ExecEdge);
  const graph4 = engine.getGraph(gid)!;
  assert(graph4.edges[0].id !== undefined, 'addEdge: auto-generates edge id');

  // ─── TEST 12: Full mutation + execution ───
  const freshId = await engine.createGraph('Fresh', [], []);
  engine.addNode(freshId, { id: 'a' as EntityId, name: 'A', type: 'function', fn: async (i) => ({ ...i as any, done: true }) });
  engine.addNode(freshId, { id: 'b' as EntityId, name: 'B', type: 'function', fn: async (i) => ({ ...i as any, b: true }) });
  engine.addNode(freshId, { id: 'c' as EntityId, name: 'C', type: 'function', fn: async (i) => ({ ...i as any, c: true }) });
  engine.addEdge(freshId, { source: 'a' as EntityId, target: 'b' as EntityId } as ExecEdge);
  engine.addEdge(freshId, { source: 'b' as EntityId, target: 'c' as EntityId } as ExecEdge);
  const results = await engine.executeGraph(freshId, { seed: 42 });
  assert(results.size === 3, 'Exec: all 3 nodes executed');
  assert(Array.from(results.values()).every(r => r.status === 'completed'), 'Exec: all completed');
  assert((results.get('c' as EntityId)?.output as any)?.c, 'Exec: data flows through mutated edges');

  // ─── TEST 13: Remove graph not found ───
  try {
    engine.removeNode('nonexistent' as EntityId, 'x' as EntityId);
    assert(false, 'removeNodeMissing: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `removeNodeMissing: throws (${(e as Error).message})`);
  }

  try {
    engine.addEdge('nonexistent' as EntityId, { source: 'a' as EntityId, target: 'b' as EntityId } as ExecEdge);
    assert(false, 'addEdgeMissing: should have thrown');
  } catch (e) {
    assert((e as Error).message.includes('not found'), `addEdgeMissing: throws (${(e as Error).message})`);
  }

  console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
  if (f === 0) console.log('\n✅✅✅ L1 MUTATION API VERIFIED');
  process.exit(f > 0 ? 1 : 0);
}
main();
