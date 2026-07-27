"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kbd = Kbd;
exports.KbdSequence = KbdSequence;
const react_1 = require("react");
const index_ts_1 = require("../typography/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
function Kbd({ className, children, color: _color, ...props }) {
    // The `<kbd>` is the text-styled surface the component owns: its composite type
    // (caption-sm-medium) + color (text-primary) come from Typography; the chip's
    // own layout/border/surface classes ride in className (applied last).
    return (<index_ts_1.Typography as="kbd" variant="caption-sm-medium" color="primary" className={(0, cx_ts_1.cx)('inline-flex h-5 shrink-0 items-center justify-center gap-0.5 rounded-q-100 px-1 align-middle', 'border-q-hairline border-q-border-subtle bg-q-overlay-hover', className)} {...props}>
      {children}
    </index_ts_1.Typography>);
}
function KbdSequence({ separator = '+', keys, className, children, ...props }) {
    const items = keys
        ? keys.map((k, i) => typeof k === 'string' || typeof k === 'number'
            ? <Kbd key={i}>{k}</Kbd>
            : k)
        : react_1.Children.toArray(children);
    return (<span className={(0, cx_ts_1.cx)('inline-flex items-center gap-1 align-middle', className)} {...props}>
      {items.map((item, i) => (<span key={i} className="inline-flex items-center gap-1">
          {item}
          {separator != null && i < items.length - 1
                ? (<index_ts_1.Typography as="span" variant="caption-sm-regular" color="tertiary" aria-hidden>
                  {separator}
                </index_ts_1.Typography>)
                : null}
        </span>))}
    </span>);
}
//# sourceMappingURL=kbd.js.map