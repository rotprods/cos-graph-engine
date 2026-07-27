"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prompt_1 = require("../prompt");
(0, vitest_1.describe)('promptCodec', () => {
    (0, vitest_1.it)('maps structured prompt to flat wire keys', () => {
        (0, vitest_1.expect)(prompt_1.promptCodec.serialize({ instruction: 'a cat', enhance: true, negative: 'blur' })).toEqual({
            prompt: 'a cat',
            enhance_prompt: true,
            negative_prompt: 'blur',
        });
    });
    (0, vitest_1.it)('parses flat wire keys back to structured prompt', () => {
        (0, vitest_1.expect)(prompt_1.promptCodec.parse({ prompt: 'a cat', enhance_prompt: true, system_prompt: 'be brief' })).toEqual({
            instruction: 'a cat',
            enhance: true,
            system: 'be brief',
        });
    });
    (0, vitest_1.it)('round-trips losslessly', () => {
        const x = { instruction: 'dog', enhance: false, negative: 'noise', system: 'x' };
        (0, vitest_1.expect)(prompt_1.promptCodec.parse(prompt_1.promptCodec.serialize(x))).toEqual(x);
    });
});
//# sourceMappingURL=prompt.test.js.map