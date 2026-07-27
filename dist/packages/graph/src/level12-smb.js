"use strict";
// LEVEL 12: SMB Integration — Persistent Memory Graph
// Extends MemoryGraphEngine with SMB backing store and event publishing
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMBMemoryGraph = void 0;
const level12_memory_1 = require("./level12-memory");
const SMB_KEY_PREFIX = 'memory-graph:';
/**
 * SMB-integrated memory graph.
 * Wraps MemoryGraphEngine with save/load to the Shared Memory Bus
 * and publishes events for memory operations.
 */
class SMBMemoryGraph {
    engine;
    smb;
    graphId;
    constructor(smb, name = 'memory-graph') {
        this.smb = smb;
        this.engine = new level12_memory_1.MemoryGraphEngine(name);
        this.graphId = `${SMB_KEY_PREFIX}${name}`;
    }
    /** Delegate to underlying MemoryGraphEngine */
    get graph() { return this.engine; }
    addNode(n) {
        const id = this.engine.addNode(n);
        this.smb.publish({
            type: 'memory:addNode',
            source: 'L12',
            payload: { nodeId: id, name: n.name, type: n.type },
            graphId: this.graphId,
            nodeId: id,
        });
        return id;
    }
    addEdge(source, target, type, strength = 0.5) {
        const id = this.engine.addEdge(source, target, type, strength);
        this.smb.publish({
            type: 'memory:addEdge',
            source: 'L12',
            payload: { edgeId: id, source, target, type, strength },
            graphId: this.graphId,
        });
        return id;
    }
    accessNode(nodeId) {
        const node = this.engine.accessNode(nodeId);
        if (node) {
            this.smb.publish({
                type: 'memory:accessNode',
                source: 'L12',
                payload: { nodeId, name: node.name },
                graphId: this.graphId,
                nodeId,
            });
        }
        return node;
    }
    buildConversation() {
        this.engine.buildConversation();
        this.smb.publish({
            type: 'memory:buildConversation',
            source: 'L12',
            payload: { graphId: this.graphId },
            graphId: this.graphId,
        });
    }
    recall(nodeId, maxDepth, minStrength) {
        return this.engine.recall(nodeId, maxDepth, minStrength);
    }
    strongestPath(fromId, toId) {
        return this.engine.strongestPath(fromId, toId);
    }
    forget(minConfidence) {
        return this.engine.forget(minConfidence);
    }
    consolidate() {
        return this.engine.consolidate();
    }
    validate() {
        return this.engine.validate();
    }
    metrics() {
        return this.engine.metrics();
    }
    /** Save the entire memory graph to SMB */
    async save() {
        const data = this.engine.toJSON();
        return this.smb.saveGraph(this.graphId, data, {
            tags: ['memory-graph', 'L12'],
            importance: 0.95,
        });
    }
    /** Load the memory graph from SMB */
    async load() {
        const data = await this.smb.loadGraph(this.graphId);
        if (!data)
            return false;
        const restored = level12_memory_1.MemoryGraphEngine.fromJSON(data);
        this.engine = restored;
        return true;
    }
    toJSON() {
        return this.engine.toJSON();
    }
    toMermaid() {
        return this.engine.toMermaid();
    }
}
exports.SMBMemoryGraph = SMBMemoryGraph;
//# sourceMappingURL=level12-smb.js.map