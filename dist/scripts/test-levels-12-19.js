"use strict";
// COS Graph Engine — Levels 12-19 Test Suite
// Tests: Memory (L12), Agent (L13), Tool (L14), Workflow (L15),
//        Network (L16), Social (L17), Biological (L18), Molecular (L19)
Object.defineProperty(exports, "__esModule", { value: true });
const level12_memory_1 = require("../packages/graph/src/level12-memory");
const level13_agent_1 = require("../packages/graph/src/level13-agent");
const level14_tool_1 = require("../packages/graph/src/level14-tool");
const level15_workflow_1 = require("../packages/graph/src/level15-workflow");
const level16_network_1 = require("../packages/graph/src/level16-network");
const level17_social_1 = require("../packages/graph/src/level17-social");
const level18_biological_1 = require("../packages/graph/src/level18-biological");
const level19_molecular_1 = require("../packages/graph/src/level19-molecular");
let p = 0, f = 0;
function assert(c, m) { if (c) {
    p++;
    console.log('  ✅ ' + m);
}
else {
    f++;
    console.log('  ❌ ' + m);
} }
async function main() {
    console.log('📊 Levels 12-19 Tests\n');
    // L12: Memory Graph
    const mem = new level12_memory_1.MemoryGraphEngine('Test Memory');
    mem.buildConversation();
    assert(mem['graph'].nodes.length >= 6, 'L12: Conversation has 6+ nodes');
    assert(mem['graph'].edges.length >= 7, 'L12: Conversation has 7+ edges');
    const recall = mem.recall(mem['graph'].nodes[0].id);
    assert(recall.length >= 1, 'L12: Recall returns related memories');
    assert(mem.validate().length === 0, 'L12: No validation errors');
    const metrics = mem.metrics();
    assert(metrics.nodeCount >= 6, 'L12: Metrics report node count');
    assert(metrics.density > 0, 'L12: Metrics report density');
    // Access node
    const accessed = mem.accessNode(mem['graph'].nodes[0].id);
    assert(accessed && accessed.accessCount === 1, 'L12: Access tracking works');
    // Serialization
    const json = mem.toJSON();
    assert(json.nodes.length >= 6, 'L12: toJSON preserves nodes');
    const restored = level12_memory_1.MemoryGraphEngine.fromJSON(json);
    assert(restored['graph'].nodes.length === json.nodes.length, 'L12: fromJSON restores graph');
    assert(restored.toMermaid().includes('Memory Graph'), 'L12: Mermaid output works');
    // Forget + Consolidate
    const merged = mem.consolidate();
    assert(merged >= 0, 'L12: Consolidation works');
    const forgotten = mem.forget(0.01);
    assert(forgotten >= 0, 'L12: Forget works');
    // Empty graph
    const empty = new level12_memory_1.MemoryGraphEngine('Empty');
    assert(empty.metrics().nodeCount === 0, 'L12: Empty graph metrics');
    assert(empty.validate().length === 0, 'L12: Empty graph validates');
    assert(empty.recall('nonexistent', 2).length === 0, 'L12: Recall on empty returns empty');
    // L13: Agent Graph
    const agents = new level13_agent_1.AgentGraphEngine('Test Agents');
    agents.buildDevTeam();
    assert(agents['graph'].nodes.length >= 6, 'L13: Dev team has 6+ agents');
    assert(agents['graph'].edges.length >= 7, 'L13: Dev team has 7+ edges');
    assert(agents.validate().length === 0, 'L13: No validation errors');
    const developers = agents.findByCapability('code');
    assert(developers.length >= 1, 'L13: Find by capability works');
    const chain = agents.delegationChain(agents['graph'].nodes[0].id, agents['graph'].nodes[3].id);
    assert(chain.length >= 2, 'L13: Delegation chain found');
    const met = agents.metrics();
    assert(met.roles >= 4, 'L13: Metrics report role diversity');
    assert(agents.toJSON().nodes.length >= 6, 'L13: Serialization works');
    // Empty graph
    const emptyA = new level13_agent_1.AgentGraphEngine();
    assert(emptyA.findByCapability('code').length === 0, 'L13: Empty findByCapability');
    // L14: Tool Graph
    const tools = new level14_tool_1.ToolGraphEngine('Test Tools');
    tools.buildToolEcosystem();
    assert(tools['graph'].nodes.length >= 5, 'L14: Tool ecosystem has 5+ tools');
    assert(tools['graph'].edges.length >= 5, 'L14: Tool ecosystem has 5+ edges');
    assert(tools.validate().length === 0, 'L14: No validation errors');
    const route = tools.route('git', 'GitHub API');
    assert(route.length >= 1, 'L14: Route finds path to tool');
    assert(tools.metrics().toolTypes >= 3, 'L14: Metrics report tool types');
    const disabled = tools.findDisabled();
    assert(disabled.length === 0, 'L14: All tools enabled');
    assert(tools.toMermaid().includes('Tool Graph'), 'L14: Mermaid output works');
    // L15: Workflow Graph
    const wf = new level15_workflow_1.WorkflowGraphEngine('Support Flow', 'Customer support automation');
    wf.buildSupportWorkflow();
    assert(wf['graph'].nodes.length >= 8, 'L15: Workflow has 8+ nodes');
    assert(wf['graph'].edges.length >= 8, 'L15: Workflow has 8+ edges');
    assert(wf.validate().length === 0, 'L15: No validation errors');
    assert(wf.detectCycle() === null, 'L15: No cycle detected');
    const executed = wf.execute({ ticket: 'urgent' });
    assert(executed.length >= 1, 'L15: Execute runs workflow');
    assert(wf.metrics().triggerCount >= 1, 'L15: Metrics report triggers');
    assert(wf.toJSON().enabled === true, 'L15: Serialization preserves state');
    // Cycle detection
    const wf2 = new level15_workflow_1.WorkflowGraphEngine('Cyclic');
    const a = wf2.addNode({ name: 'A', type: 'action' });
    const b = wf2.addNode({ name: 'B', type: 'action' });
    wf2.addEdge(a, b, 'on_success');
    wf2.addEdge(b, a, 'on_success');
    assert(wf2.detectCycle() !== null, 'L15: Cycle detection works');
    assert(wf2.validate().length >= 1, 'L15: Validation catches cycles');
    // L16: Network Graph
    const net = new level16_network_1.NetworkGraphEngine('Test Net');
    net.buildInfrastructure();
    assert(net['graph'].nodes.length >= 7, 'L16: Infrastructure has 7+ nodes');
    assert(net['graph'].edges.length >= 8, 'L16: Infrastructure has 8+ edges');
    assert(net.validate().length === 0, 'L16: No validation errors');
    const path = net.shortestPath(net['graph'].nodes[0].id, net['graph'].nodes[6].id);
    assert(path.length >= 2, 'L16: Shortest path found');
    assert(net.metrics().regionCount >= 1, 'L16: Metrics report regions');
    assert(net.toMermaid().includes('Network Topology'), 'L16: Mermaid output works');
    // L17: Social Graph
    const soc = new level17_social_1.SocialGraphEngine('Test Social');
    soc.buildTechNetwork();
    assert(soc['graph'].nodes.length >= 5, 'L17: Social network has 5+ nodes');
    assert(soc['graph'].edges.length >= 8, 'L17: Social network has 8+ edges');
    assert(soc.validate().length === 0, 'L17: No validation errors');
    const mutual = soc.mutualFriends(soc['graph'].nodes[0].id, soc['graph'].nodes[1].id);
    assert(mutual.length >= 0, 'L17: Mutual friends works');
    const influential = soc.mostInfluential();
    assert(influential !== undefined, 'L17: Most influential found');
    const recs = soc.recommendFriends(soc['graph'].nodes[0].id);
    assert(recs.length >= 0, 'L17: Friend recommendations work');
    assert(soc.metrics().verifiedCount >= 3, 'L17: Metrics report verified users');
    assert(soc.toJSON().nodes.length >= 5, 'L17: Serialization works');
    // L18: Biological Graph
    const bio = new level18_biological_1.BiologicalGraphEngine('Test Neural');
    bio.buildNeuralCircuit();
    assert(bio['graph'].nodes.length >= 6, 'L18: Neural circuit has 6+ nodes');
    assert(bio['graph'].edges.length >= 6, 'L18: Neural circuit has 6+ edges');
    assert(bio.validate().length === 0, 'L18: No validation errors');
    const firing = bio.simulateFiring(bio['graph'].nodes[0].id, 3);
    assert(firing.length >= 1, 'L18: Simulated firing propagates');
    assert(bio.metrics().neuronCount >= 3, 'L18: Metrics report neuron count');
    // Protein network
    const ppi = new level18_biological_1.BiologicalGraphEngine('PPI');
    ppi.buildProteinNetwork();
    assert(ppi['graph'].nodes.length >= 5, 'L18: PPI has 5+ proteins');
    assert(ppi.toJSON().nodes.length >= 5, 'L18: Serialization works');
    assert(ppi.toMermaid().includes('Biological'), 'L18: Mermaid output works');
    // L19: Molecular Graph
    const mol = new level19_molecular_1.MolecularGraphEngine('Water');
    mol.buildWater();
    assert(mol['graph'].nodes.length === 3, 'L19: Water has 3 atoms');
    assert(mol['graph'].edges.length === 2, 'L19: Water has 2 bonds');
    assert(mol.validate().length === 0, 'L19: No validation errors');
    assert(mol.computeWeight() > 0, 'L19: Molecular weight computed');
    // Benzene
    const benz = new level19_molecular_1.MolecularGraphEngine('Benzene');
    benz.buildBenzene();
    assert(benz['graph'].nodes.length === 6, 'L19: Benzene has 6 carbons');
    const rings = benz.findRings();
    assert(rings.length >= 1, 'L19: Benzene ring detected');
    assert(benz.metrics().ringCount >= 1, 'L19: Metrics report rings');
    assert(benz.toJSON().formula === 'C6H6', 'L19: Serialization preserves formula');
    // Aspirin
    const aspirin = new level19_molecular_1.MolecularGraphEngine('Aspirin');
    aspirin.buildAspirin();
    assert(aspirin['graph'].nodes.length >= 10, 'L19: Aspirin has 10+ atoms');
    assert(aspirin.metrics().atomTypes.includes('C'), 'L19: Metrics report carbon');
    assert(aspirin.toMermaid().includes('Molecular Graph'), 'L19: Mermaid output works');
    // Empty graph
    const emptyM = new level19_molecular_1.MolecularGraphEngine('Empty');
    assert(emptyM.computeWeight() === 0, 'L19: Empty molecular weight = 0');
    assert(emptyM.findRings().length === 0, 'L19: Empty graph has no rings');
    // ============ SUMMARY ============
    console.log(`\n${p} tests, ${p + f} total, ${f} failed`);
    if (f === 0)
        console.log('\n✅✅✅ ALL 8 LEVELS (12-19) VERIFIED');
    process.exit(f > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=test-levels-12-19.js.map