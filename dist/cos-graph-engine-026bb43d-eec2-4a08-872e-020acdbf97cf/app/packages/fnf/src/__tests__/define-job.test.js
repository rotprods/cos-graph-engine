"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const define_job_1 = require("../define-job");
const registry_1 = require("../registry");
const z_1 = require("../z");
const job = (0, define_job_1.defineJob)({
    jobSetType: 'demo_video',
    outputType: 'video',
    params: {
        media: { field: 'medias', format: 'wrapped', roles: ['start_image'] },
        settings: {
            seed: z_1.z.optional(z_1.z.number()),
            duration: z_1.z.duration({ values: [5, 10] }),
            aspectRatio: z_1.z.aspectRatio(['1:1', '16:9']),
            resolution: z_1.z._default(z_1.z.enum(['720p', '1080p']), '720p'),
        },
    },
    finalize: wire => ({ ...wire, use_chain: true }),
});
(0, vitest_1.describe)('defineJob', () => {
    (0, vitest_1.it)('keeps identity fields and media config', () => {
        (0, vitest_1.expect)(job.jobSetType).toBe('demo_video');
        (0, vitest_1.expect)(job.outputType).toBe('video');
        (0, vitest_1.expect)(job.media?.format).toBe('wrapped');
    });
    (0, vitest_1.it)('builds a settings schema that validates and applies defaults', () => {
        (0, vitest_1.expect)(job.settingsSchema.parse({ duration: 5, aspectRatio: '1:1' })).toEqual({
            duration: 5,
            aspectRatio: '1:1',
            resolution: '720p',
        });
    });
    (0, vitest_1.it)('collects normalizers for tagged settings fields only', () => {
        (0, vitest_1.expect)(job.normalizers).toEqual({
            duration: { kind: 'duration', values: [5, 10] },
            aspectRatio: { kind: 'aspectRatio', options: ['1:1', '16:9'] },
        });
    });
    (0, vitest_1.it)('exposes the finalize hook (last touch on the assembled wire body)', () => {
        (0, vitest_1.expect)(job.finalize?.({ existing: 1 }, { model: 'demo_video', settings: {} })).toEqual({ existing: 1, use_chain: true });
    });
    (0, vitest_1.it)('rejects single/unwrapped media with multiple roles', () => {
        (0, vitest_1.expect)(() => (0, define_job_1.defineJob)({
            jobSetType: 'bad',
            outputType: 'image',
            params: {
                media: { field: 'input_images', format: 'unwrapped', roles: ['image', 'audio'] },
                settings: {},
            },
        })).toThrow(/exactly one role/);
    });
});
(0, vitest_1.describe)('defineJob wire-collision guard', () => {
    (0, vitest_1.it)('rejects two settings mapping to one wire key', () => {
        (0, vitest_1.expect)(() => (0, define_job_1.defineJob)({
            jobSetType: 'clash',
            outputType: 'image',
            params: {
                settings: { a: z_1.z.wire('same_key', z_1.z.number()), b: z_1.z.wire('same_key', z_1.z.string()) },
            },
        })).toThrow(/both serialize to wire key 'same_key'/);
    });
    (0, vitest_1.it)('rejects a settings key shadowing a prompt/media wire key', () => {
        (0, vitest_1.expect)(() => (0, define_job_1.defineJob)({
            jobSetType: 'clash2',
            outputType: 'image',
            params: {
                prompt: true,
                settings: { prompt: z_1.z.string() }, // 'prompt' is the prompt group's wire key
            },
        })).toThrow(/collides with the prompt wire key/);
    });
});
(0, vitest_1.describe)('tagged schemas survive z.optional / z._default wrappers', () => {
    (0, vitest_1.it)('keeps the normalizer and wire name of a wrapped schema', () => {
        const wrapped = (0, define_job_1.defineJob)({
            jobSetType: 'wrapped',
            outputType: 'image',
            params: {
                settings: {
                    aspectRatio: z_1.z.optional(z_1.z.wire('aspect_ratio', z_1.z.aspectRatio(['1:1', '16:9']))),
                    duration: z_1.z._default(z_1.z.duration({ values: [5, 10] }), 5),
                },
            },
        });
        (0, vitest_1.expect)(wrapped.normalizers.aspectRatio).toEqual({ kind: 'aspectRatio', options: ['1:1', '16:9'] });
        (0, vitest_1.expect)(wrapped.normalizers.duration).toEqual({ kind: 'duration', values: [5, 10] });
        (0, vitest_1.expect)(wrapped.wireNames).toEqual({ aspectRatio: 'aspect_ratio' });
    });
});
(0, vitest_1.describe)('buildRegistry', () => {
    (0, vitest_1.it)('indexes jobs by jobSetType', () => {
        const registry = (0, registry_1.buildRegistry)([job]);
        (0, vitest_1.expect)(registry.get('demo_video')).toBe(job);
        (0, vitest_1.expect)(registry.get('missing')).toBeUndefined();
    });
    (0, vitest_1.it)('throws on a duplicate jobSetType instead of last-write-wins', () => {
        (0, vitest_1.expect)(() => (0, registry_1.buildRegistry)([job, job])).toThrow(/duplicate jobSetType 'demo_video'/);
    });
});
//# sourceMappingURL=define-job.test.js.map