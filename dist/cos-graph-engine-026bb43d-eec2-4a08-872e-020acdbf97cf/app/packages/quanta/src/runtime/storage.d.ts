/**
 * Storage adapters for runtime theme persistence.
 *
 * `defineTheme` (tokens map) and `ThemeController.setOverride` (pinned
 * theme name) can each be pointed at any storage backend implementing
 * the `ThemeStorage` interface — localStorage, sessionStorage, URL
 * search params, or a custom adapter.
 *
 * Recommended pairings:
 *   - localStorageAdapter — default; cross-tab, cross-reload (typical)
 *   - sessionStorageAdapter — per-tab themes (different theme per tab)
 *   - urlAdapter() — for the override name only; produces shareable
 *     "look-at-this-theme" links. Don't use for tokens map (too big for URL).
 *   - memoryStorage() — for SSR / tests; lives only in this process.
 *
 * The `pref` and `brand` storage (managed-mode user preferences) remain
 * on `localStorage` and are not pluggable — those are conceptually
 * device-bound user settings, not theme content.
 */
export interface ThemeStorage {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
}
export declare const localStorageAdapter: ThemeStorage;
export declare const sessionStorageAdapter: ThemeStorage;
export interface UrlAdapterOptions {
    /**
     * Which part of the URL to use for storage. `search` → ?key=value
     * (visible in URL bar, shareable). `hash` → #key=value (client-only,
     * not sent to server). Default: 'search'.
     */
    mode?: 'search' | 'hash';
}
/**
 * URL search-param or hash storage. Best for the override NAME only
 * — token JSON maps are too large for URLs in practice. Use case:
 * shareable theme links ("send your friend a link with `?theme=ai-ocean`").
 *
 * Writes use `history.replaceState` — no navigation, no scroll jump.
 */
export declare function urlAdapter({ mode }?: UrlAdapterOptions): ThemeStorage;
/**
 * In-memory storage. Lives only in the current JS process — never
 * survives reload. Useful for SSR (no window) and tests.
 */
export declare function memoryStorage(): ThemeStorage;
//# sourceMappingURL=storage.d.ts.map