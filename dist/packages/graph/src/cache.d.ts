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
export interface CacheEntry<T = unknown> {
    key: string;
    value: T;
    createdAt: number;
    accessedAt: number;
    ttl: number;
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
export declare class L1Cache {
    private entries;
    private accessOrder;
    private maxSize;
    private _hits;
    private _misses;
    private _evictions;
    constructor(maxSize?: number);
    get(key: string): unknown | undefined;
    set(key: string, value: unknown, ttl?: number): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    private touch;
    private evictOne;
    private estimateSize;
    stats(): CacheStats;
}
export declare class L2Cache {
    private entries;
    private defaultTtl;
    private _hits;
    private _misses;
    private _evictions;
    private cleanupInterval;
    private lastCleanup;
    constructor(defaultTtl?: number, cleanupInterval?: number);
    get(key: string): unknown | undefined;
    set(key: string, value: unknown, ttl?: number): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    private maybeCleanup;
    stats(): CacheStats;
}
export declare class L3Cache {
    private storage;
    private _hits;
    private _misses;
    get(key: string): unknown | undefined;
    set(key: string, value: unknown): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    size(): number;
    stats(): CacheStats;
}
export declare class MultiLevelCache {
    l1: L1Cache;
    l2: L2Cache;
    l3: L3Cache;
    private _hits;
    private _misses;
    private _l1Hits;
    private _l2Hits;
    private _l3Hits;
    constructor(l1MaxSize?: number, l2DefaultTtl?: number);
    /**
     * Obtener valor: prueba L1 -> L2 -> L3.
     * Si se encuentra en un nivel inferior, promueve a niveles superiores.
     */
    get(key: string): unknown | undefined;
    /**
     * Almacenar valor en todos los niveles.
     */
    set(key: string, value: unknown, l2Ttl?: number): void;
    /**
     * Verificar si existe (prueba L1, L2, L3).
     */
    has(key: string): boolean;
    /**
     * Eliminar de todos los niveles.
     */
    delete(key: string): boolean;
    /**
     * Limpiar todo.
     */
    clear(): void;
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
    };
}
//# sourceMappingURL=cache.d.ts.map