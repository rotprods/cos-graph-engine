import { EventBus } from '@cos/runtime';
import { MemoryManager } from '@cos/memory';
import { EntityId } from '@cos/core';
export interface SMBConfig {
    maxHistory?: number;
    memoryStore?: import('@cos/memory').IMemoryStore;
}
export interface SMBEvent {
    type: string;
    source: string;
    payload: unknown;
    graphId?: EntityId;
    nodeId?: string;
    timestamp?: string;
}
export interface SMBState {
    lastEvent: SMBEvent | null;
    eventCount: number;
    memoryCount: number;
    subscribers: number;
}
/**
 * Shared Memory Bus — COS's central nervous system.
 * Combines EventBus (event-driven communication) with MemoryManager (persistent storage)
 * so graph engines can publish, subscribe, save, and load state seamlessly.
 */
export declare class SMB {
    readonly eventBus: EventBus;
    readonly memoryManager: MemoryManager;
    private readonly graphIndex;
    constructor(config?: SMBConfig);
    /** Publish an event to the bus */
    publish(event: SMBEvent): Promise<EntityId>;
    /** Subscribe to events */
    subscribe(type: string, handler: (event: SMBEvent) => Promise<void> | void): Promise<string>;
    /** Save a graph state to memory */
    saveGraph(key: string, data: unknown, options?: {
        tags?: string[];
        importance?: number;
        ttl?: number | null;
    }): Promise<EntityId>;
    /** Load a graph state from memory by key */
    loadGraph(key: string): Promise<unknown | null>;
    /** List all saved graph snapshots */
    listGraphs(key?: string): Promise<Array<{
        id: EntityId;
        key: string;
        timestamp: string;
    }>>;
    /** Get current SMB state metrics */
    getState(): Promise<SMBState>;
    /** Clear all graph indices */
    clear(): void;
}
//# sourceMappingURL=smb.d.ts.map