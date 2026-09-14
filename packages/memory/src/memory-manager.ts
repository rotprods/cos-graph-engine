import {
  MemoryEntry, MemoryLayer, MemoryQuery, IMemoryStore, MemoryStoreStats,
  EntityId, Timestamp,
} from '@cos/core';
import { generateId } from '@cos/core';

type AccessTelemetry = { lastAccessed: Timestamp; accessCount: number };

function detached<T>(value: T, label: string): T {
  try {
    return structuredClone(value);
  } catch {
    throw new Error(`${label} contains non-cloneable data`);
  }
}

export class InMemoryStore implements IMemoryStore {
  private entries: Map<EntityId, MemoryEntry> = new Map();
  private layerIndex: Map<MemoryLayer, Set<EntityId>> = new Map();
  private tagIndex: Map<string, Set<EntityId>> = new Map();
  private accessTelemetry: Map<EntityId, AccessTelemetry> = new Map();
  private sweepTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    const layers: MemoryLayer[] = [
      'working', 'short_term', 'long_term', 'semantic',
      'procedural', 'episodic', 'temporal', 'spatial',
      'vector', 'knowledge_graph', 'cache', 'reflection',
    ];
    for (const layer of layers) this.layerIndex.set(layer, new Set());
    this.sweepTimer = setInterval(() => {
      void this.sweepExpired().catch(() => {
        console.error('[InMemoryStore] Expiration sweep failed');
      });
    }, 60000);
    this.sweepTimer.unref();
  }

  /** Stop housekeeping without deleting canonical memory. Idempotent. */
  dispose(): void {
    if (this.sweepTimer !== undefined) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
  }

  /**
   * Export a detached, deterministic snapshot without incrementing access
   * telemetry. Expired entries are never promoted into durable authority.
   */
  exportSnapshot(): MemoryEntry[] {
    const now = Date.now();
    const entries: MemoryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (this.isExpired(entry, now)) continue;
      entries.push(this.materialize(entry, false));
    }
    entries.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'));
    return entries;
  }

  private index(entry: MemoryEntry): void {
    if (!this.layerIndex.has(entry.layer)) this.layerIndex.set(entry.layer, new Set());
    this.layerIndex.get(entry.layer)!.add(entry.id);
    for (const tag of entry.tags || []) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(entry.id);
    }
  }

  private unindex(entry: MemoryEntry): void {
    this.layerIndex.get(entry.layer)?.delete(entry.id);
    for (const tag of entry.tags || []) {
      const ids = this.tagIndex.get(tag);
      if (!ids) continue;
      ids.delete(entry.id);
      if (ids.size === 0) this.tagIndex.delete(tag);
    }
  }

  private telemetry(entry: MemoryEntry): AccessTelemetry {
    return this.accessTelemetry.get(entry.id) ?? {
      lastAccessed: entry.lastAccessed,
      accessCount: entry.accessCount,
    };
  }

  private materialize(entry: MemoryEntry, touch: boolean): MemoryEntry {
    let access = this.telemetry(entry);
    if (touch) {
      access = {
        lastAccessed: new Date().toISOString(),
        accessCount: access.accessCount + 1,
      };
      this.accessTelemetry.set(entry.id, access);
    }
    const result = detached(entry, `Memory entry ${entry.id}`);
    result.lastAccessed = access.lastAccessed;
    result.accessCount = access.accessCount;
    return result;
  }

  private isExpired(entry: MemoryEntry, now: number = Date.now()): boolean {
    if (entry.ttl === null || entry.ttl <= 0) return false;
    const created = new Date(entry.createdAt).getTime();
    return Number.isFinite(created) && now - created > entry.ttl * 1000;
  }

  async store(entry: MemoryEntry): Promise<EntityId> {
    const input = detached(entry, 'Memory entry');
    const id = input.id || generateId();
    const now = new Date().toISOString();
    const stored: MemoryEntry = {
      ...input,
      id,
      tags: [...(input.tags || [])],
      createdAt: input.createdAt || now,
      lastAccessed: input.lastAccessed || now,
      accessCount: Number.isFinite(input.accessCount) ? input.accessCount : 0,
    };
    const previous = this.entries.get(id);
    if (previous) this.unindex(previous);
    this.entries.set(id, stored);
    this.accessTelemetry.set(id, {
      lastAccessed: stored.lastAccessed,
      accessCount: stored.accessCount,
    });
    this.index(stored);
    return id;
  }

  async retrieve(id: EntityId): Promise<MemoryEntry | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      await this.delete(id);
      return null;
    }
    return this.materialize(entry, true);
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    await this.sweepExpired();
    let results = Array.from(this.entries.values());

    if (q.layer) results = results.filter(entry => entry.layer === q.layer);
    if (q.content) {
      const needle = q.content.toLocaleLowerCase('en-US');
      results = results.filter(entry => {
        let haystack: string;
        try { haystack = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content); }
        catch { return false; }
        return haystack.toLocaleLowerCase('en-US').includes(needle);
      });
    }
    if (q.tags?.length) {
      results = results.filter(entry => q.tags!.some(tag => entry.tags.includes(tag)));
    }
    if (q.importance) {
      const { min, max } = q.importance;
      if (min !== undefined) results = results.filter(entry => entry.importance >= min);
      if (max !== undefined) results = results.filter(entry => entry.importance <= max);
    }
    if (q.timeRange) {
      const { from, to } = q.timeRange;
      if (from) results = results.filter(entry => entry.createdAt >= from);
      if (to) results = results.filter(entry => entry.createdAt <= to);
    }

    if (q.sortBy) {
      const order = q.sortOrder === 'desc' ? -1 : 1;
      const sortBy = q.sortBy;
      results.sort((a, b) => {
        const aAccess = this.telemetry(a);
        const bAccess = this.telemetry(b);
        const aVal = sortBy === 'lastAccessed' ? aAccess.lastAccessed
          : sortBy === 'accessCount' ? aAccess.accessCount : a[sortBy];
        const bVal = sortBy === 'lastAccessed' ? bAccess.lastAccessed
          : sortBy === 'accessCount' ? bAccess.accessCount : b[sortBy];
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * order;
        return String(aVal).localeCompare(String(bVal), 'en') * order;
      });
    }

    const offset = q.offset === undefined ? 0 : Math.max(0, Math.trunc(q.offset));
    if (offset > 0) results = results.slice(offset);
    if (q.limit !== undefined && q.limit >= 0) results = results.slice(0, Math.trunc(q.limit));
    return results.map(entry => this.materialize(entry, true));
  }

  async update(id: EntityId, updates: Partial<MemoryEntry>): Promise<void> {
    const current = this.entries.get(id);
    if (!current) throw new Error(`Memory entry ${id} not found`);
    if (updates.id !== undefined && updates.id !== id) {
      throw new Error(`Memory entry identity is immutable: ${id}`);
    }

    const patch = detached(updates, `Memory update ${id}`);
    const { accessCount, lastAccessed, ...statePatch } = patch;
    const candidate: MemoryEntry = {
      ...current,
      ...statePatch,
      id,
      tags: patch.tags === undefined ? [...current.tags] : [...patch.tags],
      accessCount: current.accessCount,
      lastAccessed: current.lastAccessed,
    };
    detached(candidate, `Memory update ${id}`);

    this.unindex(current);
    this.entries.set(id, candidate);
    this.index(candidate);

    const previousAccess = this.telemetry(current);
    this.accessTelemetry.set(id, {
      accessCount: accessCount === undefined ? previousAccess.accessCount : accessCount,
      lastAccessed: lastAccessed === undefined ? previousAccess.lastAccessed : lastAccessed,
    });
  }

  async delete(id: EntityId): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.unindex(entry);
    this.entries.delete(id);
    this.accessTelemetry.delete(id);
  }

  async clear(layer?: MemoryLayer): Promise<void> {
    if (layer) {
      const ids = [...(this.layerIndex.get(layer) || [])];
      for (const id of ids) await this.delete(id);
      return;
    }
    this.entries.clear();
    this.accessTelemetry.clear();
    for (const layerSet of this.layerIndex.values()) layerSet.clear();
    this.tagIndex.clear();
  }

  async stats(): Promise<MemoryStoreStats> {
    await this.sweepExpired();
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
      byLayer: Object.fromEntries(allLayers.map(layer => [layer, byLayer[layer] || 0])) as Record<MemoryLayer, number>,
      totalSizeBytes: totalSize,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    const expired: EntityId[] = [];
    for (const entry of this.entries.values()) if (this.isExpired(entry, now)) expired.push(entry.id);
    for (const id of expired) await this.delete(id);
  }
}

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
      ttl: options.ttl === undefined ? this.defaultTTL(layer) : options.ttl,
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
    const entries = await this.storeImpl.query({ layer: 'short_term', sortBy: 'importance', sortOrder: 'desc' });
    let consolidated = 0;
    for (const entry of entries) {
      if (entry.importance >= threshold) {
        await this.storeImpl.update(entry.id, { layer: 'long_term', consolidated: true, ttl: null });
        consolidated++;
      }
    }
    return consolidated;
  }

  async forget(threshold: number = 0.2, maxAge: number = 86400 * 7): Promise<number> {
    const entries = await this.storeImpl.query({ sortBy: 'importance', sortOrder: 'asc' });
    let forgotten = 0;
    const now = Date.now();
    for (const entry of entries) {
      if (entry.layer === 'long_term' || entry.layer === 'semantic') continue;
      if (entry.importance < threshold && now - new Date(entry.createdAt).getTime() > maxAge * 1000) {
        await this.storeImpl.delete(entry.id);
        forgotten++;
      }
    }
    return forgotten;
  }

  async crossLink(sourceId: EntityId, targetId: EntityId, relation: string): Promise<void> {
    const source = await this.storeImpl.retrieve(sourceId);
    const target = await this.storeImpl.retrieve(targetId);
    if (!source || !target) return;
    if (!relation.trim()) throw new Error('Memory relation must be non-empty');

    const linksRaw: unknown = source.metadata['links'];
    let decoded: unknown = linksRaw;
    if (typeof linksRaw === 'string') {
      try { decoded = JSON.parse(linksRaw); }
      catch { throw new Error(`Invalid serialized memory links for ${sourceId}`); }
    }
    if (decoded === undefined || decoded === null) decoded = [];
    if (!Array.isArray(decoded) || !decoded.every(link =>
      link !== null && typeof link === 'object'
      && typeof link.target === 'string' && typeof link.relation === 'string'
    )) {
      throw new Error(`Invalid memory links for ${sourceId}`);
    }
    const links = decoded as Array<{ target: string; relation: string }>;
    if (!links.some(link => link.target === targetId && link.relation === relation)) {
      links.push({ target: targetId, relation });
    }
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
