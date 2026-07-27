import { MemoryGraphEngine, MemoryNode, MemoryGraph, MemoryEdgeType } from './level12-memory';
import { SMB } from './smb';
import type { EntityId } from '@cos/core';
/**
 * SMB-integrated memory graph.
 * Wraps MemoryGraphEngine with save/load to the Shared Memory Bus
 * and publishes events for memory operations.
 */
export declare class SMBMemoryGraph {
    private engine;
    private smb;
    graphId: string;
    constructor(smb: SMB, name?: string);
    /** Delegate to underlying MemoryGraphEngine */
    get graph(): MemoryGraphEngine;
    addNode(n: Omit<MemoryNode, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): EntityId;
    addEdge(source: EntityId, target: EntityId, type: MemoryEdgeType, strength?: number): EntityId;
    accessNode(nodeId: EntityId): MemoryNode | undefined;
    buildConversation(): void;
    recall(nodeId: EntityId, maxDepth?: number, minStrength?: number): MemoryNode[];
    strongestPath(fromId: EntityId, toId: EntityId): MemoryNode[];
    forget(minConfidence?: number): number;
    consolidate(): number;
    validate(): string[];
    metrics(): ReturnType<MemoryGraphEngine['metrics']>;
    /** Save the entire memory graph to SMB */
    save(): Promise<EntityId>;
    /** Load the memory graph from SMB */
    load(): Promise<boolean>;
    toJSON(): MemoryGraph;
    toMermaid(): string;
}
//# sourceMappingURL=level12-smb.d.ts.map