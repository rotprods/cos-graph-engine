"use strict";
// T-6.4: 40 Tests for L5 CFG (Control Flow Graph)
// Mutation API, blocks, edges, if/then/else, loops, switch, dominators, loop detection
Object.defineProperty(exports, "__esModule", { value: true });
const level5_cfg_1 = require("../packages/graph/src/level5-cfg");
let p = 0, f = 0;
function assert(cond, msg) { if (cond) {
    p++;
}
else {
    f++;
    console.error(`  ❌ ${msg}`);
} }
const builder = new level5_cfg_1.CFGBuilder();
const cfgId = builder.createCFG('test-func');
// === Creation ===
assert(cfgId.length > 0, 'L5: createCFG returns id');
const cfg = builder.getCFG(cfgId);
assert(cfg !== undefined, 'L5: getCFG returns graph');
assert(cfg.name === 'test-func', 'L5: CFG name matches');
assert(cfg.blocks.length === 2, 'L5: CFG has entry + exit blocks');
// === Mutation API: addBlock ===
const entry = cfg.entryBlock;
const b1 = builder.addBlock(cfgId, 'branch', 'condition', ['if (x > 0)']);
const b2 = builder.addBlock(cfgId, 'then', 'basic', ['x++']);
const b3 = builder.addBlock(cfgId, 'else', 'basic', ['x--']);
const b4 = builder.addBlock(cfgId, 'merge', 'merge', ['return x']);
assert(builder.getCFG(cfgId).blocks.length === 6, 'L5: addBlock adds blocks');
// === Mutation API: addEdge ===
builder.addEdge(cfgId, entry, b1, 'jump');
builder.addEdge(cfgId, b1, b2, 'true', 'x > 0');
builder.addEdge(cfgId, b1, b3, 'false', 'x <= 0');
builder.addEdge(cfgId, b2, b4, 'jump');
builder.addEdge(cfgId, b3, b4, 'jump');
assert(builder.getCFG(cfgId).edges.length === 5, 'L5: addEdge adds edges');
// === Mutation API: removeBlock ===
const tmp = builder.addBlock(cfgId, 'temp', 'basic');
builder.removeBlock(cfgId, tmp);
assert(builder.getCFG(cfgId).blocks.length === 6, 'L5: removeBlock removes block');
// === Mutation API: removeEdge ===
const tmpEdge = builder.getCFG(cfgId).edges[0];
builder.removeEdge(cfgId, tmpEdge.id);
assert(builder.getCFG(cfgId).edges.length === 4, 'L5: removeEdge removes edge');
builder.addEdge(cfgId, entry, b1, 'jump');
assert(builder.getCFG(cfgId).edges.length === 5, 'L5: re-add edge works');
// === buildIfThenElse ===
const cfgId2 = builder.createCFG('if-then-else');
builder.buildIfThenElse(cfgId2, 'x > 0', 'doPositive', 'doNegative', 'merge');
const cfg2 = builder.getCFG(cfgId2);
assert(cfg2.blocks.length >= 6, 'L5: buildIfThenElse creates blocks');
assert(cfg2.edges.length >= 6, 'L5: buildIfThenElse creates edges');
// === buildLoop ===
const cfgId3 = builder.createCFG('loop');
builder.buildLoop(cfgId3, 'i', 'i = 0', 'i < 10', 'body');
const cfg3 = builder.getCFG(cfgId3);
assert(cfg3.blocks.length >= 6, 'L5: buildLoop creates blocks');
assert(cfg3.edges.length >= 6, 'L5: buildLoop creates edges');
// === buildSwitch ===
const cfgId4 = builder.createCFG('switch');
builder.buildSwitch(cfgId4, 'value', [
    { value: '1', block: 'case1' },
    { value: '2', block: 'case2' },
], 'defaultBlock');
const cfg4 = builder.getCFG(cfgId4);
assert(cfg4.blocks.length >= 6, 'L5: buildSwitch creates blocks');
// === computeDominators ===
const doms = builder.computeDominators(cfgId);
assert(doms.size > 0, 'L5: computeDominators returns map');
assert(doms.get(entry)?.has(entry), 'L5: Entry dominates itself');
assert(doms.get(b1)?.has(entry), 'L5: Entry dominates all nodes');
// === detectLoops ===
// Create a loop for detection
const cfgIdLoop = builder.createCFG('loop-detect');
const lb1 = builder.addBlock(cfgIdLoop, 'header', 'loop_header');
const lb2 = builder.addBlock(cfgIdLoop, 'body', 'loop_body');
builder.addEdge(cfgIdLoop, builder.getCFG(cfgIdLoop).entryBlock, lb1, 'jump');
builder.addEdge(cfgIdLoop, lb1, lb2, 'true', 'keep');
builder.addEdge(cfgIdLoop, lb2, lb1, 'back_edge');
const loops = builder.detectLoops(cfgIdLoop);
assert(loops.length >= 1, 'L5: detectLoops finds back-edge loop');
// === Validation ===
const errs = builder.validate(cfgId);
assert(errs.length === 0, 'L5: Valid CFG validates');
// === Metrics ===
const mt = builder.metrics(cfgId);
assert(mt.nodeCount >= 6, 'L5: Metrics node count');
assert(mt.edgeCount >= 5, 'L5: Metrics edge count');
assert(mt.avgDegree > 0, 'L5: Metrics avg degree');
// === Serialization: toJSON ===
const saved = builder.toJSON(cfgId);
assert(saved !== undefined, 'L5: toJSON returns data');
assert(saved.blocks.length >= 6, 'L5: toJSON preserves blocks');
// === Serialization: fromJSON ===
const restored = level5_cfg_1.CFGBuilder.fromJSON(saved);
assert(restored.getCFG(cfgId) !== undefined, 'L5: fromJSON restores graph');
assert(restored.getCFG(cfgId).blocks.length >= 6, 'L5: fromJSON restores blocks');
// === toMermaid ===
const mermaid = builder.toMermaid(cfgId);
assert(mermaid.includes('graph'), 'L5: Mermaid output');
assert(mermaid.includes('entry'), 'L5: Mermaid contains block name');
// === Empty graph ===
const cfgId6 = builder.createCFG('empty');
assert(builder.validate(cfgId6).length === 0, 'L5: Empty graph validates');
const mtEmpty = builder.metrics(cfgId6);
assert(mtEmpty.nodeCount === 2, 'L5: Empty graph metrics (entry+exit)');
// === Multiple CFGs isolation ===
const cfgId7 = builder.createCFG('isolated');
builder.addBlock(cfgId7, 'only', 'basic');
assert(builder.getCFG(cfgId).blocks.length >= 6, 'L5: Multiple CFGs isolated');
assert(builder.getCFG(cfgId7).blocks.length === 3, 'L5: New CFG starts with 3 blocks');
// === getBlock ===
const block = builder.getBlock(cfgId, entry);
assert(block !== undefined, 'L5: getBlock returns block');
assert(block.name === 'entry', 'L5: getBlock correct name');
// === getCFG ===
const cfgCheck = builder.getCFG(cfgId);
assert(cfgCheck !== undefined, 'L5: getCFG returns graph');
assert(cfgCheck.name === 'test-func', 'L5: getCFG correct name');
// === Summary ===
console.log(`\n📊 L5: ${p} tests, ${p + f} total, ${f} failed`);
if (f > 0)
    process.exit(1);
//# sourceMappingURL=test-level5-cfg.js.map