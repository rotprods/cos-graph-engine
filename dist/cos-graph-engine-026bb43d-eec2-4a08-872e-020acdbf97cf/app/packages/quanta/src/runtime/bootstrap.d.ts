/**
 * Anti-FOUC snippet generator — opinionated recipe implementation.
 *
 * Generates an inline <head> script that sets data-theme before first
 * paint. Used in SSR frameworks (Next.js, Astro, SvelteKit) via
 * dangerouslySetInnerHTML or is:inline.
 *
 * What the script does, in order:
 *   1. Reads persisted runtime themes from localStorage and injects
 *      <style> tags before paint — otherwise an override pinned to
 *      "ai-ocean" would apply before :where([data-theme="ai-ocean"])
 *      exists in the DOM.
 *   2. Reads the pinned override (if any) and applies it.
 *   3. If no override is set, resolves the managed theme from pref +
 *      prefers-color-scheme.
 *
 * Usage (Next.js):
 *   import { bootstrapScript } from "@higgsfield/quanta/runtime";
 *
 *   <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootstrapScript() }} />
 *
 * Usage (Astro):
 *   <script is:inline set:html={bootstrapScript()} />
 */
export interface BootstrapOptions {
    brand?: string;
    /** localStorage key for the user's mode pref. Default 'hf:quanta:theme-pref'. */
    storageKey?: string;
    /** localStorage key for the pinned override. Default 'hf:quanta:theme-override'. */
    overrideStorageKey?: string;
    /** localStorage key for the runtime themes map. Default 'hf:quanta:runtime-themes'. */
    themesStorageKey?: string;
}
export declare function bootstrapScript({ brand, storageKey, overrideStorageKey, themesStorageKey, }?: BootstrapOptions): string;
//# sourceMappingURL=bootstrap.d.ts.map