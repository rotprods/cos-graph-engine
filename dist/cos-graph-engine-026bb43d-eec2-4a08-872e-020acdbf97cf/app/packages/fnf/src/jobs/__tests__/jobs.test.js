"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const spec_1 = require("../../spec");
const nano_banana_2_1 = require("../nano-banana-2");
const seedance_2_0_1 = require("../seedance-2-0");
(0, vitest_1.describe)('nanoBanana2 (image, unwrapped input_images)', () => {
    (0, vitest_1.it)('builds wire params with bare image data array and canonical wire names', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'nano_banana_2',
            prompt: { instruction: 'a blue cat' },
            media: { image: [{ id: 'u1', type: 'media_input', url: 'https://x/u1' }] },
            settings: { aspectRatio: '1:1', resolution: '2k', batchSize: 3 },
        }, nano_banana_2_1.nanoBanana2);
        (0, vitest_1.expect)(wire.prompt).toBe('a blue cat');
        // typed camelCase keys → backend's canonical snake_case wire keys (z.wire)
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('1:1');
        (0, vitest_1.expect)(wire.batch_size).toBe(3);
        (0, vitest_1.expect)(wire).not.toHaveProperty('aspectRatio');
        (0, vitest_1.expect)(wire.resolution).toBe('2k');
        (0, vitest_1.expect)(wire.input_images).toEqual([{ id: 'u1', type: 'media_input', url: 'https://x/u1' }]);
    });
    (0, vitest_1.it)('round-trips wire-named settings: parseGeneration maps aspect_ratio back to aspectRatio', () => {
        const gen = (0, spec_1.parseGeneration)({ id: 'j1', status: 'completed', result_url: 'https://x/o.png', params: { prompt: 'cat', aspect_ratio: '1:1', resolution: '2k' } }, nano_banana_2_1.nanoBanana2);
        (0, vitest_1.expect)(gen.input.settings).toEqual({ aspectRatio: '1:1', resolution: '2k' });
        (0, vitest_1.expect)(gen.input.extra).toBeUndefined(); // not misrouted to extra
        (0, vitest_1.expect)((0, spec_1.buildWireParams)(gen.input, nano_banana_2_1.nanoBanana2)).toMatchObject({ prompt: 'cat', aspect_ratio: '1:1', resolution: '2k' });
    });
    (0, vitest_1.it)('round-trips folder_id/parent_id and surfaces job_set_parent_id as parentJobSetId', () => {
        const gen = (0, spec_1.parseGeneration)({
            id: 'j2',
            job_set_id: 'set-2',
            job_set_parent_id: 'set-1',
            status: 'completed',
            result_url: 'https://x/o.png',
            params: { prompt: 'cat', aspect_ratio: '1:1', folder_id: 'f1', parent_id: 'set-1' },
        }, nano_banana_2_1.nanoBanana2);
        (0, vitest_1.expect)(gen.parentJobSetId).toBe('set-1');
        (0, vitest_1.expect)(gen.input.folderId).toBe('f1');
        (0, vitest_1.expect)(gen.input.parentId).toBe('set-1');
        (0, vitest_1.expect)(gen.input.extra).toBeUndefined(); // targeting fields are not misrouted to extra
        (0, vitest_1.expect)((0, spec_1.buildWireParams)(gen.input, nano_banana_2_1.nanoBanana2)).toMatchObject({ folder_id: 'f1', parent_id: 'set-1' });
    });
});
(0, vitest_1.describe)('seedance2_0 (video, wrapped medias)', () => {
    (0, vitest_1.it)('passes settings through unchanged (no normalization) and wraps media with roles', () => {
        const wire = (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'demo' },
            media: { image: [{ id: 's1', type: 'image_job', url: 'https://x/s1' }] },
            settings: { duration: 8, aspectRatio: '16:9' },
        }, seedance_2_0_1.seedance2_0);
        (0, vitest_1.expect)(wire.duration).toBe(8); // not snapped — submit does not normalize; adjust() does
        (0, vitest_1.expect)(wire.aspect_ratio).toBe('16:9'); // z.wire mapping
        (0, vitest_1.expect)(wire.generate_audio).toBe(true); // defaulted wire param
        (0, vitest_1.expect)(wire.medias).toEqual([{ role: 'image', data: { id: 's1', type: 'image_job', url: 'https://x/s1' } }]);
    });
    (0, vitest_1.it)('enforces cardinality: a second start_image is rejected before any I/O', () => {
        const two = [{ id: 'a', type: 'media_input' }, { id: 'b', type: 'media_input' }];
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'seedance_2_0', media: { start_image: two }, settings: { duration: 8, aspectRatio: 'auto' } }, seedance_2_0_1.seedance2_0)).toThrow(/start_image.*at most 1.*got 2/);
    });
    (0, vitest_1.it)('enforces the cross-role rule: audio alone (no visuals) is rejected', () => {
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'seedance_2_0', media: { audio: { id: 'm', type: 'media_input' } }, settings: { duration: 8, aspectRatio: 'auto' } }, seedance_2_0_1.seedance2_0)).toThrow(/audio.*requires one of/);
    });
    (0, vitest_1.it)('validate hook: a frame with a forced concrete ratio is rejected (the live-failure trap)', () => {
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'x' },
            media: { start_image: { id: 's', type: 'media_input' } },
            settings: { duration: 8, aspectRatio: '16:9' },
        }, seedance_2_0_1.seedance2_0)).toThrow(/aspectRatio must be 'auto'/);
    });
    (0, vitest_1.it)('validate hook: prompt is required when no media is attached (seedance + nano)', () => {
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'seedance_2_0', settings: { duration: 8, aspectRatio: 'auto' } }, seedance_2_0_1.seedance2_0)).toThrow(/Prompt is required/);
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({ model: 'nano_banana_2', settings: { aspectRatio: 'auto' } }, nano_banana_2_1.nanoBanana2))
            .toThrow(/Prompt is required/);
    });
    (0, vitest_1.it)('validate hook: aggregates ALL issues at once', () => {
        try {
            (0, spec_1.buildWireParams)({ model: 'seedance_2_0', media: { start_image: { id: 's', type: 'media_input' } }, settings: { duration: 8, aspectRatio: '16:9', batchSize: 9 } }, seedance_2_0_1.seedance2_0);
            throw new Error('should have thrown');
        }
        catch (err) {
            const issues = err.data?.issues ?? [];
            (0, vitest_1.expect)(issues.length).toBeGreaterThanOrEqual(2); // ratio lock + batchSize range
        }
    });
    (0, vitest_1.it)('group cap: 10 reference images across image-like roles are rejected', () => {
        const refs = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, type: 'media_input' }));
        (0, vitest_1.expect)(() => (0, spec_1.buildWireParams)({
            model: 'seedance_2_0',
            prompt: { instruction: 'x' },
            media: { image: refs, start_image: { id: 's', type: 'media_input' } },
            settings: { duration: 8, aspectRatio: 'auto' },
        }, seedance_2_0_1.seedance2_0)).toThrow(/at most 9.*got 10/);
    });
});
//# sourceMappingURL=jobs.test.js.map