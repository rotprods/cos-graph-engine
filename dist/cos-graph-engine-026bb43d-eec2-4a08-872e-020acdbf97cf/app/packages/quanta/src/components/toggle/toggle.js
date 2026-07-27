"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toggle = Toggle;
const toggle_1 = require("@base-ui/react/toggle");
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const SIZE_CLASS = {
    sm: 'q-toggle-sm',
    md: 'q-toggle-md',
    lg: 'q-toggle-lg',
};
function Toggle({ color = 'brand', size = 'md', start, end, className, style, children, ...props }) {
    // Slots flank the label only when set; otherwise children render bare so the
    // legacy icon-as-children pattern is unchanged. Gap + `& svg` do the spacing.
    const content = start != null || end != null ? <>{start}{children}{end}</> : children;
    return (<toggle_1.Toggle style={{ ...(0, slot_ts_1.slotStyle)(color), ...style }} className={state => (0, cx_ts_1.cx)('q-toggle', SIZE_CLASS[size], typeof className === 'function' ? className(state) : className)} {...props}>
      {content}
    </toggle_1.Toggle>);
}
//# sourceMappingURL=toggle.js.map