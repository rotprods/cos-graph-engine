"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefCountPool = void 0;
class RefCountPool {
    hash;
    factory;
    instances = new Map();
    refs = new Map();
    freeTimers = new Map();
    freeGraceMs;
    constructor(hash, factory, options) {
        this.hash = hash;
        this.factory = factory;
        this.freeGraceMs = options?.freeGraceMs ?? 0;
    }
    /** Get-or-create AND take a reference (pair every allocate with a free). */
    allocate(id) {
        const key = this.hash(id);
        const instance = this.ensure(id); // a factory throw must not leak a ref
        const pending = this.freeTimers.get(key);
        if (pending) {
            clearTimeout(pending);
            this.freeTimers.delete(key);
        }
        this.refs.set(key, (this.refs.get(key) ?? 0) + 1);
        return instance;
    }
    /** Release a reference; the last one disposes the instance (after the grace). Extra frees are a no-op — never underflow a live instance. */
    free(id) {
        const key = this.hash(id);
        const current = this.refs.get(key);
        if (current === undefined)
            return; // never allocated, or already fully freed (a double-free)
        if (current > 1) {
            this.refs.set(key, current - 1);
            return;
        }
        this.refs.delete(key);
        if (this.freeGraceMs > 0) {
            this.freeTimers.set(key, setTimeout(() => {
                this.freeTimers.delete(key);
                this.dispose(key);
            }, this.freeGraceMs));
        }
        else {
            this.dispose(key);
        }
    }
    /** Get-or-create WITHOUT touching the ref count — safe in a render phase. */
    ensure(id) {
        const key = this.hash(id);
        const existing = this.instances.get(key);
        if (existing)
            return existing;
        const created = this.factory(id);
        this.instances.set(key, created);
        return created;
    }
    get(id) {
        return this.instances.get(this.hash(id));
    }
    has(id) {
        return this.instances.has(this.hash(id));
    }
    dispose(key) {
        this.instances.get(key)?.free();
        this.instances.delete(key);
    }
}
exports.RefCountPool = RefCountPool;
//# sourceMappingURL=pool.js.map