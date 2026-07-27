"use strict";
// LEVEL 7: SMB Integration — Persistent Compute Graph
// Extends ComputationalGraph with SMB save/load and event publishing
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMBComputeGraph = void 0;
const level7_compute_1 = require("./level7-compute");
const SMB_KEY_PREFIX = 'compute-graph:';
/**
 * SMB-integrated computational graph.
 * Wraps ComputationalGraph with save/load to the Shared Memory Bus
 * and publishes events for each computation.
 */
class SMBComputeGraph {
    graph;
    smb;
    graphId;
    constructor(smb, name = 'compute-graph') {
        this.smb = smb;
        this.graph = new level7_compute_1.ComputationalGraph();
        this.graphId = `${SMB_KEY_PREFIX}${name}`;
    }
    /** Delegate to underlying ComputationalGraph */
    get nodes() { return this.graph.nodes; }
    get edges() { return this.graph.edges; }
    addNode(n) {
        return this.graph.addNode(n);
    }
    addEdge(e) {
        this.graph.addEdge(e);
    }
    buildMLP(inputDim, hiddenDim, numClasses) {
        this.graph.buildMLP(inputDim, hiddenDim, numClasses);
    }
    buildExpression() {
        this.graph.buildExpression();
    }
    topologicalSort() {
        return this.graph.topologicalSort();
    }
    paramCount() {
        return this.graph.paramCount();
    }
    toMermaid() {
        return this.graph.toMermaid();
    }
    /** Forward pass + publish event */
    async forward(inputs) {
        const result = this.graph.forward(inputs);
        await this.smb.publish({
            type: 'compute:forward',
            source: 'L7',
            payload: { inputs, result, graphId: this.graphId },
            graphId: this.graphId,
        });
        return result;
    }
    /** Backward pass + publish event */
    async backward() {
        const grads = this.graph.backward();
        const gradObj = {};
        for (const [k, v] of grads)
            gradObj[k] = v;
        await this.smb.publish({
            type: 'compute:backward',
            source: 'L7',
            payload: { gradients: gradObj, graphId: this.graphId },
            graphId: this.graphId,
        });
        return grads;
    }
    /** Save computation graph state to SMB */
    async save() {
        const data = this.graph.toJSON();
        return this.smb.saveGraph(this.graphId, data, {
            tags: ['compute-graph', 'L7'],
            importance: 0.9,
        });
    }
    /** Load computation graph state from SMB */
    async load() {
        const data = await this.smb.loadGraph(this.graphId);
        if (!data)
            return false;
        this.graph = level7_compute_1.ComputationalGraph.fromJSON(data);
        return true;
    }
    /** Get the underlying graph data */
    toJSON() {
        return this.graph.toJSON();
    }
}
exports.SMBComputeGraph = SMBComputeGraph;
//# sourceMappingURL=level7-smb.js.map