"use strict";
/**
 * ThemeController — runtime that manages the `data-theme` attribute.
 *
 * Methods are split cleanly across two domains:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Managed — quanta's built-in themes (`{brand}-{mode}` contract)   │
 *   │   setPref / getPref     — user preference: auto | light | dark   │
 *   │   setBrand / getBrand   — brand string (quanta ships "default")  │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Escape hatch — for themes quanta doesn't know about              │
 *   │   setOverride(name)     — pin any `data-theme` value             │
 *   │   setOverride(null)     — unpin, return to managed mode          │
 *   │   getOverride()         — current pinned value (null if none)    │
 *   │                                                                  │
 *   │ Use cases:                                                       │
 *   │   - a theme from defineTheme() ("ai-ocean", AI-generated)        │
 *   │   - consumer-side brands not built into quanta CSS               │
 *   │   - preview / A/B testing of themes                              │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Contract between the two domains:
 *   - `setOverride()` pins the DOM to any value. pref/brand state is
 *     **preserved** — after `setOverride(null)` the resolved theme returns.
 *   - `setPref()` / `setBrand()` update internal state while an override is
 *     active but do not touch the DOM (override wins).
 *   - System theme changes (`prefers-color-scheme`) apply only when
 *     pref="auto" AND no override is pinned.
 *
 * Read access to state is via `subscribe`. The callback receives the full
 * `ThemeState` (pref, brand, resolvedTheme, override, activeTheme) and is
 * invoked immediately with the current state on subscription.
 *
 * Usage:
 *   const controller = new ThemeController({ brand: "default" });
 *   controller.setPref("dark");
 *   controller.subscribe(state => render(state));
 *
 *   // dynamic theme escape hatch
 *   defineTheme("ai-ocean", {...});
 *   controller.setOverride("ai-ocean");
 *   // ... later
 *   controller.setOverride(null);
 *
 *   // SPA teardown
 *   controller.destroy();
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeController = void 0;
exports.readInitialThemeState = readInitialThemeState;
const define_theme_ts_1 = require("./define-theme.ts");
const storage_keys_ts_1 = require("./storage-keys.ts");
const storage_ts_1 = require("./storage.ts");
const VALID_PREFS = ['auto', 'light', 'dark'];
/**
 * Compute the same ThemeState that `new ThemeController()` would expose on
 * first `subscribe()`, but without any side effects — no listeners, no DOM
 * mutation. Designed for React `useState(() => readInitialThemeState(...))`
 * so the first render has the correct pref/override and we avoid a flash of
 * wrong UI state before the effect-bound controller fires its first update.
 *
 * Browser-only — reads localStorage and matchMedia. On the server, or when
 * either API throws (Safari Private Mode, locked-down iframes, partial DOM
 * environments), falls back to documented defaults instead of crashing the
 * first render. React `useState` lazy init bubbles exceptions to the
 * nearest error boundary, so we must never throw here.
 */
function readInitialThemeState({ brand = 'default', storageKey = storage_keys_ts_1.DEFAULT_STORAGE_KEY, overrideStorageKey = storage_keys_ts_1.DEFAULT_OVERRIDE_STORAGE_KEY, overrideStorage = storage_ts_1.localStorageAdapter, } = {}) {
    if (typeof window === 'undefined') {
        const resolvedTheme = `${brand}-dark`;
        return { pref: 'auto', brand, resolvedTheme, override: null, activeTheme: resolvedTheme };
    }
    let storedPref = null;
    try {
        storedPref = localStorage.getItem(storageKey);
    }
    catch {
        // privacy mode / SecurityError — fall through to 'auto'
    }
    const pref = VALID_PREFS.includes(storedPref)
        ? storedPref
        : 'auto';
    const override = overrideStorage.get(overrideStorageKey);
    // Package default is DARK. For pref='auto' we resolve to light ONLY when the
    // OS explicitly signals a light preference; any other signal (dark, none,
    // matchMedia missing) resolves to dark.
    let lightSystem = false;
    if (pref === 'auto') {
        try {
            lightSystem = matchMedia('(prefers-color-scheme: light)').matches;
        }
        catch {
            // matchMedia absent (partial DOM, jsdom edge cases) — fall through to dark
        }
    }
    const mode = pref === 'auto' ? (lightSystem ? 'light' : 'dark') : pref;
    const resolvedTheme = `${brand}-${mode}`;
    return { pref, brand, resolvedTheme, override, activeTheme: override ?? resolvedTheme };
}
class ThemeController {
    #brand;
    #storageKey;
    #overrideStorageKey;
    #overrideStorage;
    #persistOverride;
    #override = null;
    #mq;
    #onSystemChange;
    #subscribers = new Set();
    constructor({ brand = 'default', storageKey = storage_keys_ts_1.DEFAULT_STORAGE_KEY, overrideStorageKey = storage_keys_ts_1.DEFAULT_OVERRIDE_STORAGE_KEY, overrideStorage = storage_ts_1.localStorageAdapter, persistOverride = true, themesStorage = storage_ts_1.localStorageAdapter, hydrateThemes = true, styleNonce, } = {}) {
        this.#brand = brand;
        this.#storageKey = storageKey;
        this.#overrideStorageKey = overrideStorageKey;
        this.#overrideStorage = overrideStorage;
        this.#persistOverride = persistOverride;
        this.#mq = matchMedia('(prefers-color-scheme: dark)');
        // Re-inject persisted runtime-theme <style> tags BEFORE reading the
        // override — otherwise an override pointing at "ai-ocean" would apply
        // before its CSS block is in the DOM, causing an unstyled flash.
        if (hydrateThemes)
            (0, define_theme_ts_1.hydratePersistedThemes)({ storage: themesStorage, styleNonce });
        if (this.#persistOverride) {
            const stored = this.#overrideStorage.get(this.#overrideStorageKey);
            if (stored)
                this.#override = stored;
        }
        this.#onSystemChange = () => {
            // System change matters only if managed-mode is driving the DOM
            // (pref="auto" and no override pinning).
            if (this.#override === null && this.#readPref() === 'auto')
                this.#apply();
        };
        this.#mq.addEventListener('change', this.#onSystemChange);
        this.#apply();
    }
    // ────────────────────────────────────────────────────────────────────
    // Internal
    // ────────────────────────────────────────────────────────────────────
    #readPref() {
        const stored = localStorage.getItem(this.#storageKey);
        return VALID_PREFS.includes(stored) ? stored : 'auto';
    }
    #resolveTheme(pref) {
        if (pref !== 'auto')
            return `${this.#brand}-${pref}`;
        // Package default is DARK. We resolve auto → light only when the OS
        // explicitly prefers light; any other signal (dark, none) → dark.
        const lightSystem = matchMedia('(prefers-color-scheme: light)').matches;
        return `${this.#brand}-${lightSystem ? 'light' : 'dark'}`;
    }
    #computeState() {
        const pref = this.#readPref();
        const resolvedTheme = this.#resolveTheme(pref);
        const activeTheme = this.#override ?? resolvedTheme;
        return {
            pref,
            brand: this.#brand,
            resolvedTheme,
            override: this.#override,
            activeTheme,
        };
    }
    #apply() {
        const state = this.#computeState();
        document.documentElement.dataset.theme = state.activeTheme;
        this.#subscribers.forEach(cb => cb(state));
    }
    // ────────────────────────────────────────────────────────────────────
    // Managed — built-in themes ({brand}-{mode} contract)
    // ────────────────────────────────────────────────────────────────────
    setPref(pref) {
        if (!VALID_PREFS.includes(pref)) {
            throw new Error(`setPref: invalid pref "${pref}". Expected one of: ${VALID_PREFS.join(', ')}.`);
        }
        localStorage.setItem(this.#storageKey, pref);
        this.#apply();
    }
    getPref() {
        return this.#readPref();
    }
    setBrand(brand) {
        if (typeof brand !== 'string' || !brand) {
            throw new Error('setBrand: brand must be a non-empty string.');
        }
        this.#brand = brand;
        this.#apply();
    }
    getBrand() {
        return this.#brand;
    }
    // ────────────────────────────────────────────────────────────────────
    // Escape hatch — opaque-to-quanta theme value
    // ────────────────────────────────────────────────────────────────────
    /**
     * Pin `data-theme` to any string. Bypasses brand+pref resolution.
     * Pass `null` to clear and resume managed resolution.
     *
     * Use for:
     *   - dynamic themes defined via `defineTheme()` (e.g. "ai-ocean")
     *   - consumer-side brand themes not built into quanta
     *   - preview / A/B-test themes
     *
     * pref and brand state are preserved while an override is active.
     */
    setOverride(theme) {
        if (theme !== null && (typeof theme !== 'string' || !theme)) {
            throw new Error('setOverride: expected non-empty string or null.');
        }
        if (this.#override === theme)
            return;
        this.#override = theme;
        if (this.#persistOverride) {
            if (theme === null)
                this.#overrideStorage.remove(this.#overrideStorageKey);
            else
                this.#overrideStorage.set(this.#overrideStorageKey, theme);
        }
        this.#apply();
    }
    getOverride() {
        return this.#override;
    }
    // ────────────────────────────────────────────────────────────────────
    // Subscription / lifecycle
    // ────────────────────────────────────────────────────────────────────
    subscribe(callback) {
        this.#subscribers.add(callback);
        callback(this.#computeState());
        return () => this.#subscribers.delete(callback);
    }
    destroy() {
        this.#mq.removeEventListener('change', this.#onSystemChange);
        this.#subscribers.clear();
    }
}
exports.ThemeController = ThemeController;
//# sourceMappingURL=controller.js.map