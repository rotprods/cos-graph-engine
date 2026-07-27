"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualGrid = VirtualGrid;
const react_1 = require("react");
const grid_gap_ts_1 = require("./grid-gap.ts");
const use_grid_virtualizer_ts_1 = require("./use-grid-virtualizer.ts");
const cx_ts_1 = require("../utils/cx.ts");
function VirtualGrid({ items, renderItem, getKey, cols, minColWidth, rowHeight, gap = 4, overscan = 3, velocityThreshold, height = '32rem', className, viewportClassName, style, }) {
    const gapPx = grid_gap_ts_1.GAP_PX[gap];
    // Responsive column count derived from the measured viewport width when `cols`
    // isn't fixed — `floor((width + gap) / (minColWidth + gap))`.
    const [width, setWidth] = (0, react_1.useState)(0);
    const columns = cols
        ?? (minColWidth != null && width > 0 ? Math.max(1, Math.floor((width + gapPx) / (minColWidth + gapPx))) : 1);
    const { scrollRef, totalHeight, start, end, offsetY, isScrolling } = (0, use_grid_virtualizer_ts_1.useGridVirtualizer)({
        count: items.length,
        columns,
        rowHeight,
        rowGap: gapPx,
        overscan,
        velocityThreshold,
    });
    (0, react_1.useEffect)(() => {
        if (cols != null || minColWidth == null)
            return;
        const el = scrollRef.current;
        if (el == null || typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(() => setWidth(el.clientWidth));
        ro.observe(el);
        setWidth(el.clientWidth);
        return () => ro.disconnect();
    }, [cols, minColWidth, scrollRef]);
    const cells = [];
    for (let i = start; i < end; i++) {
        const item = items[i];
        if (item === undefined)
            continue;
        cells.push(<div key={getKey ? getKey(item, i) : i} className="q-grid-item">
        {renderItem(item, i, { isScrolling })}
      </div>);
    }
    return (<div ref={scrollRef} className={(0, cx_ts_1.cx)('q-virtual-grid', viewportClassName)} style={{ height, ...style }}>
      <div className="q-virtual-grid-sizer" style={{ height: totalHeight }}>
        <div className={(0, cx_ts_1.cx)('q-grid', 'q-virtual-grid-track', grid_gap_ts_1.GAP_CLASS[gap], className)} style={{
            transform: `translateY(${offsetY}px)`,
            gridAutoRows: `${rowHeight}px`,
            '--q-grid-cols': columns,
        }}>
          {cells}
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=virtual-grid.js.map