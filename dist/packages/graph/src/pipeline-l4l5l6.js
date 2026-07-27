"use strict";
// ================================================================
// PIPELINE L4 -> L5 -> L6
// Cross-level integration: trace -> CallGraph -> CFG -> DataFlow
// Fase 8: Integracion Cruzada
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineL4L5L6 = void 0;
const level4_call_1 = require("./level4-call");
const level5_cfg_1 = require("./level5-cfg");
const level6_dataflow_1 = require("./level6-dataflow");
const core_1 = require("@cos/core");
// ===== Pipeline L4 -> L5 -> L6 =====
class PipelineL4L5L6 {
    builder;
    cfgBuilder;
    dataFlow;
    callGraphId = null;
    cfgId = null;
    constructor() {
        this.builder = new level4_call_1.CallGraphBuilder();
        this.cfgBuilder = new level5_cfg_1.CFGBuilder();
        this.dataFlow = new level6_dataflow_1.DataFlowGraph();
    }
    /** Step 1: Build a CallGraph from a structured program trace */
    traceToCallGraph(trace, options) {
        const graphId = this.builder.createGraph(trace.name);
        this.callGraphId = graphId;
        const stack = [];
        const processEntry = (entry, parentId) => {
            const nodeId = this.builder.enterCall(graphId, entry.name, entry.type || 'function', entry.module);
            // Record timing if available
            if (entry.duration && entry.duration > 0) {
                const node = this.builder.getNode(graphId, nodeId);
                if (node) {
                    node.selfTime = entry.duration;
                    node.totalTime = entry.duration;
                }
            }
            // Process children
            if (entry.children) {
                for (const child of entry.children) {
                    processEntry(child, nodeId);
                }
            }
            // Exit the call
            this.builder.exitCall(graphId, nodeId);
        };
        for (const entry of trace.entries) {
            processEntry(entry, null);
        }
        return graphId;
    }
    /** Step 2: Analyze a stack trace string into the CallGraph */
    analyzeStackTrace(graphId, stackLines) {
        this.builder.analyzeStackTrace(graphId, stackLines);
    }
    /** Step 3: Convert a CallGraph into a CFG */
    callGraphToCFG(graphId, options) {
        const graph = this.builder.getGraph(graphId);
        if (!graph)
            throw new Error(`CallGraph ${graphId} not found`);
        const cfgId = this.cfgBuilder.createCFG(`cfg_${graph.name}`);
        this.cfgId = cfgId;
        // Map: callNodeId -> cfgBlockId
        const nodeToBlock = new Map();
        // Create a basic block for each CallNode, sorted by depth for topological order
        const sortedNodes = [...graph.nodes].sort((a, b) => (a.depth || 0) - (b.depth || 0));
        for (const node of sortedNodes) {
            const blockType = node.type === 'root' ? 'entry' : 'basic';
            const blockId = this.cfgBuilder.addBlock(cfgId, `${node.name}${node.module ? ` [${node.module}]` : ''}`, blockType);
            nodeToBlock.set(node.id, blockId);
            // Add timing info as instructions
            const block = this.cfgBuilder.getBlock(cfgId, blockId);
            if (block && node.selfTime) {
                block.instructions = [`selfTime: ${node.selfTime}ms`, `calls: ${node.callCount || 1}`];
            }
        }
        // Create CFG edges from call edges
        for (const edge of graph.edges) {
            const sourceBlock = nodeToBlock.get(edge.source);
            const targetBlock = nodeToBlock.get(edge.target);
            if (sourceBlock && targetBlock) {
                this.cfgBuilder.addEdge(cfgId, sourceBlock, targetBlock, 'jump', `${edge.callCount}x`);
            }
        }
        return cfgId;
    }
    /** Step 4: Convert a CFG into a DataFlow graph */
    cfgToDataFlow(cfgId, options) {
        const cfg = this.cfgBuilder.getCFG(cfgId);
        if (!cfg)
            throw new Error(`CFG ${cfgId} not found`);
        this.dataFlow = new level6_dataflow_1.DataFlowGraph();
        const defaultLatency = options?.defaultLatencyMs ?? 10;
        const propagateTiming = options?.propagateTiming ?? true;
        // Map: cfgBlockId -> dataFlowNodeId
        const blockToNode = new Map();
        // Create a DataFlow node for each CFG block
        for (const block of cfg.blocks) {
            const nodeType = this.blockTypeToDataFlowType(block.type);
            let latency = defaultLatency;
            // Extract timing from instructions if available
            if (propagateTiming && block.instructions) {
                for (const instr of block.instructions) {
                    const match = instr.match(/selfTime:\s*(\d+)/);
                    if (match)
                        latency = parseInt(match[1]);
                }
            }
            const dfNode = {
                id: block.id,
                name: block.name,
                type: nodeType,
                latency,
                ops: block.instructions?.join('; '),
            };
            if (options?.autoThroughput) {
                dfNode.throughput = latency > 0 ? Math.round(1000 / latency) : 0;
            }
            this.dataFlow.addNode(dfNode);
            blockToNode.set(block.id, block.id);
        }
        // Create DataFlow edges from CFG edges
        for (const edge of cfg.edges) {
            const source = blockToNode.get(edge.source);
            const target = blockToNode.get(edge.target);
            if (source && target) {
                const dfEdge = {
                    id: (0, core_1.generateId)(),
                    source,
                    target,
                    dataType: edge.type,
                };
                this.dataFlow.addEdge(dfEdge);
            }
        }
        return this.dataFlow;
    }
    /** End-to-end: trace -> CallGraph -> CFG -> DataFlow */
    traceToDataFlow(trace, options) {
        const graphId = this.traceToCallGraph(trace, options);
        const cfgId = this.callGraphToCFG(graphId, options);
        return this.cfgToDataFlow(cfgId, options);
    }
    /** Access underlying builders */
    getCallGraphBuilder() { return this.builder; }
    getCFGBuilder() { return this.cfgBuilder; }
    getDataFlowGraph() { return this.dataFlow; }
    /** Validate all three graphs */
    validate() {
        return {
            l4: this.callGraphId ? this.builder.validate(this.callGraphId) : ['No CallGraph'],
            l5: this.cfgId ? this.cfgBuilder.validate(this.cfgId) : ['No CFG'],
            l6: this.dataFlow.validate(),
        };
    }
    /** Metrics for all three graphs */
    metrics() {
        return {
            l4: this.callGraphId ? this.builder.metrics(this.callGraphId) : null,
            l5: this.cfgId ? this.cfgBuilder.metrics(this.cfgId) : null,
            l6: this.dataFlow.metrics(),
        };
    }
    blockTypeToDataFlowType(blockType) {
        switch (blockType) {
            case 'entry': return 'source';
            case 'exit': return 'sink';
            case 'loop_header':
            case 'loop_body': return 'transform';
            case 'condition':
            case 'branch': return 'filter';
            case 'merge': return 'join';
            default: return 'transform';
        }
    }
}
exports.PipelineL4L5L6 = PipelineL4L5L6;
//# sourceMappingURL=pipeline-l4l5l6.js.map