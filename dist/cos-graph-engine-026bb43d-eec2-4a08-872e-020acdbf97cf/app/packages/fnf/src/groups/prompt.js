"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptCodec = void 0;
const group_1 = require("../group");
exports.promptCodec = (0, group_1.group)({
    instruction: (0, group_1.field)('prompt'),
    enhance: (0, group_1.field)('enhance_prompt'),
    negative: (0, group_1.field)('negative_prompt'),
    system: (0, group_1.field)('system_prompt'),
});
//# sourceMappingURL=prompt.js.map