"use strict";
// LEVEL 12: MEMORY GRAPH
// Persistent memory, conversation trees, associative recall, consolidation
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryGraphEngine = void 0;
const core_1 = require("@cos/core");
class MemoryGraphEngine {
    graph;
    adj = new Map();
    adjRev = new Map();
    constructor(name = 'Memory Graph') {
        this.graph = { id: (0, core_1.generateId)(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
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
        this.graph.nodes.push({ ...n, id, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString(), accessCount: 0 });
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
    addEdge(source, target, type, strength = 0.5) {
        if (!this.graph.nodes.some(n => n.id === source))
            throw new Error(`Source node ${source} not found`);
        if (!this.graph.nodes.some(n => n.id === target))
            throw new Error(`Target node ${target} not found`);
        const id = (0, core_1.generateId)();
        this.graph.edges.push({ id, source, target, type, strength, createdAt: new Date().toISOString() });
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
    accessNode(nodeId) {
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) {
            node.lastAccessed = new Date().toISOString();
            node.accessCount++;
        }
        return node;
    }
    buildConversation() {
        const roberto = this.addNode({ name: 'Roberto', type: 'entity', content: 'User who builds agentic systems' });
        const oculops = this.addNode({ name: 'Oculops', type: 'topic', content: 'Computer vision platform' });
        const supabase = this.addNode({ name: 'Supabase', type: 'entity', content: 'Open source Firebase alternative' });
        const claude = this.addNode({ name: 'Claude', type: 'entity', content: 'AI assistant by Anthropic' });
        const agenticOS = this.addNode({ name: 'Agentic OS', type: 'insight', content: 'Cognitive Operating System vision' });
        const memorySys = this.addNode({ name: 'Memory System', type: 'fact', content: '12-layer memory with TTL and consolidation' });
        this.addEdge(roberto, oculops, 'references', 0.8);
        this.addEdge(roberto, supabase, 'references', 0.7);
        this.addEdge(roberto, claude, 'references', 0.9);
        this.addEdge(oculops, agenticOS, 'led_to', 0.6);
        this.addEdge(supabase, agenticOS, 'led_to', 0.5);
        this.addEdge(claude, agenticOS, 'led_to', 0.9);
        this.addEdge(agenticOS, memorySys, 'references', 0.8);
    }
    recall(nodeId, maxDepth = 2, minStrength = 0.3) {
        this.buildAdjacency();
        const visited = new Set();
        const results = [];
        const dfs = (id, depth) => {
            if (depth > maxDepth || visited.has(id))
                return;
            visited.add(id);
            const node = this.graph.nodes.find(n => n.id === id);
            if (node)
                results.push(node);
            for (const nb of this.adj.get(id) || []) {
                const edge = this.graph.edges.find(e => e.source === id && e.target === nb);
                if (edge && edge.strength >= minStrength)
                    dfs(nb, depth + 1);
            }
            for (const nb of this.adjRev.get(id) || []) {
                const edge = this.graph.edges.find(e => e.target === id && e.source === nb);
                if (edge && edge.strength >= minStrength)
                    dfs(nb, depth + 1);
            }
        };
        dfs(nodeId, 0);
        return results;
    }
    strongestPath(fromId, toId) {
        this.buildAdjacency();
        const visited = new Set();
        let bestPath = [];
        let bestStrength = 0;
        const dfs = (id, path, strength) => {
            if (id === toId) {
                if (strength > bestStrength) {
                    bestPath = [...path];
                    bestStrength = strength;
                }
                return;
            }
            if (visited.has(id))
                return;
            visited.add(id);
            const node = this.graph.nodes.find(n => n.id === id);
            if (!node)
                return;
            for (const nb of this.adj.get(id) || []) {
                const edge = this.graph.edges.find(e => e.source === id && e.target === nb);
                dfs(nb, [...path, node], strength + (edge?.strength || 0));
            }
            visited.delete(id);
        };
        dfs(fromId, [], 0);
        return bestPath;
    }
    forget(minConfidence = 0.3) {
        const before = this.graph.nodes.length;
        this.graph.nodes = this.graph.nodes.filter(n => (n.confidence ?? 0.5) >= minConfidence);
        const validIds = new Set(this.graph.nodes.map(n => n.id));
        this.graph.edges = this.graph.edges.filter(e => validIds.has(e.source) && validIds.has(e.target));
        this.buildAdjacency();
        return before - this.graph.nodes.length;
    }
    consolidate() {
        const nameMap = new Map();
        const toRemove = [];
        for (const node of this.graph.nodes) {
            const key = node.name.toLowerCase();
            if (nameMap.has(key)) {
                const existing = nameMap.get(key);
                existing.accessCount += node.accessCount;
                existing.confidence = Math.max(existing.confidence ?? 0.5, node.confidence ?? 0.5);
                existing.content = existing.content || node.content;
                toRemove.push(node.id);
            }
            else {
                nameMap.set(key, node);
            }
        }
        this.graph.nodes = this.graph.nodes.filter(n => !toRemove.includes(n.id));
        const validIds = new Set(this.graph.nodes.map(n => n.id));
        this.graph.edges = this.graph.edges.filter(e => validIds.has(e.source) && validIds.has(e.target));
        this.buildAdjacency();
        return toRemove.length;
    }
    validate() {
        const errors = [];
        for (const e of this.graph.edges) {
            if (!this.graph.nodes.some(n => n.id === e.source))
                errors.push(`Dangling edge: source ${e.source} not found`);
            if (!this.graph.nodes.some(n => n.id === e.target))
                errors.push(`Dangling edge: target ${e.target} not found`);
            if (e.source === e.target)
                errors.push(`Self-loop edge: ${e.source}`);
        }
        return errors;
    }
    metrics() {
        const n = this.graph.nodes.length;
        const e = this.graph.edges.length;
        this.buildAdjacency();
        const deg = this.graph.nodes.map(no => (this.adj.get(no.id)?.length || 0) + (this.adjRev.get(no.id)?.length || 0));
        const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
        const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
        return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density, maxDegree: Math.max(...deg, 0) };
    }
    toJSON() { return JSON.parse(JSON.stringify(this.graph)); }
    static fromJSON(data) { const g = new MemoryGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }
    toMermaid() {
        let m = 'graph LR\n  title: "Memory Graph"\n';
        for (const n of this.graph.nodes) {
            const shape = n.type === 'entity' ? '[(' : n.type === 'insight' ? '{' : '[';
            const close = n.type === 'entity' ? ')]' : n.type === 'insight' ? '}' : ']';
            m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}${shape}"${n.name}"${close}\n`;
        }
        for (const e of this.graph.edges) {
            const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
            const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
            const label = e.strength ? `|${(e.strength * 100).toFixed(0)}%|` : '';
            m += `    ${s} -->${label}${t}\n`;
        }
        return m;
    }
}
exports.MemoryGraphEngine = MemoryGraphEngine;
//# sourceMappingURL=level12-memory.js.map