"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const z_1 = require("../z");
(0, vitest_1.describe)('z helpers', () => {
    (0, vitest_1.it)('re-exports zod/mini primitives', () => {
        (0, vitest_1.expect)(typeof z_1.z.object).toBe('function');
        (0, vitest_1.expect)(typeof z_1.z.string).toBe('function');
        (0, vitest_1.expect)(typeof z_1.z.number).toBe('function');
    });
    (0, vitest_1.it)('aspectRatio validates against its options and carries a normalize tag', () => {
        const schema = (0, z_1.aspectRatio)(['1:1', '16:9']);
        (0, vitest_1.expect)(schema.parse('16:9')).toBe('16:9');
        (0, vitest_1.expect)((0, z_1.getNormalize)(schema)).toEqual({ kind: 'aspectRatio', options: ['1:1', '16:9'] });
    });
    (0, vitest_1.it)('duration validates a number and carries a normalize tag with values', () => {
        const schema = (0, z_1.duration)({ values: [5, 10] });
        (0, vitest_1.expect)(schema.parse(10)).toBe(10);
        (0, vitest_1.expect)((0, z_1.getNormalize)(schema)).toEqual({ kind: 'duration', values: [5, 10] });
    });
    (0, vitest_1.it)('duration supports a min/max range tag', () => {
        const schema = (0, z_1.duration)({ min: 4, max: 15 });
        (0, vitest_1.expect)((0, z_1.getNormalize)(schema)).toEqual({ kind: 'duration', min: 4, max: 15 });
    });
});
//# sourceMappingURL=z.test.js.map