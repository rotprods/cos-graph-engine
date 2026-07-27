"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cx_ts_1 = require("./cx.ts");
(0, vitest_1.describe)('cx', () => {
    (0, vitest_1.it)('joins truthy class names with a space', () => {
        (0, vitest_1.expect)((0, cx_ts_1.cx)('a', 'b')).toBe('a b');
    });
    (0, vitest_1.it)('drops falsy values', () => {
        (0, vitest_1.expect)((0, cx_ts_1.cx)('a', false, undefined, null, '', 'b')).toBe('a b');
    });
});
//# sourceMappingURL=cx.test.js.map