"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_query_1 = require("@tanstack/react-query");
const vitest_1 = require("vitest");
const generation_cache_1 = require("../generation-cache");
const keys_1 = require("../keys");
function gen(id, status, extra) {
    return { id, model: 'demo', type: 'image', status, input: { model: 'demo', settings: {} }, ...extra };
}
function feedData(pages) {
    return {
        pages: pages.map((items, at) => ({ items, ...(at < pages.length - 1 ? { cursor: at } : {}) })),
        pageParams: pages.map((_p, at) => (at === 0 ? undefined : at - 1)),
    };
}
(0, vitest_1.describe)('applyGenerations — the single write door', () => {
    (0, vitest_1.it)('folds one snapshot into EVERY cache entry that holds it: job, job set, all feeds', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.job('a'), gen('a', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.jobSet('set-1'), [gen('a', 'queued', { jobSetId: 'set-1' }), gen('b', 'queued', { jobSetId: 'set-1' })]);
        qc.setQueryData(keys_1.fnfKeys.jobs({ type: 'image' }), feedData([[gen('a', 'queued')]]));
        qc.setQueryData(keys_1.fnfKeys.jobs({}), feedData([[gen('z', 'completed'), gen('a', 'queued')]]));
        const fresh = gen('a', 'completed', { jobSetId: 'set-1', results: { rawUrl: 'https://x/a.png' } });
        (0, generation_cache_1.applyGenerations)(qc, [fresh]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('a'))?.status).toBe('completed');
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobSet('set-1'))?.map(g => g.status)).toEqual(['completed', 'queued']);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'image' }))?.pages[0].items[0].status).toBe('completed');
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}))?.pages[0].items[1].status).toBe('completed');
    });
    (0, vitest_1.it)('updates, never seeds: ids nothing holds are ignored, absent keys are not created', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({}), feedData([[gen('a', 'queued')]]));
        (0, generation_cache_1.applyGenerations)(qc, [gen('stranger', 'completed', { jobSetId: 'set-9' })]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('stranger'))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobSet('set-9'))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}))?.pages[0].items.map(g => g.id)).toEqual(['a']);
    });
    (0, vitest_1.it)('the terminal anti-regress holds at the door: a stale tick cannot roll back a feed tile', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({}), feedData([[gen('a', 'completed', { results: { rawUrl: 'https://x/a.png' } })]]));
        (0, generation_cache_1.applyGenerations)(qc, [gen('a', 'in_progress')]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}))?.pages[0].items[0].status).toBe('completed');
    });
    (0, vitest_1.it)('a write that changes nothing bails out — references stay stable for memoization', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({}), feedData([[gen('a', 'in_progress')]]));
        const before = qc.getQueryData(keys_1.fnfKeys.jobs({}));
        (0, generation_cache_1.applyGenerations)(qc, [gen('a', 'in_progress')]); // a tick with no observable change
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}))).toBe(before);
    });
    (0, vitest_1.it)('updates only the named scope when scoped', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.job('a'), gen('a', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.job('a', { scopeKey: 'u:w' }), gen('a', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'u:w' }), feedData([[gen('a', 'queued')]]));
        (0, generation_cache_1.applyGenerations)(qc, [gen('a', 'completed', { results: { rawUrl: 'https://x/a.png' } })], { scopeKey: 'u:w' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('a'))?.status).toBe('queued');
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('a', { scopeKey: 'u:w' }))?.status).toBe('completed');
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'u:w' }))?.pages[0].items[0].status).toBe('completed');
    });
    (0, vitest_1.it)('removes generation queries for one scope without touching profile or other scopes', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.job('a', { scopeKey: 'old' }), gen('a', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'old' }), feedData([[gen('a', 'queued')]]));
        qc.setQueryData(keys_1.fnfKeys.job('b', { scopeKey: 'new' }), gen('b', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.profileSnapshot({ scopeKey: 'old' }), { user: null, workspaces: [], currentWorkspace: null, wallet: null, credits: null });
        (0, generation_cache_1.removeGenerationQueries)(qc, { scopeKey: 'old' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('a', { scopeKey: 'old' }))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'old' }))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('b', { scopeKey: 'new' }))).toBeDefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileSnapshot({ scopeKey: 'old' }))).toBeDefined();
    });
});
(0, vitest_1.describe)('prependGenerations — explicit optimistic insert', () => {
    (0, vitest_1.it)('inserts fresh submits at the head of the named feed, deduplicated', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({ type: 'video' }), feedData([[gen('old', 'completed')]]));
        (0, generation_cache_1.prependGenerations)(qc, { type: 'video' }, [gen('new', 'queued'), gen('old', 'completed')]);
        const items = qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video' }))?.pages[0].items;
        (0, vitest_1.expect)(items?.map(g => g.id)).toEqual(['new', 'old']);
    });
    (0, vitest_1.it)('a feed that was never fetched is left alone — its first fetch includes the new jobs anyway', () => {
        const qc = new react_query_1.QueryClient();
        (0, generation_cache_1.prependGenerations)(qc, { type: 'video' }, [gen('new', 'queued')]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video' }))).toBeUndefined();
    });
    (0, vitest_1.it)('targets ONLY the named feed — fan-out across feeds is the app\'s explicit policy', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({ type: 'video' }), feedData([[]]));
        qc.setQueryData(keys_1.fnfKeys.jobs({}), feedData([[]]));
        (0, generation_cache_1.prependGenerations)(qc, { type: 'video' }, [gen('new', 'queued')]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video' }))?.pages[0].items).toHaveLength(1);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}))?.pages[0].items).toHaveLength(0);
    });
    (0, vitest_1.it)('can optimistically insert into a scoped feed', () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.jobs({ type: 'video' }, { scopeKey: 'u:w' }), feedData([[]]));
        (0, generation_cache_1.prependGenerations)(qc, { type: 'video' }, [gen('new', 'queued')], { scopeKey: 'u:w' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video' }, { scopeKey: 'u:w' }))?.pages[0].items).toHaveLength(1);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({ type: 'video' }))).toBeUndefined();
    });
});
//# sourceMappingURL=generation-cache.test.js.map