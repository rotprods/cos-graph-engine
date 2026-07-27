"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cx = cx;
/**
 * Minimal class-name joiner. No tailwind-merge: components apply a single
 *  composite `menu-*` class plus an optional caller `className`.
 */
function cx(...values) {
    return values.filter(Boolean).join(' ');
}
//# sourceMappingURL=cx.js.map