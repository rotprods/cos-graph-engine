"use strict";
// ================================================================
// LEVEL 1: EXECUTION GRAPH — "Los nodos ejecutan código"
// DAG runner: planifica, ejecuta, observa
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionGraphEngine = void 0;
const core_1 = require("@cos/core");
class ExecutionGraphEngine {
    graphs = new Map();
    results = new Map();
    async createGraph(name, nodes, edges, options) {
        const id = (0, core_1.generateId)();
        // Validate no duplicate node IDs
        const nodeIds = new Set();
        for (const node of nodes) {
            if (nodeIds.has(node.id))
                throw new Error(`Duplicate node ID: ${node.id}`);
            nodeIds.add(node.id);
        }
        // Ensure every edge has an id and references valid nodes
        for (const edge of edges) {
            if (!edge.id)
                edge.id = (0, core_1.generateId)();
            if (!nodeIds.has(edge.source))
                throw new Error(`Edge source ${edge.source} not found in nodes`);
            if (!nodeIds.has(edge.target))
                throw new Error(`Edge target ${edge.target} not found in nodes`);
        }
        this.graphs.set(id, { id, name, nodes, edges, maxConcurrency: options?.maxConcurrency || 4, context: { traceId: `exec-${id}` } });
        return id;
    }
    /** Add a node to an existing graph */
    addNode(graphId, node) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        if (graph.nodes.some(n => n.id === node.id))
            throw new Error(`Node ${node.id} already exists`);
        graph.nodes.push(node);
    }
    /** Remove a node and its connected edges from an existing graph */
    removeNode(graphId, nodeId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        const idx = graph.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            throw new Error(`Node ${nodeId} not found`);
        graph.nodes.splice(idx, 1);
        graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    }
    /** Add an edge to an existing graph */
    addEdge(graphId, edge) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        if (!graph.nodes.some(n => n.id === edge.source))
            throw new Error(`Edge source ${edge.source} not found`);
        if (!graph.nodes.some(n => n.id === edge.target))
            throw new Error(`Edge target ${edge.target} not found`);
        if (!edge.id)
            edge.id = (0, core_1.generateId)();
        graph.edges.push(edge);
    }
    /** Remove an edge by id */
    removeEdge(graphId, edgeId) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        const idx = graph.edges.findIndex(e => e.id === edgeId);
        if (idx === -1)
            throw new Error(`Edge ${edgeId} not found`);
        graph.edges.splice(idx, 1);
    }
    async executeGraph(graphId, input) {
        const graph = this.graphs.get(graphId);
        if (!graph)
            throw new Error(`Graph ${graphId} not found`);
        // Validate no cycles first
        const visited = new Set(), inStack = new Set();
        function dfs(id) {
            visited.add(id);
            inStack.add(id);
            for (const e of graph.edges.filter(e => e.source === id)) {
                if (!visited.has(e.target)) {
                    if (dfs(e.target))
                        return true;
                }
                else if (inStack.has(e.target))
                    return true;
            }
            inStack.delete(id);
            return false;
        }
        for (const n of graph.nodes) {
            if (!visited.has(n.id)) {
                if (dfs(n.id))
                    throw new Error('Graph contains a cycle');
            }
        }
        const nodeResults = new Map();
        const completed = new Set();
        const adjacency = this.buildAdjacency(graph);
        const inDegree = this.buildInDegree(graph);
        const dataFlow = new Map();
        for (const node of graph.nodes) {
            nodeResults.set(node.id, { nodeId: node.id, status: 'pending', input: undefined, output: undefined, duration: 0, confidence: 0, cost: { units: 'credits', amount: 0 } });
        }
        const queue = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0)
                queue.push(id);
        }
        // Track remaining in-degree for each node to avoid scanning all entries per batch
        const remainingInDegree = new Map(inDegree);
        for (const q of queue)
            dataFlow.set(q, input);
        while (queue.length > 0) {
            const batch = queue.splice(0, graph.maxConcurrency);
            await Promise.all(batch.map(async (nodeId) => {
                const node = graph.nodes.find(n => n.id === nodeId);
                const nodeInput = dataFlow.get(nodeId) ?? input;
                const result = await this.executeNodeWithRetry(node, nodeInput, graph.context);
                nodeResults.set(nodeId, result);
                completed.add(nodeId);
                // Propagate data using proper adjacency lookup
                const targets = adjacency.get(nodeId) || [];
                for (const targetId of targets) {
                    const edge = graph.edges.find(e => e.source === nodeId && e.target === targetId);
                    if (!edge)
                        continue;
                    let output = result.output;
                    if (edge.dataMap)
                        output = edge.dataMap(output);
                    if (edge.condition && !edge.condition(result.output)) {
                        const skipResult = { nodeId: targetId, status: 'skipped', input: output, output: undefined, duration: 0, confidence: 0, cost: { units: 'credits', amount: 0 } };
                        nodeResults.set(targetId, skipResult);
                        completed.add(targetId);
                        continue;
                    }
                    // Last-write-wins: when multiple upstream nodes feed the same target,
                    // the last one to complete determines the value. This is a documented
                    // design choice — not a bug — for single-value dataflow graphs.
                    dataFlow.set(targetId, output);
                }
            }));
            // Check which nodes are now unblocked using tracked remaining in-degree
            for (const batchId of batch) {
                if (nodeResults.get(batchId)?.status === 'skipped')
                    continue;
                const targets = adjacency.get(batchId) || [];
                for (const targetId of targets) {
                    if (completed.has(targetId) || queue.includes(targetId))
                        continue;
                    const current = remainingInDegree.get(targetId) || 0;
                    if (current > 0) {
                        remainingInDegree.set(targetId, current - 1);
                    }
                    if (remainingInDegree.get(targetId) === 0 && !completed.has(targetId)) {
                        queue.push(targetId);
                    }
                }
            }
        }
        this.results.set(graphId, nodeResults);
        return nodeResults;
    }
    async executeNodeWithRetry(node, input, context) {
        const maxRetries = node.retries || 0;
        const timeout = node.timeout || 30000;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const result = await this.executeNode(node, input, context);
            if (result.status !== 'failed')
                return result;
        }
        // All retries exhausted — return the last failure
        const start = Date.now();
        const result = {
            nodeId: node.id, status: 'failed', input, output: undefined, duration: Date.now() - start,
            confidence: 0, cost: { units: 'credits', amount: 0 }, startedAt: new Date().toISOString(),
            error: `All ${maxRetries + 1} attempts failed`,
        };
        return result;
    }
    async executeNode(node, input, context) {
        const start = Date.now();
        const result = { nodeId: node.id, status: 'running', input, output: undefined, duration: 0, confidence: 0, cost: { units: 'credits', amount: 0 }, startedAt: new Date().toISOString() };
        try {
            const timeout = node.timeout || 30000;
            if (node.type === 'sleep') {
                const ms = node.config?.ms || 100;
                await withTimeout(new Promise(r => setTimeout(r, ms)), timeout);
                result.output = { slept: ms };
            }
            else if (node.type === 'condition') {
                result.output = { condition: true, input };
            }
            else if (node.fn) {
                result.output = await withTimeout(node.fn(input, context), timeout);
            }
            else {
                result.output = { processed: input, node: node.name };
            }
            result.status = 'completed';
            result.confidence = 0.9;
            result.cost = { units: 'credits', amount: 0.1 };
        }
        catch (error) {
            result.status = 'failed';
            result.error = error.message;
            result.confidence = 0;
        }
        result.duration = Date.now() - start;
        result.completedAt = new Date().toISOString();
        return result;
    }
    buildAdjacency(graph) {
        const adj = new Map();
        for (const node of graph.nodes)
            adj.set(node.id, []);
        for (const edge of graph.edges) {
            adj.get(edge.source).push(edge.target);
        }
        return adj;
    }
    buildInDegree(graph) {
        const deg = new Map();
        for (const node of graph.nodes)
            deg.set(node.id, 0);
        for (const edge of graph.edges) {
            deg.set(edge.target, (deg.get(edge.target) || 0) + 1);
        }
        return deg;
    }
    getResults(graphId) {
        return this.results.get(graphId);
    }
    getGraph(id) {
        return this.graphs.get(id);
    }
}
exports.ExecutionGraphEngine = ExecutionGraphEngine;
async function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
    ]);
}
//# sourceMappingURL=level1-execution.js.map