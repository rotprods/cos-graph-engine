"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const types_1 = require("../types");
(0, vitest_1.describe)('status helpers', () => {
    (0, vitest_1.it)('marks completed/failed/nsfw/canceled/ip_detected as terminal', () => {
        (0, vitest_1.expect)((0, types_1.isTerminal)('completed')).toBe(true);
        (0, vitest_1.expect)((0, types_1.isTerminal)('failed')).toBe(true);
        (0, vitest_1.expect)((0, types_1.isTerminal)('nsfw')).toBe(true);
        (0, vitest_1.expect)((0, types_1.isTerminal)('canceled')).toBe(true);
        (0, vitest_1.expect)((0, types_1.isTerminal)('ip_detected')).toBe(true);
    });
    (0, vitest_1.it)('marks in-flight statuses as not terminal', () => {
        (0, vitest_1.expect)((0, types_1.isTerminal)('pending')).toBe(false);
        (0, vitest_1.expect)((0, types_1.isTerminal)('queued')).toBe(false);
        (0, vitest_1.expect)((0, types_1.isTerminal)('in_progress')).toBe(false);
    });
    (0, vitest_1.it)('exposes exactly five terminal statuses', () => {
        (0, vitest_1.expect)(types_1.TERMINAL_STATUSES.size).toBe(5);
    });
});
//# sourceMappingURL=types.test.js.map