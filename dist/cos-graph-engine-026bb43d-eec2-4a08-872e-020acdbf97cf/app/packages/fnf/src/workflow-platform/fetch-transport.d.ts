import type { FnfObservabilityOptions } from '../observability';
import type { Transport } from '../transport';
type MaybePromise<T> = T | Promise<T>;
export interface FetchTransportOptions {
    /** Backend origin, e.g. "https://dev-fnf.higgsfield.ai". Trailing slash is trimmed. */
    baseUrl: string;
    /**
     * Static or lazily-resolved headers applied to every request (e.g. auth).
     * A function form supports async sources (rotating secrets, async storage).
     */
    headers?: Record<string, string> | (() => MaybePromise<Record<string, string>>);
    /** Override the fetch implementation (defaults to global fetch). */
    fetch?: typeof globalThis.fetch;
    observability?: FnfObservabilityOptions;
}
/**
 * Isomorphic Transport over the Fetch API. JSON in, JSON out. Works in Node,
 * the browser, and plugin webviews (Figma) that expose a global fetch. Adobe
 * UXP, which forbids direct fetch from the webview, needs a Comlink adapter
 * instead — this transport is the reference for the fetch-capable environments.
 */
export declare function createFetchTransport(options: FetchTransportOptions): Transport;
export {};
//# sourceMappingURL=fetch-transport.d.ts.map