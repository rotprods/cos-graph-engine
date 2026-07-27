"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const storage_ts_1 = require("./storage.ts");
(0, vitest_1.describe)('Side-effect contract', () => {
    (0, vitest_1.describe)('localStorageAdapter', () => {
        (0, vitest_1.beforeEach)(() => {
            localStorage.clear();
        });
        (0, vitest_1.it)('round-trips set → get', () => {
            storage_ts_1.localStorageAdapter.set('foo', 'bar');
            (0, vitest_1.expect)(storage_ts_1.localStorageAdapter.get('foo')).toBe('bar');
        });
        (0, vitest_1.it)('returns null for missing keys', () => {
            (0, vitest_1.expect)(storage_ts_1.localStorageAdapter.get('missing')).toBeNull();
        });
        (0, vitest_1.it)('remove() makes subsequent get() return null', () => {
            storage_ts_1.localStorageAdapter.set('foo', 'bar');
            storage_ts_1.localStorageAdapter.remove('foo');
            (0, vitest_1.expect)(storage_ts_1.localStorageAdapter.get('foo')).toBeNull();
        });
        (0, vitest_1.it)('does not throw if backing store throws on set', () => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = () => {
                throw new Error('QuotaExceeded');
            };
            (0, vitest_1.expect)(() => storage_ts_1.localStorageAdapter.set('k', 'v')).not.toThrow();
            Storage.prototype.setItem = original;
        });
    });
    (0, vitest_1.describe)('sessionStorageAdapter', () => {
        (0, vitest_1.beforeEach)(() => {
            sessionStorage.clear();
        });
        (0, vitest_1.it)('round-trips set → get → remove', () => {
            storage_ts_1.sessionStorageAdapter.set('a', '1');
            (0, vitest_1.expect)(storage_ts_1.sessionStorageAdapter.get('a')).toBe('1');
            storage_ts_1.sessionStorageAdapter.remove('a');
            (0, vitest_1.expect)(storage_ts_1.sessionStorageAdapter.get('a')).toBeNull();
        });
        (0, vitest_1.it)('is isolated from localStorage', () => {
            storage_ts_1.sessionStorageAdapter.set('iso', 'session');
            (0, vitest_1.expect)(storage_ts_1.localStorageAdapter.get('iso')).toBeNull();
        });
    });
    (0, vitest_1.describe)('urlAdapter (search mode)', () => {
        (0, vitest_1.beforeEach)(() => {
            window.history.replaceState(null, '', '/');
        });
        (0, vitest_1.it)('writes to ?search and reads back', () => {
            const adapter = (0, storage_ts_1.urlAdapter)();
            adapter.set('theme', 'ai-ocean');
            (0, vitest_1.expect)(window.location.search).toContain('theme=ai-ocean');
            (0, vitest_1.expect)(adapter.get('theme')).toBe('ai-ocean');
        });
        (0, vitest_1.it)('remove() drops the key from the URL', () => {
            const adapter = (0, storage_ts_1.urlAdapter)();
            adapter.set('theme', 'ai-ocean');
            adapter.remove('theme');
            (0, vitest_1.expect)(adapter.get('theme')).toBeNull();
            (0, vitest_1.expect)(window.location.search).not.toContain('theme=');
        });
        (0, vitest_1.it)('preserves other search params on set', () => {
            window.history.replaceState(null, '', '/?utm=src');
            const adapter = (0, storage_ts_1.urlAdapter)();
            adapter.set('theme', 'ai-ocean');
            (0, vitest_1.expect)(window.location.search).toContain('utm=src');
            (0, vitest_1.expect)(window.location.search).toContain('theme=ai-ocean');
        });
        (0, vitest_1.it)('encodes special characters', () => {
            const adapter = (0, storage_ts_1.urlAdapter)();
            adapter.set('theme', 'a b/c');
            (0, vitest_1.expect)(adapter.get('theme')).toBe('a b/c');
        });
    });
    (0, vitest_1.describe)('urlAdapter (hash mode)', () => {
        (0, vitest_1.beforeEach)(() => {
            window.history.replaceState(null, '', '/');
        });
        (0, vitest_1.it)('writes to #hash, not ?search', () => {
            const adapter = (0, storage_ts_1.urlAdapter)({ mode: 'hash' });
            adapter.set('theme', 'ai-ocean');
            (0, vitest_1.expect)(window.location.hash).toContain('theme=ai-ocean');
            (0, vitest_1.expect)(window.location.search).toBe('');
        });
        (0, vitest_1.it)('reads back from hash', () => {
            const adapter = (0, storage_ts_1.urlAdapter)({ mode: 'hash' });
            adapter.set('theme', 'ai-ocean');
            (0, vitest_1.expect)(adapter.get('theme')).toBe('ai-ocean');
        });
        (0, vitest_1.it)('ignores ?search params even when populated', () => {
            window.history.replaceState(null, '', '/?theme=from-search');
            const adapter = (0, storage_ts_1.urlAdapter)({ mode: 'hash' });
            (0, vitest_1.expect)(adapter.get('theme')).toBeNull();
        });
    });
    (0, vitest_1.describe)('memoryStorage', () => {
        (0, vitest_1.it)('round-trips within one instance', () => {
            const m = (0, storage_ts_1.memoryStorage)();
            m.set('k', 'v');
            (0, vitest_1.expect)(m.get('k')).toBe('v');
            m.remove('k');
            (0, vitest_1.expect)(m.get('k')).toBeNull();
        });
        (0, vitest_1.it)('is isolated between instances', () => {
            const a = (0, storage_ts_1.memoryStorage)();
            const b = (0, storage_ts_1.memoryStorage)();
            a.set('k', 'a-val');
            (0, vitest_1.expect)(b.get('k')).toBeNull();
        });
        (0, vitest_1.it)('does not touch localStorage', () => {
            const m = (0, storage_ts_1.memoryStorage)();
            m.set('mem', 'only');
            (0, vitest_1.expect)(localStorage.getItem('mem')).toBeNull();
        });
    });
});
//# sourceMappingURL=storage.test.js.map