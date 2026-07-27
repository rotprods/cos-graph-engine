"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tag = Tag;
const index_ts_1 = require("../close-button/index.ts");
const index_ts_2 = require("../icon/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
function Tag({ color = 'neutral', start, end, onRemove, removeLabel = 'Remove', className, style, children, ...props }) {
    return (<span style={{ ...(0, slot_ts_1.slotStyle)(color), ...style }} className={(0, cx_ts_1.cx)('inline-flex max-w-full items-center gap-1 rounded-q-150 px-2 py-0.5 align-middle text-q-caption-sm-medium', 'q-slot-bg-10 q-slot-text', className)} {...props}>
      {start != null ? <span className="inline-flex shrink-0 items-center [&_svg]:size-q-icon-xs">{start}</span> : null}
      <span className="truncate">{children}</span>
      {end != null ? <span className="inline-flex shrink-0 items-center [&_svg]:size-q-icon-xs">{end}</span> : null}
      {onRemove
            ? (<button type="button" onClick={onRemove} aria-label={removeLabel} className={(0, cx_ts_1.cx)('-mr-0.5 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-q-100 outline-none transition-colors', 'hover:q-slot-bg-20 focus-visible:ring-2 focus-visible:q-slot-ring-40')}>
              <index_ts_2.Icon as={index_ts_1.CloseIcon} size="xs"/>
            </button>)
            : null}
    </span>);
}
//# sourceMappingURL=tag.js.map