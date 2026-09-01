import { generateId, type EntityId } from '@cos/core';
import { CallGraphBuilder, type CallGraph, type CallNode } from '../level4-call';
import { CFGBuilder, type ControlFlowGraph } from '../level5-cfg';
import { DataFlowGraph, type DataFlowNode, type DataFlowEdge } from '../level6-dataflow';
import { ComputationalGraph } from '../level7-compute';
import { EmbeddingGraph, type EmbeddingNode } from '../level10-embedding';
import { MemoryGraphEngine } from '../level12-memory';

export type FiscalCallOutcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'DEGRADED';

export interface FiscalCallObservation {
  callId: string;
  actorId: string;
  actorName: string;
  toolId: string;
  toolName: string;
  operation: string;
  durationMs: number;
  outcome: FiscalCallOutcome;
  evidenceIds?: string[];
  schemaHash?: string;
  sensitivity?: 'PUBLIC' | 'INTERNAL' | 'RESTRICTED_FINANCIAL';
}

/**
 * L4 projection for persistent agent/tool traces.
 * Native CallGraph remains the topology. Fiscal metadata is encoded on edge args
 * and mirrored in the observation registry so no evidence IDs are lost.
 */
export class FiscalCallTraceProjection {
  readonly builder = new CallGraphBuilder();
  readonly graphId: EntityId;
  private readonly nodeIds = new Map<string, EntityId>();
  private readonly observations = new Map<string, FiscalCallObservation>();

  constructor(name = 'Fiscal Agent / Tool Call Trace') {
    this.graphId = this.builder.createGraph(name);
  }

  record(observation: FiscalCallObservation): void {
    if (this.observations.has(observation.callId)) {
      throw new Error(`Duplicate fiscal call observation: ${observation.callId}`);
    }
    const actorNode = this.ensureNode(`actor:${observation.actorId}`, observation.actorName, 'method', 'fiscal-agent');
    const toolNode = this.ensureNode(`tool:${observation.toolId}`, observation.toolName, 'external', 'fiscal-tool');
    const opNode = this.ensureNode(`operation:${observation.toolId}:${observation.operation}`, observation.operation, 'api', observation.toolName);

    this.builder.addEdge(this.graphId, {
      id: generateId(), source: actorNode, target: toolNode, callCount: 1,
      avgDuration: observation.durationMs, totalDuration: observation.durationMs,
      async: true, args: [
        `callId=${observation.callId}`,
        `outcome=${observation.outcome}`,
        `sensitivity=${observation.sensitivity ?? 'INTERNAL'}`,
        `schemaHash=${observation.schemaHash ?? ''}`,
        `evidenceIds=${(observation.evidenceIds ?? []).join('|')}`,
      ],
    });
    this.builder.addEdge(this.graphId, {
      id: generateId(), source: toolNode, target: opNode, callCount: 1,
      avgDuration: observation.durationMs, totalDuration: observation.durationMs, async: true,
      args: [`callId=${observation.callId}`],
    });
    this.observations.set(observation.callId, structuredClone(observation));
  }

  getObservation(callId: string): FiscalCallObservation | undefined {
    const value = this.observations.get(callId);
    return value ? structuredClone(value) : undefined;
  }

  validate(): string[] {
    return this.builder.validate(this.graphId);
  }

  snapshot(): { graph: CallGraph | undefined; observations: FiscalCallObservation[] } {
    return {
      graph: this.builder.toJSON(this.graphId),
      observations: [...this.observations.values()].map(v => structuredClone(v)),
    };
  }

  private ensureNode(key: string, name: string, type: CallNode['type'], module: string): EntityId {
    const existing = this.nodeIds.get(key);
    if (existing) return existing;
    const id = generateId();
    this.builder.addNode(this.graphId, { id, name, type, module, callCount: 0 });
    this.nodeIds.set(key, id);
    return id;
  }
}

export type FiscalDecisionCFGKind =
  | 'filed-status'
  | 'payment-status'
  | 'invoice-validity'
  | 'foreign-service-vat'
  | 'historical-regularization';

/** Build explicit L5 decision paths. These graphs describe guards; they do not make legal conclusions. */
export function buildFiscalDecisionCFG(kind: FiscalDecisionCFGKind): { builder: CFGBuilder; graphId: EntityId; graph: ControlFlowGraph } {
  const builder = new CFGBuilder();
  const graphId = builder.createCFG(`Fiscal Decision — ${kind}`);

  if (kind === 'filed-status') {
    builder.buildIfThenElse(
      graphId,
      'official filing receipt exists',
      'classify FILED',
      'keep UNKNOWN / request authority truth',
      'emit filing-status decision event',
    );
  } else if (kind === 'payment-status') {
    builder.buildIfThenElse(
      graphId,
      'bank or official settlement proof exists',
      'classify PAID',
      'keep UNPROVEN / request payment evidence',
      'emit payment-status decision event',
    );
  } else if (kind === 'invoice-validity') {
    builder.buildIfThenElse(
      graphId,
      'invoice identity + amount + sequence + tax treatment valid',
      'accept invoice fact',
      'open QA / rectification task',
      'emit invoice validation result',
    );
  } else if (kind === 'foreign-service-vat') {
    builder.buildIfThenElse(
      graphId,
      'supplier foreign AND B2B place-of-supply in Spain',
      'evaluate reverse charge and 349 applicability',
      'apply domestic/other VAT path',
      'emit VAT applicability decision',
    );
  } else {
    builder.buildIfThenElse(
      graphId,
      'authority truth confirms unfiled/incorrect obligation',
      'calculate regularization scenario',
      'do not file corrective return',
      'send to independent human review',
    );
  }

  const errors = builder.validate(graphId);
  if (errors.length) throw new Error(`Invalid fiscal CFG ${kind}: ${errors.join('; ')}`);
  return { builder, graphId, graph: builder.toJSON(graphId)! };
}

export type FiscalLineageNodeType = 'source' | 'parse' | 'normalize' | 'resolve' | 'calculate' | 'review' | 'filing' | 'projection';

export interface FiscalLineageNode {
  id: string;
  name: string;
  type: FiscalLineageNodeType;
  evidenceIds?: string[];
  artifactType?: string;
  transformVersion?: string;
  status?: string;
  latencyMs?: number;
}

export interface FiscalLineageEdge {
  source: string;
  target: string;
  dataType: string;
  relation: 'PARSED_INTO' | 'NORMALIZED_INTO' | 'RESOLVED_INTO' | 'CALCULATED_INTO' | 'REVIEWED_INTO' | 'FILED_AS' | 'PROJECTED_AS';
}

function toDataFlowType(type: FiscalLineageNodeType): DataFlowNode['type'] {
  if (type === 'source') return 'source';
  if (type === 'filing' || type === 'projection') return 'sink';
  if (type === 'review') return 'filter';
  if (type === 'resolve') return 'join';
  return 'transform';
}

/** L6 evidence -> fact -> calculation -> return/projection lineage. */
export function buildFiscalDataFlow(
  nodes: readonly FiscalLineageNode[],
  edges: readonly FiscalLineageEdge[],
): DataFlowGraph {
  const graph = new DataFlowGraph();
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate fiscal lineage node: ${node.id}`);
    ids.add(node.id);
    graph.addNode({
      id: node.id,
      name: node.name,
      type: toDataFlowType(node.type),
      latency: node.latencyMs,
      params: {
        fiscalLineageType: node.type,
        evidenceIds: node.evidenceIds ?? [],
        artifactType: node.artifactType,
        transformVersion: node.transformVersion,
        status: node.status,
      },
    });
  }
  let seq = 0;
  for (const edge of edges) {
    graph.addEdge({
      id: `fiscal-lineage-${++seq}`,
      source: edge.source,
      target: edge.target,
      dataType: edge.dataType,
      partitionKey: edge.relation,
    });
  }
  const errors = graph.validate();
  if (errors.length) throw new Error(`Invalid fiscal data flow: ${errors.join('; ')}`);
  return graph;
}

export type FiscalComputeKind = 'invoice-total' | 'realized-pnl' | 'debt-total' | 'reconciliation-gap';

export interface FiscalComputeResult {
  kind: FiscalComputeKind;
  inputCents: Record<string, number>;
  outputCents: number;
  graph: ComputationalGraph;
  replayHashMaterial: string;
}

function assertIntegerCents(values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isSafeInteger(value)) throw new Error(`${key} must be integer cents, got ${value}`);
  }
}

/**
 * L7 deterministic monetary calculations operate in integer cents.
 * This avoids floating-point tax/accounting drift in the graph itself.
 */
export function computeFiscalMoney(kind: FiscalComputeKind, inputCents: Record<string, number>): FiscalComputeResult {
  assertIntegerCents(inputCents);
  const graph = new ComputationalGraph();
  const addConst = (id: string, value: number) => graph.addNode({ id, name: id, op: 'constant', value });

  let outputId: string;
  if (kind === 'invoice-total') {
    addConst('base', inputCents.base ?? 0); addConst('vat', inputCents.vat ?? 0); addConst('withholding', inputCents.withholding ?? 0);
    graph.addNode({ id: 'gross', name: 'base + vat', op: 'add' });
    graph.addNode({ id: 'total', name: 'gross - withholding', op: 'sub' });
    graph.addEdge({ source: 'base', target: 'gross' }); graph.addEdge({ source: 'vat', target: 'gross' });
    graph.addEdge({ source: 'gross', target: 'total' }); graph.addEdge({ source: 'withholding', target: 'total' });
    outputId = 'total';
  } else if (kind === 'realized-pnl') {
    addConst('proceeds', inputCents.proceeds ?? 0); addConst('basis', inputCents.basis ?? 0);
    graph.addNode({ id: 'pnl', name: 'proceeds - basis', op: 'sub' });
    graph.addEdge({ source: 'proceeds', target: 'pnl' }); graph.addEdge({ source: 'basis', target: 'pnl' });
    outputId = 'pnl';
  } else if (kind === 'debt-total') {
    addConst('principal', inputCents.principal ?? 0); addConst('surcharge', inputCents.surcharge ?? 0); addConst('interest', inputCents.interest ?? 0);
    graph.addNode({ id: 'principal_plus_surcharge', name: 'principal + surcharge', op: 'add' });
    graph.addNode({ id: 'debt_total', name: 'principal + surcharge + interest', op: 'add' });
    graph.addEdge({ source: 'principal', target: 'principal_plus_surcharge' }); graph.addEdge({ source: 'surcharge', target: 'principal_plus_surcharge' });
    graph.addEdge({ source: 'principal_plus_surcharge', target: 'debt_total' }); graph.addEdge({ source: 'interest', target: 'debt_total' });
    outputId = 'debt_total';
  } else {
    addConst('expected', inputCents.expected ?? 0); addConst('observed', inputCents.observed ?? 0);
    graph.addNode({ id: 'gap', name: 'expected - observed', op: 'sub' });
    graph.addEdge({ source: 'expected', target: 'gap' }); graph.addEdge({ source: 'observed', target: 'gap' });
    outputId = 'gap';
  }

  const outputCents = graph.forward({});
  if (!graph.nodes.some(n => n.id === outputId)) throw new Error(`Missing fiscal compute output ${outputId}`);
  return {
    kind,
    inputCents: { ...inputCents },
    outputCents,
    graph,
    replayHashMaterial: JSON.stringify({ kind, inputCents, topology: graph.toJSON?.() ?? { nodes: graph.nodes, edges: graph.edges } }),
  };
}

export interface FiscalEmbeddingInput {
  id: string;
  label: string;
  vector: number[];
  evidenceId: string;
  fiscalType: string;
  authorityRank?: string;
  sensitivity?: string;
  observedAt?: string;
}

/** L10 semantic index remains a derived retrieval projection, never authority. */
export class FiscalEmbeddingIndex {
  readonly graph = new EmbeddingGraph();

  add(input: FiscalEmbeddingInput): void {
    this.graph.addNode({
      id: input.id,
      label: input.label,
      vector: [...input.vector],
      metadata: {
        evidenceId: input.evidenceId,
        fiscalType: input.fiscalType,
        authorityRank: input.authorityRank,
        sensitivity: input.sensitivity,
        observedAt: input.observedAt,
        derivedIndex: true,
      },
    });
  }

  nearest(vector: number[], topK = 5): Array<{ node: EmbeddingNode; similarity: number }> {
    return this.graph.nodes
      .map(node => ({ node, similarity: EmbeddingGraph.cosine(node.vector, vector) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  rebuildKNN(k = 3): void {
    this.graph.buildKNN(k);
  }
}

export interface FiscalCheckpointInput {
  checkpointId: string;
  sessionId: string;
  content: string;
  evidenceIds: string[];
  taskDelta: string[];
  riskDelta: string[];
  nextFrontier: string[];
  manifestHash?: string;
  createdAt?: string;
}

/** L12 materializes durable zero-context recovery checkpoints as a MemoryGraph. */
export class FiscalMemoryProjection {
  readonly graph = new MemoryGraphEngine('Fiscal Durable Memory');
  private readonly checkpointNodes = new Map<string, EntityId>();
  private lastCheckpoint?: EntityId;

  addCheckpoint(input: FiscalCheckpointInput): EntityId {
    if (this.checkpointNodes.has(input.checkpointId)) throw new Error(`Duplicate checkpoint ${input.checkpointId}`);
    const nodeId = this.graph.addNode({
      name: input.checkpointId,
      type: 'memory',
      content: input.content,
      confidence: 1,
      metadata: {
        fiscalMemoryType: 'checkpoint',
        checkpointId: input.checkpointId,
        sessionId: input.sessionId,
        evidenceIds: [...input.evidenceIds],
        taskDelta: [...input.taskDelta],
        riskDelta: [...input.riskDelta],
        nextFrontier: [...input.nextFrontier],
        manifestHash: input.manifestHash,
        sourceCreatedAt: input.createdAt,
      },
    });
    if (this.lastCheckpoint) this.graph.addEdge(this.lastCheckpoint, nodeId, 'evolves_to', 1);
    this.lastCheckpoint = nodeId;
    this.checkpointNodes.set(input.checkpointId, nodeId);
    return nodeId;
  }

  getCheckpoint(checkpointId: string) {
    const id = this.checkpointNodes.get(checkpointId);
    return id ? this.graph.getNode(id) : undefined;
  }

  validate(): string[] {
    return this.graph.validate();
  }
}
