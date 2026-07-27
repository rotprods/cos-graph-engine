"use strict";
// L1 Mutation API Test — addNode, removeNode, addEdge, removeEdge, duplicate validation
Object.defineProperty(exports, "__esModule", { value: true });
const level1_execution_1 = require("../packages/graph/src/level1-execution");
let p = 0, f = 0;
function assert(cond, msg) {
    if (cond) {
        p++;
        console.log(`  ✅ ${msg}`);
    }
    else {
        f++;
        console.log(`  ❌ ${msg}`);
    }
}
async function main() {
    console.log('🔧 L1 Mutation API Test\n');
    const engine = new level1_execution_1.ExecutionGraphEngine();
    // ─── TEST 1: Duplicate node ID rejection ───
    try {
        await engine.createGraph('DupTest', [
            { id: 'a', name: 'A', type: 'function', fn: async (i) => i },
            { id: 'a', name: 'A dup', type: 'function', fn: async (i) => i },
        ], []);
        assert(false, 'Duplicate: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('Duplicate'), `Duplicate: throws on duplicate ID (${e.message})`);
    }
    // ─── TEST 2: Edge referencing nonexistent node ───
    try {
        await engine.createGraph('BadEdge', [
            { id: 'a', name: 'A', type: 'function', fn: async (i) => i },
        ], [{ source: 'a', target: 'nonexistent' }]);
        assert(false, 'BadEdge: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `BadEdge: throws on invalid target (${e.message})`);
    }
    // ─── TEST 3: addNode ───
    const gid = await engine.createGraph('MutationTest', [], []);
    engine.addNode(gid, { id: 'n1', name: 'Node 1', type: 'function', fn: async (i) => i });
    engine.addNode(gid, { id: 'n2', name: 'Node 2', type: 'function', fn: async (i) => i });
    const graph = engine.getGraph(gid);
    assert(graph.nodes.length === 2, 'addNode: graph has 2 nodes');
    assert(graph.nodes.some(n => n.id === 'n1'), 'addNode: n1 present');
    assert(graph.nodes.some(n => n.id === 'n2'), 'addNode: n2 present');
    // ─── TEST 4: addNode duplicate rejection ───
    try {
        engine.addNode(gid, { id: 'n1', name: 'Node 1 dup', type: 'function', fn: async (i) => i });
        assert(false, 'addDup: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('already exists'), `addDup: throws on duplicate (${e.message})`);
    }
    // ─── TEST 5: addEdge ───
    engine.addEdge(gid, { source: 'n1', target: 'n2' });
    const graph2 = engine.getGraph(gid);
    assert(graph2.edges.length === 1, 'addEdge: graph has 1 edge');
    assert(graph2.edges.some(e => e.source === 'n1' && e.target === 'n2'), 'addEdge: n1→n2 present');
    // ─── TEST 6: addEdge with invalid source ───
    try {
        engine.addEdge(gid, { source: 'n1', target: 'ghost' });
        assert(false, 'addEdgeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `addEdgeBad: throws on invalid target (${e.message})`);
    }
    // ─── TEST 7: removeEdge by id ───
    const edgeId = graph2.edges[0].id;
    engine.removeEdge(gid, edgeId);
    assert(engine.getGraph(gid).edges.length === 0, 'removeEdge: edge removed');
    assert(engine.getGraph(gid).nodes.length === 2, 'removeEdge: nodes preserved');
    // ─── TEST 8: removeEdge nonexistent ───
    try {
        engine.removeEdge(gid, 'nonexistent');
        assert(false, 'removeEdgeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeEdgeBad: throws (${e.message})`);
    }
    // ─── TEST 9: removeNode ───
    engine.removeNode(gid, 'n1');
    const graph3 = engine.getGraph(gid);
    assert(graph3.nodes.length === 1, 'removeNode: 1 node remains');
    assert(graph3.nodes[0].id === 'n2', 'removeNode: n2 preserved');
    assert(graph3.edges.length === 0, 'removeNode: connected edges also removed');
    // ─── TEST 10: removeNode nonexistent ───
    try {
        engine.removeNode(gid, 'ghost');
        assert(false, 'removeNodeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeNodeBad: throws (${e.message})`);
    }
    // ─── TEST 11: addEdge auto-generates edge id ───
    engine.addNode(gid, { id: 'n3', name: 'Node 3', type: 'function', fn: async (i) => i });
    engine.addEdge(gid, { source: 'n2', target: 'n3' });
    const graph4 = engine.getGraph(gid);
    assert(graph4.edges[0].id !== undefined, 'addEdge: auto-generates edge id');
    // ─── TEST 12: Full mutation + execution ───
    const freshId = await engine.createGraph('Fresh', [], []);
    engine.addNode(freshId, { id: 'a', name: 'A', type: 'function', fn: async (i) => ({ ...i, done: true }) });
    engine.addNode(freshId, { id: 'b', name: 'B', type: 'function', fn: async (i) => ({ ...i, b: true }) });
    engine.addNode(freshId, { id: 'c', name: 'C', type: 'function', fn: async (i) => ({ ...i, c: true }) });
    engine.addEdge(freshId, { source: 'a', target: 'b' });
    engine.addEdge(freshId, { source: 'b', target: 'c' });
    const results = await engine.executeGraph(freshId, { seed: 42 });
    assert(results.size === 3, 'Exec: all 3 nodes executed');
    assert(Array.from(results.values()).every(r => r.status === 'completed'), 'Exec: all completed');
    assert(results.get('c')?.output?.c, 'Exec: data flows through mutated edges');
    // ─── TEST 13: Remove graph not found ───
    try {
        engine.removeNode('nonexistent', 'x');
        assert(false, 'removeNodeMissing: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeNodeMissing: throws (${e.message})`);
    }
    try {
        engine.addEdge('nonexistent', { source: 'a', target: 'b' });
        assert(false, 'addEdgeMissing: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `addEdgeMissing: throws (${e.message})`);
    }
    console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
    if (f === 0)
        console.log('\n✅✅✅ L1 MUTATION API VERIFIED');
    process.exit(f > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-level1-mutation.js.map