/**
 * Runtime theme injection — opinionated recipe implementation.
 *
 * Injects a <style> tag with a :where([data-theme="<name>"]) block,
 * populating --hf-color-* storage. Tailwind utilities pick up the values
 * via the @theme inline alias in tailwind.css.
 *
 * Activate via the ThemeController escape hatch (`controller.setOverride(name)`).
 * The controller pins data-theme to this name and preserves pref/brand so
 * clearing the override restores the managed theme.
 *
 * Usage:
 *   defineTheme("ai-ocean", {
 *     "surface-default":  "#0c2461",
 *     "text-primary":     "#dbeafe",
 *     "brand-primary":    "#fbbf24",
 *   });
 *   controller.setOverride("ai-ocean");
 *
 *   // later
 *   controller.setOverride(null);
 *   removeTheme("ai-ocean");
 *
 * Persistence:
 *   defineTheme writes tokens to `storage` (localStorage by default).
 *   After reload, calling `hydratePersistedThemes()` (or a ThemeController
 *   with `hydrateThemes: true`, the default) re-injects the <style> tags
 *   before the controller applies data-theme. Disable persistence with
 *   `defineTheme(name, tokens, { persist: false })` — an ephemeral theme.
 *   Switch the backend with
 *   `defineTheme(name, tokens, { storage: sessionStorageAdapter })`.
 *   In strict CSP environments, pass `{ styleNonce }` for injected <style>
 *   tags created after hydration.
 *
 * Without ThemeController you can set it manually:
 * `document.documentElement.dataset.theme = "ai-ocean"` — but then the
 * controller doesn't know about the change and subscribers won't fire.
 */
import type { ThemeStorage } from './storage.ts';
export type ThemeTokens = Record<string, string>;
export interface DefineThemeOptions {
    /**
     * Write tokens to storage so the theme survives reload.
     * Default: true. Pass `false` for ephemeral / A-B-test overlays.
     */
    persist?: boolean;
    /**
     * Storage backend for persisted tokens. Default: `localStorageAdapter`.
     * Use `sessionStorageAdapter` for per-tab themes, `memoryStorage()` for
     * SSR/tests, or any custom `ThemeStorage`. (URL not recommended for
     * tokens — JSON maps are too large for URLs.)
     */
    storage?: ThemeStorage;
    /** CSP nonce for the runtime <style> tag injected into document.head. */
    styleNonce?: string;
}
export interface HydrateOptions {
    /** Storage to read persisted themes from. Default: `localStorageAdapter`. */
    storage?: ThemeStorage;
    /** CSP nonce for the runtime <style> tags injected into document.head. */
    styleNonce?: string;
}
export interface RemoveThemeOptions {
    /** Storage to also remove persisted tokens from. Default: `localStorageAdapter`. */
    storage?: ThemeStorage;
}
export declare function defineTheme(name: string, tokens: ThemeTokens, options?: DefineThemeOptions): void;
export declare function removeTheme(name: string, options?: RemoveThemeOptions): void;
export declare function listThemes(): string[];
export declare function hasTheme(name: string): boolean;
/**
 * Re-inject persisted runtime themes from storage. Idempotent — skips
 * names that already have a <style> tag in the DOM. Call before applying
 * an override that targets a persisted theme; otherwise the cascade has
 * no matching block and the page flashes unstyled.
 *
 * ThemeController calls this automatically on construct (opt out via
 * `hydrateThemes: false`).
 */
export declare function hydratePersistedThemes(options?: HydrateOptions): void;
//# sourceMappingURL=define-theme.d.ts.map