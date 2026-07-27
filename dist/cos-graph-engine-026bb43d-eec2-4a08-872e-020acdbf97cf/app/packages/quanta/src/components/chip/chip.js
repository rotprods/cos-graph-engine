"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.chip = chip;
exports.Chip = Chip;
const cx_ts_1 = require("../utils/cx.ts");
const COLOR_CLASS = {
    brand: 'q-chip-brand',
    neutral: 'q-chip-neutral',
    success: 'q-chip-success',
    error: 'q-chip-error',
    warning: 'q-chip-warning',
    info: 'q-chip-info',
};
const SIZE_CLASS = {
    xxs: 'q-chip-xxs',
    xs: 'q-chip-xs',
    sm: 'q-chip-sm',
    md: 'q-chip-md',
};
function chip(options = {}, ...extra) {
    const { color = 'brand', size = 'sm', selected = false } = options;
    return (0, cx_ts_1.cx)('q-chip', COLOR_CLASS[color], SIZE_CLASS[size], selected && 'q-chip-selected', ...extra);
}
function Chip({ color, size, selected = false, className, type, start, end, children, ...props }) {
    // Slots flank the label only when set; otherwise children render bare so the
    // legacy icon-as-children pattern is unchanged. Gap + `& svg` do the spacing.
    const content = start != null || end != null ? <>{start}{children}{end}</> : children;
    return (<button type={type ?? 'button'} aria-pressed={selected} data-selected={selected ? '' : undefined} className={chip({ color, size, selected }, className)} {...props}>
      {content}
    </button>);
}
//# sourceMappingURL=chip.js.map