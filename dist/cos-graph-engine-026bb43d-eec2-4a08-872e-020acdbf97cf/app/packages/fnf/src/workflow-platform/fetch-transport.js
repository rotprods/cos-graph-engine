"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFetchTransport = createFetchTransport;
const observability_1 = require("../observability");
/**
 * Isomorphic Transport over the Fetch API. JSON in, JSON out. Works in Node,
 * the browser, and plugin webviews (Figma) that expose a global fetch. Adobe
 * UXP, which forbids direct fetch from the webview, needs a Comlink adapter
 * instead — this transport is the reference for the fetch-capable environments.
 */
function createFetchTransport(options) {
    const base = options.baseUrl.replace(/\/$/, '');
    const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    const transport = async (req) => {
        const injected = typeof options.headers === 'function' ? await options.headers() : options.headers ?? {};
        // Headers.set replaces case-insensitively — a consumer passing lowercase
        // 'content-type' overrides the default instead of producing a combined,
        // invalid header (which a plain object spread would).
        const headers = new Headers({ 'Content-Type': 'application/json' });
        for (const [key, value] of Object.entries(injected))
            headers.set(key, value);
        for (const [key, value] of Object.entries(req.headers ?? {}))
            headers.set(key, value);
        const res = await doFetch(base + req.path, {
            method: req.method,
            headers,
            body: req.body === undefined ? undefined : JSON.stringify(req.body),
            signal: req.signal,
        });
        const text = await res.text();
        let body;
        try {
            body = text.length > 0 ? JSON.parse(text) : undefined;
        }
        catch {
            body = text;
        }
        return { status: res.status, body };
    };
    return options.observability ? (0, observability_1.withObservedTransport)(transport, options.observability) : transport;
}
//# sourceMappingURL=fetch-transport.js.map