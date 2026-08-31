// T-6.6: 40+ Tests for L8-L11
// Knowledge (addEntity/addRelation), Semantic (addNode/addEdge/similarity/lca)
// Embedding (addNode/buildKNN/cluster), GraphRAG (addChunk/addEntity/retrieve)

import { KnowledgeGraphEngine } from '../packages/graph/src/level8-knowledge';
import { SemanticGraph } from '../packages/graph/src/level9-semantic';
import { EmbeddingGraph } from '../packages/graph/src/level10-embedding';
import { GraphRAGEngine } from '../packages/graph/src/level11-graphrag';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

// ========== L8: KNOWLEDGE GRAPH ==========
(function testL8() {
  const kg = new KnowledgeGraphEngine();

  assert(kg.entities.length === 0, 'L8: Empty has 0 entities');
  assert(kg.relations.length === 0, 'L8: Empty has 0 relations');

  kg.addEntity({ id: 'einstein', name: 'Einstein', type: 'person', description: 'Physicist', aliases: ['Albert'] });
  kg.addEntity({ id: 'relativity', name: 'Relativity', type: 'concept', description: 'Theory' });
  kg.addEntity({ id: 'physics', name: 'Physics', type: 'concept', description: 'Science' });
  assert(kg.entities.length === 3, 'L8: addEntity adds entities');

  try { kg.addEntity({ id: 'einstein', name: 'Dup', type: 'concept' }); assert(false, 'L8: Should reject duplicate'); }
  catch (e) { assert(true, 'L8: Rejects duplicate entity'); }

  kg.addRelation({ id: 'r1', source: 'einstein', target: 'relativity', type: 'created', confidence: 0.9 });
  kg.addRelation({ id: 'r2', source: 'relativity', target: 'physics', type: 'part_of', confidence: 0.8 });
  assert(kg.relations.length === 2, 'L8: addRelation adds relations');

  try { kg.addRelation({ id: 'r3', source: 'nonexistent', target: 'physics', type: 'related_to' }); assert(false, 'L8: Should reject dangling'); }
  catch (e) { assert(true, 'L8: Rejects dangling relation source'); }

  kg.addEntity({ id: 'tmp', name: 'Temp', type: 'concept' });
  kg.removeEntity('tmp');
  assert(kg.entities.length === 3, 'L8: removeEntity removes entity');

  kg.removeRelation('r1');
  assert(kg.relations.length === 1, 'L8: removeRelation removes relation');
  kg.addRelation({ id: 'r1', source: 'einstein', target: 'relativity', type: 'created', confidence: 0.9 });

  const ent = kg.getEntity('einstein');
  assert(ent !== undefined, 'L8: getEntity returns entity');
  assert(ent!.name === 'Einstein', 'L8: getEntity correct name');

  const rels = kg.getRelations('einstein');
  assert(rels.length >= 1, 'L8: getRelations returns relations');
  const rel = kg.getRelation('r1');
  assert(rel !== undefined, 'L8: getRelation returns relation');

  const kg2 = new KnowledgeGraphEngine();
  kg2.buildAIEcosystem();
  assert(kg2.entities.length === 6, 'L8: AI ecosystem has documented 6 entities');
  assert(kg2.relations.length === 5, 'L8: AI ecosystem has documented 5 relations');

  const kg3 = new KnowledgeGraphEngine();
  kg3.buildCOS();
  assert(kg3.entities.length === 6, 'L8: COS has documented 6 entities');
  assert(kg3.relations.length === 5, 'L8: COS has 5 component relations');

  const sparql = kg.sparql({ select: ['*'], where: [{ subject: 'einstein', predicate: 'created', object: 'relativity' }] });
  assert(Array.isArray(sparql), 'L8: SPARQL query returns bindings array');
  assert(kg.validate().length === 0, 'L8: Valid graph validates');

  const mt = kg.metrics();
  assert(mt.nodeCount === 3, 'L8: Metrics node count');
  assert(mt.edgeCount === 2, 'L8: Metrics edge count');

  const saved = kg.toJSON();
  assert(saved.entities.length === 3, 'L8: toJSON preserves entities');
  const restored = KnowledgeGraphEngine.fromJSON(saved);
  assert(restored.entities.length === 3, 'L8: fromJSON restores entities');
  assert(kg.toMermaid().includes('graph'), 'L8: Mermaid output');

  console.log(`  L8: 20+ tests`);
})();

// ========== L9: SEMANTIC GRAPH ==========
(function testL9() {
  const sg = new SemanticGraph();
  assert(sg.nodes.length === 0, 'L9: Empty has 0 nodes');

  sg.addNode({ id: 'dog', concept: 'Dog', type: 'entity' });
  sg.addNode({ id: 'cat', concept: 'Cat', type: 'entity' });
  sg.addNode({ id: 'car', concept: 'Car', type: 'entity' });
  sg.addNode({ id: 'mammal', concept: 'Mammal', type: 'class' });
  assert(sg.nodes.length === 4, 'L9: addNode adds nodes');

  sg.addEdge({ id: 'e1', source: 'dog', target: 'mammal', relation: 'is_a', strength: 1.0 });
  sg.addEdge({ id: 'e2', source: 'cat', target: 'mammal', relation: 'is_a', strength: 1.0 });
  sg.addEdge({ id: 'e3', source: 'car', target: 'cat', relation: 'related_to', strength: 0.1 });
  assert(sg.edges.length === 3, 'L9: addEdge adds edges');

  sg.addNode({ id: 'tmp', concept: 'Temp', type: 'entity' });
  sg.removeNode('tmp');
  assert(sg.nodes.length === 4, 'L9: removeNode removes node');

  sg.removeEdge('e3');
  assert(sg.edges.length === 2, 'L9: removeEdge removes edge');
  sg.addEdge({ id: 'e3', source: 'car', target: 'cat', relation: 'related_to', strength: 0.1 });

  assert(sg.getNode('dog') !== undefined, 'L9: getNode returns node');
  assert(sg.getEdge('e1') !== undefined, 'L9: getEdge returns edge');

  const similarity = sg.similarity('dog', 'cat');
  assert(similarity > 0 && similarity <= 1, 'L9: sibling semantic similarity is bounded and positive');
  assert(sg.similarity('dog', 'dog') === 1, 'L9: identity similarity is 1');
  assert(sg.similarity('dog', 'car') === 0, 'L9: unrelated taxonomy nodes have 0 similarity');
  assert(sg.lca('dog', 'cat')?.id === 'mammal', 'L9: LCA of dog and cat is mammal');

  const sg2 = new SemanticGraph();
  sg2.buildAnimalTaxonomy();
  assert(sg2.nodes.length === 6, 'L9: Animal taxonomy has documented 6 nodes');
  assert(sg2.lca('dog', 'cat')?.id === 'mammal', 'L9: Built taxonomy LCA is mammal');
  assert(sg2.similarity('dog', 'eagle') > 0, 'L9: Built taxonomy relates nodes through animal ancestor');

  assert(sg.validate().length === 0, 'L9: Valid graph validates');
  const mt = sg.metrics();
  assert(mt.nodeCount === 4, 'L9: Metrics node count');
  assert(mt.edgeCount === 3, 'L9: Metrics edge count');

  const saved = sg.toJSON();
  assert(saved.nodes.length === 4, 'L9: toJSON preserves nodes');
  const restored = SemanticGraph.fromJSON(saved);
  assert(restored.nodes.length === 4, 'L9: fromJSON restores nodes');
  assert(restored.lca('dog', 'cat')?.id === 'mammal', 'L9: fromJSON rebuilds taxonomy traversal');
  assert(sg.toMermaid().includes('graph'), 'L9: Mermaid output');

  console.log('  L9: 18+ tests');
})();

// ========== L10: EMBEDDING GRAPH ==========
(function testL10() {
  const eg = new EmbeddingGraph();
  assert(eg.nodes.length === 0, 'L10: Empty has 0 nodes');

  // Canonical EmbeddingNode contract: id, label, vector.
  eg.addNode({ id: 'doc1', label: 'Document A', vector: [0.5, 0.2, 0.8], metadata: { type: 'doc' } });
  eg.addNode({ id: 'doc2', label: 'Document B', vector: [0.55, 0.25, 0.85], metadata: { type: 'doc' } });
  eg.addNode({ id: 'img1', label: 'Image', vector: [0.1, 0.9, 0.3], metadata: { type: 'image' } });
  eg.addNode({ id: 'doc3', label: 'Document C', vector: [0.52, 0.22, 0.82], metadata: { type: 'doc' } });
  assert(eg.nodes.length === 4, 'L10: addNode adds nodes');

  try { eg.addNode({ id: 'doc1', label: 'Dup', vector: [0, 0, 0], metadata: {} }); assert(false, 'L10: Should reject'); }
  catch (e) { assert(true, 'L10: Rejects duplicate'); }

  const d12 = EmbeddingGraph.distance([0.5, 0.2, 0.8], [0.55, 0.25, 0.85]);
  const d23 = EmbeddingGraph.distance([0.55, 0.25, 0.85], [0.52, 0.22, 0.82]);
  eg.addEdge({ id: 'e1', source: 'doc1', target: 'doc2', similarity: 1 / (1 + d12), distance: d12 });
  eg.addEdge({ id: 'e2', source: 'doc2', target: 'doc3', similarity: 1 / (1 + d23), distance: d23 });
  assert(eg.edges.length === 2, 'L10: addEdge adds edges');

  eg.addNode({ id: 'tmp', label: 'Tmp', vector: [0], metadata: {} });
  eg.removeNode('tmp');
  assert(eg.nodes.length === 4, 'L10: removeNode removes node');

  eg.removeEdge('e2');
  assert(eg.edges.length === 1, 'L10: removeEdge removes edge');
  eg.addEdge({ id: 'e2', source: 'doc2', target: 'doc3', similarity: 1 / (1 + d23), distance: d23 });

  assert(eg.getNode('doc1') !== undefined, 'L10: getNode returns node');
  assert(EmbeddingGraph.cosine([1, 0], [1, 0]) === 1, 'L10: cosine identity is 1');
  assert(EmbeddingGraph.distance([1, 2], [1, 2]) === 0, 'L10: identical vector distance is 0');

  eg.buildKNN(2);
  assert(eg.edges.length >= 2, 'L10: buildKNN creates edges');
  assert(eg.edges.every(edge => Number.isFinite(edge.distance)), 'L10: KNN distances are finite');

  const clusters = eg.cluster(3, 7);
  assert(clusters.size >= 1, 'L10: cluster returns groups');

  const eg2 = new EmbeddingGraph();
  eg2.buildAIModelGraph();
  assert(eg2.nodes.length === 6, 'L10: AI model graph has documented 6 nodes');
  assert(eg2.edges.length > 0, 'L10: AI model graph builds KNN edges');

  assert(eg.validate().length === 0, 'L10: Valid graph validates');
  const mt = eg.metrics();
  assert(mt.nodeCount === 4, 'L10: Metrics node count');
  assert(mt.edgeCount >= 2, 'L10: Metrics edge count');

  const saved = eg.toJSON();
  assert(saved.nodes.length === 4, 'L10: toJSON preserves nodes');
  const restored = EmbeddingGraph.fromJSON(saved);
  assert(restored.nodes.length === 4, 'L10: fromJSON restores nodes');
  assert(restored.getNode('doc1')?.vector.length === 3, 'L10: fromJSON preserves vector data');
  assert(eg.toMermaid().includes('graph'), 'L10: Mermaid output');

  console.log('  L10: 20+ tests');
})();

// ========== L11: GraphRAG ==========
(function testL11() {
  const rag = new GraphRAGEngine();

  // Canonical Chunk contract includes source and linked entity IDs.
  rag.addChunk({ id: 'c1', text: 'The sky is blue', source: 'test', embedding: [0.5, 0.2, 0.8], entities: ['sky'] });
  rag.addChunk({ id: 'c2', text: 'The ocean is blue', source: 'test', embedding: [0.55, 0.25, 0.85], entities: ['ocean'] });
  rag.addChunk({ id: 'c3', text: 'Cars are fast', source: 'test', embedding: [0.1, 0.9, 0.3], entities: ['car'] });
  assert(rag.chunks.length === 3, 'L11: addChunk adds chunks');

  rag.addEntity('sky', 'Sky', 'concept');
  rag.addEntity('ocean', 'Ocean', 'concept');
  rag.addEntity('car', 'Car', 'concept');
  assert(rag.entities.length === 3, 'L11: addEntity adds entities');

  try { rag.addEntity('sky', 'Dup', 'concept'); assert(false, 'L11: Should reject dup entity'); }
  catch (e) { assert(true, 'L11: Rejects duplicate entity'); }

  rag.addRelation('sky', 'ocean', 'related_to');
  rag.addRelation('sky', 'car', 'unrelated');
  assert(rag.relations.length === 2, 'L11: addRelation adds relations');

  rag.addEntity('tmp', 'Temp', 'concept');
  rag.removeEntity('tmp');
  assert(rag.entities.length === 3, 'L11: removeEntity removes entity');

  rag.removeRelation(rag.relations[0].id);
  assert(rag.relations.length === 1, 'L11: removeRelation removes relation');
  rag.addRelation('sky', 'ocean', 'related_to');

  assert(rag.getEntity('sky') !== undefined, 'L11: getEntity returns entity');

  const rag2 = new GraphRAGEngine();
  rag2.buildDemo();
  assert(rag2.chunks.length === 3, 'L11: Demo has documented 3 chunks');
  assert(rag2.entities.length === 5, 'L11: Demo has documented 5 entities');

  const results = rag.retrieve([0.5, 0.2, 0.8], ['sky']);
  assert(results.chunks.length > 0, 'L11: retrieve returns chunks');
  assert(results.entities.includes('Sky'), 'L11: retrieve traverses requested entity');

  assert(rag.validate().length === 0, 'L11: Valid graph validates');
  const mt = rag.metrics();
  assert(mt.chunkCount === 3, 'L11: Metrics chunk count');
  assert(mt.entityCount === 3, 'L11: Metrics entity count');
  assert(mt.relationCount === 2, 'L11: Metrics relation count');

  const saved = rag.toJSON();
  assert(saved.entities.length === 3, 'L11: toJSON preserves entities');
  assert(saved.chunks.length === 3, 'L11: toJSON preserves chunks');
  const restored = GraphRAGEngine.fromJSON(saved);
  assert(restored.entities.length === 3, 'L11: fromJSON restores entities');
  assert(restored.chunks[0].source === 'test', 'L11: fromJSON preserves chunk source');
  assert(restored.retrieve([0.5, 0.2, 0.8], ['sky']).chunks.length > 0, 'L11: fromJSON rebuilds retrieval adjacency');
  assert(rag.toMermaid().includes('graph'), 'L11: Mermaid output');

  console.log('  L11: 18+ tests');
})();

console.log(`\n📊 L8-L11: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0) process.exit(1);
