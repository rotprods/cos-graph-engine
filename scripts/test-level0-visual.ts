// T-6.1: 40 Tests for L0 Visual Graph Engine
// Mutation API, renderers, serialization, validation, edge cases

import { VisualGraphEngine } from '../packages/graph/src/level0-visual';

let p = 0, f = 0;
function assert(cond: boolean, msg: string) { if (cond) { p++; } else { f++; console.error(`  ❌ ${msg}`); } }

// === Creation ===
const g = new VisualGraphEngine('Test Flow');
assert(g['graph'].nodes.length === 0, 'L0: Empty graph has 0 nodes');
assert(g['graph'].edges.length === 0, 'L0: Empty graph has 0 edges');
assert(g['graph'].title === 'Test Flow', 'L0: Title matches constructor');

// === Mutation API: addNode ===
const n1 = g.addNode({ label: 'Start', type: 'start' });
assert(n1.length > 0, 'L0: addNode returns id');
assert(g['graph'].nodes.length === 1, 'L0: addNode adds node');

const n2 = g.addNode({ label: 'Process', type: 'process', color: '#4ecca3' });
assert(g['graph'].nodes.length === 2, 'L0: addNode with color');

const n3 = g.addNode({ id: 'custom-id', label: 'Custom' });
assert(g.getNode('custom-id') !== undefined, 'L0: addNode with custom id');

// === addNode duplicate ===
try { g.addNode({ id: 'custom-id', label: 'Duplicate' }); assert(false, 'L0: Should reject duplicate id'); }
catch (e) { assert(true, 'L0: Rejects duplicate id'); }

// === Mutation API: addEdge ===
const e1 = g.addEdge(n1, n2, 'go', 'dashed');
assert(e1.length > 0, 'L0: addEdge returns id');
assert(g['graph'].edges.length === 1, 'L0: addEdge adds edge');

const e2 = g.addEdge(n1, n2, 'check');
assert(g['graph'].edges.length === 2, 'L0: addEdge without style');

// === addEdge dangling source ===
try { g.addEdge('nonexistent', n2, 'bad'); assert(false, 'L0: Should reject dangling source'); }
catch (e) { assert(true, 'L0: Rejects dangling source'); }

// === addEdge dangling target ===
try { g.addEdge(n1, 'nonexistent', 'bad'); assert(false, 'L0: Should reject dangling target'); }
catch (e) { assert(true, 'L0: Rejects dangling target'); }

// === Mutation API: removeNode ===
g.removeNode(n3);
assert(g['graph'].nodes.length === 2, 'L0: removeNode removes node');
assert(g['graph'].edges.length === 2, 'L0: removeNode preserves edges of other nodes');

try { g.removeNode('nonexistent'); assert(false, 'L0: Should reject remove nonexistent'); }
catch (e) { assert(true, 'L0: Rejects remove nonexistent node'); }

// === Mutation API: removeEdge ===
g.removeEdge(e1);
assert(g['graph'].edges.length === 1, 'L0: removeEdge removes edge');

try { g.removeEdge('nonexistent'); assert(false, 'L0: Should reject remove nonexistent edge'); }
catch (e) { assert(true, 'L0: Rejects remove nonexistent edge'); }

// === Renderers ===
const g2 = new VisualGraphEngine('Render Test');
g2.buildFlowchart();
assert(g2['graph'].nodes.length === 6, 'L0: Flowchart has 6 nodes');
assert(g2['graph'].edges.length === 5, 'L0: Flowchart has 5 edges');

// === Mermaid render ===
const mermaid = g2.toMermaid();
assert(mermaid.includes('graph TB'), 'L0: Mermaid direction default TB');
assert(mermaid.includes('Start'), 'L0: Mermaid contains node labels');
assert(mermaid.includes('Valid?'), 'L0: Mermaid contains decision node');
assert(mermaid.includes('-->'), 'L0: Mermaid contains edges');

// === Graphviz render ===
const dot = g2.toGraphviz();
assert(dot.includes('digraph'), 'L0: Graphviz starts with digraph');
assert(dot.includes('rankdir=TB'), 'L0: Graphviz has rankdir');
assert(dot.includes('->'), 'L0: Graphviz contains edges');

// === ASCII render ===
const ascii = g2.toASCII();
assert(ascii.includes('Start'), 'L0: ASCII contains nodes');
assert(ascii.includes('╔'), 'L0: ASCII has box border');

// === JSON render ===
const json = g2.toJSONString();
assert(json.includes('visual_graph'), 'L0: JSON type is visual_graph');
assert(json.includes('Valid?'), 'L0: JSON contains decision');

// === Validation ===
const gv = new VisualGraphEngine('Good');
gv.addNode({ label: 'A' });
gv.addNode({ label: 'B' });
gv.addEdge(gv['graph'].nodes[0].id, gv['graph'].nodes[1].id);
assert(gv.validate().length === 0, 'L0: Valid graph validates');

// Test validation catches dangling edges via internal state
const gb = new VisualGraphEngine('Bad');
gb.addNode({ label: 'X' });
gb['graph'].edges.push({ id: 'dangling', source: 'x', target: 'y' });
const errs = gb.validate();
assert(errs.length >= 1, 'L0: Validation catches dangling edges');

// === Metrics ===
const mt = g2.metrics();
assert(mt.nodeCount === 6, 'L0: Metrics node count');
assert(mt.edgeCount === 5, 'L0: Metrics edge count');
assert(mt.nodeTypes.length >= 3, 'L0: Metrics has multiple node types');

// === Serialization: toJSON ===
const saved = g2.toJSON();
assert(saved.title === 'Render Test', 'L0: toJSON preserves title');
assert(saved.nodes.length === 6, 'L0: toJSON preserves nodes');
assert(saved.edges.length === 5, 'L0: toJSON preserves edges');

// === Serialization: fromJSON ===
const restored = VisualGraphEngine.fromJSON(saved);
assert(restored['graph'].nodes.length === 6, 'L0: fromJSON restores nodes');
assert(restored['graph'].edges.length === 5, 'L0: fromJSON restores edges');
assert(restored['graph'].title === 'Render Test', 'L0: fromJSON restores title');
const restoredMermaid = restored.toMermaid();
assert(restoredMermaid.includes('Start'), 'L0: fromJSON render works');

// === createFromEdges ===
const g4 = new VisualGraphEngine('Edges');
g4.createFromEdges('From Edges', [
  { from: 'A', to: 'B' },
  { from: 'B', to: 'C' },
  { from: 'A', to: 'C', label: 'direct' },
]);
assert(g4['graph'].nodes.length === 3, 'L0: createFromEdges creates nodes');
assert(g4['graph'].edges.length === 3, 'L0: createFromEdges creates edges');
assert(g4['graph'].title === 'From Edges', 'L0: createFromEdges sets title');

// === Direction ===
const g5 = new VisualGraphEngine('LR Flow');
g5['graph'].direction = 'LR';
g5.addNode({ label: 'Left' });
g5.addNode({ label: 'Right' });
const lrMermaid = g5.toMermaid();
assert(lrMermaid.includes('graph LR'), 'L0: Direction LR works');

// === Edge styles ===
const g6 = new VisualGraphEngine('Styles');
const a = g6.addNode({ label: 'A' });
const b = g6.addNode({ label: 'B' });
g6.addEdge(a, b, 'dashed', 'dashed');
const dashedMermaid = g6.toMermaid();
assert(dashedMermaid.includes('-.-'), 'L0: Dashed edge in mermaid');

// === Node types ===
const g7 = new VisualGraphEngine('Types');
g7.addNode({ label: 'DB', type: 'database' });
g7.addNode({ label: 'Doc', type: 'document' });
const dMermaid = g7.toMermaid();
assert(dMermaid.includes('[(', 'L0: Database shape in mermaid'));
assert(dMermaid.includes('>'), 'L0: Document shape in mermaid');

// === Empty graph metrics ===
const empty = new VisualGraphEngine('Empty');
const emptyMetrics = empty.metrics();
assert(emptyMetrics.nodeCount === 0, 'L0: Empty graph metrics node count');
assert(emptyMetrics.edgeCount === 0, 'L0: Empty graph metrics edge count');

// === Summary ===
console.log(`\n📊 L0: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0) process.exit(1);