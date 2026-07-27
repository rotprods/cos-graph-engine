"use strict";
/**
 * Shared grid gap scale — the native Tailwind spacing steps quanta exposes for
 * grids, as literal class maps (so Tailwind's scanner sees every class that can
 * render) plus a px map for the virtualizer's row math. Used by both `Grid` and
 * `VirtualGrid`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAP_PX = exports.GAP_Y_CLASS = exports.GAP_X_CLASS = exports.GAP_CLASS = void 0;
exports.GAP_CLASS = {
    1: 'gap-1',
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
    7: 'gap-7',
    8: 'gap-8',
    10: 'gap-10',
    12: 'gap-12',
    14: 'gap-14',
    16: 'gap-16',
    20: 'gap-20',
    24: 'gap-24',
};
exports.GAP_X_CLASS = {
    1: 'gap-x-1',
    2: 'gap-x-2',
    3: 'gap-x-3',
    4: 'gap-x-4',
    5: 'gap-x-5',
    6: 'gap-x-6',
    7: 'gap-x-7',
    8: 'gap-x-8',
    10: 'gap-x-10',
    12: 'gap-x-12',
    14: 'gap-x-14',
    16: 'gap-x-16',
    20: 'gap-x-20',
    24: 'gap-x-24',
};
exports.GAP_Y_CLASS = {
    1: 'gap-y-1',
    2: 'gap-y-2',
    3: 'gap-y-3',
    4: 'gap-y-4',
    5: 'gap-y-5',
    6: 'gap-y-6',
    7: 'gap-y-7',
    8: 'gap-y-8',
    10: 'gap-y-10',
    12: 'gap-y-12',
    14: 'gap-y-14',
    16: 'gap-y-16',
    20: 'gap-y-20',
    24: 'gap-y-24',
};
// Native Tailwind spacing: step × 0.25rem = step × 4px at the 16px root quanta
// assumes. The virtualizer needs the row gap in px to size rows correctly.
exports.GAP_PX = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
};
//# sourceMappingURL=grid-gap.js.map