import type { CSSProperties, ReactNode } from 'react';
import { type GridGap } from './grid-gap.ts';
/**
 * VirtualGrid — a windowed, data-driven uniform grid for big feeds & galleries.
 * Where `Grid` lays out arbitrary children, VirtualGrid takes an `items` array +
 * `renderItem` and renders ONLY the rows in view (plus `overscan` rows) via
 * `useGridVirtualizer`, so 10k cells cost the same as a screenful.
 *
 *   <VirtualGrid
 *     items={photos} rowHeight={220} minColWidth={180} gap={3} overscan={4}
 *     height="40rem" getKey={p => p.id}
 *     renderItem={p => <Media ratio="square"><Media.Image src={p.src} /></Media>}
 *   />
 *
 * Uniform rows: each cell is laid out at exactly `rowHeight` (`grid-auto-rows`),
 * which is what lets the scroll math stay exact without measuring every cell.
 * Columns are `cols` (fixed) or derived from the measured width + `minColWidth`
 * (ResizeObserver). Pair with `Media.Video autoPlayInView` for a feed that only
 * plays the clips actually on screen.
 */
/** Per-cell render context — lets a cell defer expensive work during fast scroll. */
export type VirtualGridItemMeta = {
    /** True while the user is flinging fast enough to defer image/video/API loads. */
    isScrolling: boolean;
};
export type VirtualGridProps<Item> = {
    /** The full dataset. Only the visible window is rendered. */
    items: readonly Item[];
    /**
     * Render one cell (wrapped in a `q-grid-item`). `meta.isScrolling` is true
     * during a fast fling — render a cheap placeholder then and load the real
     * image/video/fetch only when it is false (slow scroll or settled), so a fast
     * scroll fires no requests.
     */
    renderItem: (item: Item, index: number, meta: VirtualGridItemMeta) => ReactNode;
    /** Stable React key per item. Defaults to the index. */
    getKey?: (item: Item, index: number) => string | number;
    /** Fixed column count. Omit and set `minColWidth` for responsive columns. */
    cols?: number;
    /** Min column width in px — columns are derived from the measured width. */
    minColWidth?: number;
    /** Cell (row) height in px — drives `grid-auto-rows` and the scroll math. */
    rowHeight: number;
    /** Gap on both axes (shared GridGap scale). Default 4. */
    gap?: GridGap;
    /** Extra rows rendered above/below the viewport. Default 3. */
    overscan?: number;
    /** Scroll speed (px/ms) above which `meta.isScrolling` defers loads. Default 1.5; `0` disables. */
    velocityThreshold?: number;
    /** Height of the scroll viewport (CSS length). Default `32rem`. */
    height?: string;
    /** Class for the inner grid track. */
    className?: string;
    /** Class for the scroll viewport. */
    viewportClassName?: string;
    style?: CSSProperties;
};
export declare function VirtualGrid<Item>({ items, renderItem, getKey, cols, minColWidth, rowHeight, gap, overscan, velocityThreshold, height, className, viewportClassName, style, }: VirtualGridProps<Item>): any;
//# sourceMappingURL=virtual-grid.d.ts.map