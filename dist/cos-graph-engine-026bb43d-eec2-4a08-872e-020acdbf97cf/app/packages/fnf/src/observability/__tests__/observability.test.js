"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("../../client");
const define_job_1 = require("../../define-job");
const errors_1 = require("../../errors");
const media_1 = require("../../media");
const profile_1 = require("../../profile");
const z_1 = require("../../z");
const index_1 = require("../index");
const demo = (0, define_job_1.defineJob)({
    jobSetType: 'demo',
    outputType: 'image',
    params: { prompt: true, settings: { aspectRatio: z_1.z.aspectRatio(['1:1']) } },
});
// Inline port stubs — this suite tests the observability layer, which must not
// depend on concrete adapters (those live in @higgsfield/fnf-adapters).
function stubBackend(cost = 1) {
    return {
        createJobs: async ({ jobSetType }) => [{ id: 'job-1', job_set_type: jobSetType, status: 'completed', result_url: 'memory://out' }],
        getJob: async (id) => ({ id, status: 'completed' }),
        listJobs: async () => ({ items: [] }),
        estimateCost: async () => ({ credits: cost }),
    };
}
function recorder() {
    const events = [];
    return {
        events,
        observer: (event) => {
            events.push(event);
        },
    };
}
(0, vitest_1.describe)('fnf observability', () => {
    (0, vitest_1.it)('emits job lifecycle spans without changing client behavior', async () => {
        const rec = recorder();
        const client = (0, client_1.createJobClient)({
            adapter: stubBackend(7),
            jobs: [demo],
            observability: { observer: rec.observer, traceId: 'trace-1' },
        });
        const submitted = await client.submit({ model: 'demo', prompt: { instruction: 'secret prompt' }, settings: { aspectRatio: '1:1' } });
        await client.cost({ model: 'demo', prompt: { instruction: 'secret prompt' }, settings: { aspectRatio: '1:1' } });
        (0, vitest_1.expect)(submitted.generations).toHaveLength(1);
        (0, vitest_1.expect)(rec.events.map(e => `${e.name}:${e.phase}`)).toContain('fnf.job.submit:start');
        (0, vitest_1.expect)(rec.events.map(e => `${e.name}:${e.phase}`)).toContain('fnf.job.submit:success');
        (0, vitest_1.expect)(rec.events.find(e => e.name === 'fnf.job.submit' && e.phase === 'success')?.attributes).toMatchObject({ generation_count: 1 });
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('secret prompt');
    });
    (0, vitest_1.it)('emits typed error metadata for SDK failures', async () => {
        const rec = recorder();
        const client = (0, client_1.createJobClient)({
            adapter: stubBackend(),
            jobs: [demo],
            observability: { observer: rec.observer },
        });
        await (0, vitest_1.expect)(client.submit({ model: 'missing_model' })).rejects.toBeInstanceOf(errors_1.ApiJobError);
        const error = rec.events.find(e => e.name === 'fnf.job.submit' && e.phase === 'error');
        (0, vitest_1.expect)(error?.error).toMatchObject({ code: 'unknown_model' });
    });
    (0, vitest_1.it)('observes transport requests with sanitized paths and safe status metadata', async () => {
        const rec = recorder();
        const transport = (0, index_1.withObservedTransport)(async () => ({ status: 201, body: { ok: true } }), { observer: rec.observer });
        await transport({ method: 'POST', path: '/jobs/topaz-image?dry_run=true&token=secret', body: { prompt: 'secret' } });
        const success = rec.events.find(e => e.name === 'fnf.transport.request' && e.phase === 'success');
        (0, vitest_1.expect)(success?.attributes).toMatchObject({ method: 'POST', path: '/jobs/topaz-image?dry_run&token', status: 201 });
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('secret');
    });
    (0, vitest_1.it)('media upload spans do not expose upload URLs, filenames, bytes, or result URLs', async () => {
        const rec = recorder();
        const mediaBackend = {
            getMedia: async () => ({}),
            listMedia: async () => ({ items: [] }),
            getUploadUrl: async () => ({ id: 'm1', url: 'https://cdn/private.png', upload_url: 'https://s3/private-put' }),
            confirmMedia: async () => ({ id: 'm1', status: 'uploaded', url: 'https://cdn/private.png' }),
        };
        const media = (0, media_1.createMediaClient)({
            mediaAdapter: mediaBackend,
            blobUploader: { transfer: async () => { } },
            observability: { observer: rec.observer },
        });
        await media.upload({ source: new Uint8Array([1, 2, 3]), filename: 'private-cat.png', role: 'image' });
        const text = JSON.stringify(rec.events);
        (0, vitest_1.expect)(rec.events.map(e => e.name)).toEqual(vitest_1.expect.arrayContaining(['fnf.media.upload', 'fnf.media.presign', 'fnf.media.transfer', 'fnf.media.confirm']));
        (0, vitest_1.expect)(text).not.toContain('private-cat.png');
        (0, vitest_1.expect)(text).not.toContain('https://s3/private-put');
        (0, vitest_1.expect)(text).not.toContain('https://cdn/private.png');
        (0, vitest_1.expect)(text).not.toContain('[1,2,3]');
    });
    (0, vitest_1.it)('profile spans expose only coarse metadata and ids', async () => {
        const rec = recorder();
        const workspaces = [{ id: 'w1', name: 'Secret Team', type: 'private', user_role: 'owner' }];
        const profileBackend = {
            getUser: async () => ({ id: 'u1', email: 'private@example.com', workspace_id: 'w1' }),
            listWorkspaces: async () => workspaces,
            getCurrentWorkspace: async () => workspaces[0],
            getWorkspaceWallet: async () => ({ subscription_balance: 0 }),
            switchWorkspace: async () => ({}),
        };
        const profile = (0, profile_1.createProfileClient)({
            profileAdapter: profileBackend,
            observability: { observer: rec.observer },
        });
        await profile.getSnapshot();
        const snapshot = rec.events.find(e => e.name === 'fnf.profile.get_snapshot' && e.phase === 'success');
        (0, vitest_1.expect)(snapshot?.attributes).toMatchObject({ has_user: true, workspace_count: 1, has_current_workspace: true });
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('private@example.com');
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('Secret Team');
    });
    (0, vitest_1.it)('wrappers preserve behavior and observer failures do not affect operations', async () => {
        const observer = vitest_1.vi.fn(() => {
            throw new Error('observer exploded');
        });
        const onObserverError = vitest_1.vi.fn();
        const backend = (0, index_1.withObservedGenerationBackend)(stubBackend(), { observer, onObserverError });
        const client = (0, client_1.createJobClient)({ adapter: backend, jobs: [demo] });
        await (0, vitest_1.expect)(client.submit({ model: 'demo', prompt: { instruction: 'x' }, settings: { aspectRatio: '1:1' } })).resolves.toHaveProperty('generations');
        (0, vitest_1.expect)(onObserverError).toHaveBeenCalled();
    });
    (0, vitest_1.it)('compose/noop observers and uploader wrappers are safe defaults', async () => {
        const rec = recorder();
        const observer = (0, index_1.composeObservers)((0, index_1.createNoopObserver)(), rec.observer);
        const uploader = (0, index_1.withObservedUploader)({
            transfer: async () => { },
            fetchBytes: async () => ({ bytes: new Uint8Array([1]), contentType: 'image/png' }),
        }, { observer });
        await uploader.transfer({ uploadUrl: 'https://s3/private', bytes: new Uint8Array([1]), contentType: 'image/png' });
        await uploader.fetchBytes?.('https://cdn/private.png');
        (0, vitest_1.expect)(rec.events.map(e => e.name)).toEqual(['fnf.media.transfer', 'fnf.media.transfer', 'fnf.media.fetch_bytes', 'fnf.media.fetch_bytes']);
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('https://s3/private');
        (0, vitest_1.expect)(JSON.stringify(rec.events)).not.toContain('https://cdn/private.png');
    });
    (0, vitest_1.it)('withObservedTransport preserves error behavior', async () => {
        const rec = recorder();
        const transport = (0, index_1.withObservedTransport)(async () => {
            throw new errors_1.ApiJobError('network', 'offline');
        }, { observer: rec.observer });
        await (0, vitest_1.expect)(transport({ method: 'GET', path: '/health' })).rejects.toMatchObject({ code: 'network' });
        (0, vitest_1.expect)(rec.events.find(e => e.phase === 'error')?.error).toMatchObject({ code: 'network' });
    });
});
//# sourceMappingURL=observability.test.js.map