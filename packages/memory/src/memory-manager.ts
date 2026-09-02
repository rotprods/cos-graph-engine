import {
  MemoryEntry, MemoryLayer, MemoryQuery, IMemoryStore, MemoryStoreStats,
  EntityId, Timestamp,
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
    const layers: MemoryLayer[] = [
      'working', 'short_term', 'long_term', 'semantic',
      'procedural', 'episodic', 'temporal', 'spatial',
      'vector', 'knowledge_graph', 'cache', 'reflection',
    ];
    for (const layer of layers) this.layerIndex.set(layer, new Set());
    setInterval(() => this.sweepExpired(), 60000);
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
    this.layerIndex.get(entry.layer)?.add(id);
    for (const tag of entry.tags || []) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(id);
    }
    return id;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    if (entry.ttl !== null && entry.ttl > 0) {
      const age = Date.now() - new Date(entry.createdAt).getTime();
      if (age > entry.ttl * 1000) {
        await this.delete(id);
        return null;
      }
    }

    entry.lastAccessed = new Date().toISOString();
    entry.accessCount += 1;
    return entry;
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    let results = Array.from(this.entries.values());

    if (q.layer) results = results.filter(e => e.layer === q.layer);

    const tags = q.tags;
    if (tags?.length) {
      results = results.filter(e => tags.some(tag => e.tags.includes(tag)));
    }

    const importance = q.importance;
    if (importance) {
      const min = importance.min;
      const max = importance.max;
      if (min !== undefined) results = results.filter(e => e.importance >= min);
      if (max !== undefined) results = results.filter(e => e.importance <= max);
    }

    const timeRange = q.timeRange;
    if (timeRange) {
      const from = timeRange.from;
      const to = timeRange.to;
      if (from) results = results.filter(e => e.createdAt >= from);
      if (to) results = results.filter(e => e.createdAt <= to);
    }

    const sortBy = q.sortBy;
    if (sortBy) {
      const order = q.sortOrder === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
        return String(aVal).localeCompare(String(bVal)) * order;
      });
    }

    if (q.limit && q.limit > 0) results = results.slice(0, q.limit);

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
    this.layerIndex.get(entry.layer)?.delete(id);
    for (const tag of entry.tags) this.tagIndex.get(tag)?.delete(id);
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      const layerSet = this.layerIndex.get(layer);
      if (layerSet) {
        for (const id of layerSet) this.entries.delete(id);
        layerSet.clear();
      }
    } else {
      this.entries.clear();
      for (const layerSet of this.layerIndex.values()) layerSet.clear();
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
        if (age > entry.ttl * 1000) toDelete.push(entry.id);
      }
    }
    for (const id of toDelete) await this.delete(id);
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
      source: options.source || ('system' as EntityId),
      metadata: (options.metadata || {}) as Record<string, string | number | boolean | null>,
    };

    entry.importance = this.scoreImportance(entry);
    return this.storeImpl.store(entry);
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> { return this.storeImpl.retrieve(id); }
  async query(q: MemoryQuery): Promise<MemoryEntry[]> { return this.storeImpl.query(q); }
  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> { return this.storeImpl.update(id, updates); }
  async delete(id: EntityId): Promise<void> { return this.storeImpl.delete(id); }

  async consolidate(threshold: number = 0.7): Promise<number> {
    const shortTermEntries = await this.storeImpl.query({ layer: 'short_term', sortBy: 'importance', sortOrder: 'desc' });
    let consolidated = 0;
    for (const entry of shortTermEntries) {
      if (entry.importance >= threshold) {
        entry.layer = 'long_term';
        entry.consolidated = true;
        entry.ttl = null;
        await this.storeImpl.update(entry.id, { layer: 'long_term', consolidated: true, ttl: null });
        consolidated++;
      }
    }
    return consolidated;
  }

  async forget(threshold: number = 0.2, maxAge: number = 86400 * 7): Promise<number> {
    const oldEntries = await this.storeImpl.query({ sortBy: 'importance', sortOrder: 'asc' });
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

  async crossLink(sourceId: EntityId, targetId: EntityId, relation: string): Promise<void> {
    const source = await this.storeImpl.retrieve(sourceId);
    const target = await this.storeImpl.retrieve(targetId);
    if (!source || !target) return;

    const linksRaw = source.metadata['links'];
    const links = Array.isArray(linksRaw)
      ? [...linksRaw] as Array<{ target: string; relation: string }>
      : [];
    links.push({ target: targetId, relation });
    await this.storeImpl.update(sourceId, {
      metadata: { ...source.metadata, links: JSON.stringify(links) },
    });
  }

  async stats(): Promise<MemoryStoreStats> { return this.storeImpl.stats(); }
  async clear(layer?: MemoryLayer): Promise<void> { return this.storeImpl.clear(layer); }

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
      case 'working': return 300;
      case 'short_term': return 86400;
      case 'long_term': return null;
      case 'semantic': return null;
      case 'procedural': return null;
      case 'episodic': return 86400 * 30;
      case 'temporal': return 86400 * 7;
      case 'spatial': return 86400 * 7;
      case 'vector': return 86400 * 30;
      case 'knowledge_graph': return null;
      case 'cache': return 600;
      case 'reflection': return 86400 * 7;
    }
  }

  private scoreImportance(entry: MemoryEntry): number {
    let score = entry.importance;
    if (entry.layer === 'semantic' || entry.layer === 'procedural') score += 0.2;
    const age = Date.now() - new Date(entry.createdAt).getTime();
    if (age < 3600000) score += 0.1;
    if (age < 600000) score += 0.1;
    if (entry.accessCount > 10) score += 0.1;
    if (entry.accessCount > 50) score += 0.1;
    return Math.min(score, 1.0);
  }
}
