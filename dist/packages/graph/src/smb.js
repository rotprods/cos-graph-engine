"use strict";
// SMB — Shared Memory Bus Connector
// Central event bus + memory integration for COS graph engines
// Bridging graph computations (L7) and memory graphs (L12) with persistent storage
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMB = void 0;
const runtime_1 = require("@cos/runtime");
const memory_1 = require("@cos/memory");
/**
 * Shared Memory Bus — COS's central nervous system.
 * Combines EventBus (event-driven communication) with MemoryManager (persistent storage)
 * so graph engines can publish, subscribe, save, and load state seamlessly.
 */
class SMB {
    eventBus;
    memoryManager;
    graphIndex = new Map();
    constructor(config = {}) {
        this.eventBus = new runtime_1.EventBus(config.maxHistory ?? 10000);
        this.memoryManager = new memory_1.MemoryManager(config.memoryStore ?? new memory_1.InMemoryStore());
    }
    /** Publish an event to the bus */
    async publish(event) {
        return this.eventBus.publish({
            type: event.type,
            source: event.source,
            payload: event.payload,
            severity: 'info',
            metadata: {
                graphId: event.graphId,
                nodeId: event.nodeId,
                ...(event.payload || {}),
            },
        });
    }
    /** Subscribe to events */
    async subscribe(type, handler) {
        return this.eventBus.subscribe(type, async (evt) => {
            await handler({
                type: evt.type,
                source: evt.source,
                payload: evt.payload,
                graphId: evt.metadata?.graphId,
                nodeId: evt.metadata?.nodeId,
                timestamp: evt.timestamp,
            });
        });
    }
    /** Save a graph state to memory */
    async saveGraph(key, data, options = {}) {
        const id = await this.memoryManager.store(data, 'long_term', {
            tags: ['graph', ...(options.tags || [])],
            importance: options.importance ?? 0.8,
            ttl: options.ttl ?? null,
            metadata: { key, savedAt: new Date().toISOString() },
        });
        // Index by key
        if (!this.graphIndex.has(key))
            this.graphIndex.set(key, new Set());
        this.graphIndex.get(key).add(id);
        return id;
    }
    /** Load a graph state from memory by key */
    async loadGraph(key) {
        const ids = this.graphIndex.get(key);
        if (!ids || ids.size === 0)
            return null;
        // Get the most recent
        const idsArr = Array.from(ids);
        const lastId = idsArr[idsArr.length - 1];
        const entry = await this.memoryManager.retrieve(lastId);
        return entry?.content ?? null;
    }
    /** List all saved graph snapshots */
    async listGraphs(key) {
        const entries = await this.memoryManager.query({
            tags: ['graph'],
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
        return entries
            .filter(e => !key || e.metadata?.key === key)
            .map(e => ({
            id: e.id,
            key: e.metadata?.key || 'unknown',
            timestamp: e.createdAt,
        }));
    }
    /** Get current SMB state metrics */
    async getState() {
        const stats = await this.memoryManager.stats();
        return {
            lastEvent: null,
            eventCount: this.eventBus.eventCount,
            memoryCount: stats.totalEntries,
            subscribers: this.eventBus.subscriberCount,
        };
    }
    /** Clear all graph indices */
    clear() {
        this.graphIndex.clear();
    }
}
exports.SMB = SMB;
//# sourceMappingURL=smb.js.map