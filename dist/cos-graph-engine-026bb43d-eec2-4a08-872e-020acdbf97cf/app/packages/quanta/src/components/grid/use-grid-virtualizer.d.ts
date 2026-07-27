/**
 * useGridVirtualizer — headless windowing for a UNIFORM grid (equal cells). It
 * chunks `count` items into rows of `columns`, then — off the scroll container's
 * `scrollTop`/`clientHeight` — renders only the rows in view plus `overscan`
 * rows above and below. Zero dependencies; the uniform-grid case needs no
 * per-item measurement, just row arithmetic.
 *
 * Attach the returned `scrollRef` to the scroll container (fixed height,
 * `overflow:auto`). Give an inner sizer the returned `totalHeight` so the
 * scrollbar reflects the full set, and translate the rendered block by
 * `offsetY`. Render `items.slice(start, end)`.
 *
 * Scroll handling is rAF-throttled and passive; SSR/test safe (no rAF →
 * synchronous measure).
 */
export type UseGridVirtualizerOptions = {
    /** Total number of items. */
    count: number;
    /** Columns per row (>= 1). */
    columns: number;
    /** Estimated cell (row) height in px — the row gap is added on top. */
    rowHeight: number;
    /** Row gap in px (match the visual gap so the math lines up). Default 0. */
    rowGap?: number;
    /** Extra rows rendered above/below the viewport. Default 3. */
    overscan?: number;
    /**
     * SUSTAINED scroll speed (px/ms, smoothed) above which `isScrolling` flips true
     * so cells can defer expensive work (image/video/API loads) during a fast
     * fling. Smooth/slow scrolling stays below it (loads keep happening, buffered
     * by `overscan`); as soon as a fast scroll *slows down* the smoothed speed
     * drops back under it and loads resume. Set `0` to never defer. Default 3.
     */
    velocityThreshold?: number;
};
export declare function useGridVirtualizer<T extends HTMLElement = HTMLDivElement>(options: UseGridVirtualizerOptions): {
    scrollRef: any;
    totalHeight: number;
    start: any;
    end: any;
    offsetY: any;
    isScrolling: any;
    rowCount: number;
    columns: number;
};
//# sourceMappingURL=use-grid-virtualizer.d.ts.map