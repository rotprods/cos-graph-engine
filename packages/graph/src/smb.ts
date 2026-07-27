// SMB — Shared Memory Bus Connector
// Central event bus + memory integration for COS graph engines
// Bridging graph computations (L7) and memory graphs (L12) with persistent storage

import { EventBus } from '@cos/runtime';
import { MemoryManager, InMemoryStore } from '@cos/memory';
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
export class SMB {
  public readonly eventBus: EventBus;
  public readonly memoryManager: MemoryManager;
  private readonly graphIndex: Map<string, Set<EntityId>> = new Map();

  constructor(config: SMBConfig = {}) {
    this.eventBus = new EventBus(config.maxHistory ?? 10000);
    this.memoryManager = new MemoryManager(config.memoryStore ?? new InMemoryStore());
  }

  /** Publish an event to the bus */
  async publish(event: SMBEvent): Promise<EntityId> {
    return this.eventBus.publish({
      type: event.type,
      source: event.source,
      payload: event.payload,
      severity: 'info',
      metadata: {
        graphId: event.graphId,
        nodeId: event.nodeId,
        ...(event.payload as Record<string, unknown> || {}),
      },
    });
  }

  /** Subscribe to events */
  async subscribe(
    type: string,
    handler: (event: SMBEvent) => Promise<void> | void,
  ): Promise<string> {
    return this.eventBus.subscribe(type, async (evt) => {
      await handler({
        type: evt.type,
        source: evt.source,
        payload: evt.payload,
        graphId: evt.metadata?.graphId as string | undefined,
        nodeId: evt.metadata?.nodeId as string | undefined,
        timestamp: evt.timestamp,
      });
    });
  }

  /** Save a graph state to memory */
  async saveGraph(
    key: string,
    data: unknown,
    options: { tags?: string[]; importance?: number; ttl?: number | null } = {},
  ): Promise<EntityId> {
    const id = await this.memoryManager.store(data, 'long_term', {
      tags: ['graph', ...(options.tags || [])],
      importance: options.importance ?? 0.8,
      ttl: options.ttl ?? null,
      metadata: { key, savedAt: new Date().toISOString() },
    });

    // Index by key
    if (!this.graphIndex.has(key)) this.graphIndex.set(key, new Set());
    this.graphIndex.get(key)!.add(id);

    return id;
  }

  /** Load a graph state from memory by key */
  async loadGraph(key: string): Promise<unknown | null> {
    const ids = this.graphIndex.get(key);
    if (!ids || ids.size === 0) return null;

    // Get the most recent
    const idsArr = Array.from(ids);
    const lastId = idsArr[idsArr.length - 1];
    const entry = await this.memoryManager.retrieve(lastId);
    return entry?.content ?? null;
  }

  /** List all saved graph snapshots */
  async listGraphs(key?: string): Promise<Array<{ id: EntityId; key: string; timestamp: string }>> {
    const entries = await this.memoryManager.query({
      tags: ['graph'],
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    return entries
      .filter(e => !key || (e.metadata as Record<string, unknown>)?.key === key)
      .map(e => ({
        id: e.id,
        key: (e.metadata as Record<string, unknown>)?.key as string || 'unknown',
        timestamp: e.createdAt,
      }));
  }

  /** Get current SMB state metrics */
  async getState(): Promise<SMBState> {
    const stats = await this.memoryManager.stats();
    return {
      lastEvent: null,
      eventCount: this.eventBus.eventCount,
      memoryCount: stats.totalEntries,
      subscribers: this.eventBus.subscriberCount,
    };
  }

  /** Clear all graph indices */
  clear(): void {
    this.graphIndex.clear();
  }
}