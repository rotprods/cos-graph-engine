"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@higgsfield/fnf/client");
const errors_1 = require("@higgsfield/fnf/errors");
const jobs_1 = require("@higgsfield/fnf/jobs");
const vitest_1 = require("vitest");
const generation_run_1 = require("../generation-run");
const test_utils_1 = require("./test-utils");
const demo = (0, jobs_1.defineJob)({
    jobSetType: 'demo',
    outputType: 'image',
    params: { prompt: true, settings: { aspectRatio: jobs_1.z.aspectRatio(['1:1', '16:9']) } },
});
function statuses(run) {
    const seen = [];
    run.subscribe(() => {
        if (seen[seen.length - 1] !== run.status)
            seen.push(run.status);
    });
    return seen;
}
(0, vitest_1.describe)('GenerationRun', () => {
    (0, vitest_1.it)('walks idle → submitting → generating → completed against the memory backend', async () => {
        const client = (0, client_1.createJobClient)({ adapter: (0, test_utils_1.createMemoryBackend)(), jobs: [demo] });
        const run = new generation_run_1.GenerationRun(client);
        const seen = statuses(run);
        const done = await run.start({ model: 'demo', prompt: { instruction: 'x' }, settings: { aspectRatio: '1:1' } });
        (0, vitest_1.expect)(run.status).toBe('completed');
        (0, vitest_1.expect)(done.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(run.generations).toEqual(done);
        (0, vitest_1.expect)(seen).toEqual(['submitting', 'generating', 'completed']);
    });
    (0, vitest_1.it)('a failed submit becomes state, not a rejection', async () => {
        const client = (0, client_1.createJobClient)({ adapter: (0, test_utils_1.createMemoryBackend)(), jobs: [demo] });
        const run = new generation_run_1.GenerationRun(client);
        const done = await run.start({ model: 'unknown_model' });
        (0, vitest_1.expect)(done).toEqual([]);
        (0, vitest_1.expect)(run.status).toBe('failed');
        (0, vitest_1.expect)(run.error?.code).toBe('unknown_model');
    });
    (0, vitest_1.it)('abort mid-poll lands on status aborted (no error)', async () => {
        let release;
        const pending = { id: 'g1', model: 'demo', type: 'image', status: 'queued', input: { model: 'demo', settings: {} } };
        const run = new generation_run_1.GenerationRun({
            submit: async () => ({ generations: [pending] }),
            wait: (_gens, opts) => new Promise((_resolve, reject) => {
                // mimic the real client: abort surfaces as the typed JobAbortedError
                release = () => reject(new errors_1.ApiJobError('aborted', 'Operation aborted'));
                opts?.signal?.addEventListener('abort', () => release?.());
            }),
        });
        const started = run.start({});
        await Promise.resolve(); // let submit settle
        await Promise.resolve();
        run.abort();
        await started;
        (0, vitest_1.expect)(run.status).toBe('aborted');
        (0, vitest_1.expect)(run.error).toBeUndefined();
    });
    (0, vitest_1.it)('starting again supersedes the previous run (late results are dropped)', async () => {
        let resolveFirst;
        const first = { id: 'old', model: 'demo', type: 'image', status: 'queued', input: { model: 'demo', settings: {} } };
        const second = { id: 'new', model: 'demo', type: 'image', status: 'completed', input: { model: 'demo', settings: {} } };
        let calls = 0;
        const run = new generation_run_1.GenerationRun({
            submit: async () => ({ generations: calls++ === 0 ? [first] : [second] }),
            wait: async (gens) => {
                if (gens[0].id === 'old')
                    return new Promise(resolve => (resolveFirst = resolve));
                return gens;
            },
        });
        const firstStart = run.start({});
        await Promise.resolve();
        await Promise.resolve();
        const secondStart = run.start({});
        resolveFirst?.([{ ...first, status: 'completed' }]); // the superseded run settles late
        await Promise.all([firstStart, secondStart]);
        (0, vitest_1.expect)(run.generations.map(g => g.id)).toEqual(['new']); // old run never touched state again
        (0, vitest_1.expect)(run.status).toBe('completed');
    });
    (0, vitest_1.it)('abort during the SUBMIT phase still lands on aborted (no stuck submitting)', async () => {
        let releaseSubmit;
        const run = new generation_run_1.GenerationRun({
            submit: () => new Promise((resolve) => {
                releaseSubmit = () => resolve({ generations: [] });
            }),
            wait: async (gens) => gens,
        });
        const started = run.start({});
        run.abort(); // mid-submit — before any generation exists
        releaseSubmit?.();
        await started;
        (0, vitest_1.expect)(run.status).toBe('aborted');
        (0, vitest_1.expect)(run.isRunning).toBe(false); // a Generate button must un-brick
    });
    (0, vitest_1.it)('abort during submit keeps a handle on the generations the submit created', async () => {
        const created = { id: 'g1', model: 'demo', type: 'image', status: 'queued', input: { model: 'demo', settings: {} } };
        let releaseSubmit;
        const run = new generation_run_1.GenerationRun({
            submit: () => new Promise((resolve) => {
                releaseSubmit = () => resolve({ generations: [created], warning: 'partial' });
            }),
            wait: async (gens) => gens,
        });
        const started = run.start({});
        run.abort();
        releaseSubmit?.(); // the submit DID happen on the backend
        await started;
        (0, vitest_1.expect)(run.status).toBe('aborted');
        // the UI can still render them and call client.cancel(id)
        (0, vitest_1.expect)(run.generations.map(g => g.id)).toEqual(['g1']);
        (0, vitest_1.expect)(run.warning).toBe('partial');
    });
    (0, vitest_1.it)('reset returns to idle and clears state', async () => {
        const client = (0, client_1.createJobClient)({ adapter: (0, test_utils_1.createMemoryBackend)(), jobs: [demo] });
        const run = new generation_run_1.GenerationRun(client);
        await run.start({ model: 'demo', prompt: { instruction: 'x' }, settings: { aspectRatio: '1:1' } });
        run.reset();
        (0, vitest_1.expect)(run.status).toBe('idle');
        (0, vitest_1.expect)(run.generations).toEqual([]);
        (0, vitest_1.expect)(run.error).toBeUndefined();
    });
    (0, vitest_1.it)('emits safe observability events for lifecycle transitions', async () => {
        const events = [];
        const client = (0, client_1.createJobClient)({ adapter: (0, test_utils_1.createMemoryBackend)(), jobs: [demo] });
        const run = new generation_run_1.GenerationRun(client, {
            observability: {
                observer: (event) => {
                    events.push(event);
                },
            },
        });
        await run.start({ model: 'demo', prompt: { instruction: 'private prompt' }, settings: { aspectRatio: '1:1' } });
        run.reset();
        (0, vitest_1.expect)(events.map(event => event.name)).toEqual(vitest_1.expect.arrayContaining([
            'fnf.react.generation_run.start',
            'fnf.react.generation_run.submitted',
            'fnf.react.generation_run.progress',
            'fnf.react.generation_run.completed',
            'fnf.react.generation_run.reset',
        ]));
        (0, vitest_1.expect)(JSON.stringify(events)).not.toContain('private prompt');
    });
});
//# sourceMappingURL=generation-run.test.js.map