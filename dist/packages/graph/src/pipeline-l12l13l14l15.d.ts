import { MemoryGraphEngine, MemoryNode, MemoryEdge } from './level12-memory';
import { AgentGraphEngine } from './level13-agent';
import { ToolGraphEngine } from './level14-tool';
import { WorkflowGraphEngine } from './level15-workflow';
import { EntityId } from '@cos/core';
export interface MemoryToWorkflowResult {
    memoryGraph: MemoryGraphEngine;
    agentGraph: AgentGraphEngine;
    toolGraph: ToolGraphEngine;
    workflowGraph: WorkflowGraphEngine;
    executionPath: EntityId[];
    metrics: {
        l12: {
            nodeCount: number;
            edgeCount: number;
        };
        l13: {
            nodeCount: number;
            edgeCount: number;
        };
        l14: {
            nodeCount: number;
            edgeCount: number;
        };
        l15: {
            nodeCount: number;
            edgeCount: number;
        };
    };
}
export interface PipelineMemoryToWorkflowOptions {
    autoBuildDemo?: boolean;
}
export declare class PipelineL12L13L14L15 {
    memoryGraph: MemoryGraphEngine;
    agentGraph: AgentGraphEngine;
    toolGraph: ToolGraphEngine;
    workflowGraph: WorkflowGraphEngine;
    private options;
    constructor(options?: PipelineMemoryToWorkflowOptions);
    /** Step 1: Build Memory Graph from memory nodes */
    buildMemoryGraph(nodes: Array<Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>>, edges: Array<Omit<MemoryEdge, 'id'>>): void;
    /** Step 2: Convert Memory into an Agent hierarchy */
    memoryToAgent(): AgentGraphEngine;
    /** Step 3: Convert Agent capabilities into Tools */
    agentToTool(): ToolGraphEngine;
    /** Step 4: Convert Tools into a Workflow */
    toolToWorkflow(): WorkflowGraphEngine;
    /** End-to-end pipeline */
    runPipeline(memoryNodes: Array<Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>>, memoryEdges: Array<Omit<MemoryEdge, 'id'>>): MemoryToWorkflowResult;
    /** Build demo data */
    buildDemo(): MemoryToWorkflowResult;
    /** Validate all four graphs */
    validate(): {
        l12: string[];
        l13: string[];
        l14: string[];
        l15: string[];
    };
    /** Access underlying engines */
    getMemoryGraph(): MemoryGraphEngine;
    getAgentGraph(): AgentGraphEngine;
    getToolGraph(): ToolGraphEngine;
    getWorkflowGraph(): WorkflowGraphEngine;
}
//# sourceMappingURL=pipeline-l12l13l14l15.d.ts.map