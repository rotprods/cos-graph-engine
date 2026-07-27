"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Divider = Divider;
const index_ts_1 = require("../typography/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
function Divider({ orientation = 'horizontal', className, children, ...props }) {
    // Labelled — needs to contain text, so we can't use <hr>.
    if (children != null && orientation === 'horizontal') {
        return (<div role="separator" aria-orientation="horizontal" className={(0, cx_ts_1.cx)('flex w-full items-center gap-2 align-middle', className)} {...props}>
        <span className="q-divider flex-1" aria-hidden/>
        <index_ts_1.Typography as="span" variant="caption-sm-medium" color="tertiary">
          {children}
        </index_ts_1.Typography>
        <span className="q-divider flex-1" aria-hidden/>
      </div>);
    }
    if (orientation === 'vertical') {
        return (<hr aria-orientation="vertical" className={(0, cx_ts_1.cx)('q-divider-vertical m-0 inline-block self-stretch', className)} {...props}/>);
    }
    return (<hr className={(0, cx_ts_1.cx)('q-divider m-0 block w-full', className)} {...props}/>);
}
//# sourceMappingURL=divider.js.map