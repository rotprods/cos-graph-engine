"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const generation_fold_1 = require("../generation-fold");
function gen(id, status, extra) {
    return { id, model: 'demo', type: 'image', status, input: { model: 'demo', settings: {} }, ...extra };
}
(0, vitest_1.describe)('foldGeneration', () => {
    (0, vitest_1.it)('progress folds forward', () => {
        const prev = gen('a', 'queued');
        const next = gen('a', 'in_progress');
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(prev, next)).toBe(next);
    });
    (0, vitest_1.it)('a stale snapshot can NOT reopen a settled generation (terminal anti-regress)', () => {
        const settled = gen('a', 'completed', { results: { rawUrl: 'https://x/a.png' } });
        const stale = gen('a', 'in_progress');
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(settled, stale)).toBe(settled);
    });
    (0, vitest_1.it)('terminal → terminal still folds (a late fail reason, a fresher result url)', () => {
        const prev = gen('a', 'completed', { results: { rawUrl: 'https://x/a.png' } });
        const next = gen('a', 'completed', { results: { rawUrl: 'https://x/a.png', minUrl: 'https://x/a-min.png' } });
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(prev, next)).toBe(next);
    });
    (0, vitest_1.it)('nothing observable changed → the PREVIOUS reference survives (memoization keeps working)', () => {
        const prev = gen('a', 'in_progress');
        const tick = gen('a', 'in_progress'); // a poll tick re-parsed into a fresh object
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(prev, tick)).toBe(prev);
    });
    (0, vitest_1.it)('no previous (or a different id) → the next snapshot wins', () => {
        const next = gen('a', 'queued');
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(undefined, next)).toBe(next);
        (0, vitest_1.expect)((0, generation_fold_1.foldGeneration)(gen('b', 'completed'), next)).toBe(next);
    });
});
//# sourceMappingURL=generation-fold.test.js.map