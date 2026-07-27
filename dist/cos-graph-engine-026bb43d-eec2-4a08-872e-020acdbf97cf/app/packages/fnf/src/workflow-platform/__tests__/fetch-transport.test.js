"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fetch_transport_1 = require("../fetch-transport");
function fakeFetch(status, body) {
    const calls = [];
    const fn = vitest_1.vi.fn(async (url, init) => {
        calls.push({ url, init });
        return {
            status,
            text: async () => (body === undefined ? '' : JSON.stringify(body)),
        };
    });
    return { fn: fn, calls };
}
(0, vitest_1.describe)('createFetchTransport', () => {
    (0, vitest_1.it)('trims the base url, JSON-encodes the body, and parses the JSON response', async () => {
        const { fn, calls } = fakeFetch(200, { id: 'job-1', status: 'queued' });
        const transport = (0, fetch_transport_1.createFetchTransport)({ baseUrl: 'https://dev-fnf.higgsfield.ai/', fetch: fn });
        const res = await transport({ method: 'POST', path: '/mcp/jobs', body: { a: 1 } });
        (0, vitest_1.expect)(calls[0].url).toBe('https://dev-fnf.higgsfield.ai/mcp/jobs');
        (0, vitest_1.expect)(calls[0].init.method).toBe('POST');
        (0, vitest_1.expect)(calls[0].init.body).toBe('{"a":1}');
        (0, vitest_1.expect)(calls[0].init.headers.get('content-type')).toBe('application/json');
        (0, vitest_1.expect)(res).toEqual({ status: 200, body: { id: 'job-1', status: 'queued' } });
    });
    (0, vitest_1.it)('applies injected auth headers (function form) to every request', async () => {
        const { fn, calls } = fakeFetch(200, {});
        const transport = (0, fetch_transport_1.createFetchTransport)({
            baseUrl: 'https://dev-fnf.higgsfield.ai',
            headers: () => ({ 'fnf-mcp-secret': 's3cr3t' }),
            fetch: fn,
        });
        await transport({ method: 'GET', path: '/mcp/jobs/x' });
        (0, vitest_1.expect)(calls[0].init.headers.get('fnf-mcp-secret')).toBe('s3cr3t');
    });
    (0, vitest_1.it)('merges headers case-insensitively: a lowercase content-type override replaces the default', async () => {
        const { fn, calls } = fakeFetch(200, {});
        const transport = (0, fetch_transport_1.createFetchTransport)({
            baseUrl: 'https://x',
            headers: { 'content-type': 'application/vnd.custom+json' },
            fetch: fn,
        });
        await transport({ method: 'POST', path: '/y', body: {} });
        (0, vitest_1.expect)(calls[0].init.headers.get('content-type')).toBe('application/vnd.custom+json');
    });
    (0, vitest_1.it)('passes the PUT method through verbatim (job cancel rides it)', async () => {
        const { fn, calls } = fakeFetch(200, { success: true });
        const transport = (0, fetch_transport_1.createFetchTransport)({ baseUrl: 'https://x', fetch: fn });
        const res = await transport({ method: 'PUT', path: '/jobs/j1/cancel' });
        (0, vitest_1.expect)(calls[0].init.method).toBe('PUT');
        (0, vitest_1.expect)(res).toEqual({ status: 200, body: { success: true } });
    });
    (0, vitest_1.it)('returns the raw text body when the response is not JSON', async () => {
        const { fn } = fakeFetch(502, undefined);
        const transport = (0, fetch_transport_1.createFetchTransport)({ baseUrl: 'https://x', fetch: fn });
        const res = await transport({ method: 'GET', path: '/health' });
        (0, vitest_1.expect)(res.status).toBe(502);
        (0, vitest_1.expect)(res.body).toBeUndefined();
    });
});
//# sourceMappingURL=fetch-transport.test.js.map