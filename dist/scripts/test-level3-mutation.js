"use strict";
// L3 Mutation API Test — addNode, removeNode, addEdge, removeEdge, duplicate validation
Object.defineProperty(exports, "__esModule", { value: true });
const level3_dependency_1 = require("../packages/graph/src/level3-dependency");
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
    console.log('🔧 L3 Mutation API Test\n');
    const resolver = new level3_dependency_1.DependencyResolver();
    // ─── TEST 1: Duplicate node ID rejection ───
    try {
        resolver.createGraph('DupTest', [
            { id: 'a', name: 'A', type: 'library' },
            { id: 'a', name: 'A dup', type: 'library' },
        ], []);
        assert(false, 'Duplicate: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('Duplicate'), `Duplicate: throws (${e.message})`);
    }
    // ─── TEST 2: Edge referencing nonexistent target ───
    try {
        resolver.createGraph('BadEdge', [
            { id: 'a', name: 'A', type: 'library' },
        ], [{ source: 'a', target: 'ghost', type: 'depends_on' }]);
        assert(false, 'BadEdge: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `BadEdge: throws (${e.message})`);
    }
    // ─── TEST 3: addNode ───
    const gid = resolver.createGraph('MutationTest', [], []);
    resolver.addNode(gid, { id: 'a', name: 'A', type: 'library' });
    resolver.addNode(gid, { id: 'b', name: 'B', type: 'library' });
    resolver.addNode(gid, { id: 'c', name: 'C', type: 'library' });
    const graph = resolver.getGraph(gid);
    assert(graph.nodes.length === 3, 'addNode: 3 nodes');
    assert(graph.nodes.some(n => n.id === 'a'), 'addNode: a present');
    assert(graph.nodes.some(n => n.id === 'c'), 'addNode: c present');
    // ─── TEST 4: addNode duplicate rejection ───
    try {
        resolver.addNode(gid, { id: 'a', name: 'A dup', type: 'library' });
        assert(false, 'addDup: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('already exists'), `addDup: throws (${e.message})`);
    }
    // ─── TEST 5: addEdge ───
    resolver.addEdge(gid, { source: 'a', target: 'b', type: 'depends_on' });
    resolver.addEdge(gid, { source: 'b', target: 'c', type: 'depends_on' });
    const graph2 = resolver.getGraph(gid);
    assert(graph2.edges.length === 2, 'addEdge: 2 edges');
    assert(graph2.edges.some(e => e.source === 'a' && e.target === 'b'), 'addEdge: a→b');
    // ─── TEST 6: addEdge with invalid source ───
    try {
        resolver.addEdge(gid, { source: 'ghost', target: 'a', type: 'depends_on' });
        assert(false, 'addEdgeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `addEdgeBad: throws (${e.message})`);
    }
    // ─── TEST 7: removeEdge ───
    resolver.removeEdge(gid, 'a', 'b');
    const graph3 = resolver.getGraph(gid);
    assert(graph3.edges.length === 1, 'removeEdge: 1 edge remains');
    assert(!graph3.edges.some(e => e.source === 'a' && e.target === 'b'), 'removeEdge: a→b removed');
    // ─── TEST 8: removeEdge nonexistent ───
    try {
        resolver.removeEdge(gid, 'a', 'b');
        assert(false, 'removeEdgeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeEdgeBad: throws (${e.message})`);
    }
    // ─── TEST 9: removeNode ───
    resolver.removeNode(gid, 'c');
    const graph4 = resolver.getGraph(gid);
    assert(graph4.nodes.length === 2, 'removeNode: 2 nodes remain');
    assert(!graph4.nodes.some(n => n.id === 'c'), 'removeNode: c removed');
    assert(graph4.edges.length === 0, 'removeNode: connected edges removed');
    // ─── TEST 10: removeNode nonexistent ───
    try {
        resolver.removeNode(gid, 'ghost');
        assert(false, 'removeNodeBad: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeNodeBad: throws (${e.message})`);
    }
    // ─── TEST 11: Mutation + topological sort ───
    const tsId = resolver.createGraph('TopoSort', [
        { id: 'x', name: 'X', type: 'library' },
        { id: 'y', name: 'Y', type: 'library' },
        { id: 'z', name: 'Z', type: 'library' },
    ], [
        { source: 'x', target: 'y', type: 'depends_on' },
        { source: 'y', target: 'z', type: 'depends_on' },
    ]);
    let ts = resolver.topologicalSort(tsId);
    assert(ts.length === 3, 'TSort: 3 nodes initially');
    assert(ts[0] === 'z', 'TSort: z first (depends on nothing)');
    assert(ts[2] === 'x', 'TSort: x last (depends on y and z)');
    // Add a new node and edge
    resolver.addNode(tsId, { id: 'w', name: 'W', type: 'library' });
    resolver.addEdge(tsId, { source: 'z', target: 'w', type: 'depends_on' });
    ts = resolver.topologicalSort(tsId);
    assert(ts.length === 4, 'TSort: 4 nodes after mutation');
    assert(ts.includes('w'), 'TSort: w present');
    // Remove the new node
    resolver.removeNode(tsId, 'w');
    ts = resolver.topologicalSort(tsId);
    assert(ts.length === 3, 'TSort: 3 nodes after removal');
    // ─── TEST 12: addNode missing graph ───
    try {
        resolver.addNode('nonexistent', { id: 'x', name: 'X', type: 'library' });
        assert(false, 'addNodeMissing: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `addNodeMissing: throws (${e.message})`);
    }
    // ─── TEST 13: removeNode missing graph ───
    try {
        resolver.removeNode('nonexistent', 'x');
        assert(false, 'removeNodeMissing: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `removeNodeMissing: throws (${e.message})`);
    }
    // ─── TEST 14: addEdge missing graph ───
    try {
        resolver.addEdge('nonexistent', { source: 'a', target: 'b', type: 'depends_on' });
        assert(false, 'addEdgeMissing: should have thrown');
    }
    catch (e) {
        assert(e.message.includes('not found'), `addEdgeMissing: throws (${e.message})`);
    }
    console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
    if (f === 0)
        console.log('\n✅✅✅ L3 MUTATION API VERIFIED');
    process.exit(f > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-level3-mutation.js.map