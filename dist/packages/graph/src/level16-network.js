"use strict";
// LEVEL 16: NETWORK GRAPH
// Infrastructure topology, CDN, shortest path, health monitoring
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkGraphEngine = void 0;
const core_1 = require("@cos/core");
class NetworkGraphEngine {
    graph;
    adj = new Map();
    constructor(name = 'Network Topology') {
        this.graph = { id: (0, core_1.generateId)(), name, createdAt: new Date().toISOString(), nodes: [], edges: [] };
    }
    buildAdjacency() {
        this.adj.clear();
        for (const n of this.graph.nodes)
            this.adj.set(n.id, []);
        for (const e of this.graph.edges) {
            if (this.adj.has(e.source))
                this.adj.get(e.source).push(e.target);
            if (this.adj.has(e.target))
                this.adj.get(e.target).push(e.source);
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
    addEdge(source, target, type, bandwidth) {
        if (!this.graph.nodes.some(n => n.id === source))
            throw new Error(`Source ${source} not found`);
        if (!this.graph.nodes.some(n => n.id === target))
            throw new Error(`Target ${target} not found`);
        const id = (0, core_1.generateId)();
        this.graph.edges.push({ id, source, target, type, bandwidth, createdAt: new Date().toISOString() });
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
    buildInfrastructure() {
        const client = this.addNode({ name: 'Client', type: 'client', healthy: true, region: 'global' });
        const cloudflare = this.addNode({ name: 'Cloudflare CDN', type: 'cdn', healthy: true, region: 'global', latency: 10, replicas: 200 });
        const lb = this.addNode({ name: 'Load Balancer', type: 'load_balancer', healthy: true, region: 'us-east-1', latency: 5 });
        const router = this.addNode({ name: 'Router', type: 'router', healthy: true, region: 'us-east-1' });
        const gateway = this.addNode({ name: 'API Gateway', type: 'gateway', healthy: true, region: 'us-east-1', latency: 15 });
        const app = this.addNode({ name: 'App Server', type: 'server', healthy: true, region: 'us-east-1', cpu: 65, memory: 70, replicas: 4 });
        const db = this.addNode({ name: 'PostgreSQL', type: 'database', healthy: true, region: 'us-east-1', latency: 2 });
        const cache = this.addNode({ name: 'Redis Cache', type: 'cache', healthy: true, region: 'us-east-1', latency: 1 });
        this.addEdge(client, cloudflare, 'routes_to', 10000);
        this.addEdge(cloudflare, lb, 'load_balanced_by', 10000);
        this.addEdge(lb, router, 'routes_to');
        this.addEdge(router, gateway, 'routes_to');
        this.addEdge(gateway, app, 'proxies_to');
        this.addEdge(app, db, 'depends_on');
        this.addEdge(app, cache, 'depends_on');
        this.addEdge(db, cache, 'replicates_to', 1000);
    }
    shortestPath(fromId, toId) {
        this.buildAdjacency();
        const visited = new Set();
        const prev = new Map();
        const queue = [fromId];
        visited.add(fromId);
        prev.set(fromId, null);
        while (queue.length > 0) {
            const cur = queue.shift();
            if (cur === toId)
                break;
            for (const nb of this.adj.get(cur) || []) {
                if (!visited.has(nb)) {
                    visited.add(nb);
                    prev.set(nb, cur);
                    queue.push(nb);
                }
            }
        }
        const path = [];
        let cur = toId;
        while (cur) {
            const node = this.graph.nodes.find(n => n.id === cur);
            if (node)
                path.unshift(node);
            cur = prev.get(cur) || null;
        }
        return path;
    }
    findUnhealthy() { return this.graph.nodes.filter(n => !n.healthy); }
    validate() {
        const errors = [];
        for (const e of this.graph.edges) {
            if (!this.graph.nodes.some(n => n.id === e.source))
                errors.push(`Dangling edge source: ${e.source}`);
            if (!this.graph.nodes.some(n => n.id === e.target))
                errors.push(`Dangling edge target: ${e.target}`);
        }
        return errors;
    }
    metrics() {
        const n = this.graph.nodes.length;
        const e = this.graph.edges.length;
        const regions = [...new Set(this.graph.nodes.map(n => n.region).filter(Boolean))];
        const avgLatency = this.graph.nodes.filter(n => n.latency).reduce((s, n) => s + (n.latency || 0), 0) / Math.max(1, this.graph.nodes.filter(n => n.latency).length);
        return { nodeCount: n, edgeCount: e, unhealthyCount: this.findUnhealthy().length, avgLatency, regionCount: regions.length };
    }
    toJSON() { return JSON.parse(JSON.stringify(this.graph)); }
    static fromJSON(data) { const g = new NetworkGraphEngine(data.name); g.graph = data; g.buildAdjacency(); return g; }
    toMermaid() {
        let m = 'graph LR\n  title: "Network Topology"\n';
        for (const n of this.graph.nodes) {
            const health = n.healthy ? '' : ' [DOWN]';
            m += `    ${n.id.replace(/[^a-zA-Z0-9]/g, '_')}["${n.name}${health}"]\n`;
        }
        for (const e of this.graph.edges) {
            const s = e.source.replace(/[^a-zA-Z0-9]/g, '_');
            const t = e.target.replace(/[^a-zA-Z0-9]/g, '_');
            m += `    ${s} -->|"${e.type}"| ${t}\n`;
        }
        return m;
    }
}
exports.NetworkGraphEngine = NetworkGraphEngine;
//# sourceMappingURL=level16-network.js.map