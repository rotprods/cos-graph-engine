import assert from 'node:assert/strict';
import { BidirectionalCSRGraph } from '../packages/graph/src/bidirectional-csr';

type Node = { id: string; metadata: { label: string } };
type Edge = {
  id?: string;
  source: string;
  target: string;
  type?: string;
  identityKey?: string;
  weight?: number;
  metadata?: { note: string };
};

function main(): void {
  let assertions = 0;
  const check = (condition: unknown, message: string): void => {
    assert.ok(condition, message);
    assertions += 1;
  };

  const graph = new BidirectionalCSRGraph<Node, Edge>();
  const nodeA: Node = { id: 'A', metadata: { label: 'A' } };
  graph.addNode(nodeA);
  graph.addNode({ id: 'B', metadata: { label: 'B' } });
  graph.addNode({ id: 'C', metadata: { label: 'C' } });
  graph.addNode({ id: 'D', metadata: { label: 'D' } });

  nodeA.metadata.label = 'mutated-input';
  check(graph.getNode('A')?.metadata.label === 'A', 'node write input is detached');
  const leakedNode = graph.getNode('A')!;
  leakedNode.metadata.label = 'mutated-read';
  check(graph.getNode('A')?.metadata.label === 'A', 'node read is detached');

  const edgeAB = graph.addEdge('A', 'B', { type: 'depends_on', metadata: { note: 'primary' } });
  const edgeAB2 = graph.addEdge('A', 'B', { type: 'depends_on', identityKey: 'secondary', metadata: { note: 'secondary' } });
  const edgeBC = graph.addEdge('B', 'C', { type: 'depends_on' });
  const edgeCD = graph.addEdge('C', 'D', { type: 'depends_on' });

  check(edgeAB !== edgeAB2, 'identityKey preserves intentional parallel edges');
  check(graph.getEdges('A', 'B', 'depends_on').length === 2, 'parallel edge multiplicity is preserved');
  assert.throws(
    () => graph.addEdge('A', 'B', { type: 'depends_on' }),
    /Use a distinct identityKey/,
  );
  assertions += 1;

  check(graph.neighbors('A').join(',') === 'B', 'neighbor projection deduplicates node while retaining edge multiplicity');
  check(graph.outgoingEdgeIds('A').length === 2, 'forward CSR retains both parallel edge IDs');
  check(graph.reverseNeighbors('B').join(',') === 'A', 'reverse CSR resolves incoming neighbor');
  check(graph.incomingEdgeIds('B').length === 2, 'reverse CSR retains both parallel edge IDs');

  const leakedEdge = graph.getEdgeById(edgeAB)!;
  leakedEdge.metadata!.note = 'mutated-read';
  check(graph.getEdgeById(edgeAB)?.metadata?.note === 'primary', 'edge read is detached');
  const leakedEdges = graph.getEdges('A', 'B');
  leakedEdges[0].metadata = { note: 'mutated-list' };
  check(graph.getEdges('A', 'B').every(edge => edge.metadata?.note !== 'mutated-list'), 'edge query is detached');

  assert.throws(
    () => graph.updateEdge(edgeAB, { target: 'C' }),
    /CSR_DETERMINISTIC_IDENTITY_IMMUTABLE/,
  );
  assertions += 1;
  check(graph.getEdgeById(edgeAB)?.target === 'B', 'failed deterministic retarget leaves edge unchanged');

  graph.updateEdge(edgeAB, { weight: 2, metadata: { note: 'updated' } });
  check(graph.getEdgeById(edgeAB)?.weight === 2, 'non-identity edge fields may be updated');
  check(graph.getEdgeById(edgeAB)?.metadata?.note === 'updated', 'metadata update is committed');

  const explicit = graph.addEdge('D', 'A', {
    id: 'explicit-edge',
    type: 'links',
    identityKey: 'explicit',
  });
  graph.updateEdge(explicit, { source: 'D', target: 'B', type: 'links-v2' });
  check(graph.getEdgeById(explicit)?.target === 'B', 'explicit external edge identity may intentionally retarget');

  const bfs = graph.bfs('A', 3);
  check(bfs.map(entry => `${entry.id}:${entry.depth}`).join(',') === 'A:0,B:1,C:2,D:3', 'BFS uses exact hop depths');
  assert.throws(() => graph.bfs('A', 1.5), /non-negative safe integer/); assertions += 1;
  check(graph.bidirectionalShortestPath('A', 'D', 5)?.join('>') === 'A>B>C>D', 'bidirectional shortest path uses forward+reverse projections');

  const validation = graph.validate();
  check(validation.length === 0, `authority CSR invariants hold: ${validation.join('; ')}`);

  const hash = graph.projectionHash();
  const json = graph.toJSON();
  json.nodes[0].metadata.label = 'mutated-json';
  json.edges[0].weight = 999;
  check(graph.projectionHash() === hash, 'toJSON output is detached from canonical projection');

  const replay = new BidirectionalCSRGraph<Node, Edge>();
  // Deliberately reverse insertion order; canonical hash must be identical.
  for (const node of [...graph.toJSON().nodes].reverse()) replay.addNode(node);
  for (const edge of [...graph.toJSON().edges].reverse()) {
    const { source, target, ...data } = edge;
    replay.addEdge(source, target, data);
  }
  check(replay.projectionHash() === graph.projectionHash(), 'projection hash is insertion-order independent');
  check(replay.validate().length === 0, 'replayed projection invariants hold');

  const second = new BidirectionalCSRGraph<Node, Edge>();
  second.addNode({ id: 'A', metadata: { label: 'A' } });
  second.addNode({ id: 'B', metadata: { label: 'B' } });
  const sameEdgeId = second.addEdge('A', 'B', { type: 'depends_on' });
  check(sameEdgeId === edgeAB, 'default authority edge ID is deterministic across graphs');

  assert.throws(
    () => graph.addNode({ id: 'X', metadata: { label: undefined as unknown as string } }),
    /unsupported canonical type/,
  );
  assertions += 1;
  assert.throws(() => graph.addEdge('A', 'MISSING', { type: 'x' }), /Target node 'MISSING' does not exist/);
  assertions += 1;

  console.log(`Authority CSR contract: ${assertions} assertions passed`);
}

main();
