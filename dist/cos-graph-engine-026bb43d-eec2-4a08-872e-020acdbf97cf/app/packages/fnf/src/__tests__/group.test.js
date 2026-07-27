"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const group_1 = require("../group");
const codec = (0, group_1.group)({
    instruction: (0, group_1.field)('prompt'),
    enhance: (0, group_1.field)('enhance_prompt'),
});
(0, vitest_1.describe)('group codec', () => {
    (0, vitest_1.it)('serializes structured keys to wire keys, dropping undefined', () => {
        (0, vitest_1.expect)(codec.serialize({ instruction: 'cat', enhance: true })).toEqual({
            prompt: 'cat',
            enhance_prompt: true,
        });
        (0, vitest_1.expect)(codec.serialize({ instruction: 'cat' })).toEqual({ prompt: 'cat' });
    });
    (0, vitest_1.it)('parses wire keys back to structured keys', () => {
        (0, vitest_1.expect)(codec.parse({ prompt: 'cat', enhance_prompt: true })).toEqual({
            instruction: 'cat',
            enhance: true,
        });
    });
    (0, vitest_1.it)('exposes the wire keys it claims', () => {
        (0, vitest_1.expect)(codec.wireKeys.sort()).toEqual(['enhance_prompt', 'prompt']);
    });
    (0, vitest_1.it)('round-trips: parse(serialize(x)) === x', () => {
        const x = { instruction: 'dog', enhance: false };
        (0, vitest_1.expect)(codec.parse(codec.serialize(x))).toEqual(x);
    });
});
//# sourceMappingURL=group.test.js.map