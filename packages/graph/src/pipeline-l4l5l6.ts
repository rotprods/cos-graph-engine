// ================================================================
// PIPELINE L4 -> L5 -> L6
// Cross-level integration: trace -> CallGraph -> CFG -> DataFlow
// Fase 8: Integracion Cruzada
// ================================================================

import { CallGraphBuilder } from './level4-call';
import { CFGBuilder } from './level5-cfg';
import { DataFlowGraph, DataFlowNode, DataFlowEdge } from './level6-dataflow';
import { EntityId, generateId } from '@cos/core';

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

  callGraphId: EntityId | null = null;
  cfgId: EntityId | null = null;

  constructor() {
    this.builder = new CallGraphBuilder();
    this.cfgBuilder = new CFGBuilder();
    this.dataFlow = new DataFlowGraph();
  }

  /** Step 1: Build a CallGraph from a structured program trace */
  traceToCallGraph(trace: ProgramTrace, options?: PipelineOptions): EntityId {
    const graphId = this.builder.createGraph(trace.name);
    this.callGraphId = graphId;

    const processEntry = (entry: TraceEntry, parentId: EntityId | null): void => {
      const nodeId = this.builder.enterCall(
        graphId,
        entry.name,
        entry.type || 'function',
        entry.module,
      );

      // Record timing if available
      if (entry.duration && entry.duration > 0) {
        const node = this.builder.getNode(graphId, nodeId);
        if (node) {
          node.selfTime = entry.duration;
          node.totalTime = entry.duration;
        }
      }

      // Process children. CallGraphBuilder tracks the active span internally;
      // parentId is retained here as explicit traversal context for clarity.
      if (entry.children) {
        for (const child of entry.children) {
          processEntry(child, nodeId);
        }
      }

      this.builder.exitCall(graphId, nodeId);
      void parentId;
      void options;
    };

    for (const entry of trace.entries) {
      processEntry(entry, null);
    }

    return graphId;
  }

  /** Step 2: Analyze a stack trace string into the CallGraph */
  analyzeStackTrace(graphId: EntityId, stackLines: string[]): void {
    this.builder.analyzeStackTrace(graphId, stackLines);
  }

  /** Step 3: Convert a CallGraph into a CFG */
  callGraphToCFG(graphId: EntityId, options?: PipelineOptions): EntityId {
    const graph = this.builder.getGraph(graphId);
    if (!graph) throw new Error(`CallGraph ${graphId} not found`);

    const cfgId = this.cfgBuilder.createCFG(`cfg_${graph.name}`);
    this.cfgId = cfgId;

    // Map: callNodeId -> cfgBlockId
    const nodeToBlock = new Map<EntityId, EntityId>();

    const sortedNodes = [...graph.nodes].sort((a, b) => (a.depth || 0) - (b.depth || 0));

    for (const node of sortedNodes) {
      const blockType = node.type === 'root' ? 'entry' : 'basic';
      const blockId = this.cfgBuilder.addBlock(
        cfgId,
        `${node.name}${node.module ? ` [${node.module}]` : ''}`,
        blockType,
      );
      nodeToBlock.set(node.id, blockId);

      const block = this.cfgBuilder.getBlock(cfgId, blockId);
      if (block && node.selfTime) {
        block.instructions = [`selfTime: ${node.selfTime}ms`, `calls: ${node.callCount || 1}`];
      }
    }

    for (const edge of graph.edges) {
      const sourceBlock = nodeToBlock.get(edge.source);
      const targetBlock = nodeToBlock.get(edge.target);
      if (sourceBlock && targetBlock) {
        this.cfgBuilder.addEdge(cfgId, sourceBlock, targetBlock, 'jump', `${edge.callCount}x`);
      }
    }

    void options;
    return cfgId;
  }

  /** Step 4: Convert a CFG into a DataFlow graph */
  cfgToDataFlow(cfgId: EntityId, options?: PipelineOptions): DataFlowGraph {
    const cfg = this.cfgBuilder.getCFG(cfgId);
    if (!cfg) throw new Error(`CFG ${cfgId} not found`);

    this.dataFlow = new DataFlowGraph();

    const defaultLatency = options?.defaultLatencyMs ?? 10;
    const propagateTiming = options?.propagateTiming ?? true;

    const blockToNode = new Map<EntityId, EntityId>();

    for (const block of cfg.blocks) {
      const nodeType = this.blockTypeToDataFlowType(block.type);
      let latency = defaultLatency;

      if (propagateTiming && block.instructions) {
        for (const instr of block.instructions) {
          const match = instr.match(/selfTime:\s*(\d+)/);
          if (match) latency = parseInt(match[1], 10);
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

  getCallGraphBuilder(): CallGraphBuilder { return this.builder; }
  getCFGBuilder(): CFGBuilder { return this.cfgBuilder; }
  getDataFlowGraph(): DataFlowGraph { return this.dataFlow; }

  validate(): { l4: string[]; l5: string[]; l6: string[] } {
    return {
      l4: this.callGraphId ? this.builder.validate(this.callGraphId) : ['No CallGraph'],
      l5: this.cfgId ? this.cfgBuilder.validate(this.cfgId) : ['No CFG'],
      l6: this.dataFlow.validate(),
    };
  }

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
      case 'loop_header':
      case 'loop_body': return 'transform';
      case 'condition':
      case 'branch': return 'filter';
      case 'merge': return 'join';
      default: return 'transform';
    }
  }
}