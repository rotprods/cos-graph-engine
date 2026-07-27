"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiLevelCache = exports.L3Cache = exports.L2Cache = exports.L1Cache = void 0;
// ============================================================
// L1Cache — LRU en memoria
// ============================================================
class L1Cache {
    entries = new Map();
    accessOrder = [];
    maxSize;
    _hits = 0;
    _misses = 0;
    _evictions = 0;
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
    }
    get(key) {
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
    set(key, value, ttl = 0) {
        // Evict if at capacity
        if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
            this.evictOne();
        }
        const entry = {
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
    has(key) {
        return this.entries.has(key);
    }
    delete(key) {
        const idx = this.accessOrder.indexOf(key);
        if (idx >= 0)
            this.accessOrder.splice(idx, 1);
        return this.entries.delete(key);
    }
    clear() {
        this.entries.clear();
        this.accessOrder = [];
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
    }
    size() { return this.entries.size; }
    touch(key) {
        const idx = this.accessOrder.indexOf(key);
        if (idx >= 0)
            this.accessOrder.splice(idx, 1);
        this.accessOrder.push(key);
    }
    evictOne() {
        // LRU: remove least recently used (first in order)
        const lru = this.accessOrder.shift();
        if (lru) {
            this.entries.delete(lru);
            this._evictions++;
        }
    }
    estimateSize(value) {
        try {
            return JSON.stringify(value).length;
        }
        catch {
            return 100;
        }
    }
    stats() {
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
exports.L1Cache = L1Cache;
// ============================================================
// L2Cache — Cache con TTL
// ============================================================
class L2Cache {
    entries = new Map();
    defaultTtl;
    _hits = 0;
    _misses = 0;
    _evictions = 0;
    cleanupInterval;
    lastCleanup = Date.now();
    constructor(defaultTtl = 60000, cleanupInterval = 30000) {
        this.defaultTtl = defaultTtl;
        this.cleanupInterval = cleanupInterval;
    }
    get(key) {
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
    set(key, value, ttl) {
        this.maybeCleanup();
        const entry = {
            key,
            value,
            createdAt: Date.now(),
            accessedAt: Date.now(),
            ttl: ttl ?? this.defaultTtl,
            size: 0,
        };
        this.entries.set(key, entry);
    }
    has(key) {
        this.maybeCleanup();
        const entry = this.entries.get(key);
        if (!entry)
            return false;
        if (entry.ttl > 0 && Date.now() - entry.createdAt > entry.ttl) {
            this.entries.delete(key);
            this._evictions++;
            return false;
        }
        return true;
    }
    delete(key) {
        return this.entries.delete(key);
    }
    clear() {
        this.entries.clear();
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
    }
    size() { return this.entries.size; }
    maybeCleanup() {
        if (Date.now() - this.lastCleanup < this.cleanupInterval)
            return;
        this.lastCleanup = Date.now();
        const now = Date.now();
        for (const [key, entry] of this.entries) {
            if (entry.ttl > 0 && now - entry.createdAt > entry.ttl) {
                this.entries.delete(key);
                this._evictions++;
            }
        }
    }
    stats() {
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
exports.L2Cache = L2Cache;
// ============================================================
// L3Cache — Cache en disco (serializado)
// ============================================================
class L3Cache {
    storage = new Map(); // simulated disk
    _hits = 0;
    _misses = 0;
    get(key) {
        const serialized = this.storage.get(key);
        if (!serialized) {
            this._misses++;
            return undefined;
        }
        this._hits++;
        try {
            return JSON.parse(serialized);
        }
        catch {
            this._misses++;
            return undefined;
        }
    }
    set(key, value) {
        try {
            this.storage.set(key, JSON.stringify(value));
        }
        catch {
            // Unserializable — skip
        }
    }
    has(key) {
        return this.storage.has(key);
    }
    delete(key) {
        return this.storage.delete(key);
    }
    clear() {
        this.storage.clear();
        this._hits = 0;
        this._misses = 0;
    }
    size() { return this.storage.size; }
    stats() {
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
exports.L3Cache = L3Cache;
// ============================================================
// MultiLevelCache — Cache compuesto L1 -> L2 -> L3
// ============================================================
class MultiLevelCache {
    l1;
    l2;
    l3;
    _hits = 0;
    _misses = 0;
    _l1Hits = 0;
    _l2Hits = 0;
    _l3Hits = 0;
    constructor(l1MaxSize, l2DefaultTtl) {
        this.l1 = new L1Cache(l1MaxSize);
        this.l2 = new L2Cache(l2DefaultTtl);
        this.l3 = new L3Cache();
    }
    /**
     * Obtener valor: prueba L1 -> L2 -> L3.
     * Si se encuentra en un nivel inferior, promueve a niveles superiores.
     */
    get(key) {
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
    set(key, value, l2Ttl) {
        this.l1.set(key, value);
        this.l2.set(key, value, l2Ttl);
        this.l3.set(key, value);
    }
    /**
     * Verificar si existe (prueba L1, L2, L3).
     */
    has(key) {
        return this.l1.has(key) || this.l2.has(key) || this.l3.has(key);
    }
    /**
     * Eliminar de todos los niveles.
     */
    delete(key) {
        const d1 = this.l1.delete(key);
        const d2 = this.l2.delete(key);
        const d3 = this.l3.delete(key);
        return d1 || d2 || d3;
    }
    /**
     * Limpiar todo.
     */
    clear() {
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
    stats() {
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
exports.MultiLevelCache = MultiLevelCache;
//# sourceMappingURL=cache.js.map