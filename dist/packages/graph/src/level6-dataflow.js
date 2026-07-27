"use strict";
// LEVEL 6: DATA FLOW GRAPH
// Transforms, pipelines, tensor shapes, streaming, bottleneck detection
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlowGraph = void 0;
const core_1 = require("@cos/core");
class DataFlowGraph {
    nodes = [];
    edges = [];
    adj = new Map();
    adjRev = new Map();
    buildAdjacency() {
        this.adj.clear();
        this.adjRev.clear();
        for (const n of this.nodes) {
            this.adj.set(n.id, []);
            this.adjRev.set(n.id, []);
        }
        for (const e of this.edges) {
            if (this.adj.has(e.source))
                this.adj.get(e.source).push(e.target);
            if (this.adjRev.has(e.target))
                this.adjRev.get(e.target).push(e.source);
        }
    }
    addNode(n) {
        if (this.nodes.some(x => x.id === n.id))
            throw new Error(`Duplicate DataFlow node ID: ${n.id}`);
        this.nodes.push(n);
        this.buildAdjacency();
        return n.id;
    }
    removeNode(nodeId) {
        const idx = this.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            throw new Error(`Node ${nodeId} not found`);
        this.nodes.splice(idx, 1);
        this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.buildAdjacency();
    }
    addEdge(e) {
        if (!this.nodes.some(n => n.id === e.source))
            throw new Error(`Edge source ${e.source} not found`);
        if (!this.nodes.some(n => n.id === e.target))
            throw new Error(`Edge target ${e.target} not found`);
        this.edges.push(e);
        this.buildAdjacency();
    }
    removeEdge(edgeId) {
        const idx = this.edges.findIndex(e => e.id === edgeId);
        if (idx === -1)
            throw new Error(`Edge ${edgeId} not found`);
        this.edges.splice(idx, 1);
        this.buildAdjacency();
    }
    getNode(nodeId) { return this.nodes.find(n => n.id === nodeId); }
    getEdge(edgeId) { return this.edges.find(e => e.id === edgeId); }
    buildMLPipeline() {
        this.addNode({ id: 'img', name: 'Image Input', type: 'source', outputShape: 'HxWx3', batchSize: 32, throughput: 1000, latency: 5 });
        this.addNode({ id: 'resize', name: 'Resize', type: 'transform', inputShape: 'HxWx3', outputShape: '224x224x3', ops: 'bilinear', throughput: 850, latency: 8 });
        this.addNode({ id: 'norm', name: 'Normalize', type: 'transform', inputShape: '224x224x3', outputShape: '224x224x3', ops: 'mean=0.485,std=0.229', throughput: 900, latency: 3 });
        this.addNode({ id: 'cnn', name: 'CNN Backbone', type: 'transform', inputShape: '224x224x3', outputShape: '7x7x2048', ops: 'ResNet50', throughput: 200, latency: 150, memoryMB: 1024 });
        this.addNode({ id: 'fc', name: 'Fully Connected', type: 'transform', inputShape: '7x7x2048', outputShape: '1000', ops: 'linear', throughput: 500, latency: 20 });
        this.addNode({ id: 'out', name: 'Softmax Output', type: 'sink', inputShape: '1000', outputShape: '1000', throughput: 950, latency: 2 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'img', target: 'resize', dataType: 'image', shape: 'HxWx3', sizeBytes: 900000 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'resize', target: 'norm', dataType: 'tensor', shape: '224x224x3', sizeBytes: 602112 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'norm', target: 'cnn', dataType: 'tensor', shape: '224x224x3' });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'cnn', target: 'fc', dataType: 'tensor', shape: '7x7x2048' });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'fc', target: 'out', dataType: 'tensor', shape: '1000' });
    }
    buildETLPipeline() {
        this.addNode({ id: 'kafka', name: 'Kafka Stream', type: 'source', throughput: 50000, latency: 2 });
        this.addNode({ id: 'parse', name: 'JSON Parser', type: 'transform', ops: 'avro->json', throughput: 30000, latency: 5 });
        this.addNode({ id: 'filter', name: 'Filter Invalid', type: 'filter', ops: 'val=null', throughput: 28000, latency: 1 });
        this.addNode({ id: 'enrich', name: 'Enrich User', type: 'transform', ops: 'join:users', throughput: 15000, latency: 25 });
        this.addNode({ id: 's3', name: 'S3 Storage', type: 'storage', throughput: 20000, latency: 10 });
        this.addNode({ id: 'dashboard', name: 'Real-time Dashboard', type: 'sink', throughput: 1000, latency: 100 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'kafka', target: 'parse', dataType: 'bytes', sizeBytes: 1024 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'parse', target: 'filter', dataType: 'json' });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'filter', target: 'enrich', dataType: 'json' });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'enrich', target: 's3', dataType: 'parquet' });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'enrich', target: 'dashboard', dataType: 'aggregate' });
    }
    findBottlenecks(thresholdPercentile = 0.8) {
        if (this.nodes.length === 0)
            return [];
        const latencies = this.nodes.map(n => n.latency || 0).filter(l => l > 0).sort((a, b) => b - a);
        const throughputs = this.nodes.map(n => n.throughput || Infinity).filter(t => t < Infinity).sort((a, b) => a - b);
        if (latencies.length === 0 && throughputs.length === 0)
            return [];
        const latencyThreshold = latencies.length > 0 ? latencies[Math.floor(latencies.length * (1 - thresholdPercentile))] : 0;
        const throughputThreshold = throughputs.length > 0 ? throughputs[Math.floor(throughputs.length * thresholdPercentile)] : 0;
        return this.nodes.filter(n => (n.latency && n.latency >= latencyThreshold) || (n.throughput && n.throughput <= throughputThreshold)).slice(0, Math.max(1, Math.floor(this.nodes.length * 0.3)));
    }
    criticalPath() {
        this.buildAdjacency();
        const inDeg = new Map();
        for (const n of this.nodes)
            inDeg.set(n.id, 0);
        for (const e of this.edges)
            inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
        const q = [...this.nodes.filter(n => inDeg.get(n.id) === 0).map(n => n.id)];
        const dist = new Map();
        const prev = new Map();
        for (const n of this.nodes) {
            dist.set(n.id, n.latency || 0);
            prev.set(n.id, null);
        }
        while (q.length) {
            const u = q.shift();
            for (const e of this.edges.filter(e => e.source === u)) {
                const nd = (dist.get(u) || 0) + (this.nodes.find(n => n.id === e.target)?.latency || 0);
                if (nd > (dist.get(e.target) || 0)) {
                    dist.set(e.target, nd);
                    prev.set(e.target, u);
                }
                const d = inDeg.get(e.target) || 1;
                inDeg.set(e.target, d - 1);
                if (d - 1 === 0)
                    q.push(e.target);
            }
        }
        let maxNode = '';
        let maxDist = 0;
        for (const [id, d] of dist) {
            if (d > maxDist) {
                maxDist = d;
                maxNode = id;
            }
        }
        const path = [];
        let cur = maxNode;
        while (cur) {
            const node = this.nodes.find(n => n.id === cur);
            if (node)
                path.unshift(node);
            cur = prev.get(cur) || '';
        }
        return path;
    }
    totalLatency() { return this.criticalPath().reduce((s, n) => s + (n.latency || 0), 0); }
    toMermaid() {
        let m = 'graph LR\n';
        for (const n of this.nodes) {
            const shape = n.type === 'source' ? '[(' : n.type === 'sink' ? '])' : n.type === 'storage' ? '[/' : '[';
            const close = n.type === 'source' ? '))' : n.type === 'sink' ? ']' : n.type === 'storage' ? '/]' : ']';
            m += `    ${n.id}${shape}"${n.name}"${close}\n`;
        }
        for (const e of this.edges)
            m += `    ${e.source} -->|"${e.dataType}"| ${e.target}\n`;
        return m;
    }
    validate() {
        const errors = [];
        for (const e of this.edges) {
            if (!this.nodes.some(n => n.id === e.source))
                errors.push(`Dangling edge source: ${e.source}`);
            if (!this.nodes.some(n => n.id === e.target))
                errors.push(`Dangling edge target: ${e.target}`);
        }
        return errors;
    }
    metrics() {
        const n = this.nodes.length;
        const e = this.edges.length;
        this.buildAdjacency();
        const deg = this.nodes.map(n => (this.adj.get(n.id)?.length || 0) + (this.adjRev.get(n.id)?.length || 0));
        const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
        const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
        return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
    }
    toJSON() { return { nodes: this.nodes, edges: this.edges }; }
    static fromJSON(data) {
        const g = new DataFlowGraph();
        g.nodes = data.nodes;
        g.edges = data.edges;
        g.buildAdjacency();
        return g;
    }
}
exports.DataFlowGraph = DataFlowGraph;
//# sourceMappingURL=level6-dataflow.js.map