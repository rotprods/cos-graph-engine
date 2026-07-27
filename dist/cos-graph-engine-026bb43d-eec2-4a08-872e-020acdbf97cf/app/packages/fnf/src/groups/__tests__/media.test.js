"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const media_1 = require("../media");
const ref = (id, role) => ({ id, type: 'media_input', url: `https://x/${id}`, role });
(0, vitest_1.describe)('mediaCodec', () => {
    (0, vitest_1.it)('unwrapped: emits bare data array under the field', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'input_images', format: 'unwrapped', roles: ['image'] });
        const wire = codec.serialize({ image: [ref('a', 'image'), ref('b', 'image')] });
        (0, vitest_1.expect)(wire).toEqual({ input_images: [{ id: 'a', type: 'media_input', url: 'https://x/a' }, { id: 'b', type: 'media_input', url: 'https://x/b' }] });
    });
    (0, vitest_1.it)('wrapped: emits {role,data} entries under the field', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'medias', format: 'wrapped', roles: ['start_image', 'end_image'] });
        const wire = codec.serialize({ start_image: ref('a', 'start_image'), end_image: ref('b', 'end_image') });
        (0, vitest_1.expect)(wire).toEqual({
            medias: [
                { role: 'start_image', data: { id: 'a', type: 'media_input', url: 'https://x/a' } },
                { role: 'end_image', data: { id: 'b', type: 'media_input', url: 'https://x/b' } },
            ],
        });
    });
    (0, vitest_1.it)('single: emits one data object under the field', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'input_image', format: 'single', roles: ['image'] });
        (0, vitest_1.expect)(codec.serialize({ image: ref('a', 'image') })).toEqual({
            input_image: { id: 'a', type: 'media_input', url: 'https://x/a' },
        });
    });
    (0, vitest_1.it)('emits nothing when no media is present', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'input_images', format: 'unwrapped', roles: ['image'] });
        (0, vitest_1.expect)(codec.serialize({})).toEqual({});
    });
    (0, vitest_1.it)('wrapped round-trips role and id', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'medias', format: 'wrapped', roles: ['start_image', 'end_image'] });
        const input = { start_image: [ref('a', 'start_image')], end_image: [ref('b', 'end_image')] };
        const parsed = codec.parse(codec.serialize(input));
        (0, vitest_1.expect)(parsed.start_image).toEqual([{ id: 'a', type: 'media_input', url: 'https://x/a', role: 'start_image' }]);
        (0, vitest_1.expect)(parsed.end_image).toEqual([{ id: 'b', type: 'media_input', url: 'https://x/b', role: 'end_image' }]);
    });
    (0, vitest_1.it)('single: rejects multiple refs instead of silently dropping all but the first', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'input_image', format: 'single', roles: ['image'] });
        (0, vitest_1.expect)(() => codec.serialize({ image: [ref('a', 'image'), ref('b', 'image')] }))
            .toThrow(/exactly one ref, got 2/);
    });
    (0, vitest_1.it)('rejects an undeclared role instead of silently dropping it (typos, get-then-resubmit)', () => {
        const codec = (0, media_1.mediaCodec)({ field: 'medias', format: 'wrapped', roles: ['image'] });
        (0, vitest_1.expect)(() => codec.serialize({ style_ref: ref('a', 'style_ref') })).toThrow(/not declared by this job: style_ref/);
    });
});
(0, vitest_1.describe)('checkMedia (cardinality + cross-role rules)', () => {
    const cfg = {
        field: 'medias',
        format: 'wrapped',
        roles: ['image', 'start_image', 'audio'],
        counts: { start_image: { min: 1, max: 1 }, image: { max: 2 } },
        rules: [(0, media_1.requiresOneOf)('audio', ['image'])],
    };
    (0, vitest_1.it)('passes a valid combination', () => {
        (0, vitest_1.expect)((0, media_1.checkMedia)(cfg, { start_image: ref('s', 'start_image'), image: [ref('a', 'image')], audio: ref('m', 'audio') })).toEqual([]);
    });
    (0, vitest_1.it)('reports min/max violations with pydantic-shaped issues', () => {
        const issues = (0, media_1.checkMedia)(cfg, { image: [ref('a', 'image'), ref('b', 'image'), ref('c', 'image')] });
        (0, vitest_1.expect)(issues).toEqual([
            { loc: ['media', 'start_image'], msg: vitest_1.expect.stringMatching(/at least 1.*got 0/) },
            { loc: ['media', 'image'], msg: vitest_1.expect.stringMatching(/at most 2.*got 3/) },
        ]);
    });
    (0, vitest_1.it)('requiresOneOf fires only when the dependent role is present', () => {
        const rule = (0, media_1.requiresOneOf)('audio', ['image', 'video']);
        (0, vitest_1.expect)(rule({ audio: 0, image: 0, video: 0 }, {})).toBeNull(); // no audio — nothing required
        (0, vitest_1.expect)(rule({ audio: 1, image: 0, video: 0 }, {})).toMatch(/requires one of: image, video/);
        (0, vitest_1.expect)(rule({ audio: 1, image: 1, video: 0 }, {})).toBeNull();
    });
    (0, vitest_1.it)('atLeastOneOf requires the group', () => {
        const rule = (0, media_1.atLeastOneOf)(['start_image', 'end_image']);
        (0, vitest_1.expect)(rule({ start_image: 0, end_image: 0 }, {})).toMatch(/at least one of/);
        (0, vitest_1.expect)(rule({ start_image: 1, end_image: 0 }, {})).toBeNull();
    });
});
//# sourceMappingURL=media.test.js.map