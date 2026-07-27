// ================================================================
// PIPELINE L12 -> L13 -> L14 -> L15
// Cross-level integration: Memory -> Agent -> Tool -> Workflow
// Fase 8: Integracion Cruzada
// ================================================================

import { MemoryGraphEngine, MemoryNode, MemoryEdge, MemoryNodeType, MemoryEdgeType } from './level12-memory';
import { AgentGraphEngine, AgentNode, AgentEdge, AgentRole, AgentEdgeType } from './level13-agent';
import { ToolGraphEngine, ToolNode, ToolEdge, ToolType, ToolEdgeType } from './level14-tool';
import { WorkflowGraphEngine, WorkflowNode, WorkflowNodeType, WorkflowEdge, WorkflowEdgeType } from './level15-workflow';
import { EntityId, generateId } from '@cos/core';

// ===== Pipeline Types =====

export interface MemoryToWorkflowResult {
  memoryGraph: MemoryGraphEngine;
  agentGraph: AgentGraphEngine;
  toolGraph: ToolGraphEngine;
  workflowGraph: WorkflowGraphEngine;
  executionPath: EntityId[];
  metrics: {
    l12: { nodeCount: number; edgeCount: number };
    l13: { nodeCount: number; edgeCount: number };
    l14: { nodeCount: number; edgeCount: number };
    l15: { nodeCount: number; edgeCount: number };
  };
}

export interface PipelineMemoryToWorkflowOptions {
  autoBuildDemo?: boolean;
}

// ===== Pipeline L12 -> L13 -> L14 -> L15 =====

export class PipelineL12L13L14L15 {
  memoryGraph: MemoryGraphEngine;
  agentGraph: AgentGraphEngine;
  toolGraph: ToolGraphEngine;
  workflowGraph: WorkflowGraphEngine;
  private options: Required<PipelineMemoryToWorkflowOptions>;

  constructor(options?: PipelineMemoryToWorkflowOptions) {
    this.memoryGraph = new MemoryGraphEngine('Pipeline Memory');
    this.agentGraph = new AgentGraphEngine('Pipeline Agents');
    this.toolGraph = new ToolGraphEngine('Pipeline Tools');
    this.workflowGraph = new WorkflowGraphEngine('Pipeline Workflow', 'Auto-generated from memory');
    this.options = { autoBuildDemo: options?.autoBuildDemo ?? false };
  }

  /** Step 1: Build Memory Graph from memory nodes */
  buildMemoryGraph(nodes: Array<Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>>, edges: Array<Omit<MemoryEdge, 'id'>>): void {
    const nodeIds: EntityId[] = [];
    for (const n of nodes) {
      const id = this.memoryGraph.addNode(n);
      nodeIds.push(id);
    }
    for (const e of edges) {
      this.memoryGraph.addEdge(e.source, e.target, e.type, e.strength);
    }
  }

  /** Step 2: Convert Memory into an Agent hierarchy */
  memoryToAgent(): AgentGraphEngine {
    this.agentGraph = new AgentGraphEngine('Pipeline Agents');

    // Map memory types to agent roles
    const roleMap: Record<string, AgentRole> = {
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
  agentToTool(): ToolGraphEngine {
    this.toolGraph = new ToolGraphEngine('Pipeline Tools');
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
  toolToWorkflow(): WorkflowGraphEngine {
    this.workflowGraph = new WorkflowGraphEngine('Pipeline Workflow', 'Auto-generated from tools');
    const tools = this.toolGraph.getNodes();

    if (tools.length === 0) return this.workflowGraph;

    // Create trigger node
    const triggerId = this.workflowGraph.addNode({
      name: 'Start',
      type: 'trigger',
      service: 'pipeline',
    });

    // Create action nodes from tools
    const toolNodeIds: EntityId[] = [];
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
  runPipeline(
    memoryNodes: Array<Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>>,
    memoryEdges: Array<Omit<MemoryEdge, 'id'>>
  ): MemoryToWorkflowResult {
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
  buildDemo(): MemoryToWorkflowResult {
    const memoryNodes = [
      { name: 'Conversation', type: 'conversation' as MemoryNodeType, content: 'User conversation history', confidence: 0.9 },
      { name: 'Topics', type: 'topic' as MemoryNodeType, content: 'Key discussion topics', confidence: 0.8 },
      { name: 'Entities', type: 'entity' as MemoryNodeType, content: 'Named entities extracted', confidence: 0.85 },
      { name: 'Knowledge', type: 'fact' as MemoryNodeType, content: 'Extracted facts', confidence: 0.75 },
      { name: 'Insights', type: 'insight' as MemoryNodeType, content: 'Generated insights', confidence: 0.7 },
    ];

    return this.runPipeline(memoryNodes, []);
  }

  /** Validate all four graphs */
  validate(): { l12: string[]; l13: string[]; l14: string[]; l15: string[] } {
    return {
      l12: this.memoryGraph.validate(),
      l13: this.agentGraph.validate(),
      l14: this.toolGraph.validate(),
      l15: this.workflowGraph.validate(),
    };
  }

  /** Access underlying engines */
  getMemoryGraph(): MemoryGraphEngine { return this.memoryGraph; }
  getAgentGraph(): AgentGraphEngine { return this.agentGraph; }
  getToolGraph(): ToolGraphEngine { return this.toolGraph; }
  getWorkflowGraph(): WorkflowGraphEngine { return this.workflowGraph; }
}