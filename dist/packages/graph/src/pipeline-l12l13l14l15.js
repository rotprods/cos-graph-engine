"use strict";
// ================================================================
// PIPELINE L12 -> L13 -> L14 -> L15
// Cross-level integration: Memory -> Agent -> Tool -> Workflow
// Fase 8: Integracion Cruzada
// ================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineL12L13L14L15 = void 0;
const level12_memory_1 = require("./level12-memory");
const level13_agent_1 = require("./level13-agent");
const level14_tool_1 = require("./level14-tool");
const level15_workflow_1 = require("./level15-workflow");
// ===== Pipeline L12 -> L13 -> L14 -> L15 =====
class PipelineL12L13L14L15 {
    memoryGraph;
    agentGraph;
    toolGraph;
    workflowGraph;
    options;
    constructor(options) {
        this.memoryGraph = new level12_memory_1.MemoryGraphEngine('Pipeline Memory');
        this.agentGraph = new level13_agent_1.AgentGraphEngine('Pipeline Agents');
        this.toolGraph = new level14_tool_1.ToolGraphEngine('Pipeline Tools');
        this.workflowGraph = new level15_workflow_1.WorkflowGraphEngine('Pipeline Workflow', 'Auto-generated from memory');
        this.options = { autoBuildDemo: options?.autoBuildDemo ?? false };
    }
    /** Step 1: Build Memory Graph from memory nodes */
    buildMemoryGraph(nodes, edges) {
        const nodeIds = [];
        for (const n of nodes) {
            const id = this.memoryGraph.addNode(n);
            nodeIds.push(id);
        }
        for (const e of edges) {
            this.memoryGraph.addEdge(e.source, e.target, e.type, e.strength);
        }
    }
    /** Step 2: Convert Memory into an Agent hierarchy */
    memoryToAgent() {
        this.agentGraph = new level13_agent_1.AgentGraphEngine('Pipeline Agents');
        // Map memory types to agent roles
        const roleMap = {
            conversation: 'coordinator',
            topic: 'planner',
            entity: 'researcher',
            fact: 'analyst',
            insight: 'designer',
            memory: 'developer',
        };
        // Create agents from memory nodes
        for (const n of this.memoryGraph.getNodes()) {
            const role = roleMap[n.type] || 'analyst';
            this.agentGraph.addNode({
                name: `Agent_${n.name}`,
                role,
                capabilities: [n.type, 'memory_aware'],
                tools: [],
                memoryIds: [n.id],
                confidence: n.confidence || 0.7,
            });
        }
        // Create delegation edges
        const agents = this.agentGraph.getNodes();
        for (let i = 1; i < agents.length; i++) {
            this.agentGraph.addEdge(agents[i - 1].id, agents[i].id, 'delegates_to', 5);
        }
        // Coordinator reports to first agent
        if (agents.length >= 2) {
            this.agentGraph.addEdge(agents[0].id, agents[agents.length - 1].id, 'reports_to', 3);
        }
        return this.agentGraph;
    }
    /** Step 3: Convert Agent capabilities into Tools */
    agentToTool() {
        this.toolGraph = new level14_tool_1.ToolGraphEngine('Pipeline Tools');
        const agents = this.agentGraph.getNodes();
        // Create a tool for each agent capability
        for (const agent of agents) {
            for (const cap of agent.capabilities) {
                this.toolGraph.addNode({
                    name: `${cap}_tool`,
                    type: 'function',
                    description: `${cap} capability for ${agent.name}`,
                    requiredCapabilities: [cap],
                    rateLimit: 100,
                    latency: 50,
                    costPerCall: 0.01,
                    enabled: true,
                });
            }
        }
        // Create dependency edges between tools
        const tools = this.toolGraph.getNodes();
        for (let i = 1; i < tools.length; i++) {
            this.toolGraph.addEdge(tools[i - 1].id, tools[i].id, 'depends_on');
        }
        return this.toolGraph;
    }
    /** Step 4: Convert Tools into a Workflow */
    toolToWorkflow() {
        this.workflowGraph = new level15_workflow_1.WorkflowGraphEngine('Pipeline Workflow', 'Auto-generated from tools');
        const tools = this.toolGraph.getNodes();
        if (tools.length === 0)
            return this.workflowGraph;
        // Create trigger node
        const triggerId = this.workflowGraph.addNode({
            name: 'Start',
            type: 'trigger',
            service: 'pipeline',
        });
        // Create action nodes from tools
        const toolNodeIds = [];
        for (const tool of tools) {
            const id = this.workflowGraph.addNode({
                name: tool.name,
                type: 'action',
                config: { toolId: tool.id },
            });
            toolNodeIds.push(id);
        }
        // End node
        const endId = this.workflowGraph.addNode({
            name: 'End',
            type: 'end',
        });
        // Wire: trigger -> tool1 -> tool2 -> ... -> end
        this.workflowGraph.addEdge(triggerId, toolNodeIds[0], 'on_success');
        for (let i = 1; i < toolNodeIds.length; i++) {
            this.workflowGraph.addEdge(toolNodeIds[i - 1], toolNodeIds[i], 'on_success');
        }
        if (toolNodeIds.length > 0) {
            this.workflowGraph.addEdge(toolNodeIds[toolNodeIds.length - 1], endId, 'on_success');
        }
        return this.workflowGraph;
    }
    /** End-to-end pipeline */
    runPipeline(memoryNodes, memoryEdges) {
        this.buildMemoryGraph(memoryNodes, memoryEdges);
        this.memoryToAgent();
        this.agentToTool();
        this.toolToWorkflow();
        const execPath = this.workflowGraph.getNodes().filter(n => n.type !== 'end').map(n => n.id);
        return {
            memoryGraph: this.memoryGraph,
            agentGraph: this.agentGraph,
            toolGraph: this.toolGraph,
            workflowGraph: this.workflowGraph,
            executionPath: execPath,
            metrics: {
                l12: { nodeCount: this.memoryGraph.getNodes().length, edgeCount: this.memoryGraph.getEdges().length },
                l13: { nodeCount: this.agentGraph.getNodes().length, edgeCount: this.agentGraph.getEdges().length },
                l14: { nodeCount: this.toolGraph.getNodes().length, edgeCount: this.toolGraph.getEdges().length },
                l15: { nodeCount: this.workflowGraph.getNodes().length, edgeCount: this.workflowGraph.getEdges().length },
            },
        };
    }
    /** Build demo data */
    buildDemo() {
        const memoryNodes = [
            { name: 'Conversation', type: 'conversation', content: 'User conversation history', confidence: 0.9 },
            { name: 'Topics', type: 'topic', content: 'Key discussion topics', confidence: 0.8 },
            { name: 'Entities', type: 'entity', content: 'Named entities extracted', confidence: 0.85 },
            { name: 'Knowledge', type: 'fact', content: 'Extracted facts', confidence: 0.75 },
            { name: 'Insights', type: 'insight', content: 'Generated insights', confidence: 0.7 },
        ];
        return this.runPipeline(memoryNodes, []);
    }
    /** Validate all four graphs */
    validate() {
        return {
            l12: this.memoryGraph.validate(),
            l13: this.agentGraph.validate(),
            l14: this.toolGraph.validate(),
            l15: this.workflowGraph.validate(),
        };
    }
    /** Access underlying engines */
    getMemoryGraph() { return this.memoryGraph; }
    getAgentGraph() { return this.agentGraph; }
    getToolGraph() { return this.toolGraph; }
    getWorkflowGraph() { return this.workflowGraph; }
}
exports.PipelineL12L13L14L15 = PipelineL12L13L14L15;
//# sourceMappingURL=pipeline-l12l13l14l15.js.map