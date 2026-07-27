"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const define_job_1 = require("../define-job");
const spec_1 = require("../spec");
const z_1 = require("../z");
const job = (0, define_job_1.defineJob)({
    jobSetType: 'seedance_2_0',
    outputType: 'video',
    params: {
        prompt: true,
        media: { field: 'medias', format: 'wrapped', roles: ['start_image'] },
        settings: {
            duration: z_1.z.duration({ values: [5, 10] }),
            aspectRatio: z_1.z.aspectRatio(['1:1', '16:9']),
            resolution: z_1.z._default(z_1.z.enum(['720p', '1080p']), '720p'),
        },
    },
    finalize: wire => ({ ...wire, use_chain: true }),
});
(0, vitest_1.describe)('buildWireParams', () => {
    (0, vitest_1.it)('flattens prompt, media, settings (no normalization), finalize and extra', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'a cat', enhance: true },
            media: { start_image: [{ id: 'a', type: 'media_input', url: 'https://x/a' }] },
            settings: { duration: 7, aspectRatio: '1920:1081' },
            extra: { sample_shift: 0.3 },
        }, job);
        // settings pass through untouched — submit does not snap; `adjust()` does.
        (0, vitest_1.expect)(wire).toEqual({
            prompt: 'a cat',
            enhance_prompt: true,
            medias: [{ role: 'start_image', data: { id: 'a', type: 'media_input', url: 'https://x/a' } }],
            duration: 7,
            aspectRatio: '1920:1081',
            resolution: '720p',
            sample_shift: 0.3,
            use_chain: true,
        });
    });
});
(0, vitest_1.describe)('parseGeneration', () => {
    (0, vitest_1.it)('parses a job response into structured Generation, routing unknown keys to extra', () => {
        const gen = (0, spec_1.parseGeneration)({
            id: 'job-1',
            job_set_id: 'set-1',
            status: 'completed',
            result_url: 'https://x/out.mp4',
            params: {
                prompt: 'a cat',
                enhance_prompt: true,
                medias: [{ role: 'start_image', data: { id: 'a', type: 'media_input', url: 'https://x/a' } }],
                duration: 5,
                aspectRatio: '16:9',
                resolution: '720p',
                sample_shift: 0.3,
            },
        }, job);
        (0, vitest_1.expect)(gen.id).toBe('job-1');
        (0, vitest_1.expect)(gen.jobSetId).toBe('set-1');
        (0, vitest_1.expect)(gen.type).toBe('video');
        (0, vitest_1.expect)(gen.status).toBe('completed');
        (0, vitest_1.expect)(gen.input.prompt).toEqual({ instruction: 'a cat', enhance: true });
        (0, vitest_1.expect)(gen.input.settings).toEqual({ duration: 5, aspectRatio: '16:9', resolution: '720p' });
        (0, vitest_1.expect)(gen.input.extra).toEqual({ sample_shift: 0.3 });
        (0, vitest_1.expect)(gen.results?.rawUrl).toBe('https://x/out.mp4');
    });
    (0, vitest_1.it)('round-trips: buildWireParams(parseGeneration(job).input) reproduces params', () => {
        const params = {
            prompt: 'dog',
            enhance_prompt: false,
            medias: [{ role: 'start_image', data: { id: 'b', type: 'media_input', url: 'https://x/b' } }],
            duration: 10,
            aspectRatio: '1:1',
            resolution: '1080p',
            sample_shift: 0.5,
        };
        const gen = (0, spec_1.parseGeneration)({ id: 'j', status: 'queued', params }, job);
        // finalize (use_chain) is deterministically injected on every submit; round-trip
        // losslessness covers prompt/media/settings/extra, plus the job's finalize fields.
        (0, vitest_1.expect)((0, spec_1.buildWireParams)(gen.input, job)).toEqual({ ...params, use_chain: true });
    });
});
//# sourceMappingURL=spec.test.js.map