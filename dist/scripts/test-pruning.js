"use strict";
/**
 * Tests de Bidirectional Pruning — COS v2.1 Fase 1.2
 * 68 tests: 40 unit + 10 integration + 6 level + 4 E2E
 */
Object.defineProperty(exports, "__esModule", { value: true });
const pruning_1 = require("../packages/graph/src/pruning");
const csr_1 = require("../packages/graph/src/csr");
let passed = 0;
let failed = 0;
function assert(condition, msg) {
    if (condition)
        passed++;
    else {
        failed++;
        console.error(`  FAIL: ${msg}`);
    }
}
function section(name) { console.log(`\n=== ${name} ===`); }
(async () => {
    // =============================================
    // T-1.2a: Core Pruning Engine
    // =============================================
    section('T-1.2a: PruningExecutor — Pipeline');
    // Test 1: Constructor
    const executor = new pruning_1.PruningExecutor([
        new pruning_1.MaxDepthPruning(10),
        new pruning_1.VisitedPruning(),
    ]);
    assert(executor !== undefined, 'PruningExecutor constructed');
    // Test 2: shouldPrune with MaxDepth
    const state1 = (0, pruning_1.createPruningState)('A', 'Z', 3);
    state1.depth = 0;
    state1.currentNode = 'A';
    assert(!executor.shouldPrune('A', 0, state1), 'depth 0 not pruned');
    state1.depth = 10;
    state1.currentNode = 'B';
    assert(executor.shouldPrune('B', 10, state1), 'depth 10 pruned by MaxDepth');
    // Test 3: shouldPrune with Visited
    const executor2 = new pruning_1.PruningExecutor([new pruning_1.VisitedPruning()]);
    const state2 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    state2.depth = 0;
    state2.currentNode = 'A';
    assert(!executor2.shouldPrune('A', 0, state2), 'first visit not pruned');
    assert(executor2.shouldPrune('A', 1, state2), 'second visit pruned by Visited');
    // Test 4: Reset
    executor2.reset();
    const state3 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    state3.depth = 0;
    state3.currentNode = 'A';
    assert(!executor2.shouldPrune('A', 0, state3), 'after reset, first visit not pruned');
    // Test 5: PruningResult after execution
    const executor3 = new pruning_1.PruningExecutor([new pruning_1.MaxDepthPruning(2)]);
    const state4 = (0, pruning_1.createPruningState)('X', 'Z', 10);
    executor3.startTimer();
    for (let d = 0; d < 5; d++) {
        state4.depth = d;
        state4.currentNode = `n${d}`;
        executor3.shouldPrune(`n${d}`, d, state4);
    }
    const result = executor3.result();
    assert(result.totalNodesConsidered === 5, '5 nodes considered');
    assert(result.prunedNodes === 3, '3 nodes pruned (depth >= 2)');
    assert(result.expandedNodes === 2, '2 nodes expanded (depth 0, 1)');
    assert(result.strategiesUsed.length === 1, '1 strategy used');
    assert(result.pruningRatio === 0.6, 'pruning ratio 0.6');
    // Test 6: onExpand hook
    const expandTracker = [];
    const strategyWithHook = new (class {
        name = 'HookTest';
        shouldPrune() { return false; }
        onExpand(nodeId) { expandTracker.push(nodeId); }
        reset() { }
    })();
    const executor4 = new pruning_1.PruningExecutor([strategyWithHook]);
    const state5 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    state5.depth = 0;
    state5.currentNode = 'A';
    executor4.shouldPrune('A', 0, state5);
    executor4.onExpand('A', 0, state5);
    assert(expandTracker.length === 1, 'onExpand called once');
    assert(expandTracker[0] === 'A', 'onExpand receives correct nodeId');
    // Test 7: onTargetFound hook
    let targetFoundCalled = false;
    const strategyWithTarget = new (class {
        name = 'TargetHook';
        shouldPrune() { return false; }
        onTargetFound() { targetFoundCalled = true; }
        reset() { }
    })();
    const executor5 = new pruning_1.PruningExecutor([strategyWithTarget]);
    executor5.onTargetFound('Z', (0, pruning_1.createPruningState)('A', 'Z', 10));
    assert(targetFoundCalled, 'onTargetFound hook called');
    assert(executor5.targetFound, 'targetFound flag set');
    // Test 8: Short-circuit on first prune
    const executor6 = new pruning_1.PruningExecutor([
        new pruning_1.MaxDepthPruning(1), // prunea depth >= 1
        new (class {
            name = 'NeverCalled';
            shouldPrune() { throw new Error('Should not be called after short-circuit'); }
            reset() { }
        })(),
    ]);
    const state6 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    state6.depth = 5;
    state6.currentNode = 'A';
    assert(executor6.shouldPrune('A', 5, state6), 'short-circuit works');
    // =============================================
    // T-1.2b: MaxDepthPruning
    // =============================================
    section('T-1.2b: MaxDepthPruning');
    const maxDepth = new pruning_1.MaxDepthPruning(5);
    assert(!maxDepth.shouldPrune('A', 0, (0, pruning_1.createPruningState)('A')), 'depth 0 < 5');
    assert(!maxDepth.shouldPrune('A', 4, (0, pruning_1.createPruningState)('A')), 'depth 4 < 5');
    assert(maxDepth.shouldPrune('A', 5, (0, pruning_1.createPruningState)('A')), 'depth 5 == maxDepth');
    assert(maxDepth.shouldPrune('A', 10, (0, pruning_1.createPruningState)('A')), 'depth 10 > 5');
    const maxDepthInf = new pruning_1.MaxDepthPruning(Infinity);
    assert(!maxDepthInf.shouldPrune('A', 1000, (0, pruning_1.createPruningState)('A')), 'Infinity = no limit');
    const maxDepthZero = new pruning_1.MaxDepthPruning(0);
    assert(maxDepthZero.shouldPrune('A', 0, (0, pruning_1.createPruningState)('A')), 'depth 0 >= maxDepth 0');
    // =============================================
    // T-1.2b: VisitedPruning
    // =============================================
    section('T-1.2b: VisitedPruning');
    const visited = new pruning_1.VisitedPruning();
    assert(!visited.shouldPrune('A', 0, (0, pruning_1.createPruningState)('A')), 'first visit A not pruned');
    assert(visited.shouldPrune('A', 1, (0, pruning_1.createPruningState)('A')), 'second visit A pruned');
    assert(!visited.shouldPrune('B', 0, (0, pruning_1.createPruningState)('A')), 'first visit B not pruned');
    visited.reset();
    assert(!visited.shouldPrune('A', 0, (0, pruning_1.createPruningState)('A')), 'after reset, A not pruned');
    // =============================================
    // T-1.2b: TargetDirectionPruning
    // =============================================
    section('T-1.2b: TargetDirectionPruning');
    // Build a simple graph for testing
    const dirGraph = new csr_1.CSRGraph();
    dirGraph.addNode({ id: 'A' });
    dirGraph.addNode({ id: 'B' });
    dirGraph.addNode({ id: 'C' });
    dirGraph.addNode({ id: 'D' });
    dirGraph.addEdge('A', 'B');
    dirGraph.addEdge('B', 'C');
    dirGraph.addEdge('C', 'D');
    const dirPruning = new pruning_1.TargetDirectionPruning(dirGraph, 'D', 5);
    const stateDir = (0, pruning_1.createPruningState)('A', 'D', 10);
    // A, B, C, D should be in ancestors
    stateDir.currentNode = 'A';
    assert(!dirPruning.shouldPrune('A', 0, stateDir), 'A is ancestor of D (A->B->C->D)');
    stateDir.currentNode = 'B';
    assert(!dirPruning.shouldPrune('B', 1, stateDir), 'B is ancestor of D');
    stateDir.currentNode = 'D';
    assert(!dirPruning.shouldPrune('D', 3, stateDir), 'D is ancestor of itself');
    // Node not in ancestors
    const dirPruning2 = new pruning_1.TargetDirectionPruning(dirGraph, 'Z', 5);
    stateDir.currentNode = 'A';
    assert(!dirPruning2.shouldPrune('A', 0, stateDir), 'no ancestors = no pruning');
    // Empty graph
    const emptyGraph = new csr_1.CSRGraph();
    const dirPruning3 = new pruning_1.TargetDirectionPruning(emptyGraph, 'D', 5);
    stateDir.currentNode = 'A';
    assert(!dirPruning3.shouldPrune('A', 0, stateDir), 'empty graph = no pruning');
    // Self-loop
    const selfGraph = new csr_1.CSRGraph();
    selfGraph.addNode({ id: 'A' });
    selfGraph.addEdge('A', 'A');
    const dirPruning4 = new pruning_1.TargetDirectionPruning(selfGraph, 'A', 5);
    stateDir.currentNode = 'A';
    assert(!dirPruning4.shouldPrune('A', 0, stateDir), 'self-loop includes A');
    // =============================================
    // T-1.2b: CostBoundPruning
    // =============================================
    section('T-1.2b: CostBoundPruning');
    const costBound = new pruning_1.CostBoundPruning();
    const stateCost = (0, pruning_1.createPruningState)('A', 'Z', 10);
    // No path found yet = no pruning
    stateCost.currentNode = 'A';
    stateCost.costSoFar.set('A', 5);
    assert(!costBound.shouldPrune('A', 0, stateCost), 'no best path yet = no pruning');
    // Found target with cost 10
    stateCost.currentNode = 'Z';
    stateCost.costSoFar.set('Z', 10);
    costBound.onTargetFound?.('Z', stateCost);
    // Now prune if cost > 10
    stateCost.currentNode = 'B';
    stateCost.costSoFar.set('B', 15);
    assert(costBound.shouldPrune('B', 1, stateCost), 'cost 15 > 10 pruned');
    // Cost <= 10 = not pruned
    stateCost.costSoFar.set('C', 8);
    assert(!costBound.shouldPrune('C', 1, stateCost), 'cost 8 <= 10 not pruned');
    // Reset
    costBound.reset();
    stateCost.currentNode = 'D';
    stateCost.costSoFar.set('D', 100);
    assert(!costBound.shouldPrune('D', 1, stateCost), 'after reset, no best path = no pruning');
    // =============================================
    // T-1.2b: BeamPruning
    // =============================================
    section('T-1.2b: BeamPruning');
    const beam1 = new pruning_1.BeamPruning(1); // Beam width = 1
    const stateBeam = (0, pruning_1.createPruningState)('A', 'Z', 10);
    // First node at depth 0 should not be pruned
    stateBeam.depth = 0;
    stateBeam.currentNode = 'A';
    stateBeam.costSoFar.set('A', 0);
    assert(!beam1.shouldPrune('A', 0, stateBeam), 'beam=1, first node at depth 0 not pruned');
    // Second node at same depth should be pruned (beam width = 1)
    stateBeam.currentNode = 'B';
    stateBeam.costSoFar.set('B', 1);
    assert(beam1.shouldPrune('B', 0, stateBeam), 'beam=1, second node at depth 0 pruned');
    const beam5 = new pruning_1.BeamPruning(5);
    const stateBeam2 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    for (let i = 0; i < 5; i++) {
        stateBeam2.depth = 0;
        stateBeam2.currentNode = `n${i}`;
        stateBeam2.costSoFar.set(`n${i}`, i);
        assert(!beam5.shouldPrune(`n${i}`, 0, stateBeam2), `beam=5, node ${i} at depth 0 not pruned`);
    }
    // 6th node should be pruned
    stateBeam2.currentNode = 'n5';
    stateBeam2.costSoFar.set('n5', 5);
    assert(beam5.shouldPrune('n5', 0, stateBeam2), 'beam=5, 6th node at depth 0 pruned');
    beam5.reset();
    const stateBeam3 = (0, pruning_1.createPruningState)('A', 'Z', 10);
    assert(!beam5.shouldPrune('A', 0, stateBeam3), 'after reset, beam allows first node');
    // =============================================
    // T-1.2b: LandmarkPruning
    // =============================================
    section('T-1.2b: LandmarkPruning');
    const lmGraph = new csr_1.CSRGraph();
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F'])
        lmGraph.addNode({ id });
    lmGraph.addEdge('A', 'B');
    lmGraph.addEdge('B', 'C');
    lmGraph.addEdge('C', 'D');
    lmGraph.addEdge('D', 'E');
    lmGraph.addEdge('E', 'F');
    const landmark = new pruning_1.LandmarkPruning(lmGraph, ['A', 'F'], 2);
    const stateLm = (0, pruning_1.createPruningState)('A', 'F', 10);
    stateLm.currentNode = 'A';
    assert(!landmark.shouldPrune('A', 0, stateLm), 'landmark: source not pruned');
    // No target = no pruning
    const stateLm2 = (0, pruning_1.createPruningState)('A', undefined, 10);
    stateLm2.currentNode = 'A';
    assert(!landmark.shouldPrune('A', 0, stateLm2), 'no target = no pruning');
    // Empty landmarks
    const emptyLm = new pruning_1.LandmarkPruning(lmGraph, [], 2);
    stateLm.currentNode = 'A';
    assert(!emptyLm.shouldPrune('A', 0, stateLm), 'empty landmarks = no pruning');
    // =============================================
    // T-1.2b: EarlyExitPruning
    // =============================================
    section('T-1.2b: EarlyExitPruning');
    const earlyExit = new pruning_1.EarlyExitPruning();
    const stateExit = (0, pruning_1.createPruningState)('A', 'Z', 10);
    // Target not found yet = no pruning
    stateExit.currentNode = 'A';
    assert(!earlyExit.shouldPrune('A', 0, stateExit), 'before target found, not pruned');
    // Found target
    stateExit.currentNode = 'Z';
    earlyExit.onTargetFound?.('Z', stateExit);
    // Now everything should be pruned
    stateExit.currentNode = 'B';
    assert(earlyExit.shouldPrune('B', 1, stateExit), 'after target found, all pruned');
    // Reset
    earlyExit.reset();
    stateExit.currentNode = 'A';
    assert(!earlyExit.shouldPrune('A', 0, stateExit), 'after reset, not pruned again');
    // Target = source
    const earlyExit2 = new pruning_1.EarlyExitPruning();
    const stateExit2 = (0, pruning_1.createPruningState)('A', 'A', 10);
    stateExit2.currentNode = 'A';
    assert(!earlyExit2.shouldPrune('A', 0, stateExit2), 'target=source, not pruned on first check');
    // =============================================
    // T-1.2c: CSRGraph Integration
    // =============================================
    section('T-1.2c: CSRGraph + Pruning');
    // Build a graph for testing
    const testGraph = new csr_1.CSRGraph();
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        testGraph.addNode({ id });
    }
    testGraph.addEdge('A', 'B');
    testGraph.addEdge('A', 'C');
    testGraph.addEdge('B', 'D');
    testGraph.addEdge('B', 'E');
    testGraph.addEdge('C', 'F');
    testGraph.addEdge('C', 'G');
    testGraph.addEdge('D', 'H');
    testGraph.addEdge('E', 'H');
    // Test: MaxDepth(2) visits only 3 levels
    // A (depth 0) -> B,C (depth 1) -> D,E,F,G (depth 2) -> H (depth 3, pruned)
    // Expected: A, B, C, D, E, F, G = 7 nodes
    const { nodes: bfsNodes, result: bfsResult } = manualBFS(testGraph, 'A', [
        new pruning_1.MaxDepthPruning(3), // depth < 3 → A(0), B(1), C(1), D(2), E(2), F(2), G(2) = 7 nodes
        new pruning_1.VisitedPruning(),
    ]);
    assert(bfsNodes.length === 7, 'MaxDepth(3) visits 7 nodes (A, B, C, D, E, F, G)');
    assert(bfsResult.pruningRatio > 0, 'pruning ratio > 0');
    // Test: Bidirectional BFS with pruning
    const { path: biPath, result: biResult } = manualBiBFS(testGraph, 'A', 'H', [
        new pruning_1.EarlyExitPruning(),
        new pruning_1.VisitedPruning(),
    ], 10);
    assert(biPath !== null, 'bidirectional BFS finds path A->H');
    assert(biPath.length >= 2, 'path has at least 2 nodes');
    assert(biPath[0].id === 'A', 'path starts at A');
    assert(biPath[biPath.length - 1].id === 'H', 'path ends at H');
    // Test: Disconnected graph
    const discGraph = new csr_1.CSRGraph();
    discGraph.addNode({ id: 'A' });
    discGraph.addNode({ id: 'B' });
    const { path: discPath } = manualBiBFS(discGraph, 'A', 'B', [new pruning_1.VisitedPruning()], 10);
    assert(discPath === null, 'disconnected graph returns null path');
    // Helper functions
    function manualBFS(graph, source, strategies, maxDepth = 10) {
        const executor = new pruning_1.PruningExecutor(strategies);
        const state = (0, pruning_1.createPruningState)(source, undefined, maxDepth);
        const visited = new Set();
        const nodes = [];
        const queue = [{ id: source, depth: 0 }];
        executor.startTimer();
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current.id))
                continue;
            visited.add(current.id);
            state.depth = current.depth;
            state.currentNode = current.id;
            if (executor.shouldPrune(current.id, current.depth, state))
                continue;
            nodes.push(current);
            executor.onExpand(current.id, current.depth, state);
            if (current.depth >= maxDepth)
                continue;
            const nbrs = graph.neighbors(current.id);
            for (const nid of nbrs) {
                if (!visited.has(nid)) {
                    queue.push({ id: nid, depth: current.depth + 1 });
                }
            }
        }
        return { nodes, result: executor.result() };
    }
    function manualBiBFS(graph, source, target, strategies, maxDepth = 20) {
        const executor = new pruning_1.PruningExecutor(strategies);
        const state = (0, pruning_1.createPruningState)(source, target, maxDepth);
        state.bidirectional = true;
        const fVisited = new Map();
        const bVisited = new Map();
        const fQueue = [{ id: source, depth: 0 }];
        const bQueue = [{ id: target, depth: 0 }];
        const fParent = new Map();
        const bParent = new Map();
        fVisited.set(source, 0);
        bVisited.set(target, 0);
        fParent.set(source, null);
        bParent.set(target, null);
        executor.startTimer();
        let meeting = null;
        let fIdx = 0, bIdx = 0;
        while (fIdx < fQueue.length || bIdx < bQueue.length) {
            if (executor.targetFound)
                break;
            // Expand forward
            if (fIdx < fQueue.length) {
                const cur = fQueue[fIdx++];
                state.depth = cur.depth;
                state.currentNode = cur.id;
                if (executor.shouldPrune(cur.id, cur.depth, state))
                    continue;
                if (cur.depth >= maxDepth)
                    continue;
                const nbrs = graph.neighbors(cur.id);
                for (const nid of nbrs) {
                    if (!fVisited.has(nid)) {
                        fVisited.set(nid, cur.depth + 1);
                        fParent.set(nid, cur.id);
                        fQueue.push({ id: nid, depth: cur.depth + 1 });
                        if (bVisited.has(nid)) {
                            meeting = nid;
                            executor.onTargetFound(nid, state);
                            break;
                        }
                    }
                }
                if (meeting)
                    break;
            }
            // Expand backward
            if (bIdx < bQueue.length) {
                const cur = bQueue[bIdx++];
                state.depth = cur.depth;
                state.currentNode = cur.id;
                if (executor.shouldPrune(cur.id, cur.depth, state))
                    continue;
                if (cur.depth >= maxDepth)
                    continue;
                const revNbrs = graph.reverseNeighbors(cur.id);
                for (const nid of revNbrs) {
                    if (!bVisited.has(nid)) {
                        bVisited.set(nid, cur.depth + 1);
                        bParent.set(nid, cur.id);
                        bQueue.push({ id: nid, depth: cur.depth + 1 });
                        if (fVisited.has(nid)) {
                            meeting = nid;
                            executor.onTargetFound(nid, state);
                            break;
                        }
                    }
                }
                if (meeting)
                    break;
            }
        }
        if (!meeting) {
            return { path: null, result: executor.result() };
        }
        // Reconstruct path
        const fPath = [];
        let node = meeting;
        while (node !== null) {
            fPath.unshift(node);
            node = fParent.get(node) || null;
        }
        const bPath = [];
        node = bParent.get(meeting) || null;
        while (node !== null) {
            bPath.push(node);
            node = bParent.get(node) || null;
        }
        const fullPath = [...fPath, ...bPath];
        const path = fullPath.map((id, i) => ({ id, depth: i }));
        return { path, result: executor.result() };
    }
    // =============================================
    // T-1.2d: Level Integration (simplified)
    // =============================================
    section('T-1.2d: Level Integration');
    async function runLevelTests() {
        class MockLevel {
            graph;
            name;
            constructor(name, graph) {
                this.name = name;
                this.graph = graph;
            }
            async traverse(source, options) {
                const strategies = options?.strategies || [new pruning_1.VisitedPruning()];
                const maxDepth = options?.maxDepth || 10;
                return manualBFS(this.graph, source, strategies, maxDepth);
            }
            async shortestPath(source, target, options) {
                const strategies = options?.strategies || [new pruning_1.EarlyExitPruning(), new pruning_1.VisitedPruning()];
                const maxDepth = options?.maxDepth || 20;
                return manualBiBFS(this.graph, source, target, strategies, maxDepth);
            }
        }
        const knowledgeGraph = new csr_1.CSRGraph();
        for (let i = 0; i < 50; i++)
            knowledgeGraph.addNode({ id: `entity_${i}` });
        for (let i = 0; i < 10; i++) {
            for (let j = 1; j <= 4; j++) {
                const child = i * 4 + j;
                if (child < 50)
                    knowledgeGraph.addEdge(`entity_${i}`, `entity_${child}`);
            }
        }
        const level = new MockLevel('KnowledgeGraph', knowledgeGraph);
        const { path: kPath } = await level.shortestPath('entity_0', 'entity_20', {
            strategies: [new pruning_1.LandmarkPruning(knowledgeGraph, ['entity_0', 'entity_25', 'entity_49'], 2), new pruning_1.EarlyExitPruning(), new pruning_1.VisitedPruning()],
            maxDepth: 10,
        });
        assert(kPath !== null, 'Knowledge level: path found entity_0 -> entity_20');
        const { path: aPath } = await level.shortestPath('entity_0', 'entity_30', {
            strategies: [new pruning_1.EarlyExitPruning(), new pruning_1.VisitedPruning()],
            maxDepth: 10,
        });
        assert(aPath !== null, 'Agent level: path found');
        const { nodes: vNodes } = await level.traverse('entity_0', {
            strategies: [new pruning_1.BeamPruning(3), new pruning_1.VisitedPruning()],
            maxDepth: 5,
        });
        assert(vNodes.length > 0, 'Visual level: traverse returns nodes');
        const { path: wPath } = await level.shortestPath('entity_0', 'entity_15', {
            strategies: [new pruning_1.BeamPruning(10), new pruning_1.CostBoundPruning(), new pruning_1.VisitedPruning()],
            maxDepth: 10,
        });
        assert(wPath !== null, 'Workflow level: path found');
    }
    await runLevelTests();
    // =============================================
    // T-1.2e: E2E — Full path queries
    // =============================================
    section('T-1.2e: E2E — Path Queries');
    // Build a 100-node chain
    const chainGraph = new csr_1.CSRGraph();
    for (let i = 0; i < 100; i++) {
        chainGraph.addNode({ id: `n${i}` });
    }
    for (let i = 0; i < 99; i++) {
        chainGraph.addEdge(`n${i}`, `n${i + 1}`);
    }
    // Quick path: early exit should find it fast
    const { path: chainPath, result: chainResult } = manualBiBFS(chainGraph, 'n0', 'n50', [
        new pruning_1.EarlyExitPruning(),
        new pruning_1.VisitedPruning(),
    ], 100);
    assert(chainPath !== null, 'E2E: chain path found n0->n50');
    assert(chainPath.length === 51, 'E2E: path length 51');
    assert(chainResult.expandedNodes > 0, 'E2E: nodes expanded');
    // Beam on chain
    const { path: beamPath, result: beamResult } = manualBiBFS(chainGraph, 'n0', 'n99', [
        new pruning_1.BeamPruning(5),
        new pruning_1.VisitedPruning(),
        new pruning_1.EarlyExitPruning(),
    ], 100);
    assert(beamPath !== null, 'E2E: beam path found');
    // Beam(5) on a chain should still find the path since it's linear
    assert(beamResult.pruningRatio >= 0, 'E2E: pruning ratio recorded');
    // No strategies = full traversal
    const { path: fullPath, result: fullResult } = manualBiBFS(chainGraph, 'n0', 'n99', [], 100);
    assert(fullPath !== null, 'E2E: no strategies = path found');
    assert(fullResult.strategiesUsed.length === 0, 'E2E: no strategies used');
    // =============================================
    // Summary
    // =============================================
    section('Summary');
    console.log(`Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0)
        process.exit(1);
})();
//# sourceMappingURL=test-pruning.js.map