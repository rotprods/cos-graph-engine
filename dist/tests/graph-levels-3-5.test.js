"use strict";
// COS Graph Engine — Levels 3-5 Test Suite
// Tests: Dependency Graph (L3), Call Graph (L4), Control Flow Graph (L5)
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLevels3to5Tests = runLevels3to5Tests;
const level3_dependency_1 = require("../packages/graph/src/level3-dependency");
const level4_call_1 = require("../packages/graph/src/level4-call");
const level5_cfg_1 = require("../packages/graph/src/level5-cfg");
let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) {
        passed++;
        console.log(`  ✅ ${msg}`);
    }
    else {
        failed++;
        console.log(`  ❌ ${msg}`);
    }
}
// ============ LEVEL 3: DEPENDENCY GRAPH ============
async function testDependencyGraph() {
    const resolver = new level3_dependency_1.DependencyResolver();
    // Create a dependency graph
    const gid = resolver.createGraph('Test Project', [
        { id: 'react', name: 'react', type: 'library', version: '18.2.0' },
        { id: 'next', name: 'next', type: 'package', version: '14.0.0' },
        { id: 'app', name: 'my-app', type: 'package' },
        { id: 'lodash', name: 'lodash', type: 'library', version: '4.17.21' },
        { id: 'typescript', name: 'typescript', type: 'library', version: '5.3.0' },
    ], [
        { source: 'next', target: 'react', type: 'depends_on', semver: '^18.0.0' },
        { source: 'app', target: 'next', type: 'depends_on', semver: '^14.0.0' },
        { source: 'app', target: 'lodash', type: 'depends_on', semver: '^4.0.0' },
        { source: 'app', target: 'typescript', type: 'depends_on', semver: '^5.0.0' },
        { source: 'next', target: 'typescript', type: 'depends_on', semver: '^5.0.0' },
    ]);
    assert(gid.length > 0, 'DependencyResolver.createGraph returns valid ID');
    // Topological sort
    const order = resolver.topologicalSort(gid);
    assert(order.length === 5, 'Topological sort returns all nodes');
    // react and typescript should be first (no deps)
    const firstThree = order.slice(0, 3);
    assert(firstThree.includes('react') && firstThree.includes('typescript') && firstThree.includes('lodash'), 'Topological sort: roots first (react, lodash, typescript)');
    // Ensure app is last
    assert(order[order.length - 1] === 'app', 'Topological sort: app is last (depends on everything)');
    // Cycle detection
    const noCycle = resolver.detectCycle(gid);
    assert(noCycle === null, 'No cycle detected in acyclic graph');
    // Create a graph with a cycle
    const cycleId = resolver.createGraph('Cycle Test', [
        { id: 'a', name: 'A', type: 'module' },
        { id: 'b', name: 'B', type: 'module' },
        { id: 'c', name: 'C', type: 'module' },
    ], [
        { source: 'a', target: 'b', type: 'depends_on' },
        { source: 'b', target: 'c', type: 'depends_on' },
        { source: 'c', target: 'a', type: 'depends_on' },
    ]);
    const cycle = resolver.detectCycle(cycleId);
    assert(cycle !== null && cycle.length >= 3, 'Cycle detection finds cycles');
    // Depth computation
    const depth = resolver.computeDepth(gid);
    assert(depth.get('react') === 0, 'Root node has depth 0');
    assert(depth.get('next') === 1, 'Next depends on react → depth 1');
    assert(depth.get('app') >= 2, 'App depends on next → depth >= 2');
    // Root and leaf detection
    const roots = resolver.findRoots(gid);
    assert(roots.length === 3, 'Three root nodes (react, lodash, typescript)');
    const leaves = resolver.findLeaves(gid);
    assert(leaves.length === 1 && leaves[0].name === 'my-app', 'One leaf node (my-app)');
    // Subgraph extraction
    const sub = resolver.subgraph(gid, 'next');
    assert(sub !== null, 'Subgraph extraction works');
    assert(sub.nodes.length >= 2, 'Subgraph contains next and its dependencies');
    assert(sub.edges.length >= 1, 'Subgraph contains edges');
    // Mermaid rendering
    const mermaid = resolver.toMermaid(gid);
    assert(mermaid.includes('graph LR'), 'Mermaid output for dependency graph');
    assert(mermaid.includes('react'), 'Mermaid includes react');
    assert(mermaid.includes('-->'), 'Mermaid includes edges');
    // Get graph
    const graph = resolver.getGraph(gid);
    assert(graph !== undefined, 'getGraph returns the graph');
    assert(graph.name === 'Test Project', 'getGraph returns correct name');
    // Empty graph
    const emptyId = resolver.createGraph('Empty', [], []);
    const emptyOrder = resolver.topologicalSort(emptyId);
    assert(emptyOrder.length === 0, 'Empty graph topological sort returns empty');
}
// ============ LEVEL 4: CALL GRAPH ============
async function testCallGraph() {
    const builder = new level4_call_1.CallGraphBuilder();
    // Create a call graph
    const gid = builder.createGraph('Test Calls');
    assert(gid.length > 0, 'CallGraphBuilder.createGraph returns valid ID');
    // Simulate a call chain: main → login → validate → db
    const mainId = builder.enterCall(gid, 'main', 'function', 'app.ts');
    const loginId = builder.enterCall(gid, 'login', 'function', 'auth.ts');
    const validateId = builder.enterCall(gid, 'validate', 'function', 'auth.ts');
    const dbId = builder.enterCall(gid, 'queryDB', 'function', 'db.ts');
    builder.exitCall(gid, dbId);
    builder.exitCall(gid, validateId);
    builder.exitCall(gid, loginId);
    builder.exitCall(gid, mainId);
    // Second call chain: main → render
    const mainId2 = builder.enterCall(gid, 'main', 'function', 'app.ts');
    const renderId = builder.enterCall(gid, 'render', 'function', 'ui.tsx');
    builder.exitCall(gid, renderId);
    builder.exitCall(gid, mainId2);
    const graph = builder.getGraph(gid);
    assert(graph !== undefined, 'getGraph returns graph');
    assert(graph.nodes.length >= 4, 'Call graph has correct nodes');
    assert(graph.edges.length >= 3, 'Call graph has correct edges');
    // Find hot paths
    const hot = builder.findHotPaths(gid, 1);
    assert(hot.length > 0, 'Hot paths detect frequent call chains');
    // Depth computation
    const depth = builder.computeDepth(gid);
    const mainNode = graph.nodes.find(n => n.name === 'main');
    assert(mainNode !== undefined, 'Main node exists');
    assert(depth.get(mainNode.id) === 0, 'Main has depth 0');
    // Flame graph data
    const flame = builder.toFlameData(gid);
    assert(flame.length > 0, 'Flame graph data generated');
    // Mermaid rendering
    const mermaid = builder.toMermaid(gid);
    assert(mermaid.includes('graph TD'), 'Mermaid output for call graph');
    assert(mermaid.includes('main'), 'Mermaid includes main');
    assert(mermaid.includes('-->'), 'Mermaid includes edges');
    // Stack trace analysis
    const traceId = builder.createGraph('Stack Trace');
    builder.analyzeStackTrace(traceId, [
        'at main (app.ts:10:5)',
        'at login (auth.ts:25:10)',
        'at validate (auth.ts:50:15)',
        'at queryDB (db.ts:100:20)',
    ]);
    const traceGraph = builder.getGraph(traceId);
    assert(traceGraph !== undefined, 'Stack trace analysis works');
    assert(traceGraph.nodes.length >= 4, 'Stack trace creates correct nodes');
    assert(traceGraph.edges.length >= 3, 'Stack trace creates correct edges');
    // Call count tracking
    const mainCalls = traceGraph.nodes.filter(n => n.name === 'main');
    assert(mainCalls.length >= 1, 'Call count tracked');
}
// ============ LEVEL 5: CONTROL FLOW GRAPH ============
async function testControlFlowGraph() {
    const builder = new level5_cfg_1.CFGBuilder();
    // Create CFG
    const cfgId = builder.createCFG('Test Function');
    assert(cfgId.length > 0, 'CFGBuilder.createCFG returns valid ID');
    const cfg = builder.getCFG(cfgId);
    assert(cfg !== undefined, 'getCFG returns CFG');
    assert(cfg.blocks.length === 2, 'CFG starts with entry + exit blocks');
    assert(cfg.entryBlock.length > 0, 'CFG has entry block');
    assert(cfg.exitBlock !== undefined, 'CFG has exit block');
    // Add blocks and edges
    const b1 = builder.addBlock(cfgId, 'int x = 0', 'basic', ['int x = 0']);
    const b2 = builder.addBlock(cfgId, 'x++', 'basic', ['x++']);
    builder.addEdge(cfgId, cfg.entryBlock, b1, 'fallthrough');
    builder.addEdge(cfgId, b1, b2, 'jump');
    builder.addEdge(cfgId, b2, cfg.exitBlock, 'fallthrough');
    const updatedCfg = builder.getCFG(cfgId);
    assert(updatedCfg.blocks.length === 4, 'Added blocks appear in CFG');
    assert(updatedCfg.edges.length === 3, 'Added edges appear in CFG');
    // If-then-else CFG
    const ifId = builder.createCFG('IfThenElse');
    builder.buildIfThenElse(ifId, 'x > 0', 'then: positive', 'else: negative', 'merge');
    const ifCfg = builder.getCFG(ifId);
    assert(ifCfg !== undefined, 'If-then-else CFG created');
    assert(ifCfg.blocks.length >= 6, 'If-then-else has all blocks');
    assert(ifCfg.edges.some(e => e.type === 'true'), 'If-then-else has true branch');
    assert(ifCfg.edges.some(e => e.type === 'false'), 'If-then-else has false branch');
    // Loop CFG
    const loopId = builder.createCFG('Loop');
    builder.buildLoop(loopId, 'i', 'i = 0', 'i < 10', 'body: print(i)');
    const loopCfg = builder.getCFG(loopId);
    assert(loopCfg !== undefined, 'Loop CFG created');
    assert(loopCfg.edges.some(e => e.type === 'back_edge'), 'Loop CFG has back edge');
    // Switch CFG
    const switchId = builder.createCFG('Switch');
    builder.buildSwitch(switchId, 'color', [
        { value: 'red', block: 'handleRed' },
        { value: 'blue', block: 'handleBlue' },
    ], 'defaultHandler');
    const switchCfg = builder.getCFG(switchId);
    assert(switchCfg !== undefined, 'Switch CFG created');
    assert(switchCfg.blocks.length >= 7, 'Switch CFG has all blocks');
    // Dominator computation
    const dom = builder.computeDominators(ifId);
    const ifCfgFull = builder.getCFG(ifId);
    assert(ifCfgFull !== undefined, 'If CFG exists for dominators');
    assert(dom.size >= 1, 'Dominator computation works');
    // Loop detection
    const loops = builder.detectLoops(loopId);
    assert(loops.length >= 1, 'Loop detection finds loops');
    // Mermaid rendering
    const mermaid = builder.toMermaid(ifId);
    assert(mermaid.includes('graph TD'), 'Mermaid output for CFG');
    // Add block with instructions
    const detailedId = builder.createCFG('Detailed');
    const blockId = builder.addBlock(detailedId, 'int x = compute()', 'basic', ['int x = compute()', 'if (x > 0)']);
    const detailedCfg = builder.getCFG(detailedId);
    assert(detailedCfg !== undefined, 'Detailed CFG exists');
    const addedBlock = detailedCfg.blocks.find(b => b.id === blockId);
    assert(addedBlock !== undefined, 'Added block exists');
    assert(addedBlock.instructions !== undefined, 'Added block has instructions');
    assert(addedBlock.instructions.length === 2, 'Added block has correct instructions');
}
// ============ RUNNER ============
async function runLevels3to5Tests() {
    console.log('\n📊 Graph Engine Levels 3-5 Tests');
    console.log('─────────────────────────────────');
    console.log('\n📍 Level 3: Dependency Graph');
    await testDependencyGraph();
    console.log('\n📍 Level 4: Call Graph');
    await testCallGraph();
    console.log('\n📍 Level 5: Control Flow Graph');
    await testControlFlowGraph();
    console.log(`\n  ────────────────────`);
    console.log(`  ${passed}/${passed + failed} passed, ${failed} failed\n`);
    return { passed, failed };
}
if (require.main === module) {
    runLevels3to5Tests().then(r => process.exit(r.failed > 0 ? 1 : 0));
}
//# sourceMappingURL=graph-levels-3-5.test.js.map