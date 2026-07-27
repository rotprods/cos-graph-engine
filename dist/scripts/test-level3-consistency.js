"use strict";
// COS Graph Engine — L3 Cross-Method Consistency Test
// Verifies: topologicalSort, computeDepth, findRoots, findLeaves,
// subgraph, detectCycle ALL agree on edge direction
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
    console.log('📐 L3 Cross-Method Consistency Test\n');
    const resolver = new level3_dependency_1.DependencyResolver();
    // Build known graph:
    // app → next, app → lodash, app → typescript
    // next → react, next → typescript
    // Convention: source depends on target
    // Dependencies: app depends on next, lodash, typescript
    //               next depends on react, typescript
    // Roots (no outgoing edges): react, lodash, typescript
    // Leaves (no incoming edges): app
    // Topological order: [react, lodash, typescript, next, app]
    const gid = resolver.createGraph('Consistency Test', [
        { id: 'react', name: 'React', type: 'library' },
        { id: 'next', name: 'Next', type: 'package' },
        { id: 'app', name: 'App', type: 'package' },
        { id: 'lodash', name: 'Lodash', type: 'library' },
        { id: 'typescript', name: 'TypeScript', type: 'library' },
        { id: 'webpack', name: 'Webpack', type: 'library' },
    ], [
        { source: 'next', target: 'react', type: 'depends_on' },
        { source: 'app', target: 'next', type: 'depends_on' },
        { source: 'app', target: 'lodash', type: 'depends_on' },
        { source: 'app', target: 'typescript', type: 'depends_on' },
        { source: 'next', target: 'typescript', type: 'depends_on' },
        { source: 'webpack', target: 'typescript', type: 'depends_on' },
    ]);
    // ============ TEST 1: Topological Sort ============
    const order = resolver.topologicalSort(gid);
    assert(order.length === 6, 'TSort: returns all 6 nodes');
    // Roots must be first
    const rootNodes = ['react', 'lodash', 'typescript'].map(s => s);
    const firstThree = order.slice(0, 3);
    assert(rootNodes.every(r => firstThree.includes(r)), 'TSort: roots are first (react, lodash, typescript)');
    // app must be last (depends on the most)
    assert(order[order.length - 1] === 'app', 'TSort: app is last');
    // next before app, after react and typescript
    const nextIdx = order.indexOf('next');
    const reactIdx = order.indexOf('react');
    const tsIdx = order.indexOf('typescript');
    const appIdx = order.indexOf('app');
    assert(reactIdx < nextIdx, 'TSort: react before next');
    assert(tsIdx < nextIdx, 'TSort: typescript before next');
    assert(nextIdx < appIdx, 'TSort: next before app');
    // ============ TEST 2: Cycle Detection ============
    const noCycle = resolver.detectCycle(gid);
    assert(noCycle === null, 'Cycle: no cycle in acyclic graph');
    // Build a cyclic graph
    const cycleId = resolver.createGraph('Cycle', [
        { id: 'a', name: 'A', type: 'module' },
        { id: 'b', name: 'B', type: 'module' },
        { id: 'c', name: 'C', type: 'module' },
    ], [
        { source: 'a', target: 'b', type: 'depends_on' },
        { source: 'b', target: 'c', type: 'depends_on' },
        { source: 'c', target: 'a', type: 'depends_on' },
    ]);
    const hasCycle = resolver.detectCycle(cycleId);
    assert(hasCycle !== null, 'Cycle: detects A→B→C→A cycle');
    assert(hasCycle.length >= 3, 'Cycle: path has 3+ nodes');
    // ============ TEST 3: Depth ============
    const depth = resolver.computeDepth(gid);
    assert(depth.get('react') === 0, 'Depth: react = 0 (root)');
    assert(depth.get('lodash') === 0, 'Depth: lodash = 0 (root)');
    assert(depth.get('typescript') === 0, 'Depth: typescript = 0 (root)');
    assert(depth.get('webpack') === 1, 'Depth: webpack = 1 (depends on typescript)');
    assert(depth.get('next') === 1, 'Depth: next = 1 (depends on react, typescript)');
    assert(depth.get('app') === 2, 'Depth: app = 2 (depends on next at depth 1, lodash/typescript at depth 0)');
    // ============ TEST 4: Roots and Leaves ============
    const roots = resolver.findRoots(gid);
    assert(roots.length === 3, 'Roots: 3 nodes (react, lodash, typescript)');
    assert(roots.every(r => r.id === 'react' || r.id === 'lodash' || r.id === 'typescript'), 'Roots: correct set');
    const leaves = resolver.findLeaves(gid);
    assert(leaves.length === 2, 'Leaves: 2 nodes (app, webpack)');
    assert(leaves.some(l => l.id === 'app'), 'Leaves: app is a leaf');
    assert(leaves.some(l => l.id === 'webpack'), 'Leaves: webpack is a leaf (nothing depends on it)');
    // ============ TEST 5: Subgraph ============
    const sub = resolver.subgraph(gid, 'next');
    assert(sub !== null, 'Subgraph: exists');
    assert(sub.nodes.length >= 2, 'Subgraph: contains next + its dependencies');
    // next depends on react and typescript
    const subIds = sub.nodes.map(n => n.id);
    assert(subIds.includes('next'), 'Subgraph: includes next');
    assert(subIds.includes('react'), 'Subgraph: includes react (dependency of next)');
    assert(subIds.includes('typescript'), 'Subgraph: includes typescript (dependency of next)');
    // ============ TEST 6: Determinism ============
    const order2 = resolver.topologicalSort(gid);
    assert(order.every((id, i) => id === order2[i]), 'Determinism: topological sort produces identical order');
    const order3 = resolver.topologicalSort(gid);
    assert(order.every((id, i) => id === order3[i]), 'Determinism: 3rd call also identical');
    // ============ TEST 7: Empty Graph ============
    const emptyId = resolver.createGraph('Empty', [], []);
    assert(resolver.topologicalSort(emptyId).length === 0, 'Empty: topological sort returns []');
    assert(resolver.detectCycle(emptyId) === null, 'Empty: no cycle');
    assert(resolver.findRoots(emptyId).length === 0, 'Empty: no roots');
    assert(resolver.findLeaves(emptyId).length === 0, 'Empty: no leaves');
    assert(resolver.subgraph(emptyId, 'nonexistent')?.nodes.length === 0, 'Empty: subgraph returns empty for missing node');
    // ============ SUMMARY ============
    console.log(`\n${p + f} tests, ${p} passed, ${f} failed`);
    if (f === 0)
        console.log('\n✅✅✅ L3 CROSS-METHOD CONSISTENCY VERIFIED');
    process.exit(f > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-level3-consistency.js.map