/**
 * Refcounted instance pool — the fnf-web `RefCountClassPool` pattern
 * (shared/lib/ref-count-class-pool.ts), dependency-free. Share one stateful
 * instance (a controller, a realtime channel) between consumers: `allocate`
 * gets-or-creates and increments, `free` decrements and disposes the instance
 * (calls its `free()`) when the last consumer leaves — after `freeGraceMs`,
 * so quick unmount/remount cycles reuse the live instance instead of
 * rebuilding it.
 */
export interface PoolEntry {
    free: () => void;
}
export declare class RefCountPool<Id, Instance extends PoolEntry> {
    private readonly hash;
    private readonly factory;
    private readonly instances;
    private readonly refs;
    private readonly freeTimers;
    private readonly freeGraceMs;
    constructor(hash: (id: Id) => string, factory: (id: Id) => Instance, options?: {
        freeGraceMs?: number;
    });
    /** Get-or-create AND take a reference (pair every allocate with a free). */
    allocate(id: Id): Instance;
    /** Release a reference; the last one disposes the instance (after the grace). Extra frees are a no-op — never underflow a live instance. */
    free(id: Id): void;
    /** Get-or-create WITHOUT touching the ref count — safe in a render phase. */
    ensure(id: Id): Instance;
    get(id: Id): Instance | undefined;
    has(id: Id): boolean;
    private dispose;
}
//# sourceMappingURL=pool.d.ts.map