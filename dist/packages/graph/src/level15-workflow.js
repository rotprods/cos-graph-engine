"use strict";
// LEVEL 15: WORKFLOW GRAPH
// Automation, triggers, actions, conditions, retry logic
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowGraphEngine = void 0;
const core_1 = require("@cos/core");
class WorkflowGraphEngine {
    graph;
    adj = new Map();
    adjRev = new Map();
    constructor(name, description) {
        this.graph = { id: (0, core_1.generateId)(), name, description, enabled: true, nodes: [], edges: [], createdAt: new Date().toISOString() };
    }
    buildAdjacency() {
        this.adj.clear();
        this.adjRev.clear();
        for (const n of this.graph.nodes) {
            this.adj.set(n.id, []);
            this.adjRev.set(n.id, []);
        }
        for (const e of this.graph.edges) {
            if (this.adj.has(e.source))
                this.adj.get(e.source).push(e.target);
            if (this.adjRev.has(e.target))
                this.adjRev.get(e.target).push(e.source);
        }
    }
    addNode(n) {
        const id = (0, core_1.generateId)();
        this.graph.nodes.push({ ...n, id, createdAt: new Date().toISOString() });
        this.buildAdjacency();
        return id;
    }
    removeNode(nodeId) {
        const idx = this.graph.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            throw new Error(`Node ${nodeId} not found`);
        this.graph.nodes.splice(idx, 1);
        this.graph.edges = this.graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.buildAdjacency();
    }
    addEdge(source, target, type, condition) {
        if (!this.graph.nodes.some(n => n.id === source))
            throw new Error(`Source ${source} not found`);
        if (!this.graph.nodes.some(n => n.id === target))
            throw new Error(`Target ${target} not found`);
        const id = (0, core_1.generateId)();
        this.graph.edges.push({ id, source, target, type, condition, createdAt: new Date().toISOString() });
        this.buildAdjacency();
        return id;
    }
    removeEdge(edgeId) {
        const idx = this.graph.edges.findIndex(e => e.id === edgeId);
        if (idx === -1)
            throw new Error(`Edge ${edgeId} not found`);
        this.graph.edges.splice(idx, 1);
        this.buildAdjacency();
    }
    getNode(nodeId) { return this.graph.nodes.find(n => n.id === nodeId); }
    getNodes() { return this.graph.nodes; }
    getEdges() { return this.graph.edges; }
    getEnabled() { return this.graph.enabled; }
    setEnabled(enabled) { this.graph.enabled = enabled; }
    buildSupportWorkflow() {
        const webhook = this.addNode({ name: 'Webhook In', type: 'webhook', service: 'zendesk' });
        const claude = this.addNode({ name: 'Claude Analyze', type: 'action', service: 'claude', config: { prompt: 'Analyze support ticket' } });
        const condition = this.addNode({ name: 'Is Urgent?', type: 'condition', config: { expression: 'priority == high' } });
        const slack = this.addNode({ name: 'Slack Alert', type: 'notification', service: 'slack' });
        const email = this.addNode({ name: 'Email Reply', type: 'action', service: 'sendgrid' });
        const notion = this.addNode({ name: 'Notion Log', type: 'action', service: 'notion' });
        const delay = this.addNode({ name: 'Wait 5min', type: 'delay', config: { seconds: 300 } });
        const done = this.addNode({ name: 'Done', type: 'end' });
        this.addEdge(webhook, claude, 'on_success');
        this.addEdge(claude, condition, 'on_success');
        this.addEdge(condition, slack, 'on_condition_true', 'priority == high');
        this.addEdge(condition, email, 'on_condition_false', 'priority == low');
        this.addEdge(email, notion, 'on_success');
        this.addEdge(slack, notion, 'on_success');
        this.addEdge(notion, delay, 'on_success');
        this.addEdge(delay, done, 'on_success');
    }
    topologicalSort() {
        this.buildAdjacency();
        const inDeg = new Map();
        for (const n of this.graph.nodes)
            inDeg.set(n.id, 0);
        for (const e of this.graph.edges)
            inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
        const q = [...this.graph.nodes.filter(n => inDeg.get(n.id) === 0).map(n => n.id)];
        const r = [];
        while (q.length > 0) {
            const n = q.shift();
            r.push(n);
            for (const nb of this.adj.get(n) || []) {
                const nd = (inDeg.get(nb) || 1) - 1;
                inDeg.set(nb, nd);
                if (nd === 0)
                    q.push(nb);
            }
        }
        return r;
    }
    detectCycle() {
        const order = this.topologicalSort();
        return order.length === this.graph.nodes.length ? null : order;
    }
    execute(initialData = {}) {
        if (!this.graph.enabled)
            return [];
        const order = this.topologicalSort();
        const executed = [];
        for (const id of order) {
            const node = this.graph.nodes.find(n => n.id === id);
            if (node)
                executed.push(node);
        }
        return executed;
    }
    validate() {
        const errors = [];
        if (this.detectCycle() !== null)
            errors.push('Workflow contains a cycle');
        for (const e of this.graph.edges) {
            if (!this.graph.nodes.some(n => n.id === e.source))
                errors.push(`Dangling edge source: ${e.source}`);
            if (!this.graph.nodes.some(n => n.id === e.target))
                errors.push(`Dangling edge target: ${e.target}`);
        }
        if (!this.graph.nodes.some(n => n.type === 'trigger' || n.type === 'webhook'))
            errors.push('No trigger or webhook node found');
        return errors;
    }
    metrics() {
        const n = this.graph.nodes.length;
        const e = this.graph.edges.length;
        return { nodeCount: n, edgeCount: e, actionCount: this.graph.nodes.filter(no => no.type === 'action').length, triggerCount: this.graph.nodes.filter(no => no.type === 'trigger' || no.type === 'webhook').length };
    }
    toJSON() { return JSON.parse(JSON.stringify(this.graph)); }
    static fromJSON(data) { const g = new WorkflowGraphEngine(data.name, data.description); g.graph = data; g.buildAdjacency(); return g; }
    toMermaid() {
        let m = 'graph TD\n';
        for (const n of this.graph.nodes) {
            const label = `${n.name}${n.service ? ` [${n.service}]` : ''}`;
            m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${label}"]\n`;
        }
        for (const e of this.graph.edges) {
            const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
            const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
            m += `    ${s} -->|"${e.type}"| ${t}\n`;
        }
        return m;
    }
}
exports.WorkflowGraphEngine = WorkflowGraphEngine;
//# sourceMappingURL=level15-workflow.js.map