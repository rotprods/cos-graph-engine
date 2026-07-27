"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const controller_ts_1 = require("./controller.ts");
const storage_keys_ts_1 = require("./storage-keys.ts");
const storage_ts_1 = require("./storage.ts");
/**
 * `prefers-color-scheme` is a 3-state signal: dark, light, or none.
 * Mock both query forms so tests can express each state explicitly.
 */
function mockMatchMedia(systemPref) {
    window.matchMedia = vitest_1.vi.fn().mockImplementation((q) => ({
        matches: q.includes('dark')
            ? systemPref === 'dark'
            : q.includes('light')
                ? systemPref === 'light'
                : false,
        media: q,
        addEventListener: () => { },
        removeEventListener: () => { },
        addListener: () => { },
        removeListener: () => { },
        dispatchEvent: () => true,
        onchange: null,
    }));
}
(0, vitest_1.describe)('State machine behavior', () => {
    (0, vitest_1.describe)('readInitialThemeState', () => {
        (0, vitest_1.beforeEach)(() => {
            localStorage.clear();
            mockMatchMedia('none');
        });
        (0, vitest_1.it)('defaults to pref=auto, dark when storage empty + no system pref', () => {
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s).toEqual({
                pref: 'auto',
                brand: 'default',
                resolvedTheme: 'default-dark',
                override: null,
                activeTheme: 'default-dark',
            });
        });
        (0, vitest_1.it)('honours stored pref=dark', () => {
            localStorage.setItem(storage_keys_ts_1.DEFAULT_STORAGE_KEY, 'dark');
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s.pref).toBe('dark');
            (0, vitest_1.expect)(s.resolvedTheme).toBe('default-dark');
            (0, vitest_1.expect)(s.activeTheme).toBe('default-dark');
        });
        (0, vitest_1.it)('resolves auto + system dark MQ → dark', () => {
            mockMatchMedia('dark');
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s.pref).toBe('auto');
            (0, vitest_1.expect)(s.resolvedTheme).toBe('default-dark');
        });
        (0, vitest_1.it)('resolves auto + system light MQ → light', () => {
            mockMatchMedia('light');
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s.pref).toBe('auto');
            (0, vitest_1.expect)(s.resolvedTheme).toBe('default-light');
        });
        (0, vitest_1.it)('treats garbage pref as auto', () => {
            localStorage.setItem(storage_keys_ts_1.DEFAULT_STORAGE_KEY, 'midnight');
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s.pref).toBe('auto');
        });
        (0, vitest_1.it)('respects custom brand', () => {
            const s = (0, controller_ts_1.readInitialThemeState)({ brand: 'acme' });
            (0, vitest_1.expect)(s.brand).toBe('acme');
            (0, vitest_1.expect)(s.resolvedTheme).toBe('acme-dark');
        });
        (0, vitest_1.it)('override wins over resolved theme for activeTheme; resolved stays', () => {
            localStorage.setItem(storage_keys_ts_1.DEFAULT_STORAGE_KEY, 'dark');
            localStorage.setItem(storage_keys_ts_1.DEFAULT_OVERRIDE_STORAGE_KEY, 'ai-ocean');
            const s = (0, controller_ts_1.readInitialThemeState)();
            (0, vitest_1.expect)(s.resolvedTheme).toBe('default-dark');
            (0, vitest_1.expect)(s.override).toBe('ai-ocean');
            (0, vitest_1.expect)(s.activeTheme).toBe('ai-ocean');
        });
        (0, vitest_1.it)('reads override from injected storage adapter, not localStorage', () => {
            const override = (0, storage_ts_1.memoryStorage)();
            override.set(storage_keys_ts_1.DEFAULT_OVERRIDE_STORAGE_KEY, 'from-memory');
            localStorage.setItem(storage_keys_ts_1.DEFAULT_OVERRIDE_STORAGE_KEY, 'from-localstorage');
            const s = (0, controller_ts_1.readInitialThemeState)({ overrideStorage: override });
            (0, vitest_1.expect)(s.override).toBe('from-memory');
            (0, vitest_1.expect)(s.activeTheme).toBe('from-memory');
        });
        (0, vitest_1.it)('honours custom storage keys', () => {
            localStorage.setItem('my-pref', 'dark');
            localStorage.setItem('my-override', 'pinned');
            const s = (0, controller_ts_1.readInitialThemeState)({
                storageKey: 'my-pref',
                overrideStorageKey: 'my-override',
            });
            (0, vitest_1.expect)(s.pref).toBe('dark');
            (0, vitest_1.expect)(s.override).toBe('pinned');
        });
        (0, vitest_1.it)('SSR fallback: returns defaults when window is undefined', () => {
            const w = globalThis.window;
            // @ts-expect-error — simulating SSR
            delete globalThis.window;
            try {
                const s = (0, controller_ts_1.readInitialThemeState)({ brand: 'acme' });
                (0, vitest_1.expect)(s).toEqual({
                    pref: 'auto',
                    brand: 'acme',
                    resolvedTheme: 'acme-dark',
                    override: null,
                    activeTheme: 'acme-dark',
                });
            }
            finally {
                globalThis.window = w;
            }
        });
        (0, vitest_1.it)('does not throw when localStorage.getItem throws (Safari Private Mode)', () => {
            const original = Storage.prototype.getItem;
            Storage.prototype.getItem = () => {
                throw new Error('SecurityError');
            };
            try {
                const s = (0, controller_ts_1.readInitialThemeState)();
                (0, vitest_1.expect)(s.pref).toBe('auto');
                (0, vitest_1.expect)(s.resolvedTheme).toBe('default-dark');
            }
            finally {
                Storage.prototype.getItem = original;
            }
        });
        (0, vitest_1.it)('does not throw when matchMedia is absent (partial DOM)', () => {
            const original = window.matchMedia;
            // @ts-expect-error — simulating partial DOM where matchMedia is missing
            window.matchMedia = undefined;
            try {
                const s = (0, controller_ts_1.readInitialThemeState)();
                (0, vitest_1.expect)(s.pref).toBe('auto');
                // matchMedia missing → fall through to package default (dark)
                (0, vitest_1.expect)(s.resolvedTheme).toBe('default-dark');
            }
            finally {
                window.matchMedia = original;
            }
        });
    });
});
//# sourceMappingURL=controller.test.js.map