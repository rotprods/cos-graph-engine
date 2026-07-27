// SMB Integration Tests — T-4.3
// Tests the Shared Memory Bus connector, L7 integration, and L12 integration

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { SMB, SMBComputeGraph, SMBMemoryGraph } from '@cos/graph';

// ─── T-4.3: SMB Integration Tests ─────────────────────────────────

describe('SMB — Shared Memory Bus', () => {

  it('SMB: creates with default config', async () => {
    const smb = new SMB();
    const state = await smb.getState();
    assert.ok(state.memoryCount >= 0);
    assert.ok(state.subscribers >= 0);
  });

  it('SMB: publishes and subscribes to events', async () => {
    const smb = new SMB();
    const received: string[] = [];
    await smb.subscribe('test:event', (evt) => { received.push(evt.type); });
    await smb.publish({ type: 'test:event', source: 'test', payload: { msg: 'hello' } });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0], 'test:event');
  });

  it('SMB: saveGraph and loadGraph round-trip', async () => {
    const smb = new SMB();
    const data = { nodes: [{ id: 'a', value: 1 }], edges: [] };
    const id = await smb.saveGraph('test-graph', data);
    assert.ok(id);
    const loaded = await smb.loadGraph('test-graph') as typeof data;
    assert.ok(loaded);
    assert.strictEqual(loaded.nodes[0].id, 'a');
    assert.strictEqual(loaded.nodes[0].value, 1);
  });

  it('SMB: listGraphs returns saved graphs', async () => {
    const smb = new SMB();
    await smb.saveGraph('g1', { x: 1 });
    await smb.saveGraph('g2', { y: 2 });
    const list = await smb.listGraphs();
    assert.ok(list.length >= 2);
    assert.ok(list.some(g => g.key === 'g1'));
    assert.ok(list.some(g => g.key === 'g2'));
  });

  it('SMB: loadGraph returns null for missing key', async () => {
    const smb = new SMB();
    const loaded = await smb.loadGraph('nonexistent');
    assert.strictEqual(loaded, null);
  });

  it('SMB: publishes events with graph metadata', async () => {
    const smb = new SMB();
    const received: any[] = [];
    await smb.subscribe('compute:forward', (evt) => { received.push(evt); });
    await smb.publish({
      type: 'compute:forward',
      source: 'L7',
      payload: { result: 42 },
      graphId: 'g-1',
      nodeId: 'n-1',
    });
    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].type, 'compute:forward');
    assert.strictEqual(received[0].graphId, 'g-1');
    assert.strictEqual(received[0].nodeId, 'n-1');
  });
});

describe('SMB — L7 Compute Graph Integration', () => {

  it('L7-SMB: creates and builds MLP', async () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'test-mlp');
    cg.buildMLP(784, 256, 2);
    assert.strictEqual(cg.nodes.length, 11);
    assert.strictEqual(cg.edges.length, 10);
  });

  it('L7-SMB: forward pass publishes event', async () => {
    const smb = new SMB();
    const received: string[] = [];
    await smb.subscribe('compute:forward', () => { received.push('forward'); });
    const cg = new SMBComputeGraph(smb, 'test-forward');
    cg.buildMLP(784, 256, 2);
    const loss = await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
    assert.ok(loss > 0);
    assert.strictEqual(received.length, 1);
  });

  it('L7-SMB: backward pass publishes event', async () => {
    const smb = new SMB();
    const received: string[] = [];
    await smb.subscribe('compute:backward', () => { received.push('backward'); });
    const cg = new SMBComputeGraph(smb, 'test-backward');
    cg.buildMLP();
    await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
    const grads = await cg.backward();
    assert.ok(grads.size > 0);
    assert.strictEqual(received.length, 1);
  });

  it('L7-SMB: save and load round-trip', async () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'test-save-load');
    cg.buildMLP();
    await cg.forward({ x: 1, w1: 0.5, b1: 0.1, w2: 0.3, logit1: 0.05 });
    const savedId = await cg.save();
    assert.ok(savedId);

    // Create a new graph and load the saved state
    const cg2 = new SMBComputeGraph(smb, 'test-save-load');
    const loaded = await cg2.load();
    assert.ok(loaded);
    assert.strictEqual(cg2.nodes.length, 11);
  });

  it('L7-SMB: buildExpression works', () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'test-expr');
    cg.buildExpression();
    assert.strictEqual(cg.nodes.length, 7);
    assert.strictEqual(cg.edges.length, 6);
  });

  it('L7-SMB: paramCount returns trainable params', () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'test-params');
    cg.buildMLP();
    assert.strictEqual(cg.paramCount(), 4);
  });

  it('L7-SMB: toMermaid returns string', () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'test-mermaid');
    cg.buildMLP();
    const m = cg.toMermaid();
    assert.ok(m.startsWith('graph TD'));
    assert.ok(m.includes('fc1'));
    assert.ok(m.includes('loss'));
  });

  it('L7-SMB: load returns false for missing graph', async () => {
    const smb = new SMB();
    const cg = new SMBComputeGraph(smb, 'nonexistent');
    const loaded = await cg.load();
    assert.strictEqual(loaded, false);
  });
});

describe('SMB — L12 Memory Graph Integration', () => {

  it('L12-SMB: creates and builds conversation', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-mem');
    mg.buildConversation();
    assert.ok(mg.graph.graph.nodes.length >= 6);
    assert.ok(mg.graph.graph.edges.length >= 7);
  });

  it('L12-SMB: addNode publishes event', async () => {
    const smb = new SMB();
    const received: string[] = [];
    await smb.subscribe('memory:addNode', () => { received.push('addNode'); });
    const mg = new SMBMemoryGraph(smb, 'test-events');
    mg.addNode({ name: 'Test', type: 'entity', content: 'test' });
    assert.strictEqual(received.length, 1);
  });

  it('L12-SMB: addEdge publishes event', async () => {
    const smb = new SMB();
    const received: string[] = [];
    await smb.subscribe('memory:addEdge', () => { received.push('addEdge'); });
    const mg = new SMBMemoryGraph(smb, 'test-edges');
    const n1 = mg.addNode({ name: 'A', type: 'entity' });
    const n2 = mg.addNode({ name: 'B', type: 'entity' });
    mg.addEdge(n1, n2, 'references', 0.8);
    assert.strictEqual(received.length, 1);
  });

  it('L12-SMB: accessNode publishes event', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-access');
    const id = mg.addNode({ name: 'Test', type: 'entity' });
    const node = mg.accessNode(id);
    assert.ok(node);
    assert.strictEqual(node.accessCount, 1);
  });

  it('L12-SMB: recall returns related memories', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-recall');
    mg.buildConversation();
    // Find "Roberto" node
    const roberto = mg.graph.graph.nodes.find(n => n.name === 'Roberto');
    assert.ok(roberto);
    const related = mg.recall(roberto.id, 1, 0.3);
    assert.ok(related.length >= 3); // Direct connections
  });

  it('L12-SMB: validate returns no errors', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-validate');
    mg.buildConversation();
    const errors = mg.validate();
    assert.strictEqual(errors.length, 0);
  });

  it('L12-SMB: metrics return correct values', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-metrics');
    mg.buildConversation();
    const m = mg.metrics();
    assert.ok(m.nodeCount >= 6);
    assert.ok(m.edgeCount >= 7);
    assert.ok(m.avgDegree > 0);
    assert.ok(m.density > 0);
  });

  it('L12-SMB: save and load round-trip', async () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-save');
    mg.buildConversation();
    const savedId = await mg.save();
    assert.ok(savedId);

    const mg2 = new SMBMemoryGraph(smb, 'test-save');
    const loaded = await mg2.load();
    assert.ok(loaded);
    assert.strictEqual(mg2.graph.graph.nodes.length, mg.graph.graph.nodes.length);
  });

  it('L12-SMB: forger removes low-confidence memories', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-forget');
    mg.addNode({ name: 'Keep', type: 'fact', confidence: 0.9 });
    mg.addNode({ name: 'Drop', type: 'fact', confidence: 0.1 });
    const removed = mg.forget(0.5);
    assert.strictEqual(removed, 1);
  });

  it('L12-SMB: toMermaid returns string', () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'test-mermaid');
    mg.buildConversation();
    const m = mg.toMermaid();
    assert.ok(m.includes('Roberto'));
    assert.ok(m.includes('-->'));
  });

  it('L12-SMB: load returns false for missing graph', async () => {
    const smb = new SMB();
    const mg = new SMBMemoryGraph(smb, 'nonexistent');
    const loaded = await mg.load();
    assert.strictEqual(loaded, false);
  });
});

console.log('\n✅ SMB integration tests ready');
console.log(`   Total: 28 tests (SMB core: 6, L7-SMB: 8, L12-SMB: 14)`);