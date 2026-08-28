import assert from 'node:assert/strict';
import type { EntityId, GraphEdge, GraphNode } from '../packages/core/src';
import { PropertyGraph } from '../packages/knowledge/src/property-graph';

const T0 = '2026-08-28T10:00:00.000Z';

async function main(): Promise<void> {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const graph = new PropertyGraph();
  const a = node('A', 'service', ['alpha'], { tier: 1 });
  const b = node('B', 'service', ['beta'], { tier: 2 });
  const c = node('C', 'database', ['gamma'], { tier: 3 });
  await graph.addNode(a);
  await graph.addNode(b);
  await graph.addNode(c);

  // Write inputs are detached.
  a.label = 'mutated-input';
  a.tags.push('poison');
  a.properties.tier = 999;
  const storedA = await graph.getNode(id('A'));
  check(storedA?.label === 'A', 'node input mutation cannot alter canonical graph');
  check(!storedA?.tags.includes('poison'), 'node input tag mutation cannot alter canonical graph');
  check(storedA?.properties.tier === 1, 'node input property mutation cannot alter canonical graph');

  // Reads are detached recursively.
  const leakedA = (await graph.getNode(id('A')))!;
  leakedA.label = 'leaked';
  leakedA.tags.push('leaked-tag');
  leakedA.properties.tier = 444;
  const rereadA = (await graph.getNode(id('A')))!;
  check(rereadA.label === 'A', 'getNode returns detached object');
  check(!rereadA.tags.includes('leaked-tag'), 'getNode tags are detached');
  check(rereadA.properties.tier === 1, 'getNode properties are detached');

  // Node update reindexes type + tags and detaches update arrays.
  const replacementTags = ['migrated'];
  await graph.updateNode(id('A'), { type: 'database', tags: replacementTags });
  replacementTags.push('post-update-mutation');
  check((await graph.queryNodes({ type: 'service' })).every(item => item.id !== id('A')), 'old node type index is removed');
  check((await graph.queryNodes({ type: 'database' })).some(item => item.id === id('A')), 'new node type index is populated');
  check((await graph.queryNodes({ tags: ['alpha'] })).every(item => item.id !== id('A')), 'old tag index is removed');
  check((await graph.queryNodes({ tags: ['migrated'] })).some(item => item.id === id('A')), 'new tag index is populated');
  check(!(await graph.getNode(id('A')))!.tags.includes('post-update-mutation'), 'update tag input is detached');

  const ab = edge('AB', 'A', 'B', true, 'depends_on', 2, 0.9);
  const cb = edge('CB', 'C', 'B', false, 'linked', 1, 0.8);
  await graph.addEdge(ab);
  await graph.addEdge(cb);

  ab.properties.note = 'mutated-input';
  const storedAB = (await graph.getEdge(id('AB')))!;
  check(storedAB.properties.note === 'canonical', 'edge input properties are detached');

  const leakedEdge = (await graph.getEdge(id('AB')))!;
  leakedEdge.target = id('C');
  leakedEdge.properties.note = 'leaked';
  check((await graph.getEdge(id('AB')))!.target === id('B'), 'getEdge cannot retarget canonical edge');
  check((await graph.getEdge(id('AB')))!.properties.note === 'canonical', 'getEdge properties are detached');

  // Directed AB may be traversed A→B but never B→A.
  const fromA = await graph.traverse(id('A'), ['depends_on'], 1);
  check(fromA.length === 1, 'directed outgoing edge is traversable');
  check(fromA[0].nodes.map(item => String(item.id)).join('>') === 'A>B', 'path contains source and destination nodes');
  check(fromA[0].edges.length === 1 && fromA[0].nodes.length === 2, 'path node/edge cardinality is valid');
  check(fromA[0].totalCost === 2 && fromA[0].totalConfidence === 0.9, 'path aggregates edge cost/confidence');
  check((await graph.traverse(id('B'), ['depends_on'], 1)).length === 0, 'directed incoming edge is not traversed backwards');

  // Undirected CB can be traversed from either endpoint.
  const undirectedFromB = await graph.traverse(id('B'), ['linked'], 1);
  check(undirectedFromB.length === 1, 'undirected incoming edge is traversable backwards');
  check(undirectedFromB[0].nodes.map(item => String(item.id)).join('>') === 'B>C', 'undirected reverse path is structurally complete');

  // Exact depth semantics.
  const zero = await graph.traverse(id('A'), ['depends_on'], 0);
  check(zero.length === 1 && zero[0].nodes.length === 1 && zero[0].edges.length === 0, 'depth=0 returns only origin');
  check(zero[0].totalCost === 0 && zero[0].totalConfidence === 1, 'depth=0 aggregate is neutral');
  await assert.rejects(() => graph.traverse(id('A'), ['depends_on'], 1.5), /non-negative safe integer/);
  assertions += 1;
  await assert.rejects(() => graph.traverse(id('A'), ['depends_on'], -1), /non-negative safe integer/);
  assertions += 1;

  // Retarget edge B→C and change type: old adjacency/type indices must disappear.
  await graph.updateEdge(id('AB'), { source: id('B'), target: id('C'), type: 'feeds' });
  check((await graph.queryEdges({ type: 'depends_on' })).every(item => item.id !== id('AB')), 'old edge type index removed');
  check((await graph.queryEdges({ type: 'feeds' })).some(item => item.id === id('AB')), 'new edge type index populated');
  check((await graph.traverse(id('A'), ['depends_on', 'feeds'], 2)).length === 0, 'old source adjacency no longer references retargeted edge');
  const fromBFeed = await graph.traverse(id('B'), ['feeds'], 1);
  check(fromBFeed.length === 1 && fromBFeed[0].nodes[1].id === id('C'), 'new source/target adjacency is coherent');

  await assert.rejects(
    () => graph.updateEdge(id('AB'), { target: id('MISSING') }),
    /Target node MISSING not found/,
  );
  assertions += 1;
  check((await graph.getEdge(id('AB')))!.target === id('C'), 'failed retarget leaves canonical edge unchanged');

  // Query results are detached and offset/property semantics are explicit.
  const dbTier3 = await graph.queryNodes({ type: 'database', properties: { tier: 3 }, offset: 0, limit: 1 });
  check(dbTier3.length === 1 && dbTier3[0].id === id('C'), 'query property/offset/limit filters are coherent');
  dbTier3[0].label = 'query-leak';
  check((await graph.getNode(id('C')))!.label === 'C', 'query result cannot mutate canonical node');

  const pathLeak = (await graph.traverse(id('B'), ['feeds'], 1))[0];
  pathLeak.nodes[1].label = 'path-leak';
  pathLeak.edges[0].type = 'path-leak';
  check((await graph.getNode(id('C')))!.label === 'C', 'traversal nodes are detached');
  check((await graph.getEdge(id('AB')))!.type === 'feeds', 'traversal edges are detached');

  console.log(`Authority PropertyGraph contract: ${assertions} assertions passed`);
}

function id(value: string): EntityId {
  return value as EntityId;
}

function node(
  value: string,
  type: string,
  tags: string[],
  properties: Record<string, string | number | boolean | null>,
): GraphNode {
  return {
    id: id(value),
    type,
    label: value,
    representations: {},
    properties,
    tags,
    state: 'active',
    createdAt: T0,
    updatedAt: T0,
    version: { major: 1, minor: 0, patch: 0 },
  };
}

function edge(
  edgeId: string,
  source: string,
  target: string,
  directed: boolean,
  type: string,
  weight: number,
  confidence: number,
): GraphEdge {
  return {
    id: id(edgeId),
    source: id(source),
    target: id(target),
    type,
    label: type,
    weight,
    properties: { note: 'canonical' },
    directed,
    confidence,
    createdAt: T0,
    updatedAt: T0,
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
