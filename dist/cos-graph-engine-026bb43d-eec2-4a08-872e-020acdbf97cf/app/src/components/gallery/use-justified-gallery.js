"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DENSITY = exports.DENSITY_ROW_HEIGHTS = void 0;
exports.useJustifiedGallery = useJustifiedGallery;
const react_1 = require("react");
const justified_engine_ts_1 = require("./justified-engine.ts");
const demo_data_ts_1 = require("./demo-data.ts");
/**
 * Density presets — index 0 is the largest / least-dense tiles, index 4 the
 * smallest / densest. The value is the target row height in px that the engine
 * packs against.
 */
exports.DENSITY_ROW_HEIGHTS = [320, 250, 200, 160, 128];
exports.DEFAULT_DENSITY = 2;
const GAP = 6;
/** Rows within this many px of the viewport edge are rendered (windowing). */
const OVERSCAN_PX = 600;
/** Scroll speed (px/ms) above which we show cheap placeholders instead of media. */
const FAST_SCROLL_VELOCITY = 1.6;
/** How long after the last scroll frame we consider scrolling "settled". */
const SETTLE_MS = 150;
/** Load the next batch when the viewport bottom is within this px of the end. */
const INFINITE_MARGIN = 1200;
/** Cap total items so the demo can't grow without bound. */
const MAX_ITEMS = 1400;
function useJustifiedGallery(items) {
    const viewportRef = (0, react_1.useRef)(null);
    const engineRef = (0, react_1.useRef)(null);
    if (engineRef.current == null)
        engineRef.current = new justified_engine_ts_1.JustifiedLayoutEngine();
    const engine = engineRef.current;
    const [width, setWidth] = (0, react_1.useState)(0);
    const [density, setDensityState] = (0, react_1.useState)(exports.DEFAULT_DENSITY);
    const [scrollTop, setScrollTop] = (0, react_1.useState)(0);
    const [viewportHeight, setViewportHeight] = (0, react_1.useState)(0);
    const [range, setRange] = (0, react_1.useState)({ startRow: 0, endRow: 0 });
    const [fastScroll, setFastScroll] = (0, react_1.useState)(false);
    // Infinite-scroll state: appended "older" batches beyond the initial set.
    const [olderItems, setOlderItems] = (0, react_1.useState)([]);
    const [loadingMore, setLoadingMore] = (0, react_1.useState)(false);
    const pageRef = (0, react_1.useRef)(0);
    const allItems = (0, react_1.useMemo)(() => (olderItems.length > 0 ? [...items, ...olderItems] : items), [items, olderItems]);
    const targetRowHeight = exports.DENSITY_ROW_HEIGHTS[density] ?? exports.DENSITY_ROW_HEIGHTS[exports.DEFAULT_DENSITY];
    // Feed geometry to the engine and (re)compute the layout. The engine caches
    // internally, so this is cheap when nothing changed.
    const layout = (0, react_1.useMemo)(() => {
        engine.setItems(allItems);
        engine.setConfig({ containerWidth: width, targetRowHeight, gap: GAP });
        return engine.getLayout();
    }, [engine, allItems, width, targetRowHeight]);
    // Anchor captured on the last scroll frame (against the pre-change layout) so
    // a density change or resize can re-pin the same item under the viewport.
    const anchorRef = (0, react_1.useRef)({ index: 0, offset: 0 });
    const readRange = (0, react_1.useCallback)(() => {
        const el = viewportRef.current;
        if (el == null)
            return;
        const st = el.scrollTop;
        const vh = el.clientHeight;
        const win = engine.getWindow(st, vh, OVERSCAN_PX);
        setScrollTop(st);
        setViewportHeight(vh);
        setRange(prev => (prev.startRow === win.startRow && prev.endRow === win.endRow ? prev : win));
    }, [engine]);
    // Measure width + height with a ResizeObserver.
    (0, react_1.useLayoutEffect)(() => {
        const el = viewportRef.current;
        if (el == null || typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(() => {
            setWidth(el.clientWidth);
            setViewportHeight(el.clientHeight);
        });
        ro.observe(el);
        setWidth(el.clientWidth);
        setViewportHeight(el.clientHeight);
        return () => ro.disconnect();
    }, []);
    // After any re-layout (width / density / items), recompute the window and
    // restore the scroll anchor so the visible content stays stable.
    (0, react_1.useLayoutEffect)(() => {
        const el = viewportRef.current;
        if (el == null)
            return;
        const anchor = anchorRef.current;
        if (anchor.index > 0) {
            const nextTop = engine.getItemTop(anchor.index) + anchor.offset;
            if (Math.abs(nextTop - el.scrollTop) > 0.5)
                el.scrollTop = nextTop;
        }
        readRange();
        // Depend on the layout object identity, which changes on every recompute.
    }, [engine, layout, readRange]);
    // Keep a stable loader that reads the freshest counts via refs.
    const loadingRef = (0, react_1.useRef)(false);
    const countRef = (0, react_1.useRef)(allItems.length);
    countRef.current = allItems.length;
    const triggerLoadMore = (0, react_1.useCallback)(() => {
        if (loadingRef.current)
            return;
        if (countRef.current >= MAX_ITEMS)
            return;
        loadingRef.current = true;
        setLoadingMore(true);
        // Simulate a paged fetch; keep it snappy for a demo.
        window.setTimeout(() => {
            const page = pageRef.current++;
            setOlderItems(prev => [...prev, ...(0, demo_data_ts_1.makeOlderBatch)(page)]);
            loadingRef.current = false;
            setLoadingMore(false);
        }, 120);
    }, []);
    // Scroll handling: rAF-throttled window recompute + velocity → fastScroll +
    // infinite-scroll trigger. All measurement math is delegated to the engine.
    (0, react_1.useEffect)(() => {
        const el = viewportRef.current;
        if (el == null)
            return;
        let raf = 0;
        let lastTop = el.scrollTop;
        let lastTime = performance.now();
        let settleTimer = 0;
        const onScroll = () => {
            if (raf !== 0)
                return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const now = performance.now();
                const st = el.scrollTop;
                const dt = now - lastTime;
                const velocity = dt > 0 ? Math.abs(st - lastTop) / dt : 0;
                lastTop = st;
                lastTime = now;
                // Capture the anchor for the next density/resize re-layout.
                anchorRef.current = engine.findAnchor(st);
                if (velocity > FAST_SCROLL_VELOCITY) {
                    setFastScroll(true);
                    window.clearTimeout(settleTimer);
                    settleTimer = window.setTimeout(() => setFastScroll(false), SETTLE_MS);
                }
                readRange();
                // Infinite scroll: append an older batch as the bottom nears.
                const nearBottom = st + el.clientHeight >= engine.getLayout().totalHeight - INFINITE_MARGIN;
                if (nearBottom)
                    triggerLoadMore();
            });
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', onScroll);
            if (raf !== 0)
                cancelAnimationFrame(raf);
            window.clearTimeout(settleTimer);
        };
    }, [engine, readRange, triggerLoadMore]);
    const setDensity = (0, react_1.useCallback)((level) => {
        // The anchor was captured on the last scroll frame; refresh it against the
        // live scroll position right now so the re-pin is exact even without a
        // recent scroll event.
        const el = viewportRef.current;
        if (el != null)
            anchorRef.current = engine.findAnchor(el.scrollTop);
        setDensityState(level);
    }, [engine]);
    const visibleRows = (0, react_1.useMemo)(() => layout.rows.slice(range.startRow, range.endRow), [layout, range.startRow, range.endRow]);
    return {
        viewportRef,
        layout,
        visibleRows,
        scrollTop,
        viewportHeight,
        fastScroll,
        density,
        setDensity,
        itemCount: allItems.length,
        loadingMore,
    };
}
//# sourceMappingURL=use-justified-gallery.js.map