"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGridVirtualizer = useGridVirtualizer;
const react_1 = require("react");
function useGridVirtualizer(options) {
    const { count, columns, rowHeight, rowGap = 0, overscan = 3, velocityThreshold = 3 } = options;
    const scrollRef = (0, react_1.useRef)(null);
    const cols = Math.max(1, columns);
    const rowStride = rowHeight + rowGap;
    const rowCount = Math.ceil(count / cols);
    const totalHeight = rowCount > 0 ? rowCount * rowStride - rowGap : 0;
    // Seed with a first window so SSR / first paint shows content immediately.
    const [view, setView] = (0, react_1.useState)({
        start: 0,
        end: Math.min(count, cols * (overscan + 2)),
        offsetY: 0,
        isScrolling: false,
    });
    (0, react_1.useEffect)(() => {
        const el = scrollRef.current;
        if (el == null)
            return;
        const clock = () => (typeof performance !== 'undefined' ? performance.now() : 0);
        let frame = 0;
        let settle;
        let lastTop = el.scrollTop;
        let lastTime = clock();
        let smoothVelocity = 0;
        const measure = () => {
            frame = 0;
            const scrollTop = el.scrollTop;
            const viewport = el.clientHeight || rowStride;
            const firstVisible = Math.floor(scrollTop / rowStride);
            const lastVisible = Math.ceil((scrollTop + viewport) / rowStride);
            // Clamp to real rows so a shrunk dataset / over-large scrollTop can't push
            // the window past the end and blank the grid.
            const maxRow = Math.max(0, rowCount - 1);
            const firstRow = Math.min(maxRow, Math.max(0, firstVisible - overscan));
            const lastRow = Math.min(maxRow, lastVisible + overscan);
            // Smoothed scroll speed (px/ms): an EMA so a single-frame spike or the
            // first frame after idle can't trip the gate — only SUSTAINED fast
            // scrolling does, and slowing back down decays it under the threshold so
            // loads resume before the user even stops.
            const time = clock();
            // Floor dt at ~one 120Hz frame so a tiny interval (unthrottled rAF / high-
            // refresh display) can't inflate the speed into a false fast-scroll trip.
            const dt = Math.max(time - lastTime, 8);
            const instant = Math.abs(scrollTop - lastTop) / dt;
            lastTop = scrollTop;
            lastTime = time;
            smoothVelocity = smoothVelocity * 0.7 + instant * 0.3;
            const fast = velocityThreshold > 0 && smoothVelocity > velocityThreshold;
            const start = firstRow * cols;
            const end = Math.min(count, (lastRow + 1) * cols);
            const offsetY = firstRow * rowStride;
            // Commit ONLY on a real change — returning the previous reference makes
            // React bail out, so steady/slow scrolling within a row doesn't re-render
            // (and re-run renderItem for) the whole window every frame. This identity
            // churn was what made the cells flash on every scroll move.
            setView(prev => prev.start === start && prev.end === end && prev.offsetY === offsetY && prev.isScrolling === fast
                ? prev
                : { start, end, offsetY, isScrolling: fast });
            // When the fling decays or the user lifts off, clear the flag shortly after
            // so loads resume even if the last sampled frame was still fast.
            if (settle !== undefined)
                clearTimeout(settle);
            if (fast)
                settle = setTimeout(() => setView(v => (v.isScrolling ? { ...v, isScrolling: false } : v)), 140);
        };
        const onScroll = () => {
            if (typeof requestAnimationFrame === 'undefined')
                return measure();
            if (frame === 0)
                frame = requestAnimationFrame(measure);
        };
        measure();
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            if (frame !== 0 && typeof cancelAnimationFrame !== 'undefined')
                cancelAnimationFrame(frame);
            if (settle !== undefined)
                clearTimeout(settle);
        };
    }, [count, cols, rowStride, rowCount, overscan, velocityThreshold]);
    return {
        scrollRef,
        totalHeight,
        start: view.start,
        end: view.end,
        offsetY: view.offsetY,
        isScrolling: view.isScrolling,
        rowCount,
        columns: cols,
    };
}
//# sourceMappingURL=use-grid-virtualizer.js.map