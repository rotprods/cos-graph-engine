"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.glass = glass;
exports.Glass = Glass;
const use_render_1 = require("@base-ui/react/use-render");
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const BLUR_CLASS = {
    sm: 'q-glass-blur-sm',
    md: 'q-glass-blur-md',
    lg: 'q-glass-blur-lg',
};
const ELEVATION_CLASS = {
    flat: '',
    raised: 'q-glass-raised',
};
const ROUNDED_CLASS = {
    200: 'q-glass-rounded-200',
    300: 'q-glass-rounded-300',
    400: 'q-glass-rounded-400',
    500: 'q-glass-rounded-500',
    600: 'q-glass-rounded-600',
    full: 'q-glass-rounded-full',
};
/** Build the glass surface class string — usable to skin any element as glass. */
function glass(options = {}, ...extra) {
    const { blur = 'md', elevation = 'flat', rounded = '600', interactive = false } = options;
    return (0, cx_ts_1.cx)('q-glass', BLUR_CLASS[blur], ELEVATION_CLASS[elevation], ROUNDED_CLASS[rounded], interactive && 'q-glass-interactive', ...extra);
}
function Glass({ blur, elevation, rounded, interactive, tint, className, style, render, ref, ...props }) {
    // `ref` must go to useRender's dedicated `ref` option (it is NOT read from
    // props), so spreading it via props would drop it from the rendered root.
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: glass({ blur, elevation, rounded, interactive }, tint != null && 'q-glass-tinted', className),
            // Tint wires the private --q-tint* vars; only spread when a tint is set so
            // the neutral glass keeps its exact transparent-light highlight.
            style: tint != null ? { ...(0, slot_ts_1.slotStyle)(tint), ...style } : style,
            ...props,
        },
    });
}
//# sourceMappingURL=glass.js.map