// LEVEL 12: SMB Integration — Persistent Memory Graph
// Extends MemoryGraphEngine with SMB backing store and event publishing

import { MemoryGraphEngine, MemoryNode, MemoryEdge, MemoryGraph, MemoryNodeType, MemoryEdgeType } from './level12-memory';
import { SMB } from './smb';
import type { EntityId } from '@cos/core';

const SMB_KEY_PREFIX = 'memory-graph:';

/**
 * SMB-integrated memory graph.
 * Wraps MemoryGraphEngine with save/load to the Shared Memory Bus
 * and publishes events for memory operations.
 */
export class SMBMemoryGraph {
  private engine: MemoryGraphEngine;
  private smb: SMB;
  public graphId: string;

  constructor(smb: SMB, name: string = 'memory-graph') {
    this.smb = smb;
    this.engine = new MemoryGraphEngine(name);
    this.graphId = `${SMB_KEY_PREFIX}${name}`;
  }

  /** Delegate to underlying MemoryGraphEngine */
  get graph() { return this.engine; }

  addNode(n: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): EntityId {
    const id = this.engine.addNode(n);
    this.smb.publish({
      type: 'memory:addNode',
      source: 'L12',
      payload: { nodeId: id, name: n.name, type: n.type },
      graphId: this.graphId,
      nodeId: id,
    });
    return id;
  }

  addEdge(source: EntityId, target: EntityId, type: MemoryEdgeType, strength: number = 0.5): EntityId {
    const id = this.engine.addEdge(source, target, type, strength);
    this.smb.publish({
      type: 'memory:addEdge',
      source: 'L12',
      payload: { edgeId: id, source, target, type, strength },
      graphId: this.graphId,
    });
    return id;
  }

  accessNode(nodeId: EntityId): MemoryNode | undefined {
    const node = this.engine.accessNode(nodeId);
    if (node) {
      this.smb.publish({
        type: 'memory:accessNode',
        source: 'L12',
        payload: { nodeId, name: node.name },
        graphId: this.graphId,
        nodeId,
      });
    }
    return node;
  }

  buildConversation(): void {
    this.engine.buildConversation();
    this.smb.publish({
      type: 'memory:buildConversation',
      source: 'L12',
      payload: { graphId: this.graphId },
      graphId: this.graphId,
    });
  }

  recall(nodeId: EntityId, maxDepth?: number, minStrength?: number): MemoryNode[] {
    return this.engine.recall(nodeId, maxDepth, minStrength);
  }

  strongestPath(fromId: EntityId, toId: EntityId): MemoryNode[] {
    return this.engine.strongestPath(fromId, toId);
  }

  forget(minConfidence?: number): number {
    return this.engine.forget(minConfidence);
  }

  consolidate(): number {
    return this.engine.consolidate();
  }

  validate(): string[] {
    return this.engine.validate();
  }

  metrics(): ReturnType<MemoryGraphEngine['metrics']> {
    return this.engine.metrics();
  }

  /** Save the entire memory graph to SMB */
  async save(): Promise<EntityId> {
    const data = this.engine.toJSON();
    return this.smb.saveGraph(this.graphId, data, {
      tags: ['memory-graph', 'L12'],
      importance: 0.95,
    });
  }

  /** Load the memory graph from SMB */
  async load(): Promise<boolean> {
    const data = await this.smb.loadGraph(this.graphId) as MemoryGraph | null;
    if (!data) return false;
    const restored = MemoryGraphEngine.fromJSON(data);
    this.engine = restored;
    return true;
  }

  toJSON(): MemoryGraph {
    return this.engine.toJSON();
  }

  toMermaid(): string {
    return this.engine.toMermaid();
  }
}