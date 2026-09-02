// LEVEL 7: SMB Integration — Persistent Compute Graph
// Extends ComputationalGraph with SMB save/load and event publishing

import { ComputationalGraph, ComputeGraphData } from './level7-compute';
import { SMB } from './smb';
import type { EntityId } from '@cos/core';

const SMB_KEY_PREFIX = 'compute-graph:';

export class SMBComputeGraph {
  private graph: ComputationalGraph;
  private smb: SMB;
  public graphId: EntityId;

  constructor(smb: SMB, name: string = 'compute-graph') {
    this.smb = smb;
    this.graph = new ComputationalGraph();
    this.graphId = `${SMB_KEY_PREFIX}${name}` as EntityId;
  }

  get nodes() { return this.graph.nodes; }
  get edges() { return this.graph.edges; }

  addNode(n: Parameters<ComputationalGraph['addNode']>[0]): string { return this.graph.addNode(n); }
  addEdge(e: Parameters<ComputationalGraph['addEdge']>[0]): void { this.graph.addEdge(e); }

  buildMLP(inputDim?: number, hiddenDim?: number, numClasses?: number): void {
    this.graph.buildMLP(inputDim, hiddenDim, numClasses);
  }

  buildExpression(): void { this.graph.buildExpression(); }
  topologicalSort(): string[] { return this.graph.topologicalSort(); }
  paramCount(): number { return this.graph.paramCount(); }
  toMermaid(): string { return this.graph.toMermaid(); }

  async forward(inputs: Record<string, number>): Promise<number> {
    const result = this.graph.forward(inputs);
    await this.smb.publish({
      type: 'compute:forward',
      source: 'L7',
      payload: { inputs, result, graphId: this.graphId },
      graphId: this.graphId,
    });
    return result;
  }

  async backward(): Promise<Map<string, number>> {
    const grads = this.graph.backward();
    const gradients: Record<string, number> = Object.fromEntries(grads);
    await this.smb.publish({
      type: 'compute:backward',
      source: 'L7',
      payload: { gradients, graphId: this.graphId },
      graphId: this.graphId,
    });
    return grads;
  }

  async save(): Promise<EntityId> {
    return this.smb.saveGraph(this.graphId, this.graph.toJSON(), {
      tags: ['compute-graph', 'L7'],
      importance: 0.9,
    });
  }

  async load(): Promise<boolean> {
    const data = await this.smb.loadGraph(this.graphId) as ComputeGraphData | null;
    if (!data) return false;
    this.graph = ComputationalGraph.fromJSON(data);
    return true;
  }

  toJSON(): ComputeGraphData { return this.graph.toJSON(); }
}
