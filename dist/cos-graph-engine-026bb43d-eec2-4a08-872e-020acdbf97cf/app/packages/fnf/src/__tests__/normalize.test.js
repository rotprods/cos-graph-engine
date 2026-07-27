"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const normalize_1 = require("../normalize");
(0, vitest_1.describe)('closestAspectRatio', () => {
    (0, vitest_1.it)('returns the value unchanged when it is an allowed option', () => {
        (0, vitest_1.expect)((0, normalize_1.closestAspectRatio)('16:9', ['1:1', '16:9', '9:16'])).toBe('16:9');
    });
    (0, vitest_1.it)('returns the closest option by aspect when not allowed', () => {
        (0, vitest_1.expect)((0, normalize_1.closestAspectRatio)('1920:1081', ['1:1', '16:9', '9:16'])).toBe('16:9');
        (0, vitest_1.expect)((0, normalize_1.closestAspectRatio)('100:101', ['1:1', '16:9'])).toBe('1:1');
    });
});
(0, vitest_1.describe)('clampDuration', () => {
    (0, vitest_1.it)('snaps to the nearest allowed value', () => {
        (0, vitest_1.expect)((0, normalize_1.clampDuration)(7, { kind: 'duration', values: [5, 10] })).toBe(5);
        (0, vitest_1.expect)((0, normalize_1.clampDuration)(8, { kind: 'duration', values: [5, 10] })).toBe(10);
    });
    (0, vitest_1.it)('clamps to a min/max range', () => {
        (0, vitest_1.expect)((0, normalize_1.clampDuration)(2, { kind: 'duration', min: 4, max: 15 })).toBe(4);
        (0, vitest_1.expect)((0, normalize_1.clampDuration)(20, { kind: 'duration', min: 4, max: 15 })).toBe(15);
        (0, vitest_1.expect)((0, normalize_1.clampDuration)(8, { kind: 'duration', min: 4, max: 15 })).toBe(8);
    });
});
(0, vitest_1.describe)('normalizeSettings', () => {
    const ALL = new Set(['near-aspect-ratio', 'near-duration']);
    (0, vitest_1.it)('snaps enabled kinds and records the adjustments', () => {
        const out = (0, normalize_1.normalizeSettings)({ aspectRatio: '1920:1081', duration: 7, resolution: '720p' }, {
            aspectRatio: { kind: 'aspectRatio', options: ['1:1', '16:9'] },
            duration: { kind: 'duration', values: [5, 10] },
        }, ALL);
        (0, vitest_1.expect)(out.settings).toEqual({ aspectRatio: '16:9', duration: 5, resolution: '720p' });
        (0, vitest_1.expect)(out.adjustments).toEqual([
            { field: 'aspectRatio', from: '1920:1081', to: '16:9' },
            { field: 'duration', from: 7, to: 5 },
        ]);
    });
    (0, vitest_1.it)('leaves a kind untouched when it is not enabled (passthrough)', () => {
        const out = (0, normalize_1.normalizeSettings)({ aspectRatio: '1920:1081', duration: 7 }, {
            aspectRatio: { kind: 'aspectRatio', options: ['1:1', '16:9'] },
            duration: { kind: 'duration', values: [5, 10] },
        }, new Set(['near-aspect-ratio']));
        (0, vitest_1.expect)(out.settings).toEqual({ aspectRatio: '16:9', duration: 7 });
        (0, vitest_1.expect)(out.adjustments).toEqual([{ field: 'aspectRatio', from: '1920:1081', to: '16:9' }]);
    });
    (0, vitest_1.it)('skips a normalizer when the value is absent', () => {
        const out = (0, normalize_1.normalizeSettings)({ resolution: '720p' }, { aspectRatio: { kind: 'aspectRatio', options: ['1:1'] } }, ALL);
        (0, vitest_1.expect)(out.settings).toEqual({ resolution: '720p' });
        (0, vitest_1.expect)(out.adjustments).toEqual([]);
    });
});
//# sourceMappingURL=normalize.test.js.map