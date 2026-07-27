"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_STATUSES = void 0;
exports.isTerminal = isTerminal;
exports.TERMINAL_STATUSES = new Set([
    'completed',
    'failed',
    'nsfw',
    'canceled',
    'ip_detected',
]);
function isTerminal(status) {
    return exports.TERMINAL_STATUSES.has(status);
}
//# sourceMappingURL=types.js.map