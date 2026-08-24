import {
  MemoryEntry, MemoryLayer, MemoryQuery, IMemoryStore, MemoryStoreStats,
  EntityId, Timestamp,
} from '@cos/core';
import { generateId } from '@cos/core';

const MEMORY_LAYERS: MemoryLayer[] = [
  'working', 'short_term', 'long_term', 'semantic',
  'procedural', 'episodic', 'temporal', 'spatial',
  'vector', 'knowledge_graph', 'cache', 'reflection',
];

// ================================================================
// In-Memory Store (reference implementation)
// ================================================================

/**
 * In-memory store with one canonical mutation path.
 *
 * Callers never receive mutable references to canonical entries. Every change to
 * identity-sensitive/indexed fields must pass through `update()`, which keeps
 * layer/tag indexes coherent with the primary map.
 */
export class InMemoryStore implements IMemoryStore {
  private entries: Map<EntityId, MemoryEntry> = new Map();
  private layerIndex: Map<MemoryLayer, Set<EntityId>> = new Map();
  private tagIndex: Map<string, Set<EntityId>> = new Map();
  private readonly sweepTimer: ReturnType<typeof setInterval>;

  constructor() {
    for (const layer of MEMORY_LAYERS) this.layerIndex.set(layer, new Set());
    this.sweepTimer = setInterval(() => void this.sweepExpired(), 60_000);
    // Do not keep Node processes alive solely for the reference TTL sweeper.
    (this.sweepTimer as unknown as { unref?: () => void }).unref?.();
  }

  async store(entry: MemoryEntry): Promise<EntityId> {
    const id = entry.id || generateId();
    if (this.entries.has(id)) throw new Error(`Memory entry ${String(id)} already exists`);
    this.assertEntry(entry);

    const now = new Date().toISOString();
    const stored: MemoryEntry = {
      ...entry,
      id,
      tags: [...(entry.tags || [])],
      representations: { ...entry.representations },
      metadata: { ...entry.metadata },
      createdAt: entry.createdAt || now,
      lastAccessed: now,
    };

    this.entries.set(id, stored);
    this.indexEntry(stored);
    return id;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      await this.delete(id);
      return null;
    }

    entry.lastAccessed = new Date().toISOString();
    entry.accessCount += 1;
    return this.cloneEntry(entry);
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    let candidateIds: Set<EntityId> | null = null;

    if (query.layer) candidateIds = new Set(this.layerIndex.get(query.layer) || []);

    if (query.tags && query.tags.length > 0) {
      const tagged = new Set<EntityId>();
      for (const tag of query.tags) {
        for (const id of this.tagIndex.get(tag) || []) tagged.add(id);
      }
      candidateIds = candidateIds === null
        ? tagged
        : new Set([...candidateIds].filter(id => tagged.has(id)));
    }

    let entries = candidateIds === null
      ? Array.from(this.entries.values())
      : Array.from(candidateIds, id => this.entries.get(id)).filter((entry): entry is MemoryEntry => entry !== undefined);

    const expired: EntityId[] = [];
    entries = entries.filter(entry => {
      if (!this.isExpired(entry)) return true;
      expired.push(entry.id);
      return false;
    });
    for (const id of expired) await this.delete(id);

    if (query.content) {
      const needle = query.content.toLowerCase();
      entries = entries.filter(entry => this.searchableContent(entry.content).includes(needle));
    }
    if (query.importance?.min !== undefined) entries = entries.filter(entry => entry.importance >= query.importance!.min!);
    if (query.importance?.max !== undefined) entries = entries.filter(entry => entry.importance <= query.importance!.max!);
    if (query.timeRange?.from) entries = entries.filter(entry => entry.createdAt >= query.timeRange!.from!);
    if (query.timeRange?.to) entries = entries.filter(entry => entry.createdAt <= query.timeRange!.to!);

    if (query.sortBy) {
      const direction = query.sortOrder === 'desc' ? -1 : 1;
      entries.sort((a, b) => direction * this.compareSortField(a, b, query.sortBy!));
    }

    const offset = Math.max(0, query.offset || 0);
    const limit = query.limit !== undefined ? Math.max(0, query.limit) : undefined;
    entries = entries.slice(offset, limit === undefined ? undefined : offset + limit);

    const now = new Date().toISOString();
    for (const entry of entries) {
      entry.lastAccessed = now;
      entry.accessCount += 1;
    }
    return entries.map(entry => this.cloneEntry(entry));
  }

  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    const current = this.entries.get(id);
    if (!current) throw new Error(`Memory entry ${String(id)} not found`);
    if (updates.id !== undefined && updates.id !== id) throw new Error(`Memory identity is immutable: ${String(id)}`);

    const next: MemoryEntry = {
      ...current,
      ...updates,
      id,
      createdAt: current.createdAt,
      tags: updates.tags ? [...updates.tags] : [...current.tags],
      representations: updates.representations ? { ...updates.representations } : { ...current.representations },
      metadata: updates.metadata ? { ...updates.metadata } : { ...current.metadata },
      lastAccessed: new Date().toISOString(),
      version: {
        ...current.version,
        ...(updates.version || {}),
        patch: Math.max(current.version.patch + 1, updates.version?.patch ?? 0),
      },
    };
    this.assertEntry(next);

    this.unindexEntry(current);
    try {
      this.entries.set(id, next);
      this.indexEntry(next);
    } catch (error) {
      this.entries.set(id, current);
      this.unindexEntry(next);
      this.indexEntry(current);
      throw error;
    }
  }

  async delete(id: EntityId): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    this.unindexEntry(entry);
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      const ids = Array.from(this.layerIndex.get(layer) || []);
      for (const id of ids) await this.delete(id);
      return;
    }

    this.entries.clear();
    for (const set of this.layerIndex.values()) set.clear();
    this.tagIndex.clear();
  }

  async stats(): Promise<MemoryStoreStats> {
    const byLayer = Object.fromEntries(MEMORY_LAYERS.map(layer => [layer, 0])) as Record<MemoryLayer, number>;
    let totalSize = 0;
    let oldest: Timestamp | null = null;
    let newest: Timestamp | null = null;

    for (const entry of this.entries.values()) {
      if (this.isExpired(entry)) continue;
      byLayer[entry.layer] += 1;
      totalSize += JSON.stringify(entry).length;
      if (!oldest || entry.createdAt < oldest) oldest = entry.createdAt;
      if (!newest || entry.createdAt > newest) newest = entry.createdAt;
    }

    return {
      totalEntries: Object.values(byLayer).reduce((sum, count) => sum + count, 0),
      byLayer,
      totalSizeBytes: totalSize,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /** Explicit lifecycle hook for tests/embedded runtimes. */
  dispose(): void {
    clearInterval(this.sweepTimer);
  }

  private indexEntry(entry: MemoryEntry): void {
    this.layerIndex.get(entry.layer)!.add(entry.id);
    for (const tag of entry.tags) {
      let bucket = this.tagIndex.get(tag);
      if (!bucket) {
        bucket = new Set();
        this.tagIndex.set(tag, bucket);
      }
      bucket.add(entry.id);
    }
  }

  private unindexEntry(entry: MemoryEntry): void {
    this.layerIndex.get(entry.layer)?.delete(entry.id);
    for (const tag of entry.tags) {
      const bucket = this.tagIndex.get(tag);
      bucket?.delete(entry.id);
      if (bucket?.size === 0) this.tagIndex.delete(tag);
    }
  }

  private cloneEntry(entry: MemoryEntry): MemoryEntry {
    return {
      ...entry,
      tags: [...entry.tags],
      representations: { ...entry.representations },
      metadata: { ...entry.metadata },
      version: { ...entry.version },
    };
  }

  private assertEntry(entry: MemoryEntry): void {
    if (!MEMORY_LAYERS.includes(entry.layer)) throw new Error(`Unknown memory layer: ${entry.layer}`);
    if (!Number.isFinite(entry.importance) || entry.importance < 0 || entry.importance > 1) throw new Error('Memory importance must be in [0,1]');
    if (entry.ttl !== null && (!Number.isFinite(entry.ttl) || entry.ttl < 0)) throw new Error('Memory TTL must be null or >= 0');
    if (!Number.isInteger(entry.accessCount) || entry.accessCount < 0) throw new Error('Memory accessCount must be a non-negative integer');
  }

  private isExpired(entry: MemoryEntry, now = Date.now()): boolean {
    if (entry.ttl === null || entry.ttl <= 0) return false;
    return now - Date.parse(entry.createdAt) > entry.ttl * 1000;
  }

  private searchableContent(content: unknown): string {
    if (typeof content === 'string') return content.toLowerCase();
    try { return JSON.stringify(content).toLowerCase(); } catch { return String(content).toLowerCase(); }
  }

  private compareSortField(a: MemoryEntry, b: MemoryEntry, field: NonNullable<MemoryQuery['sortBy']>): number {
    switch (field) {
      case 'createdAt': return a.createdAt.localeCompare(b.createdAt);
      case 'lastAccessed': return a.lastAccessed.localeCompare(b.lastAccessed);
      case 'accessCount': return a.accessCount - b.accessCount;
      case 'importance': return a.importance - b.importance;
    }
  }

  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    const toDelete = Array.from(this.entries.values()).filter(entry => this.isExpired(entry, now)).map(entry => entry.id);
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
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: generateId(),
      layer,
      content,
      representations: {},
      importance: options.importance ?? this.defaultImportance(layer),
      ttl: options.ttl ?? this.defaultTTL(layer),
      version: { major: 1, minor: 0, patch: 0 },
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      consolidated: false,
      compressed: false,
      tags: [...(options.tags || [])],
      source: options.source || 'system' as EntityId,
      metadata: (options.metadata || {}) as Record<string, string | number | boolean | null>,
    };
    entry.importance = this.scoreImportance(entry);
    return this.storeImpl.store(entry);
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> { return this.storeImpl.retrieve(id); }
  async query(query: MemoryQuery): Promise<MemoryEntry[]> { return this.storeImpl.query(query); }
  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> { return this.storeImpl.update(id, updates); }
  async delete(id: EntityId): Promise<void> { return this.storeImpl.delete(id); }

  async consolidate(threshold: number = 0.7): Promise<number> {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Consolidation threshold must be in [0,1]');
    const shortTermEntries = await this.storeImpl.query({ layer: 'short_term', sortBy: 'importance', sortOrder: 'desc' });
    let consolidated = 0;
    for (const entry of shortTermEntries) {
      if (entry.importance < threshold) continue;
      await this.storeImpl.update(entry.id, { layer: 'long_term', consolidated: true, ttl: null });
      consolidated += 1;
    }
    return consolidated;
  }

  async forget(threshold: number = 0.2, maxAge: number = 86400 * 7): Promise<number> {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Forget threshold must be in [0,1]');
    if (!Number.isFinite(maxAge) || maxAge < 0) throw new Error('maxAge must be >= 0');
    const entries = await this.storeImpl.query({ sortBy: 'importance', sortOrder: 'asc' });
    let forgotten = 0;
    const now = Date.now();
    for (const entry of entries) {
      if (entry.layer === 'long_term' || entry.layer === 'semantic') continue;
      if (entry.importance < threshold && now - Date.parse(entry.createdAt) > maxAge * 1000) {
        await this.storeImpl.delete(entry.id);
        forgotten += 1;
      }
    }
    return forgotten;
  }

  async crossLink(sourceId: EntityId, targetId: EntityId, relation: string): Promise<void> {
    const source = await this.storeImpl.retrieve(sourceId);
    const target = await this.storeImpl.retrieve(targetId);
    if (!source || !target) throw new Error('Both memory entries must exist before creating a cross-link');
    const normalizedRelation = relation.trim();
    if (!normalizedRelation) throw new Error('Cross-link relation must not be empty');

    const metadata = { ...source.metadata } as Record<string, unknown>;
    const existing = Array.isArray(metadata.links)
      ? metadata.links as Array<{ target: string; relation: string }>
      : [];
    if (!existing.some(link => link.target === String(targetId) && link.relation === normalizedRelation)) {
      metadata.links = [...existing, { target: String(targetId), relation: normalizedRelation }];
      await this.storeImpl.update(sourceId, { metadata: metadata as MemoryEntry['metadata'] });
    }
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
    const age = Date.now() - Date.parse(entry.createdAt);
    if (age < 3_600_000) score += 0.1;
    if (age < 600_000) score += 0.1;
    if (entry.accessCount > 10) score += 0.1;
    if (entry.accessCount > 50) score += 0.1;
    return Math.min(score, 1.0);
  }
}
