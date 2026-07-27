"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jobs_1 = require("@higgsfield/fnf/jobs");
const react_query_1 = require("@tanstack/react-query");
const vitest_1 = require("vitest");
const cost_query_1 = require("../cost-query");
const keys_1 = require("../keys");
const provider_1 = require("../provider");
const wire_preview_1 = require("../wire-preview");
const test_utils_1 = require("./test-utils");
const demo = (0, jobs_1.defineJob)({
    jobSetType: 'demo',
    outputType: 'image',
    params: {
        prompt: true,
        settings: {
            aspectRatio: jobs_1.z.wire('aspect_ratio', jobs_1.z.aspectRatio(['1:1', '16:9'])),
        },
    },
});
(0, vitest_1.describe)('FnfProvider and client creation', () => {
    (0, vitest_1.it)('creates stable SDK clients from explicit adapters', async () => {
        const clients = (0, provider_1.createFnfReactClients)({
            adapter: (0, test_utils_1.createMemoryBackend)(),
            mediaAdapter: (0, test_utils_1.createMemoryMediaAdapter)(),
            profileAdapter: (0, test_utils_1.createMemoryProfileAdapter)({
                user: { id: 'u1', workspace_id: 'w1' },
                workspaces: [{ id: 'w1', name: 'Personal', type: 'private', user_role: 'owner' }],
                currentWorkspaceId: 'w1',
            }),
            jobs: [demo],
            scopeKey: 'u1:w1',
        });
        (0, vitest_1.expect)(clients.scopeKey).toBe('u1:w1');
        (0, vitest_1.expect)(clients.jobs).toEqual([demo]);
        await (0, vitest_1.expect)(clients.profileClient.getUser()).resolves.toMatchObject({ id: 'u1', workspaceId: 'w1' });
    });
    (0, vitest_1.it)('passes shared observability into created clients', async () => {
        const events = [];
        const clients = (0, provider_1.createFnfReactClients)({
            adapter: (0, test_utils_1.createMemoryBackend)({ cost: 5 }),
            mediaAdapter: (0, test_utils_1.createMemoryMediaAdapter)(),
            profileAdapter: (0, test_utils_1.createMemoryProfileAdapter)(),
            jobs: [demo],
            observability: {
                observer: (event) => {
                    events.push(event);
                },
                traceId: 'react-trace',
            },
        });
        await clients.jobClient.cost({ model: 'demo', prompt: { instruction: 'private' }, settings: { aspectRatio: '1:1' } });
        await clients.profileClient.getUser();
        (0, vitest_1.expect)(clients.observability?.traceId).toBe('react-trace');
        (0, vitest_1.expect)(events.map(event => event.name)).toEqual(vitest_1.expect.arrayContaining(['fnf.job.cost', 'fnf.profile.get_user']));
        (0, vitest_1.expect)(events.every(event => event.traceId === 'react-trace')).toBe(true);
        (0, vitest_1.expect)(JSON.stringify(events)).not.toContain('private');
    });
});
(0, vitest_1.describe)('request helpers', () => {
    (0, vitest_1.it)('builds a local wire preview or returns a typed SDK error', () => {
        const input = { model: 'demo', prompt: { instruction: 'hello' }, settings: { aspectRatio: '16:9' } };
        const preview = (0, wire_preview_1.getWirePreview)(input, [demo]);
        (0, vitest_1.expect)(preview.ok).toBe(true);
        if (preview.ok) {
            (0, vitest_1.expect)(preview.jobSetType).toBe('demo');
            (0, vitest_1.expect)(preview.params).toMatchObject({ prompt: 'hello', aspect_ratio: '16:9' });
        }
        const bad = (0, wire_preview_1.getWirePreview)({ model: 'missing', settings: {} }, [demo]);
        (0, vitest_1.expect)(bad.ok).toBe(false);
        if (!bad.ok)
            (0, vitest_1.expect)(bad.error.code).toBe('unknown_model');
    });
    (0, vitest_1.it)('caches cost estimates under scoped request keys', async () => {
        const input = { model: 'demo', prompt: { instruction: 'hello' }, settings: { aspectRatio: '1:1' } };
        const client = {
            cost: vitest_1.vi.fn(async () => ({ credits: 3 })),
        };
        const qc = new react_query_1.QueryClient();
        await (0, vitest_1.expect)(qc.fetchQuery((0, cost_query_1.costQueryOptions)(client, input, { scopeKey: 'u1:w1' }))).resolves.toEqual({ credits: 3 });
        (0, vitest_1.expect)(client.cost).toHaveBeenCalledWith(input);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.cost(input, { scopeKey: 'u1:w1' }))).toEqual({ credits: 3 });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.cost(input))).toBeUndefined();
    });
});
//# sourceMappingURL=provider-wire.test.js.map