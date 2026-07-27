import {
  MemoryEntry, MemoryLayer, MemoryQuery, IMemoryStore, MemoryStoreStats,
  EntityId, Timestamp, Version,
} from '@cos/core';
import { generateId } from '@cos/core';

// ================================================================
// In-Memory Store (default implementation)
// ================================================================

export class InMemoryStore implements IMemoryStore {
  private entries: Map<EntityId, MemoryEntry> = new Map();
  private layerIndex: Map<MemoryLayer, Set<EntityId>> = new Map();
  private tagIndex: Map<string, Set<EntityId>> = new Map();

  constructor() {
    // Initialize all layers
    const layers: MemoryLayer[] = [
      'working', 'short_term', 'long_term', 'semantic',
      'procedural', 'episodic', 'temporal', 'spatial',
      'vector', 'knowledge_graph', 'cache', 'reflection',
    ];
    for (const layer of layers) {
      this.layerIndex.set(layer, new Set());
    }

    // Start TTL sweeper
    setInterval(() => this.sweepExpired(), 60000); // every 60s
  }

  async store(entry: MemoryEntry): Promise<EntityId> {
    const id = entry.id || generateId();
    const stored: MemoryEntry = {
      ...entry,
      id,
      createdAt: entry.createdAt || new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
    };

    this.entries.set(id, stored);

    // Index by layer
    const layerSet = this.layerIndex.get(entry.layer);
    if (layerSet) layerSet.add(id);

    // Index by tags
    for (const tag of entry.tags || []) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(id);
    }

    return id;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    // Check TTL
    if (entry.ttl !== null && entry.ttl > 0) {
      const age = Date.now() - new Date(entry.createdAt).getTime();
      if (age > entry.ttl * 1000) {
        await this.delete(id);
        return null;
      }
    }

    // Update access stats
    entry.lastAccessed = new Date().toISOString();
    entry.accessCount += 1;

    return entry;
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // Filter by layer
    if (q.layer) {
      results = results.filter(e => e.layer === q.layer);
    }

    // Filter by tags
    if (q.tags && q.tags.length > 0) {
      results = results.filter(e => q.tags!.some(tag => e.tags.includes(tag)));
    }

    // Filter by importance
    if (q.importance) {
      if (q.importance.min !== undefined) results = results.filter(e => e.importance >= q.importance.min!);
      if (q.importance.max !== undefined) results = results.filter(e => e.importance <= q.importance.max!);
    }

    // Filter by time range
    if (q.timeRange) {
      if (q.timeRange.from) results = results.filter(e => e.createdAt >= q.timeRange.from!);
      if (q.timeRange.to) results = results.filter(e => e.createdAt <= q.timeRange.to!);
    }

    // Sort
    if (q.sortBy) {
      results.sort((a, b) => {
        const aVal = a[q.sortBy!] as number;
        const bVal = b[q.sortBy!] as number;
        return q.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Limit
    if (q.limit && q.limit > 0) {
      results = results.slice(0, q.limit);
    }

    // Update access stats for returned entries
    for (const entry of results) {
      entry.lastAccessed = new Date().toISOString();
      entry.accessCount += 1;
    }

    return results;
  }

  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Memory entry ${id} not found`);

    Object.assign(entry, updates);
    entry.lastAccessed = new Date().toISOString();
  }

  async delete(id: EntityId): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;

    this.entries.delete(id);

    const layerSet = this.layerIndex.get(entry.layer);
    if (layerSet) layerSet.delete(id);

    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) tagSet.delete(id);
    }
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      const layerSet = this.layerIndex.get(layer);
      if (layerSet) {
        for (const id of layerSet) {
          this.entries.delete(id);
        }
        layerSet.clear();
      }
    } else {
      this.entries.clear();
      for (const layerSet of this.layerIndex.values()) {
        layerSet.clear();
      }
      this.tagIndex.clear();
    }
  }

  async stats(): Promise<MemoryStoreStats> {
    const byLayer: Partial<Record<MemoryLayer, number>> = {};
    let totalSize = 0;
    let oldest: Timestamp | null = null;
    let newest: Timestamp | null = null;

    for (const entry of this.entries.values()) {
      byLayer[entry.layer] = (byLayer[entry.layer] || 0) + 1;
      totalSize += JSON.stringify(entry).length;
      if (!oldest || entry.createdAt < oldest) oldest = entry.createdAt;
      if (!newest || entry.createdAt > newest) newest = entry.createdAt;
    }

    const allLayers: MemoryLayer[] = [
      'working', 'short_term', 'long_term', 'semantic',
      'procedural', 'episodic', 'temporal', 'spatial',
      'vector', 'knowledge_graph', 'cache', 'reflection',
    ];

    return {
      totalEntries: this.entries.size,
      byLayer: Object.fromEntries(allLayers.map(l => [l, byLayer[l] || 0])) as Record<MemoryLayer, number>,
      totalSizeBytes: totalSize,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    const toDelete: EntityId[] = [];

    for (const entry of this.entries.values()) {
      if (entry.ttl !== null && entry.ttl > 0) {
        const age = now - new Date(entry.createdAt).getTime();
        if (age > entry.ttl * 1000) {
          toDelete.push(entry.id);
        }
      }
    }

    for (const id of toDelete) {
      await this.delete(id);
    }
  }
}

// ================================================================
// Memory Manager — orchestrates all layers
// ================================================================

export class MemoryManager {
  private storeImpl: IMemoryStore;

  constructor(store?: IMemoryStore) {
    this.storeImpl = store || new InMemoryStore();
  }

  // Store an entry in the appropriate layer
  async store(
    content: unknown,
    layer: MemoryLayer,
    options: {
      tags?: string[];
      importance?: number;
      ttl?: number | null;
      source?: EntityId;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<EntityId> {
    const entry: MemoryEntry = {
      id: generateId(),
      layer,
      content,
      representations: {},
      importance: options.importance ?? this.defaultImportance(layer),
      ttl: options.ttl ?? this.defaultTTL(layer),
      version: { major: 1, minor: 0, patch: 0 },
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      accessCount: 0,
      consolidated: false,
      compressed: false,
      tags: options.tags || [],
      source: options.source || 'system' as EntityId,
      metadata: (options.metadata || {}) as Record<string, string | number | boolean | null>,
    };

    // Apply importance scoring
    entry.importance = this.scoreImportance(entry);

    return this.storeImpl.store(entry);
  }

  // Retrieve by ID
  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    return this.storeImpl.retrieve(id);
  }

  // Query memory
  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    return this.storeImpl.query(q);
  }

  // Update entry
  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    return this.storeImpl.update(id, updates);
  }

  // Delete entry
  async delete(id: EntityId): Promise<void> {
    return this.storeImpl.delete(id);
  }

  // Consolidate: promote important short-term to long-term
  async consolidate(threshold: number = 0.7): Promise<number> {
    const shortTermEntries = await this.storeImpl.query({
      layer: 'short_term',
      sortBy: 'importance',
      sortOrder: 'desc',
    });

    let consolidated = 0;
    for (const entry of shortTermEntries) {
      if (entry.importance >= threshold) {
        // Promote to long-term
        entry.layer = 'long_term';
        entry.consolidated = true;
        entry.ttl = null; // permanent
        await this.storeImpl.update(entry.id, {
          layer: 'long_term',
          consolidated: true,
          ttl: null,
        });
        consolidated++;
      }
    }

    return consolidated;
  }

  // Forgetting: remove low-importance, old entries
  async forget(threshold: number = 0.2, maxAge: number = 86400 * 7): Promise<number> {
    const oldEntries = await this.storeImpl.query({
      sortBy: 'importance',
      sortOrder: 'asc',
    });

    let forgotten = 0;
    const now = Date.now();
    for (const entry of oldEntries) {
      if (entry.layer === 'long_term' || entry.layer === 'semantic') continue;
      if (entry.importance < threshold) {
        const age = now - new Date(entry.createdAt).getTime();
        if (age > maxAge * 1000) {
          await this.storeImpl.delete(entry.id);
          forgotten++;
        }
      }
    }

    return forgotten;
  }

  // Cross-link entries
  async crossLink(sourceId: EntityId, targetId: EntityId, relation: string): Promise<void> {
    const source = await this.storeImpl.retrieve(sourceId);
    const target = await this.storeImpl.retrieve(targetId);
    if (!source || !target) return;

    const metadata = source.metadata as Record<string, unknown>;
    const links = (metadata['links'] as Array<{ target: string; relation: string }>) || [];
    links.push({ target: targetId, relation });
    metadata['links'] = links;

    await this.storeImpl.update(sourceId, { metadata: metadata as any });
  }

  // Get stats
  async stats(): Promise<MemoryStoreStats> {
    return this.storeImpl.stats();
  }

  // Clear
  async clear(layer?: MemoryLayer): Promise<void> {
    return this.storeImpl.clear(layer);
  }

  private defaultImportance(layer: MemoryLayer): number {
    switch (layer) {
      case 'working': return 1.0;
      case 'short_term': return 0.6;
      case 'long_term': return 0.8;
      case 'semantic': return 0.9;
      case 'procedural': return 0.8;
      case 'episodic': return 0.5;
      case 'temporal': return 0.4;
      case 'spatial': return 0.4;
      case 'vector': return 0.5;
      case 'knowledge_graph': return 0.9;
      case 'cache': return 0.3;
      case 'reflection': return 0.7;
    }
  }

  private defaultTTL(layer: MemoryLayer): number | null {
    switch (layer) {
      case 'working': return 300; // 5 min
      case 'short_term': return 86400; // 24h
      case 'long_term': return null; // permanent
      case 'semantic': return null; // permanent
      case 'procedural': return null; // permanent
      case 'episodic': return 86400 * 30; // 30 days
      case 'temporal': return 86400 * 7; // 7 days
      case 'spatial': return 86400 * 7;
      case 'vector': return 86400 * 30;
      case 'knowledge_graph': return null;
      case 'cache': return 600; // 10 min
      case 'reflection': return 86400 * 7;
    }
  }

  private scoreImportance(entry: MemoryEntry): number {
    let score = entry.importance;

    // Higher weight for semantic and procedural
    if (entry.layer === 'semantic' || entry.layer === 'procedural') score += 0.2;

    // Recent entries get a boost
    const age = Date.now() - new Date(entry.createdAt).getTime();
    if (age < 3600000) score += 0.1; // < 1 hour
    if (age < 600000) score += 0.1; // < 10 min

    // Frequently accessed
    if (entry.accessCount > 10) score += 0.1;
    if (entry.accessCount > 50) score += 0.1;

    // Cap at 1.0
    return Math.min(score, 1.0);
  }
}