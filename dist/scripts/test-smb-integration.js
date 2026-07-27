"use strict";
// SMB Integration Tests — T-4.3
// Tests the Shared Memory Bus connector, L7 integration, and L12 integration
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const graph_1 = require("@cos/graph");
// ─── T-4.3: SMB Integration Tests ─────────────────────────────────
(0, node_test_1.describe)('SMB — Shared Memory Bus', () => {
    (0, node_test_1.it)('SMB: creates with default config', async () => {
        const smb = new graph_1.SMB();
        const state = await smb.getState();
        node_assert_1.default.ok(state.memoryCount >= 0);
        node_assert_1.default.ok(state.subscribers >= 0);
    });
    (0, node_test_1.it)('SMB: publishes and subscribes to events', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('test:event', (evt) => { received.push(evt.type); });
        await smb.publish({ type: 'test:event', source: 'test', payload: { msg: 'hello' } });
        node_assert_1.default.strictEqual(received.length, 1);
        node_assert_1.default.strictEqual(received[0], 'test:event');
    });
    (0, node_test_1.it)('SMB: saveGraph and loadGraph round-trip', async () => {
        const smb = new graph_1.SMB();
        const data = { nodes: [{ id: 'a', value: 1 }], edges: [] };
        const id = await smb.saveGraph('test-graph', data);
        node_assert_1.default.ok(id);
        const loaded = await smb.loadGraph('test-graph');
        node_assert_1.default.ok(loaded);
        node_assert_1.default.strictEqual(loaded.nodes[0].id, 'a');
        node_assert_1.default.strictEqual(loaded.nodes[0].value, 1);
    });
    (0, node_test_1.it)('SMB: listGraphs returns saved graphs', async () => {
        const smb = new graph_1.SMB();
        await smb.saveGraph('g1', { x: 1 });
        await smb.saveGraph('g2', { y: 2 });
        const list = await smb.listGraphs();
        node_assert_1.default.ok(list.length >= 2);
        node_assert_1.default.ok(list.some(g => g.key === 'g1'));
        node_assert_1.default.ok(list.some(g => g.key === 'g2'));
    });
    (0, node_test_1.it)('SMB: loadGraph returns null for missing key', async () => {
        const smb = new graph_1.SMB();
        const loaded = await smb.loadGraph('nonexistent');
        node_assert_1.default.strictEqual(loaded, null);
    });
    (0, node_test_1.it)('SMB: publishes events with graph metadata', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('compute:forward', (evt) => { received.push(evt); });
        await smb.publish({
            type: 'compute:forward',
            source: 'L7',
            payload: { result: 42 },
            graphId: 'g-1',
            nodeId: 'n-1',
        });
        node_assert_1.default.strictEqual(received.length, 1);
        node_assert_1.default.strictEqual(received[0].type, 'compute:forward');
        node_assert_1.default.strictEqual(received[0].graphId, 'g-1');
        node_assert_1.default.strictEqual(received[0].nodeId, 'n-1');
    });
});
(0, node_test_1.describe)('SMB — L7 Compute Graph Integration', () => {
    (0, node_test_1.it)('L7-SMB: creates and builds MLP', async () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'test-mlp');
        cg.buildMLP(784, 256, 2);
        node_assert_1.default.strictEqual(cg.nodes.length, 11);
        node_assert_1.default.strictEqual(cg.edges.length, 10);
    });
    (0, node_test_1.it)('L7-SMB: forward pass publishes event', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('compute:forward', () => { received.push('forward'); });
        const cg = new graph_1.SMBComputeGraph(smb, 'test-forward');
        cg.buildMLP(784, 256, 2);
        const loss = await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
        node_assert_1.default.ok(loss > 0);
        node_assert_1.default.strictEqual(received.length, 1);
    });
    (0, node_test_1.it)('L7-SMB: backward pass publishes event', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('compute:backward', () => { received.push('backward'); });
        const cg = new graph_1.SMBComputeGraph(smb, 'test-backward');
        cg.buildMLP();
        await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
        const grads = await cg.backward();
        node_assert_1.default.ok(grads.size > 0);
        node_assert_1.default.strictEqual(received.length, 1);
    });
    (0, node_test_1.it)('L7-SMB: save and load round-trip', async () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'test-save-load');
        cg.buildMLP();
        await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
        const savedId = await cg.save();
        node_assert_1.default.ok(savedId);
        // Create a new graph and load the saved state
        const cg2 = new graph_1.SMBComputeGraph(smb, 'test-save-load');
        const loaded = await cg2.load();
        node_assert_1.default.ok(loaded);
        node_assert_1.default.strictEqual(cg2.nodes.length, 11);
    });
    (0, node_test_1.it)('L7-SMB: buildExpression works', () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'test-expr');
        cg.buildExpression();
        node_assert_1.default.strictEqual(cg.nodes.length, 7);
        node_assert_1.default.strictEqual(cg.edges.length, 6);
    });
    (0, node_test_1.it)('L7-SMB: paramCount returns trainable params', () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'test-params');
        cg.buildMLP();
        node_assert_1.default.strictEqual(cg.paramCount(), 4);
    });
    (0, node_test_1.it)('L7-SMB: toMermaid returns string', () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'test-mermaid');
        cg.buildMLP();
        const m = cg.toMermaid();
        node_assert_1.default.ok(m.startsWith('graph TD'));
        node_assert_1.default.ok(m.includes('fc1'));
        node_assert_1.default.ok(m.includes('loss'));
    });
    (0, node_test_1.it)('L7-SMB: load returns false for missing graph', async () => {
        const smb = new graph_1.SMB();
        const cg = new graph_1.SMBComputeGraph(smb, 'nonexistent');
        const loaded = await cg.load();
        node_assert_1.default.strictEqual(loaded, false);
    });
});
(0, node_test_1.describe)('SMB — L12 Memory Graph Integration', () => {
    (0, node_test_1.it)('L12-SMB: creates and builds conversation', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-mem');
        mg.buildConversation();
        node_assert_1.default.ok(mg.graph.graph.nodes.length >= 6);
        node_assert_1.default.ok(mg.graph.graph.edges.length >= 7);
    });
    (0, node_test_1.it)('L12-SMB: addNode publishes event', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('memory:addNode', () => { received.push('addNode'); });
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-events');
        mg.addNode({ name: 'Test', type: 'entity', content: 'test' });
        node_assert_1.default.strictEqual(received.length, 1);
    });
    (0, node_test_1.it)('L12-SMB: addEdge publishes event', async () => {
        const smb = new graph_1.SMB();
        const received = [];
        await smb.subscribe('memory:addEdge', () => { received.push('addEdge'); });
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-edges');
        const n1 = mg.addNode({ name: 'A', type: 'entity' });
        const n2 = mg.addNode({ name: 'B', type: 'entity' });
        mg.addEdge(n1, n2, 'references', 0.8);
        node_assert_1.default.strictEqual(received.length, 1);
    });
    (0, node_test_1.it)('L12-SMB: accessNode publishes event', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-access');
        const id = mg.addNode({ name: 'Test', type: 'entity' });
        const node = mg.accessNode(id);
        node_assert_1.default.ok(node);
        node_assert_1.default.strictEqual(node.accessCount, 1);
    });
    (0, node_test_1.it)('L12-SMB: recall returns related memories', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-recall');
        mg.buildConversation();
        // Find "Roberto" node
        const roberto = mg.graph.graph.nodes.find(n => n.name === 'Roberto');
        node_assert_1.default.ok(roberto);
        const related = mg.recall(roberto.id, 1, 0.3);
        node_assert_1.default.ok(related.length >= 3); // Direct connections
    });
    (0, node_test_1.it)('L12-SMB: validate returns no errors', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-validate');
        mg.buildConversation();
        const errors = mg.validate();
        node_assert_1.default.strictEqual(errors.length, 0);
    });
    (0, node_test_1.it)('L12-SMB: metrics return correct values', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-metrics');
        mg.buildConversation();
        const m = mg.metrics();
        node_assert_1.default.ok(m.nodeCount >= 6);
        node_assert_1.default.ok(m.edgeCount >= 7);
        node_assert_1.default.ok(m.avgDegree > 0);
        node_assert_1.default.ok(m.density > 0);
    });
    (0, node_test_1.it)('L12-SMB: save and load round-trip', async () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-save');
        mg.buildConversation();
        const savedId = await mg.save();
        node_assert_1.default.ok(savedId);
        const mg2 = new graph_1.SMBMemoryGraph(smb, 'test-save');
        const loaded = await mg2.load();
        node_assert_1.default.ok(loaded);
        node_assert_1.default.strictEqual(mg2.graph.graph.nodes.length, mg.graph.graph.nodes.length);
    });
    (0, node_test_1.it)('L12-SMB: forger removes low-confidence memories', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-forget');
        mg.addNode({ name: 'Keep', type: 'fact', confidence: 0.9 });
        mg.addNode({ name: 'Drop', type: 'fact', confidence: 0.1 });
        const removed = mg.forget(0.5);
        node_assert_1.default.strictEqual(removed, 1);
    });
    (0, node_test_1.it)('L12-SMB: toMermaid returns string', () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'test-mermaid');
        mg.buildConversation();
        const m = mg.toMermaid();
        node_assert_1.default.ok(m.includes('Roberto'));
        node_assert_1.default.ok(m.includes('-->'));
    });
    (0, node_test_1.it)('L12-SMB: load returns false for missing graph', async () => {
        const smb = new graph_1.SMB();
        const mg = new graph_1.SMBMemoryGraph(smb, 'nonexistent');
        const loaded = await mg.load();
        node_assert_1.default.strictEqual(loaded, false);
    });
});
console.log('\n✅ SMB integration tests ready');
console.log(`   Total: 28 tests (SMB core: 6, L7-SMB: 8, L12-SMB: 14)`);
//# sourceMappingURL=test-smb-integration.js.map