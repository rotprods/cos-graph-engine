"use strict";
// LEVEL 9: SEMANTIC GRAPH
// Taxonomies, hypernyms, LCA, semantic similarity
// Refactored: mutation API, adjacency maps, serialization, validation
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticGraph = void 0;
const core_1 = require("@cos/core");
class SemanticGraph {
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
            throw new Error(`Duplicate semantic node ID: ${n.id}`);
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
    buildAnimalTaxonomy() {
        this.addNode({ id: 'animal', concept: 'Animal', type: 'class', definition: 'Living organism' });
        this.addNode({ id: 'mammal', concept: 'Mammal', type: 'class', definition: 'Warm-blooded' });
        this.addNode({ id: 'bird', concept: 'Bird', type: 'class', definition: 'Has feathers' });
        this.addNode({ id: 'dog', concept: 'Dog', type: 'entity', examples: ['Canis familiaris'] });
        this.addNode({ id: 'cat', concept: 'Cat', type: 'entity', examples: ['Felis catus'] });
        this.addNode({ id: 'eagle', concept: 'Eagle', type: 'entity', examples: ['Aquila'] });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'mammal', target: 'animal', relation: 'is_a', strength: 1.0 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'bird', target: 'animal', relation: 'is_a', strength: 1.0 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'dog', target: 'mammal', relation: 'is_a', strength: 0.9 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'cat', target: 'mammal', relation: 'is_a', strength: 0.9 });
        this.addEdge({ id: (0, core_1.generateId)(), source: 'eagle', target: 'bird', relation: 'is_a', strength: 0.9 });
    }
    lca(id1, id2) {
        const ancestors1 = new Set();
        const collect = (id, set) => {
            set.add(id);
            for (const e of this.edges.filter(e => e.target === id && e.relation === 'is_a')) {
                collect(e.source, set);
            }
        };
        collect(id1, ancestors1);
        const queue = [id2];
        const visited = new Set();
        while (queue.length) {
            const id = queue.shift();
            if (ancestors1.has(id))
                return this.getNode(id) || null;
            if (visited.has(id))
                continue;
            visited.add(id);
            for (const e of this.edges.filter(e => e.target === id && e.relation === 'is_a')) {
                queue.push(e.source);
            }
        }
        return null;
    }
    similarity(id1, id2) {
        const ancestor = this.lca(id1, id2);
        if (!ancestor)
            return 0;
        const depth = (id) => {
            let d = 0;
            let cur = id;
            while (true) {
                const parent = this.edges.find(e => e.target === cur && e.relation === 'is_a');
                if (!parent)
                    break;
                cur = parent.source;
                d++;
            }
            return d;
        };
        const d1 = depth(id1);
        const d2 = depth(id2);
        const da = depth(ancestor.id);
        return (2 * da) / (d1 + d2);
    }
    toMermaid() {
        let m = 'graph TD\n';
        for (const n of this.nodes) {
            m += `    ${n.id}["${n.concept}"]\n`;
        }
        for (const e of this.edges) {
            m += `    ${e.source} -->|"${e.relation}"| ${e.target}\n`;
        }
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
        const deg = this.nodes.map(no => (this.adj.get(no.id)?.length || 0) + (this.adjRev.get(no.id)?.length || 0));
        const avgDeg = n > 0 ? deg.reduce((a, b) => a + b, 0) / n : 0;
        const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
        return { nodeCount: n, edgeCount: e, avgDegree: avgDeg, density };
    }
    toJSON() { return { nodes: this.nodes, edges: this.edges }; }
    static fromJSON(data) {
        const g = new SemanticGraph();
        g.nodes = data.nodes;
        g.edges = data.edges;
        g.buildAdjacency();
        return g;
    }
}
exports.SemanticGraph = SemanticGraph;
//# sourceMappingURL=level9-semantic.js.map