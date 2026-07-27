// ================================================================
// PIPELINE L4 -> L5 -> L6
// Cross-level integration: trace -> CallGraph -> CFG -> DataFlow
// Fase 8: Integracion Cruzada
// ================================================================

import { CallGraphBuilder, CallNode, CallEdge } from './level4-call';
import { CFGBuilder, BasicBlock, CFEdge } from './level5-cfg';
import { DataFlowGraph, DataFlowNode, DataFlowEdge } from './level6-dataflow';
import { generateId } from '@cos/core';

// ===== Trace Entry Types =====

export interface TraceEntry {
  name: string;
  module?: string;
  type?: 'function' | 'method' | 'api' | 'async' | 'external';
  line?: number;
  column?: number;
  duration?: number;
  timestamp?: number;
  children?: TraceEntry[];
}

export interface ProgramTrace {
  name: string;
  entries: TraceEntry[];
  totalDuration?: number;
}

// ===== Pipeline Conversion Options =====

export interface PipelineOptions {
  /** If true, propagates timing data from trace through to DataFlow */
  propagateTiming?: boolean;
  /** Default latency multiplier for trace entries without duration data */
  defaultLatencyMs?: number;
  /** Assigns throughput based on latency (ops/sec = 1000 / latency) */
  autoThroughput?: boolean;
}

// ===== Pipeline L4 -> L5 -> L6 =====

export class PipelineL4L5L6 {
  private builder: CallGraphBuilder;
  private cfgBuilder: CFGBuilder;
  private dataFlow: DataFlowGraph;

  callGraphId: string | null = null;
  cfgId: string | null = null;

  constructor() {
    this.builder = new CallGraphBuilder();
    this.cfgBuilder = new CFGBuilder();
    this.dataFlow = new DataFlowGraph();
  }

  /** Step 1: Build a CallGraph from a structured program trace */
  traceToCallGraph(trace: ProgramTrace, options?: PipelineOptions): string {
    const graphId = this.builder.createGraph(trace.name);
    this.callGraphId = graphId;

    const stack: Array<{ parentId: string | null }> = [];

    const processEntry = (entry: TraceEntry, parentId: string | null): void => {
      const nodeId = this.builder.enterCall(
        graphId,
        entry.name,
        entry.type || 'function',
        entry.module
      );

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
  analyzeStackTrace(graphId: string, stackLines: string[]): void {
    this.builder.analyzeStackTrace(graphId, stackLines);
  }

  /** Step 3: Convert a CallGraph into a CFG */
  callGraphToCFG(graphId: string, options?: PipelineOptions): string {
    const graph = this.builder.getGraph(graphId);
    if (!graph) throw new Error(`CallGraph ${graphId} not found`);

    const cfgId = this.cfgBuilder.createCFG(`cfg_${graph.name}`);
    this.cfgId = cfgId;

    // Map: callNodeId -> cfgBlockId
    const nodeToBlock = new Map<string, string>();

    // Create a basic block for each CallNode, sorted by depth for topological order
    const sortedNodes = [...graph.nodes].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    for (const node of sortedNodes) {
      const blockType = node.type === 'root' ? 'entry' : 'basic';
      const blockId = this.cfgBuilder.addBlock(cfgId, `${node.name}${node.module ? ` [${node.module}]` : ''}`, blockType as any);
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
  cfgToDataFlow(cfgId: string, options?: PipelineOptions): DataFlowGraph {
    const cfg = this.cfgBuilder.getCFG(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);

    this.dataFlow = new DataFlowGraph();

    const defaultLatency = options?.defaultLatencyMs ?? 10;
    const propagateTiming = options?.propagateTiming ?? true;

    // Map: cfgBlockId -> dataFlowNodeId
    const blockToNode = new Map<string, string>();

    // Create a DataFlow node for each CFG block
    for (const block of cfg.blocks) {
      const nodeType = this.blockTypeToDataFlowType(block.type);
      let latency = defaultLatency;

      // Extract timing from instructions if available
      if (propagateTiming && block.instructions) {
        for (const instr of block.instructions) {
          const match = instr.match(/selfTime:\s*(\d+)/);
          if (match) latency = parseInt(match[1]);
        }
      }

      const dfNode: DataFlowNode = {
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
        const dfEdge: DataFlowEdge = {
          id: generateId(),
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
  traceToDataFlow(trace: ProgramTrace, options?: PipelineOptions): DataFlowGraph {
    const graphId = this.traceToCallGraph(trace, options);
    const cfgId = this.callGraphToCFG(graphId, options);
    return this.cfgToDataFlow(cfgId, options);
  }

  /** Access underlying builders */
  getCallGraphBuilder(): CallGraphBuilder { return this.builder; }
  getCFGBuilder(): CFGBuilder { return this.cfgBuilder; }
  getDataFlowGraph(): DataFlowGraph { return this.dataFlow; }

  /** Validate all three graphs */
  validate(): { l4: string[]; l5: string[]; l6: string[] } {
    return {
      l4: this.callGraphId ? this.builder.validate(this.callGraphId) : ['No CallGraph'],
      l5: this.cfgId ? this.cfgBuilder.validate(this.cfgId) : ['No CFG'],
      l6: this.dataFlow.validate(),
    };
  }

  /** Metrics for all three graphs */
  metrics(): { l4: any; l5: any; l6: any } {
    return {
      l4: this.callGraphId ? this.builder.metrics(this.callGraphId) : null,
      l5: this.cfgId ? this.cfgBuilder.metrics(this.cfgId) : null,
      l6: this.dataFlow.metrics(),
    };
  }

  private blockTypeToDataFlowType(blockType: string): DataFlowNode['type'] {
    switch (blockType) {
      case 'entry': return 'source';
      case 'exit': return 'sink';
      case 'loop_header': case 'loop_body': return 'transform';
      case 'condition': case 'branch': return 'filter';
      case 'merge': return 'join';
      default: return 'transform';
    }
  }
}