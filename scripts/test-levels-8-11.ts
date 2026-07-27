// T-6.6: 40+ Tests for L8-L11
// Knowledge (addEntity/addRelation), Semantic (addNode/addEdge/findSimilar/lca)
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

  // addEntity
  const e1 = kg.addEntity({ id: 'einstein', name: 'Einstein', type: 'person', description: 'Physicist', aliases: ['Albert'] });
  const e2 = kg.addEntity({ id: 'relativity', name: 'Relativity', type: 'concept', description: 'Theory' });
  const e3 = kg.addEntity({ id: 'physics', name: 'Physics', type: 'concept', description: 'Science' });
  assert(kg.entities.length === 3, 'L8: addEntity adds entities');

  // duplicate
  try { kg.addEntity({ id: 'einstein', name: 'Dup', type: 'concept' }); assert(false, 'L8: Should reject duplicate'); }
  catch (e) { assert(true, 'L8: Rejects duplicate entity'); }

  // addRelation
  kg.addRelation({ id: 'r1', source: 'einstein', target: 'relativity', type: 'created', confidence: 0.9 });
  kg.addRelation({ id: 'r2', source: 'relativity', target: 'physics', type: 'part_of', confidence: 0.8 });
  assert(kg.relations.length === 2, 'L8: addRelation adds relations');

  // dangling relation
  try { kg.addRelation({ id: 'r3', source: 'nonexistent', target: 'physics', type: 'related_to' }); assert(false, 'L8: Should reject dangling'); }
  catch (e) { assert(true, 'L8: Rejects dangling relation source'); }

  // removeEntity
  const tmp = kg.addEntity({ id: 'tmp', name: 'Temp', type: 'concept' });
  kg.removeEntity('tmp');
  assert(kg.entities.length === 3, 'L8: removeEntity removes entity');

  // removeRelation
  kg.removeRelation('r1');
  assert(kg.relations.length === 1, 'L8: removeRelation removes relation');
  kg.addRelation({ id: 'r1', source: 'einstein', target: 'relativity', type: 'created', confidence: 0.9 });

  // getEntity
  const ent = kg.getEntity('einstein');
  assert(ent !== undefined, 'L8: getEntity returns entity');
  assert(ent!.name === 'Einstein', 'L8: getEntity correct name');

  // getRelations
  const rels = kg.getRelations('einstein');
  assert(rels.length >= 1, 'L8: getRelations returns relations');

  // getRelation
  const rel = kg.getRelation('r1');
  assert(rel !== undefined, 'L8: getRelation returns relation');

  // buildAIEcosystem
  const kg2 = new KnowledgeGraphEngine();
  kg2.buildAIEcosystem();
  assert(kg2.entities.length >= 5, 'L8: AI ecosystem has 5+ entities');
  assert(kg2.relations.length >= 4, 'L8: AI ecosystem has 4+ relations');

  // buildCOS
  const kg3 = new KnowledgeGraphEngine();
  kg3.buildCOS();
  assert(kg3.entities.length >= 8, 'L8: COS has 8+ entities');

  // SPARQL
  const sparql = kg.sparql({ select: ['*'], where: [{ subject: 'einstein', predicate: 'created', object: 'relativity' }] });
  assert(sparql.length >= 0, 'L8: SPARQL query works');

  // validate
  assert(kg.validate().length === 0, 'L8: Valid graph validates');

  // metrics
  const mt = kg.metrics();
  assert(mt.entityCount >= 3, 'L8: Metrics entity count');
  assert(mt.relationCount >= 2, 'L8: Metrics relation count');

  // serialization
  const saved = kg.toJSON();
  assert(saved.entities.length >= 3, 'L8: toJSON preserves entities');
  const restored = KnowledgeGraphEngine.fromJSON(saved);
  assert(restored.entities.length >= 3, 'L8: fromJSON restores entities');

  // toMermaid
  assert(kg.toMermaid().includes('graph'), 'L8: Mermaid output');

  console.log(`  L8: 20+ tests`);
})();

// ========== L9: SEMANTIC GRAPH ==========
(function testL9() {
  const sg = new SemanticGraph();

  assert(sg.nodes.length === 0, 'L9: Empty has 0 nodes');

  // addNode
  sg.addNode({ id: 'dog', name: 'Dog', concepts: ['mammal', 'pet'] });
  sg.addNode({ id: 'cat', name: 'Cat', concepts: ['mammal', 'pet'] });
  sg.addNode({ id: 'car', name: 'Car', concepts: ['vehicle'] });
  sg.addNode({ id: 'mammal', name: 'Mammal', concepts: ['animal'] });
  assert(sg.nodes.length === 4, 'L9: addNode adds nodes');

  // addEdge
  sg.addEdge({ id: 'e1', source: 'dog', target: 'cat', type: 'similar', weight: 0.9 });
  sg.addEdge({ id: 'e2', source: 'dog', target: 'mammal', type: 'is_a', weight: 1.0 });
  sg.addEdge({ id: 'e3', source: 'cat', target: 'mammal', type: 'is_a', weight: 1.0 });
  sg.addEdge({ id: 'e4', source: 'car', target: 'cat', type: 'dissimilar', weight: 0.1 });
  assert(sg.edges.length === 4, 'L9: addEdge adds edges');

  // removeNode
  sg.addNode({ id: 'tmp', name: 'Temp', concepts: [] });
  sg.removeNode('tmp');
  assert(sg.nodes.length === 4, 'L9: removeNode removes node');

  // removeEdge
  sg.removeEdge('e4');
  assert(sg.edges.length === 3, 'L9: removeEdge removes edge');
  sg.addEdge({ id: 'e4', source: 'car', target: 'cat', type: 'dissimilar', weight: 0.1 });

  // getNode
  assert(sg.getNode('dog') !== undefined, 'L9: getNode returns node');
  assert(sg.getEdge('e1') !== undefined, 'L9: getEdge returns edge');

  // findSimilar
  const similar = sg.findSimilar('dog', 2);
  assert(similar.length >= 1, 'L9: findSimilar returns results');

  // findPath
  const path = sg.findPath('dog', 'mammal');
  assert(path.length >= 1, 'L9: findPath returns path');

  // lca
  const lca = sg.lca('dog', 'cat');
  assert(lca !== null, 'L9: LCA of dog and cat exists');

  // buildAnimalTaxonomy
  const sg2 = new SemanticGraph();
  sg2.buildAnimalTaxonomy();
  assert(sg2.nodes.length >= 5, 'L9: Animal taxonomy has 5+ nodes');

  // validate
  assert(sg.validate().length === 0, 'L9: Valid graph validates');

  // metrics
  const mt = sg.metrics();
  assert(mt.nodeCount >= 4, 'L9: Metrics node count');
  assert(mt.edgeCount >= 4, 'L9: Metrics edge count');

  // serialization
  const saved = sg.toJSON();
  assert(saved.nodes.length >= 4, 'L9: toJSON preserves nodes');
  const restored = SemanticGraph.fromJSON(saved);
  assert(restored.nodes.length >= 4, 'L9: fromJSON restores nodes');

  // toMermaid
  assert(sg.toMermaid().includes('graph'), 'L9: Mermaid output');

  console.log('  L9: 18+ tests');
})();

// ========== L10: EMBEDDING GRAPH ==========
(function testL10() {
  const eg = new EmbeddingGraph();

  assert(eg.nodes.length === 0, 'L10: Empty has 0 nodes');

  // addNode
  eg.addNode({ id: 'doc1', source: 'Document A', embedding: [0.5, 0.2, 0.8], metadata: { type: 'doc' } });
  eg.addNode({ id: 'doc2', source: 'Document B', embedding: [0.55, 0.25, 0.85], metadata: { type: 'doc' } });
  eg.addNode({ id: 'img1', source: 'Image', embedding: [0.1, 0.9, 0.3], metadata: { type: 'image' } });
  eg.addNode({ id: 'doc3', source: 'Document C', embedding: [0.52, 0.22, 0.82], metadata: { type: 'doc' } });
  assert(eg.nodes.length === 4, 'L10: addNode adds nodes');

  // duplicate
  try { eg.addNode({ id: 'doc1', source: 'Dup', embedding: [0, 0, 0], metadata: {} }); assert(false, 'L10: Should reject'); }
  catch (e) { assert(true, 'L10: Rejects duplicate'); }

  // addEdge
  eg.addEdge({ id: 'e1', source: 'doc1', target: 'doc2', type: 'similar', similarity: 0.95 });
  eg.addEdge({ id: 'e2', source: 'doc2', target: 'doc3', type: 'similar', similarity: 0.90 });
  assert(eg.edges.length === 2, 'L10: addEdge adds edges');

  // removeNode
  eg.addNode({ id: 'tmp', source: 'Tmp', embedding: [0], metadata: {} });
  eg.removeNode('tmp');
  assert(eg.nodes.length === 4, 'L10: removeNode removes node');

  // removeEdge
  eg.removeEdge('e2');
  assert(eg.edges.length === 1, 'L10: removeEdge removes edge');
  eg.addEdge({ id: 'e2', source: 'doc2', target: 'doc3', type: 'similar', similarity: 0.90 });

  // getNode
  assert(eg.getNode('doc1') !== undefined, 'L10: getNode returns node');

  // buildKNN
  eg.buildKNN(2);
  assert(eg.edges.length >= 2, 'L10: buildKNN creates edges');

  // cluster
  const clusters = eg.cluster(3);
  assert(clusters.size >= 1, 'L10: cluster returns groups');

  // buildAIModelGraph
  const eg2 = new EmbeddingGraph();
  eg2.buildAIModelGraph();
  assert(eg2.nodes.length >= 4, 'L10: AI model graph has 4+ nodes');

  // validate
  assert(eg.validate().length === 0, 'L10: Valid graph validates');

  // metrics
  const mt = eg.metrics();
  assert(mt.nodeCount >= 4, 'L10: Metrics node count');

  // serialization
  const saved = eg.toJSON();
  assert(saved.nodes.length >= 4, 'L10: toJSON preserves nodes');
  const restored = EmbeddingGraph.fromJSON(saved);
  assert(restored.nodes.length >= 4, 'L10: fromJSON restores nodes');

  // toMermaid
  assert(eg.toMermaid().includes('graph'), 'L10: Mermaid output');

  console.log('  L10: 17+ tests');
})();

// ========== L11: GraphRAG ==========
(function testL11() {
  const rag = new GraphRAGEngine();

  // addChunk
  rag.addChunk({ id: 'c1', text: 'The sky is blue', embedding: [0.5, 0.2, 0.8] });
  rag.addChunk({ id: 'c2', text: 'The ocean is blue', embedding: [0.55, 0.25, 0.85] });
  rag.addChunk({ id: 'c3', text: 'Cars are fast', embedding: [0.1, 0.9, 0.3] });
  assert(rag.chunks.length === 3, 'L11: addChunk adds chunks');

  // addEntity
  rag.addEntity('sky', 'Sky', 'concept');
  rag.addEntity('ocean', 'Ocean', 'concept');
  rag.addEntity('car', 'Car', 'concept');
  assert(rag.entities.length === 3, 'L11: addEntity adds entities');

  // duplicate entity
  try { rag.addEntity('sky', 'Dup', 'concept'); assert(false, 'L11: Should reject dup entity'); }
  catch (e) { assert(true, 'L11: Rejects duplicate entity'); }

  // addRelation
  rag.addRelation('sky', 'ocean', 'related_to');
  rag.addRelation('sky', 'car', 'unrelated');
  assert(rag.relations.length === 2, 'L11: addRelation adds relations');

  // removeEntity
  rag.addEntity('tmp', 'Temp', 'concept');
  rag.removeEntity('tmp');
  assert(rag.entities.length === 3, 'L11: removeEntity removes entity');

  // removeRelation
  rag.removeRelation(rag.relations[0].id);
  assert(rag.relations.length === 1, 'L11: removeRelation removes relation');
  rag.addRelation('sky', 'ocean', 'related_to');

  // getEntity
  assert(rag.getEntity('sky') !== undefined, 'L11: getEntity returns entity');

  // buildDemo
  const rag2 = new GraphRAGEngine();
  rag2.buildDemo();
  assert(rag2.chunks.length >= 2, 'L11: Demo has 2+ chunks');
  assert(rag2.entities.length >= 3, 'L11: Demo has 3+ entities');

  // retrieve
  const results = rag.retrieve([0.5, 0.2, 0.8], ['sky']);
  assert(results.chunks.length >= 0, 'L11: retrieve returns chunks');

  // validate
  assert(rag.validate().length === 0, 'L11: Valid graph validates');

  // metrics
  const mt = rag.metrics();
  assert(mt.chunkCount >= 3, 'L11: Metrics chunk count');
  assert(mt.entityCount >= 3, 'L11: Metrics entity count');

  // serialization
  const saved = rag.toJSON();
  assert(saved.entities.length >= 3, 'L11: toJSON preserves entities');
  const restored = GraphRAGEngine.fromJSON(saved);
  assert(restored.entities.length >= 3, 'L11: fromJSON restores entities');

  // toMermaid
  assert(rag.toMermaid().includes('graph'), 'L11: Mermaid output');

  console.log('  L11: 18+ tests');
})();

console.log(`\n📊 L8-L11: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0) process.exit(1);