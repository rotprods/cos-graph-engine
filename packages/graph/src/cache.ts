/**
 * Cache Multinivel — Fase 17 (T-17.2)
 *
 * L1: Cache en memoria con LRU
 * L2: Cache con TTL (time-to-live)
 * L3: Cache en disco (serializado)
 *
 * MultiLevelCache: compuesto que prueba L1 -> L2 -> L3
 *
 * Zero dependencias externas.
 */

// ============================================================
// Tipos
// ============================================================

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  accessedAt: number;
  ttl: number; // ms, 0 = forever
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  evictions: number;
  hitRate: number;
}

// ============================================================
// L1Cache — LRU en memoria
// ============================================================

export class L1Cache {
  private entries: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private _hits: number = 0;
  private _misses: number = 0;
  private _evictions: number = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): unknown | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    entry.accessedAt = Date.now();
    this.touch(key);
    return entry.value;
  }

  set(key: string, value: unknown, ttl: number = 0): void {
    // Evict if at capacity
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      this.evictOne();
    }

    const entry: CacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttl,
      size: this.estimateSize(value),
    };

    this.entries.set(key, entry);
    this.touch(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  delete(key: string): boolean {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this.accessOrder = [];
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  size(): number { return this.entries.size; }

  private touch(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(key);
  }

  private evictOne(): void {
    // LRU: remove least recently used (first in order)
    const lru = this.accessOrder.shift();
    if (lru) {
      this.entries.delete(lru);
      this._evictions++;
    }
  }

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 100;
    }
  }

  stats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.entries.size,
      entries: this.entries.size,
      evictions: this._evictions,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }
}

// ============================================================
// L2Cache — Cache con TTL
// ============================================================

export class L2Cache {
  private entries: Map<string, CacheEntry> = new Map();
  private defaultTtl: number;
  private _hits: number = 0;
  private _misses: number = 0;
  private _evictions: number = 0;
  private cleanupInterval: number;
  private lastCleanup: number = Date.now();

  constructor(defaultTtl: number = 60000, cleanupInterval: number = 30000) {
    this.defaultTtl = defaultTtl;
    this.cleanupInterval = cleanupInterval;
  }

  get(key: string): unknown | undefined {
    this.maybeCleanup();

    const entry = this.entries.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }

    // Check TTL
    if (entry.ttl > 0 && Date.now() - entry.createdAt > entry.ttl) {
      this.entries.delete(key);
      this._evictions++;
      this._misses++;
      return undefined;
    }

    this._hits++;
    entry.accessedAt = Date.now();
    return entry.value;
  }

  set(key: string, value: unknown, ttl?: number): void {
    this.maybeCleanup();

    const entry: CacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      ttl: ttl ?? this.defaultTtl,
      size: 0,
    };

    this.entries.set(key, entry);
  }

  has(key: string): boolean {
    this.maybeCleanup();
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.ttl > 0 && Date.now() - entry.createdAt > entry.ttl) {
      this.entries.delete(key);
      this._evictions++;
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  size(): number { return this.entries.size; }

  private maybeCleanup(): void {
    if (Date.now() - this.lastCleanup < this.cleanupInterval) return;
    this.lastCleanup = Date.now();

    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) {
        this.entries.delete(key);
        this._evictions++;
      }
    }
  }

  stats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.entries.size,
      entries: this.entries.size,
      evictions: this._evictions,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }
}

// ============================================================
// L3Cache — Cache en disco (serializado)
// ============================================================

export class L3Cache {
  private storage: Map<string, string> = new Map(); // simulated disk
  private _hits: number = 0;
  private _misses: number = 0;

  get(key: string): unknown | undefined {
    const serialized = this.storage.get(key);
    if (!serialized) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    try {
      return JSON.parse(serialized);
    } catch {
      this._misses++;
      return undefined;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.storage.set(key, JSON.stringify(value));
    } catch {
      // Unserializable — skip
    }
  }

  has(key: string): boolean {
    return this.storage.has(key);
  }

  delete(key: string): boolean {
    return this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
    this._hits = 0;
    this._misses = 0;
  }

  size(): number { return this.storage.size; }

  stats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.storage.size,
      entries: this.storage.size,
      evictions: 0,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }
}

// ============================================================
// MultiLevelCache — Cache compuesto L1 -> L2 -> L3
// ============================================================

export class MultiLevelCache {
  l1: L1Cache;
  l2: L2Cache;
  l3: L3Cache;
  private _hits: number = 0;
  private _misses: number = 0;
  private _l1Hits: number = 0;
  private _l2Hits: number = 0;
  private _l3Hits: number = 0;

  constructor(l1MaxSize?: number, l2DefaultTtl?: number) {
    this.l1 = new L1Cache(l1MaxSize);
    this.l2 = new L2Cache(l2DefaultTtl);
    this.l3 = new L3Cache();
  }

  /**
   * Obtener valor: prueba L1 -> L2 -> L3.
   * Si se encuentra en un nivel inferior, promueve a niveles superiores.
   */
  get(key: string): unknown | undefined {
    // Try L1
    const l1Val = this.l1.get(key);
    if (l1Val !== undefined) {
      this._hits++;
      this._l1Hits++;
      return l1Val;
    }

    // Try L2
    const l2Val = this.l2.get(key);
    if (l2Val !== undefined) {
      this._hits++;
      this._l2Hits++;
      // Promote to L1
      this.l1.set(key, l2Val);
      return l2Val;
    }

    // Try L3
    const l3Val = this.l3.get(key);
    if (l3Val !== undefined) {
      this._hits++;
      this._l3Hits++;
      // Promote to L1 and L2
      this.l1.set(key, l3Val);
      this.l2.set(key, l3Val);
      return l3Val;
    }

    this._misses++;
    return undefined;
  }

  /**
   * Almacenar valor en todos los niveles.
   */
  set(key: string, value: unknown, l2Ttl?: number): void {
    this.l1.set(key, value);
    this.l2.set(key, value, l2Ttl);
    this.l3.set(key, value);
  }

  /**
   * Verificar si existe (prueba L1, L2, L3).
   */
  has(key: string): boolean {
    return this.l1.has(key) || this.l2.has(key) || this.l3.has(key);
  }

  /**
   * Eliminar de todos los niveles.
   */
  delete(key: string): boolean {
    const d1 = this.l1.delete(key);
    const d2 = this.l2.delete(key);
    const d3 = this.l3.delete(key);
    return d1 || d2 || d3;
  }

  /**
   * Limpiar todo.
   */
  clear(): void {
    this.l1.clear();
    this.l2.clear();
    this.l3.clear();
    this._hits = 0;
    this._misses = 0;
    this._l1Hits = 0;
    this._l2Hits = 0;
    this._l3Hits = 0;
  }

  /**
   * Estadisticas combinadas.
   */
  stats(): {
    total: CacheStats;
    l1: CacheStats;
    l2: CacheStats;
    l3: CacheStats;
    l1Hits: number;
    l2Hits: number;
    l3Hits: number;
  } {
    const total = this._hits + this._misses;
    return {
      total: {
        hits: this._hits,
        misses: this._misses,
        size: this.l1.size() + this.l2.size() + this.l3.size(),
        entries: this.l1.size() + this.l2.size() + this.l3.size(),
        evictions: 0,
        hitRate: total > 0 ? this._hits / total : 0,
      },
      l1: this.l1.stats(),
      l2: this.l2.stats(),
      l3: this.l3.stats(),
      l1Hits: this._l1Hits,
      l2Hits: this._l2Hits,
      l3Hits: this._l3Hits,
    };
  }
}