"use strict";
// COS Graph Engine — Fase 7: Benchmarks L12-L19
// T-7.3: Mide rendimiento de niveles 12-19
// Output: benchmark-results-f7-3.json
Object.defineProperty(exports, "__esModule", { value: true });
const level12_memory_1 = require("../packages/graph/src/level12-memory");
const level13_agent_1 = require("../packages/graph/src/level13-agent");
const level14_tool_1 = require("../packages/graph/src/level14-tool");
const level15_workflow_1 = require("../packages/graph/src/level15-workflow");
const level16_network_1 = require("../packages/graph/src/level16-network");
const level17_social_1 = require("../packages/graph/src/level17-social");
const level18_biological_1 = require("../packages/graph/src/level18-biological");
const level19_molecular_1 = require("../packages/graph/src/level19-molecular");
const fs_1 = require("fs");
const path_1 = require("path");
const RESULTS_PATH = (0, path_1.join)(__dirname, '..', 'benchmark-results-f7-3.json');
function now() { return performance.now(); }
function measure(label, level, n, fn, iterations = 5) {
    for (let i = 0; i < iterations; i++)
        fn();
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = now();
        fn();
        const end = now();
        times.push(end - start);
    }
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const ops = mean > 0 ? Math.round(1000 / mean) : 0;
    const r = { phase: 'F7', level, name: label, n, meanMs: Math.round(mean * 100) / 100, minMs: Math.round(min * 100) / 100, maxMs: Math.round(max * 100) / 100, ops, unit: 'ms' };
    console.log(`  ${label.padEnd(40)} n=${String(n).padEnd(5)} ${mean.toFixed(2).padStart(8)} ms  ${ops.toFixed(0).padStart(6)} ops/s`);
    return r;
}
function genNodes(n) {
    const a = [];
    for (let i = 0; i < n; i++)
        a.push({ id: `n${i}`, name: `Node${i}` });
    return a;
}
function genEdges(nodes, density = 2) {
    const e = [];
    for (let i = 1; i < nodes.length; i++) {
        e.push({ source: nodes[i].id, target: nodes[Math.floor(Math.random() * i)].id });
        if (i % density === 0 && i > 1) {
            const t = nodes[Math.floor(Math.random() * i)];
            if (t.id !== nodes[i].id)
                e.push({ source: nodes[i].id, target: t.id });
        }
    }
    return e;
}
function main() {
    console.log('═'.repeat(60));
    console.log('  FASE 7 — BENCHMARKS L12-L19');
    console.log('═'.repeat(60));
    console.log('');
    const results = [];
    // ===== L12: MEMORY GRAPH =====
    console.log('📊 L12 Memory Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L12 addNode', 'L12', n, () => {
            const g = new level12_memory_1.MemoryGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'memory', content: nd.name });
        }));
        results.push(measure('L12 addEdge', 'L12', edges.length, () => {
            const g = new level12_memory_1.MemoryGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'memory', content: nd.name }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'associates', 0.5);
        }));
        results.push(measure('L12 validate', 'L12', n, () => {
            const g = new level12_memory_1.MemoryGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'memory', content: nd.name });
            g.validate();
        }));
        results.push(measure('L12 serialization', 'L12', n, () => {
            const g = new level12_memory_1.MemoryGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'memory', content: nd.name });
            const json = g.toJSON();
            level12_memory_1.MemoryGraphEngine.fromJSON(json);
        }));
    }
    // ===== L13: AGENT GRAPH =====
    console.log('\n📊 L13 Agent Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L13 addNode', 'L13', n, () => {
            const g = new level13_agent_1.AgentGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, role: 'developer', capabilities: ['ts'], tools: ['npm'], memoryIds: [] });
        }));
        results.push(measure('L13 addEdge', 'L13', edges.length, () => {
            const g = new level13_agent_1.AgentGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, role: 'developer', capabilities: ['ts'], tools: ['npm'], memoryIds: [] }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'delegates_to');
        }));
        results.push(measure('L13 validate', 'L13', n, () => {
            const g = new level13_agent_1.AgentGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, role: 'developer', capabilities: ['ts'], tools: ['npm'], memoryIds: [] });
            g.validate();
        }));
        results.push(measure('L13 serialization', 'L13', n, () => {
            const g = new level13_agent_1.AgentGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, role: 'developer', capabilities: ['ts'], tools: ['npm'], memoryIds: [] });
            const json = g.toJSON();
            level13_agent_1.AgentGraphEngine.fromJSON(json);
        }));
    }
    // ===== L14: TOOL GRAPH =====
    console.log('\n📊 L14 Tool Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L14 addNode', 'L14', n, () => {
            const g = new level14_tool_1.ToolGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'function', description: nd.name, requiredCapabilities: [], rateLimit: 100, latency: 10, costPerCall: 0.01, enabled: true });
        }));
        results.push(measure('L14 addEdge', 'L14', edges.length, () => {
            const g = new level14_tool_1.ToolGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'function', description: nd.name, requiredCapabilities: [], rateLimit: 100, latency: 10, costPerCall: 0.01, enabled: true }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'depends_on');
        }));
        results.push(measure('L14 validate', 'L14', n, () => {
            const g = new level14_tool_1.ToolGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'function', description: nd.name, requiredCapabilities: [], rateLimit: 100, latency: 10, costPerCall: 0.01, enabled: true });
            g.validate();
        }));
        results.push(measure('L14 serialization', 'L14', n, () => {
            const g = new level14_tool_1.ToolGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'function', description: nd.name, requiredCapabilities: [], rateLimit: 100, latency: 10, costPerCall: 0.01, enabled: true });
            const json = g.toJSON();
            level14_tool_1.ToolGraphEngine.fromJSON(json);
        }));
    }
    // ===== L15: WORKFLOW GRAPH =====
    console.log('\n📊 L15 Workflow Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L15 addNode', 'L15', n, () => {
            const g = new level15_workflow_1.WorkflowGraphEngine('bench');
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'action' });
        }));
        results.push(measure('L15 addEdge', 'L15', edges.length, () => {
            const g = new level15_workflow_1.WorkflowGraphEngine('bench');
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'action' }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'on_success');
        }));
        results.push(measure('L15 validate', 'L15', n, () => {
            const g = new level15_workflow_1.WorkflowGraphEngine('bench');
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'action' });
            g.validate();
        }));
        results.push(measure('L15 serialization', 'L15', n, () => {
            const g = new level15_workflow_1.WorkflowGraphEngine('bench');
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'action' });
            const json = g.toJSON();
            level15_workflow_1.WorkflowGraphEngine.fromJSON(json);
        }));
    }
    // ===== L16: NETWORK GRAPH =====
    console.log('\n📊 L16 Network Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L16 addNode', 'L16', n, () => {
            const g = new level16_network_1.NetworkGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'server', healthy: true });
        }));
        results.push(measure('L16 addEdge', 'L16', edges.length, () => {
            const g = new level16_network_1.NetworkGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'server', healthy: true }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'connects_to');
        }));
        results.push(measure('L16 validate', 'L16', n, () => {
            const g = new level16_network_1.NetworkGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'server', healthy: true });
            g.validate();
        }));
        results.push(measure('L16 serialization', 'L16', n, () => {
            const g = new level16_network_1.NetworkGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'server', healthy: true });
            const json = g.toJSON();
            level16_network_1.NetworkGraphEngine.fromJSON(json);
        }));
    }
    // ===== L17: SOCIAL GRAPH =====
    console.log('\n📊 L17 Social Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L17 addNode', 'L17', n, () => {
            const g = new level17_social_1.SocialGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'person', verified: false });
        }));
        results.push(measure('L17 addEdge', 'L17', edges.length, () => {
            const g = new level17_social_1.SocialGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'person', verified: false }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'friend_of');
        }));
        results.push(measure('L17 validate', 'L17', n, () => {
            const g = new level17_social_1.SocialGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'person', verified: false });
            g.validate();
        }));
        results.push(measure('L17 serialization', 'L17', n, () => {
            const g = new level17_social_1.SocialGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'person', verified: false });
            const json = g.toJSON();
            level17_social_1.SocialGraphEngine.fromJSON(json);
        }));
    }
    // ===== L18: BIOLOGICAL GRAPH =====
    console.log('\n📊 L18 Biological Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L18 addNode', 'L18', n, () => {
            const g = new level18_biological_1.BiologicalGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'neuron' });
        }));
        results.push(measure('L18 addEdge', 'L18', edges.length, () => {
            const g = new level18_biological_1.BiologicalGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addNode({ name: nd.name, type: 'neuron' }));
            for (let i = 1; i < ids.length; i++)
                g.addEdge(ids[i - 1], ids[i], 'connects_to');
        }));
        results.push(measure('L18 validate', 'L18', n, () => {
            const g = new level18_biological_1.BiologicalGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'neuron' });
            g.validate();
        }));
        results.push(measure('L18 serialization', 'L18', n, () => {
            const g = new level18_biological_1.BiologicalGraphEngine();
            for (const nd of nodes)
                g.addNode({ name: nd.name, type: 'neuron' });
            const json = g.toJSON();
            level18_biological_1.BiologicalGraphEngine.fromJSON(json);
        }));
    }
    // ===== L19: MOLECULAR GRAPH =====
    console.log('\n📊 L19 Molecular Graph');
    for (const n of [10, 100, 1000]) {
        const nodes = genNodes(n);
        const edges = genEdges(nodes, 2);
        results.push(measure('L19 addAtom', 'L19', n, () => {
            const g = new level19_molecular_1.MolecularGraphEngine();
            for (const nd of nodes)
                g.addAtom({ name: nd.name, type: 'atom', element: 'C', atomicNumber: 6 });
        }));
        results.push(measure('L19 addBond', 'L19', edges.length, () => {
            const g = new level19_molecular_1.MolecularGraphEngine();
            const ids = [];
            for (const nd of nodes)
                ids.push(g.addAtom({ name: nd.name, type: 'atom', element: 'C', atomicNumber: 6 }));
            for (let i = 1; i < ids.length; i++)
                g.addBond(ids[i - 1], ids[i], 'single', 1);
        }));
        results.push(measure('L19 validate', 'L19', n, () => {
            const g = new level19_molecular_1.MolecularGraphEngine();
            for (const nd of nodes)
                g.addAtom({ name: nd.name, type: 'atom', element: 'C', atomicNumber: 6 });
            g.validate();
        }));
        results.push(measure('L19 serialization', 'L19', n, () => {
            const g = new level19_molecular_1.MolecularGraphEngine();
            for (const nd of nodes)
                g.addAtom({ name: nd.name, type: 'atom', element: 'C', atomicNumber: 6 });
            const json = g.toJSON();
            level19_molecular_1.MolecularGraphEngine.fromJSON(json);
        }));
    }
    // ===== SAVE =====
    const output = {
        phase: 'F7', label: 'L12-L19 Benchmarks',
        generated: new Date().toISOString(), results
    };
    (0, fs_1.writeFileSync)(RESULTS_PATH, JSON.stringify(output, null, 2));
    console.log(`\n📝 Resultados guardados en benchmark-results-f7-3.json (${results.length} mediciones)`);
    console.log(`\n✅✅✅ L12-L19 BENCHMARKED`);
}
main();
//# sourceMappingURL=benchmark-l12-l19.js.map