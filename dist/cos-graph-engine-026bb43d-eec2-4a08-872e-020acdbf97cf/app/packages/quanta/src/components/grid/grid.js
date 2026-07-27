"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Grid = void 0;
const react_1 = require("react");
const grid_gap_ts_1 = require("./grid-gap.ts");
const use_flip_ts_1 = require("../utils/use-flip.ts");
const cx_ts_1 = require("../utils/cx.ts");
const FLOW_CLASS = {
    row: 'grid-flow-row',
    col: 'grid-flow-col',
    dense: 'grid-flow-row-dense',
};
const ALIGN_CLASS = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
};
const JUSTIFY_CLASS = {
    start: 'justify-items-start',
    center: 'justify-items-center',
    end: 'justify-items-end',
    stretch: 'justify-items-stretch',
};
function Root({ cols = 1, minColWidth, gap, gapX, gapY, flow, align, justify, animate = false, className, style, ref, children, ...props }) {
    const autoTrack = cols === 'auto-fit' || cols === 'auto-fill';
    // FLIP key: the children's flipKey/key sequence. When it changes (reorder /
    // filter / add), useFlip animates the cells from their old boxes; null when
    // not animating, so the effect is a cheap no-op.
    const flipDependency = (0, react_1.useMemo)(() => {
        if (!animate)
            return null;
        return react_1.Children.toArray(children)
            .map(child => ((0, react_1.isValidElement)(child) ? String(child.props.flipKey ?? child.key ?? '') : ''))
            .join('|');
    }, [animate, children]);
    const flipRef = (0, use_flip_ts_1.useFlip)(flipDependency);
    // Dynamic track config rides on private CSS vars — the sanctioned escape hatch
    // for values that can't be a static class (precedent: --q-slider-width).
    const gridVars = {
        ...(autoTrack ? null : { '--q-grid-cols': cols }),
        ...(minColWidth != null ? { '--q-grid-min': minColWidth } : null),
    };
    // Per-axis gap wins over the single `gap` on that axis; fall back to `gap`.
    const gapClasses = gapX != null || gapY != null
        ? (0, cx_ts_1.cx)(gapX != null ? grid_gap_ts_1.GAP_X_CLASS[gapX] : gap != null ? grid_gap_ts_1.GAP_X_CLASS[gap] : undefined, gapY != null ? grid_gap_ts_1.GAP_Y_CLASS[gapY] : gap != null ? grid_gap_ts_1.GAP_Y_CLASS[gap] : undefined)
        : gap != null
            ? grid_gap_ts_1.GAP_CLASS[gap]
            : undefined;
    return (<div className={(0, cx_ts_1.cx)('q-grid', cols === 'auto-fill' ? 'q-grid-autofill' : autoTrack ? 'q-grid-autofit' : undefined, gapClasses, flow != null ? FLOW_CLASS[flow] : undefined, align != null ? ALIGN_CLASS[align] : undefined, justify != null ? JUSTIFY_CLASS[justify] : undefined, className)} style={{ ...gridVars, ...style }} ref={animate ? flipRef : ref} {...props}>
      {children}
    </div>);
}
function Item({ colSpan, rowSpan, colStart, flipKey, className, style, ...props }) {
    // Span/start are positional integers, not on any token scale — they ride on
    // inline grid placement (the sanctioned dynamic-style escape hatch).
    const placement = {
        ...(colSpan != null ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : null),
        ...(rowSpan != null ? { gridRow: `span ${rowSpan} / span ${rowSpan}` } : null),
        ...(colStart != null ? { gridColumnStart: colStart } : null),
    };
    return (<div className={(0, cx_ts_1.cx)('q-grid-item', className)} style={{ ...placement, ...style }} data-flip-key={flipKey != null ? String(flipKey) : undefined} {...props}/>);
}
exports.Grid = Object.assign(Root, { Item });
//# sourceMappingURL=grid.js.map