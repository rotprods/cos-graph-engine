"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pool_1 = require("../pool");
const realtime_1 = require("../realtime");
function gen(id, jobSetId) {
    return { id, model: 'demo', type: 'image', status: 'queued', input: { model: 'demo', settings: {} }, ...(jobSetId ? { jobSetId } : {}) };
}
(0, vitest_1.describe)('Realtime (refcounted channels)', () => {
    (0, vitest_1.beforeEach)(() => vitest_1.vi.useFakeTimers());
    (0, vitest_1.afterEach)(() => vitest_1.vi.useRealTimers());
    (0, vitest_1.it)('shares ONE connection per job set across subscribers; the last unsubscribe closes it', () => {
        let opened = 0;
        let closed = 0;
        const live = new realtime_1.Realtime(() => {
            opened++;
            return () => closed++;
        }, { freeGraceMs: 0 });
        const a = live.subscribe(gen('a', 'set-1'), () => { });
        const b = live.subscribe(gen('b', 'set-1'), () => { });
        (0, vitest_1.expect)(opened).toBe(1); // one channel for the whole set
        a?.();
        (0, vitest_1.expect)(closed).toBe(0); // b still listening
        b?.();
        (0, vitest_1.expect)(closed).toBe(1);
    });
    (0, vitest_1.it)('events fan out to every listener on the channel', () => {
        let fire;
        const live = new realtime_1.Realtime((_g, emit) => {
            fire = emit;
            return () => { };
        });
        const seen = [];
        live.subscribe(gen('a', 'set-1'), () => seen.push('a'));
        live.subscribe(gen('b', 'set-1'), () => seen.push('b'));
        fire?.();
        (0, vitest_1.expect)(seen.sort()).toEqual(['a', 'b']);
    });
    (0, vitest_1.it)('the grace window survives quick re-subscribes without reconnecting', () => {
        let opened = 0;
        let closed = 0;
        const live = new realtime_1.Realtime(() => {
            opened++;
            return () => closed++;
        }, { freeGraceMs: 1000 });
        const first = live.subscribe(gen('a', 'set-1'), () => { });
        first?.(); // effect re-run: unsubscribe...
        live.subscribe(gen('a', 'set-1'), () => { }); // ...and resubscribe within the grace
        vitest_1.vi.advanceTimersByTime(2000);
        (0, vitest_1.expect)(opened).toBe(1); // the live connection was reused
        (0, vitest_1.expect)(closed).toBe(0);
        // and the grace DOES close an abandoned channel
        const second = live.subscribe(gen('z', 'set-2'), () => { });
        second?.();
        vitest_1.vi.advanceTimersByTime(2000);
        (0, vitest_1.expect)(closed).toBe(1);
    });
    (0, vitest_1.it)('returns undefined when the transport has no channel (poll those instead)', () => {
        const live = new realtime_1.Realtime(g => (g.jobSetId === 'covered' ? () => { } : undefined));
        (0, vitest_1.expect)(live.subscribe(gen('a', 'covered'), () => { })).toBeDefined();
        (0, vitest_1.expect)(live.subscribe(gen('b', 'legacy-type'), () => { })).toBeUndefined();
    });
    (0, vitest_1.it)('a THROWING transport means "no channel", not a crash in the caller', () => {
        const live = new realtime_1.Realtime(() => {
            throw new Error('new WebSocket(...) blew up');
        }, { freeGraceMs: 0 });
        (0, vitest_1.expect)(live.subscribe(gen('a', 'set-1'), () => { })).toBeUndefined();
        // and the failed open didn't leak a refcount on the channel key
        (0, vitest_1.expect)(live.subscribe(gen('a', 'set-1'), () => { })).toBeUndefined();
    });
    (0, vitest_1.it)('unsubscribe is idempotent — extra calls cannot close a channel under another subscriber', () => {
        let closed = 0;
        let fire;
        const live = new realtime_1.Realtime((_g, emit) => {
            fire = emit;
            return () => closed++;
        }, { freeGraceMs: 0 });
        const seen = [];
        const a = live.subscribe(gen('a', 'set-1'), () => seen.push('a'));
        live.subscribe(gen('b', 'set-1'), () => seen.push('b'));
        a?.();
        a?.(); // a double cleanup (a buggy consumer) must be a no-op
        fire?.();
        (0, vitest_1.expect)(closed).toBe(0); // b's channel survived
        (0, vitest_1.expect)(seen).toEqual(['b']);
    });
});
(0, vitest_1.describe)('RefCountPool', () => {
    (0, vitest_1.it)('allocate shares an instance; the last free disposes it', () => {
        const freed = [];
        const pool = new pool_1.RefCountPool((id) => id, id => ({ id, free: () => freed.push(id) }));
        const one = pool.allocate('x');
        const two = pool.allocate('x');
        (0, vitest_1.expect)(two).toBe(one);
        pool.free('x');
        (0, vitest_1.expect)(freed).toEqual([]);
        pool.free('x');
        (0, vitest_1.expect)(freed).toEqual(['x']);
        (0, vitest_1.expect)(pool.has('x')).toBe(false);
    });
    (0, vitest_1.it)('ensure gets-or-creates without taking a reference (render-phase safe)', () => {
        const freed = [];
        const pool = new pool_1.RefCountPool((id) => id, id => ({ id, free: () => freed.push(id) }));
        const ensured = pool.ensure('x');
        (0, vitest_1.expect)(pool.allocate('x')).toBe(ensured);
        pool.free('x'); // releases the ONE allocate reference
        (0, vitest_1.expect)(freed).toEqual(['x']);
    });
    (0, vitest_1.it)('extra frees are a no-op — the count never underflows a live instance', () => {
        const freed = [];
        const pool = new pool_1.RefCountPool((id) => id, id => ({ id, free: () => freed.push(id) }));
        pool.free('never-allocated'); // must not throw, must not dispose anything
        (0, vitest_1.expect)(freed).toEqual([]);
        pool.allocate('x');
        pool.free('x');
        pool.free('x'); // double free after full release
        (0, vitest_1.expect)(freed).toEqual(['x']);
        // the key is fully reusable afterwards
        pool.allocate('x');
        (0, vitest_1.expect)(pool.has('x')).toBe(true);
        pool.free('x');
        (0, vitest_1.expect)(freed).toEqual(['x', 'x']);
    });
    (0, vitest_1.it)('a factory throw does not leak a reference', () => {
        const freed = [];
        let boom = true;
        const pool = new pool_1.RefCountPool((id) => id, (id) => {
            if (boom) {
                boom = false;
                throw new Error('factory blew up');
            }
            return { id, free: () => freed.push(id) };
        });
        (0, vitest_1.expect)(() => pool.allocate('x')).toThrow('factory blew up');
        pool.allocate('x'); // works now — and holds the ONLY reference
        pool.free('x'); // would NOT dispose here if the throw above had leaked a ref
        (0, vitest_1.expect)(freed).toEqual(['x']);
    });
});
//# sourceMappingURL=realtime.test.js.map