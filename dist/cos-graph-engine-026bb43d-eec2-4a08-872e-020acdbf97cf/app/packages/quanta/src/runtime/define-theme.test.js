"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const define_theme_ts_1 = require("./define-theme.ts");
const storage_keys_ts_1 = require("./storage-keys.ts");
const storage_ts_1 = require("./storage.ts");
(0, vitest_1.afterEach)(() => {
    for (const name of (0, define_theme_ts_1.listThemes)())
        (0, define_theme_ts_1.removeTheme)(name);
});
(0, vitest_1.describe)('defineTheme — injection guard', () => {
    (0, vitest_1.it)('injects a :where block for valid tokens (the happy path still works)', () => {
        (0, define_theme_ts_1.defineTheme)('ai-ocean', {
            'surface-default': '#0c2461',
            'text-primary': 'oklch(0.92 0.02 240)',
            'brand-primary': 'var(--hf-color-fallback, #fbbf24)',
            'glow': 'linear-gradient(90deg, #000 0%, #fff 100%)',
        }, { persist: false });
        const tag = document.getElementById('hf-runtime-theme-ai-ocean');
        (0, vitest_1.expect)(tag?.textContent).toContain(':where([data-theme="ai-ocean"])');
        (0, vitest_1.expect)(tag?.textContent).toContain('--hf-color-glow: linear-gradient(90deg, #000 0%, #fff 100%);');
    });
    vitest_1.it.each([
        ['a `}` in a value escapes the block', { 'surface-default': '#fff} body{background:url(//evil)' }],
        ['a `;` in a value smuggles a sibling declaration', { 'surface-default': 'red; background-image: url(//evil)' }],
        ['a control character in a value', { 'surface-default': 'red\u0000' }],
    ])('rejects %s', (_label, tokens) => {
        (0, vitest_1.expect)(() => (0, define_theme_ts_1.defineTheme)('attack', tokens, { persist: false })).toThrowError(/invalid value/);
        (0, vitest_1.expect)(document.getElementById('hf-runtime-theme-attack')).toBeNull();
        (0, vitest_1.expect)((0, define_theme_ts_1.hasTheme)('attack')).toBe(false);
    });
    (0, vitest_1.it)('rejects a token key that is not slug-shaped', () => {
        (0, vitest_1.expect)(() => (0, define_theme_ts_1.defineTheme)('t', { 'a:red;b': '#fff' }, { persist: false })).toThrowError(/invalid token key/);
    });
    (0, vitest_1.it)('rejects a theme name that would escape the attribute selector', () => {
        (0, vitest_1.expect)(() => (0, define_theme_ts_1.defineTheme)('x"]{}', { a: '#fff' }, { persist: false })).toThrowError(/invalid theme name/);
    });
    (0, vitest_1.it)('a bad redefinition does NOT destroy the valid theme it tried to replace', () => {
        (0, define_theme_ts_1.defineTheme)('keeper', { a: '#fff' }, { persist: false });
        (0, vitest_1.expect)(() => (0, define_theme_ts_1.defineTheme)('keeper', { a: 'bad}' }, { persist: false })).toThrowError(/invalid value/);
        (0, vitest_1.expect)((0, define_theme_ts_1.hasTheme)('keeper')).toBe(true);
        (0, vitest_1.expect)(document.getElementById('hf-runtime-theme-keeper')).not.toBeNull();
    });
    (0, vitest_1.it)('a bad value never reaches persistence', () => {
        const storage = (0, storage_ts_1.memoryStorage)();
        (0, vitest_1.expect)(() => (0, define_theme_ts_1.defineTheme)('t', { a: 'bad}' }, { storage })).toThrowError(/invalid value/);
        (0, vitest_1.expect)(storage.get(storage_keys_ts_1.DEFAULT_THEMES_STORAGE_KEY)).toBeNull();
    });
});
(0, vitest_1.describe)('hydratePersistedThemes — poisoned storage', () => {
    (0, vitest_1.it)('skips an entry someone wrote past the guard, hydrates the rest', () => {
        const storage = (0, storage_ts_1.memoryStorage)();
        storage.set(storage_keys_ts_1.DEFAULT_THEMES_STORAGE_KEY, JSON.stringify({
            'evil': { a: '#fff} body{display:none' }, // written to storage directly
            'fine': { a: '#fff' },
        }));
        (0, define_theme_ts_1.hydratePersistedThemes)({ storage });
        (0, vitest_1.expect)(document.getElementById('hf-runtime-theme-evil')).toBeNull();
        (0, vitest_1.expect)(document.getElementById('hf-runtime-theme-fine')).not.toBeNull();
    });
});
//# sourceMappingURL=define-theme.test.js.map