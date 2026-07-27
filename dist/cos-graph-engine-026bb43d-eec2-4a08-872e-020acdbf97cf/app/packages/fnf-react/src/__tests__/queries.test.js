"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_query_1 = require("@tanstack/react-query");
const vitest_1 = require("vitest");
const generation_query_1 = require("../generation-query");
const job_set_query_1 = require("../job-set-query");
const jobs_feed_query_1 = require("../jobs-feed-query");
const keys_1 = require("../keys");
function gen(id, status, extra) {
    return { id, model: 'demo', type: 'image', status, input: { model: 'demo', settings: {} }, ...extra };
}
/** Evaluate a refetchInterval/staleTime function the way the query core does. */
function evalWith(fn, data) {
    return fn({ state: { data } });
}
(0, vitest_1.describe)('generationQueryOptions', () => {
    (0, vitest_1.it)('keeps old unscoped key shapes and adds scoped variants additively', () => {
        (0, vitest_1.expect)(keys_1.fnfKeys.job('g1')).toEqual(['fnf', 'job', 'g1']);
        (0, vitest_1.expect)(keys_1.fnfKeys.jobSet('set-1')).toEqual(['fnf', 'job-set', 'set-1']);
        (0, vitest_1.expect)(keys_1.fnfKeys.jobs({ type: 'video' })).toEqual(['fnf', 'jobs', { type: 'video' }]);
        (0, vitest_1.expect)(keys_1.fnfKeys.job('g1', { scopeKey: 'u:w' })).toEqual(['fnf', 'scope', 'u:w', 'job', 'g1']);
        (0, vitest_1.expect)(keys_1.fnfKeys.jobSet('set-1', { scopeKey: 'u:w' })).toEqual(['fnf', 'scope', 'u:w', 'job-set', 'set-1']);
        (0, vitest_1.expect)(keys_1.fnfKeys.jobs({ type: 'video' }, { scopeKey: 'u:w' })).toEqual(['fnf', 'scope', 'u:w', 'jobs', { type: 'video' }]);
    });
    (0, vitest_1.it)('fetches through the client into the contract key', async () => {
        const qc = new react_query_1.QueryClient();
        const data = await qc.fetchQuery((0, generation_query_1.generationQueryOptions)({ get: async (id) => gen(id, 'completed') }, 'g1'));
        (0, vitest_1.expect)(data.id).toBe('g1');
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('g1'))).toBe(data);
    });
    (0, vitest_1.it)('polls at the 5s product cadence while pending, stops at terminal', () => {
        const opts = (0, generation_query_1.generationQueryOptions)({ get: async (id) => gen(id, 'queued') }, 'g1');
        (0, vitest_1.expect)(evalWith(opts.refetchInterval, undefined)).toBe(5000); // nothing known yet — keep asking
        (0, vitest_1.expect)(evalWith(opts.refetchInterval, gen('g1', 'in_progress'))).toBe(5000);
        (0, vitest_1.expect)(evalWith(opts.refetchInterval, gen('g1', 'completed'))).toBe(false);
        (0, vitest_1.expect)(evalWith(opts.staleTime, gen('g1', 'completed'))).toBe(Number.POSITIVE_INFINITY); // settled = immutable
        (0, vitest_1.expect)(evalWith(opts.staleTime, gen('g1', 'queued'))).toBe(0);
    });
    (0, vitest_1.it)('the cadence is a default, not a law: intervalMs overrides, false disables', () => {
        const client = { get: async (id) => gen(id, 'queued') };
        const custom = (0, generation_query_1.generationQueryOptions)(client, 'g1', { intervalMs: 1000 });
        (0, vitest_1.expect)(evalWith(custom.refetchInterval, gen('g1', 'queued'))).toBe(1000);
        (0, vitest_1.expect)(evalWith(custom.refetchInterval, gen('g1', 'completed'))).toBe(false); // stop-at-terminal survives the override
        const off = (0, generation_query_1.generationQueryOptions)(client, 'g1', { intervalMs: false });
        (0, vitest_1.expect)(evalWith(off.refetchInterval, gen('g1', 'queued'))).toBe(false);
    });
    (0, vitest_1.it)('uses scoped keys when provided', async () => {
        const qc = new react_query_1.QueryClient();
        const data = await qc.fetchQuery((0, generation_query_1.generationQueryOptions)({ get: async (id) => gen(id, 'completed') }, 'g1', { scopeKey: 'u:w' }));
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('g1'))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('g1', { scopeKey: 'u:w' }))).toBe(data);
    });
});
(0, vitest_1.describe)('jobSetQueryOptions', () => {
    (0, vitest_1.it)('one request per tick for the whole batch; stops when EVERY member settles', async () => {
        let reads = 0;
        const client = {
            getSet: async (jobSetId) => {
                reads++;
                return [gen('a', 'completed', { jobSetId }), gen('b', 'in_progress', { jobSetId })];
            },
        };
        const qc = new react_query_1.QueryClient();
        const opts = (0, job_set_query_1.jobSetQueryOptions)(client, 'set-1');
        const members = await qc.fetchQuery(opts);
        (0, vitest_1.expect)(reads).toBe(1);
        (0, vitest_1.expect)(members.map(g => g.id)).toEqual(['a', 'b']);
        (0, vitest_1.expect)(evalWith(opts.refetchInterval, members)).toBe(5000); // b is still running
        (0, vitest_1.expect)(evalWith(opts.refetchInterval, [gen('a', 'completed'), gen('b', 'failed')])).toBe(false);
    });
});
(0, vitest_1.describe)('jobsFeedQueryOptions', () => {
    function listClient(pages) {
        const calls = [];
        return {
            calls,
            list: async (opts) => {
                calls.push(opts);
                return pages[String(opts?.cursor)];
            },
        };
    }
    (0, vitest_1.it)('walks the cursor: the query is the identity, the cursor is the page param (verbatim to list)', async () => {
        const client = listClient({
            undefined: { items: [gen('a', 'completed')], cursor: 'c1' },
            c1: { items: [gen('b', 'completed')] },
        });
        const qc = new react_query_1.QueryClient();
        const data = await qc.fetchInfiniteQuery({ ...(0, jobs_feed_query_1.jobsFeedQueryOptions)(client, { type: 'video', size: 2 }), pages: 2 });
        (0, vitest_1.expect)(client.calls[0]).toEqual({ type: 'video', size: 2 });
        (0, vitest_1.expect)(client.calls[1]).toEqual({ type: 'video', size: 2, cursor: 'c1' });
        (0, vitest_1.expect)(data.pages.map(p => p.items[0].id)).toEqual(['a', 'b']);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video', size: 2 }))).toBe(data);
    });
    (0, vitest_1.it)('the last page (no cursor) ends the walk', async () => {
        const client = listClient({ undefined: { items: [gen('a', 'completed')] } });
        const qc = new react_query_1.QueryClient();
        const data = await qc.fetchInfiniteQuery({ ...(0, jobs_feed_query_1.jobsFeedQueryOptions)(client), pages: 5 });
        (0, vitest_1.expect)(data.pages).toHaveLength(1); // no next cursor — stop, whatever `pages` asked
    });
    (0, vitest_1.it)('keeps scoped feeds separate from unscoped feeds', async () => {
        const client = listClient({ undefined: { items: [gen('a', 'completed')] } });
        const qc = new react_query_1.QueryClient();
        const data = await qc.fetchInfiniteQuery({ ...(0, jobs_feed_query_1.jobsFeedQueryOptions)(client, { type: 'image' }, { scopeKey: 'u:w' }), pages: 1 });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'image' }))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'image' }, { scopeKey: 'u:w' }))).toBe(data);
    });
});
(0, vitest_1.describe)('flattenFeedPages', () => {
    (0, vitest_1.it)('deduplicates across pages: FIRST position, LATEST-fetched value', () => {
        const flat = (0, jobs_feed_query_1.flattenFeedPages)({
            pages: [
                { items: [gen('a', 'queued'), gen('b', 'completed')] },
                { items: [gen('a', 'completed'), gen('c', 'completed')] }, // 'a' slid onto page 2, fetched later
            ],
            pageParams: [undefined, 'c1'],
        });
        (0, vitest_1.expect)(flat.map(g => g.id)).toEqual(['a', 'b', 'c']); // position from the first sighting
        (0, vitest_1.expect)(flat[0].status).toBe('completed'); // value from the latest fetch
    });
});
//# sourceMappingURL=queries.test.js.map