/**
 * Tests de Import/Export Universal (T-19.1)
 * GraphML, GEXF, GDF, JSON, CSV, DOT
 */

import {
  GraphConverter, GraphMLParser, GEXFParser, GDFParser,
  JSONParser, CSVParser, DOTParser, GraphBuilder,
} from '../packages/graph/src/convert';
import { VisualGraph } from '../packages/graph/src/level0-visual';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) passed++;
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function section(name: string) { console.log(`\n=== ${name} ===`); }

// Helper: create a test graph
function makeTestGraph(): VisualGraph {
  return {
    id: 'test-graph',
    title: 'Test Graph',
    direction: 'TB',
    nodes: [
      { id: 'A', label: 'Node A' },
      { id: 'B', label: 'Node B' },
      { id: 'C', label: 'Node C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', label: 'connects' },
      { id: 'e2', source: 'B', target: 'C' },
    ],
  };
}

async function main() {

// =============================================
// GraphBuilder
// =============================================

section('GraphBuilder — Construction');

const builder = new GraphBuilder();
assert(builder !== undefined, 'GraphBuilder constructed');
assert(builder.nodes.length === 0, 'Empty nodes');
assert(builder.edges.length === 0, 'Empty edges');

section('GraphBuilder — addNode');

builder.addNode({ id: 'n1', label: 'Node 1' });
assert(builder.nodes.length === 1, '1 node added');

section('GraphBuilder — addEdge');

builder.addEdge({ id: 'e1', source: 'n1', target: 'n2' });
assert(builder.edges.length === 1, '1 edge added');

section('GraphBuilder — toVisualGraph');

builder.setTitle('My Graph');
const vg = builder.toVisualGraph();
assert(vg.title === 'My Graph', 'Title preserved');
assert(vg.nodes.length === 1, 'Nodes in visual graph');
assert(vg.edges.length === 1, 'Edges in visual graph');

// =============================================
// GraphConverter
// =============================================

section('GraphConverter — Construction');

const converter = new GraphConverter();
assert(converter !== undefined, 'GraphConverter constructed');

section('GraphConverter — detectFormat');

assert(converter.detectFormat('file.graphml') === 'graphml', 'Detects graphml');
assert(converter.detectFormat('file.gexf') === 'gexf', 'Detects gexf');
assert(converter.detectFormat('file.gdf') === 'gdf', 'Detects gdf');
assert(converter.detectFormat('file.json') === 'json', 'Detects json');
assert(converter.detectFormat('file.csv') === 'csv', 'Detects csv');
assert(converter.detectFormat('file.dot') === 'dot', 'Detects dot');
assert(converter.detectFormat('file.gv') === 'dot', 'Detects gv');
assert(converter.detectFormat('file.unknown') === null, 'Unknown returns null');

section('GraphConverter — listFormats');

const formats = converter.listFormats();
assert(formats.length === 6, '6 formats registered');
assert(formats.some(f => f.format === 'graphml'), 'GraphML in list');
assert(formats.some(f => f.format === 'dot'), 'DOT in list');

// =============================================
// GraphML
// =============================================

section('GraphML — Serialize');

const graph = makeTestGraph();
const graphml = converter.serialize(graph, 'graphml');
assert(graphml.includes('<?xml'), 'XML declaration');
assert(graphml.includes('<graphml'), 'GraphML root');
assert(graphml.includes('node id="A"'), 'Node A serialized');
assert(graphml.includes('node id="B"'), 'Node B serialized');
assert(graphml.includes('source="A"'), 'Edge source A');
assert(graphml.includes('target="B"'), 'Edge target B');

section('GraphML — Parse');

const parsed = converter.parse(graphml, 'graphml');
assert(parsed.nodes.length === 3, '3 nodes parsed');
assert(parsed.edges.length === 2, '2 edges parsed');
assert(parsed.nodes.some(n => n.id === 'A'), 'Node A parsed');
assert(parsed.nodes.some(n => n.id === 'C'), 'Node C parsed');

section('GraphML — Roundtrip');

const rtGraph = converter.parse(graphml, 'graphml').toVisualGraph();
const rtGraphml = converter.serialize(rtGraph, 'graphml');
assert(rtGraphml.includes('A'), 'Roundtrip A');
assert(rtGraphml.includes('B'), 'Roundtrip B');

// =============================================
// GEXF
// =============================================

section('GEXF — Serialize');

const gexf = converter.serialize(graph, 'gexf');
assert(gexf.includes('<gexf'), 'GEXF root');
assert(gexf.includes('node id="A"'), 'Node A in GEXF');
assert(gexf.includes('source="A"'), 'Edge source in GEXF');

section('GEXF — Parse');

const gexfParsed = converter.parse(gexf, 'gexf');
assert(gexfParsed.nodes.length === 3, '3 nodes parsed from GEXF');
assert(gexfParsed.edges.length === 2, '2 edges parsed from GEXF');

section('GEXF — Roundtrip');

const gexfRt = converter.parse(gexf, 'gexf').toVisualGraph();
assert(gexfRt.nodes.length === 3, 'GEXF roundtrip 3 nodes');

// =============================================
// GDF
// =============================================

section('GDF — Serialize');

const gdf = converter.serialize(graph, 'gdf');
assert(gdf.includes('nodedef'), 'GDF nodedef');
assert(gdf.includes('edgedef'), 'GDF edgedef');
assert(gdf.includes('A,'), 'Node A in GDF');
assert(gdf.includes('A,B'), 'Edge A->B in GDF');

section('GDF — Parse');

const gdfParsed = converter.parse(gdf, 'gdf');
assert(gdfParsed.nodes.length === 3, '3 nodes parsed from GDF');
assert(gdfParsed.edges.length === 2, '2 edges parsed from GDF');

// =============================================
// JSON
// =============================================

section('JSON — Serialize');

const json = converter.serialize(graph, 'json');
assert(json.includes('"nodes"'), 'JSON nodes field');
assert(json.includes('"edges"'), 'JSON edges field');
assert(json.includes('"Node A"'), 'Node A label in JSON');

section('JSON — Parse');

const jsonParsed = converter.parse(json, 'json');
assert(jsonParsed.nodes.length === 3, '3 nodes parsed from JSON');
assert(jsonParsed.edges.length === 2, '2 edges parsed from JSON');

section('JSON — Roundtrip');

const jsonRt = converter.parse(json, 'json').toVisualGraph();
assert(jsonRt.title === 'Test Graph', 'JSON roundtrip title');
assert(jsonRt.nodes[0].label === 'Node A', 'JSON roundtrip label');

// =============================================
// CSV
// =============================================

section('CSV — Serialize');

const csv = converter.serialize(graph, 'csv');
assert(csv.includes('id,label'), 'CSV header');
assert(csv.includes('A,Node A'), 'Node A in CSV');
assert(csv.includes('A,B'), 'Edge A->B in CSV');

section('CSV — Parse');

const csvParsed = converter.parse(csv, 'csv');
assert(csvParsed.nodes.length === 3, '3 nodes parsed from CSV');
assert(csvParsed.edges.length === 2, '2 edges parsed from CSV');

// =============================================
// DOT
// =============================================

section('DOT — Serialize');

const dot = converter.serialize(graph, 'dot');
assert(dot.includes('digraph'), 'DOT digraph');
assert(dot.includes('Test_Graph'), 'DOT title');
assert(dot.includes('[label="Node A"]'), 'Node A in DOT');
assert(dot.includes('A -> B'), 'Edge A->B in DOT');

section('DOT — Parse');

const dotParsed = converter.parse(dot, 'dot');
assert(dotParsed.nodes.length >= 3, '3+ nodes parsed from DOT');
assert(dotParsed.edges.length >= 2, '2+ edges parsed from DOT');

// =============================================
// Cross-format conversion
// =============================================

section('Cross-format — GraphML to DOT');

const dotFromGraphml = converter.convert(graphml, 'graphml', 'dot');
assert(dotFromGraphml.includes('digraph'), 'GraphML->DOT has digraph');
assert(dotFromGraphml.includes('A -> B'), 'GraphML->DOT has edge');

section('Cross-format — JSON to GEXF');

const gexfFromJson = converter.convert(json, 'json', 'gexf');
assert(gexfFromJson.includes('<gexf'), 'JSON->GEXF has gexf');
assert(gexfFromJson.includes('A'), 'JSON->GEXF has node A');

section('Cross-format — CSV to GraphML');

const graphmlFromCsv = converter.convert(csv, 'csv', 'graphml');
assert(graphmlFromCsv.includes('<graphml'), 'CSV->GraphML has graphml');
assert(graphmlFromCsv.includes('node id="A"'), 'CSV->GraphML has node A');

section('Cross-format — DOT to JSON');

const jsonFromDot = converter.convert(dot, 'dot', 'json');
assert(jsonFromDot.includes('"nodes"'), 'DOT->JSON has nodes');
assert(jsonFromDot.includes('"Node A"'), 'DOT->JSON has label');

section('Cross-format — GEXF to GDF');

const gdfFromGexf = converter.convert(gexf, 'gexf', 'gdf');
assert(gdfFromGexf.includes('nodedef'), 'GEXF->GDF has nodedef');
assert(gdfFromGexf.includes('A,'), 'GEXF->GDF has node A');

// =============================================
// Converter — error handling
// =============================================

section('Error handling — Invalid format');

try {
  converter.parse('content', 'graphml' as any);
  assert(true, 'Parse with valid format works');
} catch (e) { assert(false, 'Valid format should not throw'); }

try {
  converter.serialize(graph, 'invalid' as any);
  assert(false, 'Should throw on invalid format');
} catch (e) {
  assert((e as Error).message.includes('Unsupported'), 'Invalid format throws Unsupported');
}

// =============================================
// Summary
// =============================================

section('Summary');
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });