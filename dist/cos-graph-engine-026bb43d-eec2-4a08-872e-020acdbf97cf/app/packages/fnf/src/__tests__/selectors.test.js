"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const seedance_2_0_1 = require("../jobs/seedance-2-0");
const selectors_1 = require("../selectors");
function gen(overrides) {
    return { id: 'j1', model: 'demo', type: 'image', status: 'completed', input: { model: 'demo', settings: {} }, ...overrides };
}
(0, vitest_1.describe)('url selectors', () => {
    (0, vitest_1.it)('getRawUrl returns the full-quality url, getPreviewUrl prefers min → thumbnail → raw', () => {
        const full = gen({ results: { rawUrl: 'https://x/raw.png', minUrl: 'https://x/min.webp' } });
        (0, vitest_1.expect)((0, selectors_1.getRawUrl)(full)).toBe('https://x/raw.png');
        (0, vitest_1.expect)((0, selectors_1.getPreviewUrl)(full)).toBe('https://x/min.webp');
        const video = gen({ type: 'video', results: { rawUrl: 'https://x/o.mp4', thumbnailUrl: 'https://x/t.webp' } });
        (0, vitest_1.expect)((0, selectors_1.getPreviewUrl)(video)).toBe('https://x/t.webp');
        (0, vitest_1.expect)((0, selectors_1.getPreviewUrl)(gen({ results: { rawUrl: 'https://x/only.png' } }))).toBe('https://x/only.png');
        (0, vitest_1.expect)((0, selectors_1.getPreviewUrl)(gen({}))).toBeUndefined();
    });
});
(0, vitest_1.describe)('status selectors', () => {
    (0, vitest_1.it)('buckets statuses into progress / failed / completed', () => {
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)('queued')).toBe('progress');
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)('in_progress')).toBe('progress');
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)('ip_detect')).toBe('progress');
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)('completed')).toBe('completed');
        for (const status of ['failed', 'nsfw', 'canceled', 'ip_detected'])
            (0, vitest_1.expect)((0, selectors_1.getJobPhase)(status)).toBe('failed');
        // unknown future statuses are still in flight, not failures
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)('warming_up')).toBe('progress');
        (0, vitest_1.expect)((0, selectors_1.getJobPhase)(gen({ status: 'failed' }))).toBe('failed');
    });
    (0, vitest_1.it)('isTerminalJobStatus / isFailedJobStatus', () => {
        (0, vitest_1.expect)((0, selectors_1.isTerminalJobStatus)('completed')).toBe(true);
        (0, vitest_1.expect)((0, selectors_1.isTerminalJobStatus)('nsfw')).toBe(true);
        (0, vitest_1.expect)((0, selectors_1.isTerminalJobStatus)('queued')).toBe(false);
        (0, vitest_1.expect)((0, selectors_1.isFailedJobStatus)('completed')).toBe(false);
        (0, vitest_1.expect)((0, selectors_1.isFailedJobStatus)('canceled')).toBe(true);
    });
});
(0, vitest_1.describe)('predicates', () => {
    (0, vitest_1.it)('isCompleted / isFailed / isGenerating branch on the read model directly', () => {
        (0, vitest_1.expect)((0, selectors_1.isCompleted)(gen({}))).toBe(true);
        (0, vitest_1.expect)((0, selectors_1.isFailed)(gen({ status: 'nsfw' }))).toBe(true);
        (0, vitest_1.expect)((0, selectors_1.isGenerating)(gen({ status: 'in_progress' }))).toBe(true);
        (0, vitest_1.expect)((0, selectors_1.isGenerating)(gen({ status: 'failed' }))).toBe(false);
    });
    (0, vitest_1.it)('hasResult narrows results to non-optional', () => {
        const done = gen({ results: { rawUrl: 'https://x/o.png' } });
        (0, vitest_1.expect)((0, selectors_1.hasResult)(done)).toBe(true);
        if ((0, selectors_1.hasResult)(done))
            (0, vitest_1.expect)(done.results.rawUrl).toBe('https://x/o.png'); // no ?. needed — narrowed
        (0, vitest_1.expect)((0, selectors_1.hasResult)(gen({}))).toBe(false);
    });
    (0, vitest_1.it)('isFromJob narrows input to the model typed shape', () => {
        const seedance = gen({ model: 'seedance_2_0' });
        (0, vitest_1.expect)((0, selectors_1.isFromJob)(seedance, seedance_2_0_1.seedance2_0)).toBe(true);
        if ((0, selectors_1.isFromJob)(seedance, seedance_2_0_1.seedance2_0)) {
            // typed access: duration is the declared settings field, not unknown
            const duration = seedance.input.settings.duration;
            (0, vitest_1.expect)(duration).toBeUndefined();
        }
        (0, vitest_1.expect)((0, selectors_1.isFromJob)(gen({ model: 'demo' }), seedance_2_0_1.seedance2_0)).toBe(false);
    });
});
(0, vitest_1.describe)('getMediaType', () => {
    (0, vitest_1.it)('answers from a Generation, a MediaRef url, or a bare url; undefined otherwise', () => {
        (0, vitest_1.expect)((0, selectors_1.getMediaType)(gen({ type: 'video' }))).toBe('video');
        (0, vitest_1.expect)((0, selectors_1.getMediaType)('https://cdn/x/clip.MP4?sig=1')).toBe('video');
        (0, vitest_1.expect)((0, selectors_1.getMediaType)('https://cdn/x/pic.webp#frag')).toBe('image');
        (0, vitest_1.expect)((0, selectors_1.getMediaType)({ id: 'm1', type: 'media_input', url: 'https://cdn/a.heic' })).toBe('image');
        (0, vitest_1.expect)((0, selectors_1.getMediaType)({ id: 'm1', type: 'media_input' })).toBeUndefined();
        (0, vitest_1.expect)((0, selectors_1.getMediaType)('https://cdn/x/file.bin')).toBeUndefined();
        (0, vitest_1.expect)((0, selectors_1.getMediaType)(undefined)).toBeUndefined();
    });
});
//# sourceMappingURL=selectors.test.js.map