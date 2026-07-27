/**
 * Tests de GraphQL API (Fase 14)
 * Prueba: Schema, resolvers, queries, mutations, pagination, batch, SMB persistence
 */

import { GQLEngine, GQL_SCHEMA } from '../packages/graph/src/graphql';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

async function main() {

// =============================================
// T-14.1: Schema GraphQL
// =============================================

section('Schema — Structure');

assert(typeof GQL_SCHEMA === 'string', 'Schema is a string');
assert(GQL_SCHEMA.length > 500, 'Schema has substantial content');
assert(GQL_SCHEMA.includes('type Query'), 'Schema has Query type');
assert(GQL_SCHEMA.includes('type Mutation'), 'Schema has Mutation type');
assert(GQL_SCHEMA.includes('type Graph'), 'Schema has Graph type');
assert(GQL_SCHEMA.includes('type Node'), 'Schema has Node type');
assert(GQL_SCHEMA.includes('type Edge'), 'Schema has Edge type');
assert(GQL_SCHEMA.includes('type PageInfo'), 'Schema has PageInfo type');
assert(GQL_SCHEMA.includes('type MutationResult'), 'Schema has MutationResult type');
assert(GQL_SCHEMA.includes('type BatchResult'), 'Schema has BatchResult type');
assert(GQL_SCHEMA.includes('type GraphStats'), 'Schema has GraphStats type');
assert(GQL_SCHEMA.includes('type Level'), 'Schema has Level type');
assert(GQL_SCHEMA.includes('type ServiceHealth'), 'Schema has ServiceHealth type');
assert(GQL_SCHEMA.includes('enum EdgeDirection'), 'Schema has EdgeDirection enum');

section('Schema — Queries');

assert(GQL_SCHEMA.includes('graph(level: Int!, id: ID!)'), 'Schema has graph query');
assert(GQL_SCHEMA.includes('search(level: Int!, query: String!'), 'Schema has search query');
assert(GQL_SCHEMA.includes('node(level: Int!, id: ID!)'), 'Schema has node query');
assert(GQL_SCHEMA.includes('graphs(level: Int!'), 'Schema has graphs query');
assert(GQL_SCHEMA.includes('graphStats(level: Int!)'), 'Schema has graphStats query');
assert(GQL_SCHEMA.includes('levels'), 'Schema has levels query');
assert(GQL_SCHEMA.includes('health'), 'Schema has health query');

section('Schema — Mutations');

assert(GQL_SCHEMA.includes('addNode(level: Int!'), 'Schema has addNode mutation');
assert(GQL_SCHEMA.includes('addEdge(level: Int!'), 'Schema has addEdge mutation');
assert(GQL_SCHEMA.includes('removeNode(level: Int!'), 'Schema has removeNode mutation');
assert(GQL_SCHEMA.includes('removeEdge(level: Int!'), 'Schema has removeEdge mutation');
assert(GQL_SCHEMA.includes('createGraph(level: Int!'), 'Schema has createGraph mutation');
assert(GQL_SCHEMA.includes('deleteGraph(level: Int!'), 'Schema has deleteGraph mutation');
assert(GQL_SCHEMA.includes('batchAddNodes'), 'Schema has batchAddNodes mutation');
assert(GQL_SCHEMA.includes('batchAddEdges'), 'Schema has batchAddEdges mutation');
assert(GQL_SCHEMA.includes('clearGraph'), 'Schema has clearGraph mutation');

// =============================================
// T-14.2: Resolvers
// =============================================

section('GQLEngine — Schema Access');

const engine = new GQLEngine();
const schema = engine.getSchema();
assert(schema === GQL_SCHEMA, 'getSchema returns schema');

section('GQLEngine — Level Metadata');

const levels = engine.getLevels();
assert(levels.length === 20, '20 levels defined');
assert(levels[0].id === 0, 'L0 id is 0');
assert(levels[0].name === 'L0-Visual', 'L0 name correct');
assert(levels[0].domain === 'Base', 'L0 domain Base');
assert(levels[7].name === 'L7-Compute', 'L7 name correct');
assert(levels[7].domain === 'Computational', 'L7 domain Computational');
assert(levels[11].name === 'L11-GraphRAG', 'L11 name correct');
assert(levels[11].domain === 'Cognitive', 'L11 domain Cognitive');
assert(levels[19].name === 'L19-Molecular', 'L19 name correct');
assert(levels[19].domain === 'Applied', 'L19 domain Applied');

section('GQLEngine — Health');

const health = engine.getHealth();
assert(health.status === 'healthy', 'Health status healthy');
assert(health.levels === 20, 'Health reports 20 levels');
assert(health.version === '0.1.0', 'Health version correct');

section('GQLEngine — Create Graph');

const createResult = engine.createGraph(4, { name: 'Test Call Graph' });
assert(createResult.success === true, 'Create graph succeeds');
assert(createResult.graph !== undefined, 'Create returns graph');
assert(createResult.graph!.name === 'Test Call Graph', 'Graph name correct');
assert(createResult.graph!.level === 4, 'Graph level 4');
assert(createResult.graph!.nodeCount === 0, 'Graph starts empty');
assert(createResult.graph!.edgeCount === 0, 'Graph starts with 0 edges');

section('GQLEngine — Add Node');

const nodeResult = engine.addNode(4, createResult.graph!.id, { id: 'n1', label: 'Start', type: 'entry' });
assert(nodeResult.success === true, 'Add node succeeds');
assert(nodeResult.node !== undefined, 'Returns node');
assert(nodeResult.node!.id === 'n1', 'Node id correct');
assert(nodeResult.node!.label === 'Start', 'Node label correct');
assert(nodeResult.node!.type === 'entry', 'Node type correct');

const nodeResult2 = engine.addNode(4, createResult.graph!.id, { id: 'n2', label: 'Process', type: 'normal' });
assert(nodeResult2.success === true, 'Add second node');

const nodeResult3 = engine.addNode(4, createResult.graph!.id, { id: 'n3', label: 'End', type: 'exit' });
assert(nodeResult3.success === true, 'Add third node');

section('GQLEngine — Add Edge');

const edgeResult = engine.addEdge(4, createResult.graph!.id, { source: 'n1', target: 'n2', label: 'enter', weight: 1 });
assert(edgeResult.success === true, 'Add edge succeeds');
assert(edgeResult.edge !== undefined, 'Returns edge');
assert(edgeResult.edge!.source === 'n1', 'Edge source correct');
assert(edgeResult.edge!.target === 'n2', 'Edge target correct');

const edgeResult2 = engine.addEdge(4, createResult.graph!.id, { source: 'n2', target: 'n3', label: 'exit', weight: 1 });
assert(edgeResult2.success === true, 'Add second edge');

section('GQLEngine — Add Edge Validation');

const badEdge = engine.addEdge(4, createResult.graph!.id, { source: 'nonexistent', target: 'n3' });
assert(badEdge.success === false, 'Edge with bad source fails');
assert(badEdge.error !== undefined, 'Returns error message');

const badEdge2 = engine.addEdge(4, createResult.graph!.id, { source: 'n1', target: 'nonexistent' });
assert(badEdge2.success === false, 'Edge with bad target fails');

section('GQLEngine — Get Graph');

const graph = engine.getGraph(4, createResult.graph!.id);
assert(graph !== undefined, 'Get graph returns graph');
assert(graph!.nodeCount === 3, 'Graph has 3 nodes');
assert(graph!.edgeCount === 2, 'Graph has 2 edges');
assert(graph!.nodes.length === 3, '3 nodes in array');
assert(graph!.edges.length === 2, '2 edges in array');

section('GQLEngine — Get Node');

const node = engine.getNode(4, 'n1');
assert(node !== undefined, 'Get node returns node');
assert(node!.id === 'n1', 'Node id correct');
assert(node!.label === 'Start', 'Node label correct');

const missingNode = engine.getNode(4, 'nonexistent');
assert(missingNode === undefined, 'Missing node returns undefined');

section('GQLEngine — Search');

const searchResults = engine.search(4, 'start');
assert(searchResults.nodes.length >= 1, 'Search "start" finds at least 1 node');
assert(searchResults.nodes[0].id === 'n1', 'Search finds node n1');

const searchAll = engine.search(4, '');
assert(searchAll.nodes.length >= 3, 'Empty search finds all nodes');

const searchFiltered = engine.search(4, '', { type: 'exit' });
assert(searchFiltered.nodes.length === 1, 'Filter by type finds 1 node');
assert(searchFiltered.nodes[0].id === 'n3', 'Filtered node is n3');

section('GQLEngine — Pagination');

const paged = engine.search(4, '', undefined, 1, 2);
assert(paged.nodes.length === 2, 'Page 1: 2 nodes');
assert(paged.pageInfo.hasNextPage === true, 'Page 1 has next page');
assert(paged.pageInfo.hasPreviousPage === false, 'Page 1 has no previous');
assert(paged.pageInfo.totalCount >= 3, 'Total count >= 3');

const page2 = engine.search(4, '', undefined, 2, 2);
assert(page2.nodes.length >= 1, 'Page 2: at least 1 node');
assert(page2.pageInfo.hasPreviousPage === true, 'Page 2 has previous page');

section('GQLEngine — Graph Stats');

const stats = engine.getGraphStats(4);
assert(stats.totalGraphs >= 1, 'Stats: at least 1 graph');
assert(stats.totalNodes >= 3, 'Stats: at least 3 nodes total');
assert(stats.totalEdges >= 2, 'Stats: at least 2 edges total');

section('GQLEngine — Remove Node');

const removeNodeResult = engine.removeNode(4, createResult.graph!.id, 'n3');
assert(removeNodeResult.success === true, 'Remove node succeeds');
const updatedGraph = engine.getGraph(4, createResult.graph!.id);
assert(updatedGraph!.nodeCount === 2, 'Graph now has 2 nodes');
assert(updatedGraph!.edges.length === 1, 'Edges referencing removed node also removed');

section('GQLEngine — Remove Edge');

const removeEdgeResult = engine.removeEdge(4, createResult.graph!.id, 'e1');
assert(removeEdgeResult.success === true, 'Remove edge succeeds');
const updatedGraph2 = engine.getGraph(4, createResult.graph!.id);
assert(updatedGraph2!.edgeCount === 0, 'Graph now has 0 edges');

section('GQLEngine — Batch Add Nodes');

const batchNodes = engine.batchAddNodes(4, createResult.graph!.id, [
  { id: 'b1', label: 'Batch1' },
  { id: 'b2', label: 'Batch2' },
  { id: 'b3', label: 'Batch3' },
]);
assert(batchNodes.success === true, 'Batch add nodes succeeds');
assert(batchNodes.results.length === 3, '3 batch results');
assert(batchNodes.errors === 0, '0 errors in batch');

const graphAfterBatch = engine.getGraph(4, createResult.graph!.id);
assert(graphAfterBatch!.nodeCount === 5, 'Graph now has 5 nodes');

section('GQLEngine — Batch Add Edges');

const batchEdges = engine.batchAddEdges(4, createResult.graph!.id, [
  { source: 'b1', target: 'b2', label: 'to_b2' },
  { source: 'b2', target: 'b3', label: 'to_b3' },
]);
assert(batchEdges.success === true, 'Batch add edges succeeds');
assert(batchEdges.results.length === 2, '2 batch edge results');
assert(batchEdges.errors === 0, '0 errors in batch');

const graphAfterEdges = engine.getGraph(4, createResult.graph!.id);
assert(graphAfterEdges!.edgeCount === 2, 'Graph now has 2 edges');

section('GQLEngine — Clear Graph');

const clearResult = engine.clearGraph(4, createResult.graph!.id);
assert(clearResult.success === true, 'Clear graph succeeds');
const clearedGraph = engine.getGraph(4, createResult.graph!.id);
assert(clearedGraph!.nodeCount === 0, 'Cleared graph has 0 nodes');
assert(clearedGraph!.edgeCount === 0, 'Cleared graph has 0 edges');

section('GQLEngine — Delete Graph');

const deleteResult = engine.deleteGraph(4, createResult.graph!.id);
assert(deleteResult.success === true, 'Delete graph succeeds');
const deletedGraph = engine.getGraph(4, createResult.graph!.id);
assert(deletedGraph === undefined, 'Deleted graph returns undefined');

section('GQLEngine — Execute Interface');

// Test the execute() routing
const createViaExec = engine.execute('createGraph', { level: 7, input: { name: 'Compute Graph' } });
assert((createViaExec.createGraph as any).success === true, 'Execute createGraph works');

const graphId = (createViaExec.createGraph as any).graph.id;
const addViaExec = engine.execute('addNode', { level: 7, graphId, input: { id: 'x1', label: 'Input' } });
assert((addViaExec.addNode as any).success === true, 'Execute addNode works');

const healthViaExec = engine.execute('health', {});
assert((healthViaExec.health as any).status === 'healthy', 'Execute health works');

const levelsViaExec = engine.execute('levels', {});
assert(Array.isArray((levelsViaExec.levels as any)), 'Execute levels returns array');

const statsViaExec = engine.execute('graphStats', { level: 7 });
assert((statsViaExec.graphStats as any).totalGraphs >= 1, 'Execute graphStats works');

// Unknown operation
const unknownOp = engine.execute('unknownOp', {});
assert((unknownOp as any).error !== undefined, 'Unknown operation returns error');

section('GQLEngine — Multi-level Support');

const l0Graph = engine.createGraph(0, { name: 'Visual Graph' });
assert(l0Graph.success === true, 'Create L0 graph');

const l8Graph = engine.createGraph(8, { name: 'Knowledge Graph' });
assert(l8Graph.success === true, 'Create L8 graph');

const l19Graph = engine.createGraph(19, { name: 'Molecular Graph' });
assert(l19Graph.success === true, 'Create L19 graph');

const l0Stats = engine.getGraphStats(0);
assert(l0Stats.totalGraphs >= 1, 'L0 has 1+ graphs');

const l8Stats = engine.getGraphStats(8);
assert(l8Stats.totalGraphs >= 1, 'L8 has 1+ graphs');

const l19Stats = engine.getGraphStats(19);
assert(l19Stats.totalGraphs >= 1, 'L19 has 1+ graphs');

section('GQLEngine — Graphs List');

const graphsL4 = engine.getGraphs(4);
assert(graphsL4.length === 0, 'L4 graphs (deleted)');

const graphsL7 = engine.getGraphs(7);
assert(graphsL7.length >= 1, 'L7 has 1+ graph');

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });