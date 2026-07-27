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
import type { ThemeStorage } from './storage.ts';
export type ThemePref = 'auto' | 'light' | 'dark';
export interface ThemeControllerOptions {
    brand?: string;
    /** localStorage key for the user's mode pref. Default: 'hf:quanta:theme-pref'. */
    storageKey?: string;
    /** Storage key for the pinned override. Default: 'hf:quanta:theme-override'. */
    overrideStorageKey?: string;
    /**
     * Storage backend for the override pin. Default: `localStorageAdapter`.
     * Try `urlAdapter()` for shareable theme links, `sessionStorageAdapter`
     * for per-tab overrides, or any custom `ThemeStorage`.
     */
    overrideStorage?: ThemeStorage;
    /**
     * Read/write override from storage so the pinned theme survives reload.
     * Default: true. Set false for purely ephemeral overrides (A/B testing,
     * preview sessions).
     */
    persistOverride?: boolean;
    /**
     * Storage backend used when `hydrateThemes` calls `hydratePersistedThemes`
     * on construct. Should match the `storage` you pass to `defineTheme`.
     * Default: `localStorageAdapter`.
     */
    themesStorage?: ThemeStorage;
    /**
     * On construct, call `hydratePersistedThemes()` so persisted runtime-theme
     * <style> tags are re-injected before the first apply. Default: true.
     * Set false if you call hydrate manually elsewhere.
     */
    hydrateThemes?: boolean;
    /**
     * CSP nonce for runtime <style> tags injected while hydrating persisted
     * themes. Pass the same nonce your framework puts on the bootstrap script.
     */
    styleNonce?: string;
}
export interface ThemeState {
    /** User's mode preference. Survives override. */
    pref: ThemePref;
    /** Current brand string. Survives override. */
    brand: string;
    /** Theme that would apply from brand+pref alone. May differ from activeTheme. */
    resolvedTheme: string;
    /** Active override value, or null if no override is pinned. */
    override: string | null;
    /** Value actually applied to `data-theme` on `<html>`. = override ?? resolvedTheme. */
    activeTheme: string;
}
export type ThemeSubscriber = (state: ThemeState) => void;
export interface ReadInitialThemeStateOptions {
    brand?: string;
    /** localStorage key for the user's mode pref. Default: 'hf:quanta:theme-pref'. */
    storageKey?: string;
    /** Storage key for the pinned override. Default: 'hf:quanta:theme-override'. */
    overrideStorageKey?: string;
    /**
     * Storage backend for the override pin. Default: `localStorageAdapter`.
     * Must match the backend you pass to `ThemeController`.
     */
    overrideStorage?: ThemeStorage;
}
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
export declare function readInitialThemeState({ brand, storageKey, overrideStorageKey, overrideStorage, }?: ReadInitialThemeStateOptions): ThemeState;
export declare class ThemeController {
    #private;
    constructor({ brand, storageKey, overrideStorageKey, overrideStorage, persistOverride, themesStorage, hydrateThemes, styleNonce, }?: ThemeControllerOptions);
    setPref(pref: ThemePref): void;
    getPref(): ThemePref;
    setBrand(brand: string): void;
    getBrand(): string;
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
    setOverride(theme: string | null): void;
    getOverride(): string | null;
    subscribe(callback: ThemeSubscriber): () => void;
    destroy(): void;
}
//# sourceMappingURL=controller.d.ts.map