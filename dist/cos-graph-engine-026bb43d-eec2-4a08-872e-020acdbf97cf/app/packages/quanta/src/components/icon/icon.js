"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.icon = icon;
exports.Icon = Icon;
const react_1 = require("react");
const cx_ts_1 = require("../utils/cx.ts");
const SIZE_CLASS = {
    xs: 'q-icon-xs',
    sm: 'q-icon-sm',
    md: 'q-icon-md',
    lg: 'q-icon-lg',
    xl: 'q-icon-xl',
};
const COLOR_CLASS = {
    primary: 'text-q-icon-primary',
    secondary: 'text-q-icon-secondary',
    tertiary: 'text-q-icon-tertiary',
    brand: 'text-q-icon-brand',
    accent: 'text-q-icon-accent',
    inverse: 'text-q-icon-inverse',
    disabled: 'text-q-icon-disabled',
    error: 'text-q-icon-error',
    success: 'text-q-icon-success',
    warning: 'text-q-icon-warning',
    info: 'text-q-icon-info',
};
/** Recipe — the composite icon class string, for styling a glyph element directly. */
function icon(options = {}, ...extra) {
    const { size = 'md', color } = options;
    return (0, cx_ts_1.cx)('q-icon', SIZE_CLASS[size], color && COLOR_CLASS[color], ...extra);
}
function Icon({ size = 'md', color, as: As, children, label, className, ref, role, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden, }) {
    const accessibleLabel = ariaLabel ?? label;
    // Props painted DIRECTLY onto the glyph svg (no wrapper element). `q-icon`
    // sizes the svg via --hf-icon-*; color flows through `currentColor`.
    const glyphProps = {
        ref,
        role: role ?? (accessibleLabel ? 'img' : undefined),
        'aria-label': accessibleLabel,
        'aria-hidden': ariaHidden ?? (accessibleLabel ? undefined : true),
        className: icon({ size, color }, className),
    };
    // `as` wins over `children`: render the glyph component with our props.
    if (As)
        return <As {...glyphProps}/>;
    // `children` is a single glyph element; clone it so the props (incl. our
    // className) merge onto its svg — the glyphs spread incoming props last.
    if ((0, react_1.isValidElement)(children))
        return (0, react_1.cloneElement)(children, glyphProps);
    return null;
}
//# sourceMappingURL=icon.js.map