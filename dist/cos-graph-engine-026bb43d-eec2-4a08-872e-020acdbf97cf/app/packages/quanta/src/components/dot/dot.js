"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dot = Dot;
const cx_ts_1 = require("../utils/cx.ts");
const SIZE_CLASS = {
    md: 'size-q-200', // 8px
    sm: 'size-q-150', // 6px
    xs: 'size-q-100', // 4px
};
const RING = {
    md: 'border-q-thick', // 2px
    sm: 'border-q-medium', // 1.5px
    xs: 'border-q-medium', // 1.5px
};
const RING_COLOR = {
    green: {
        md: 'border-q-background-glass',
        sm: 'border-q-background-glass',
        // Figma variable `transparent/dark/05` is white 5% in this dark design.
        xs: 'border-q-transparent-light-05',
    },
    yellow: {
        md: 'border-q-background-glass',
        sm: 'border-q-background-glass',
        xs: 'border-q-background-glass',
    },
    red: {
        md: 'border-q-background-glass',
        sm: 'border-q-background-glass',
        xs: 'border-q-background-glass',
    },
    grey: {
        md: 'border-q-background-glass',
        sm: 'border-q-background-glass',
        xs: 'border-q-background-glass',
    },
};
const FILL = {
    green: 'bg-q-palette-mint-bg',
    yellow: 'bg-q-brand-yellow',
    red: 'bg-q-palette-pink-bg',
    grey: 'bg-q-icon-secondary',
};
/**
 * Sets `color` to the fill so the animations (which use `currentColor` for their
 * rings / halo) inherit the dot's colour. Applied only when animating.
 */
const INK = {
    green: 'text-q-palette-mint-bg',
    yellow: 'text-q-brand-yellow',
    red: 'text-q-palette-pink-bg',
    grey: 'text-q-icon-secondary',
};
const ANIMATION = {
    pulse: 'q-dot-pulse',
    glow: 'q-dot-glow',
};
function Dot({ color = 'green', size = 'md', animation, label, className, role, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden, ...props }) {
    const accessibleLabel = ariaLabel ?? label;
    return (<span role={role ?? (accessibleLabel ? 'img' : undefined)} aria-label={accessibleLabel} aria-hidden={ariaHidden ?? (accessibleLabel ? undefined : true)} className={(0, cx_ts_1.cx)('q-dot box-content block shrink-0 rounded-q-full', SIZE_CLASS[size], RING[size], RING_COLOR[color][size], FILL[color], animation && ANIMATION[animation], animation && INK[color], className)} {...props}/>);
}
//# sourceMappingURL=dot.js.map