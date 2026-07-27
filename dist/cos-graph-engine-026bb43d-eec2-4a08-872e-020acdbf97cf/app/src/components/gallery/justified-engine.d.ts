import type { GalleryItem } from './types.ts';
/**
 * JustifiedLayoutEngine — a bespoke, out-of-React layout + windowing engine for
 * a Flickr / Google-Photos style justified-masonry gallery.
 *
 * It is a plain TypeScript class with NO React dependency. The React layer feeds
 * it the item list and the current geometry (container width, target row height,
 * gap) and, on every scroll frame, asks it which rows are visible. All of the
 * heavy math — packing items into equal-height rows, justifying each row to the
 * container width, stacking dated groups with headers, binary-searching the
 * visible window, and classifying load tiers by distance from the viewport —
 * lives here, so the React tree only ever renders a screenful of absolutely
 * positioned tiles.
 *
 * ── The justified algorithm ──────────────────────────────────────────────────
 * Pick a target row height `h0`. Each item, scaled to `h0`, has display width
 * `h0 * aspect`. Greedily pack items into a row until their combined natural
 * width (plus gaps) reaches the container width, then solve for the exact row
 * height that makes the row fill the width precisely:
 *
 *     h = (containerWidth - gap * (n - 1)) / Σ aspectᵢ
 *
 * and set each tile width to `h * aspectᵢ`. The final (incomplete) row of a
 * group is left at the target height (never over-stretched) and left-aligned.
 */
/** One tile's resolved rectangle, relative to its row's top-left. */
export interface TileRect {
    /** Index into the flat items array. */
    index: number;
    item: GalleryItem;
    /** Horizontal offset within the content column. */
    x: number;
    width: number;
    height: number;
}
export type LayoutRowType = 'header' | 'tiles';
/** A laid-out row — either a dated group header or a justified row of tiles. */
export interface LayoutRow {
    type: LayoutRowType;
    /** Absolute top offset within the scrollable content. */
    y: number;
    height: number;
    /** Sequential index among rows (stable key). */
    key: string;
    /** header only — the group label. */
    label?: string;
    /** tiles only — the justified tiles in this row. */
    tiles?: TileRect[];
}
export interface Layout {
    rows: LayoutRow[];
    totalHeight: number;
    /** Number of items covered by this layout (for infinite-scroll bookkeeping). */
    itemCount: number;
}
export interface EngineConfig {
    /** Inner content width in px (viewport clientWidth). */
    containerWidth: number;
    /** Target/base row height in px — the density knob. */
    targetRowHeight: number;
    /** Gap between tiles AND between rows, in px. */
    gap: number;
    /** Header band height in px. */
    headerHeight: number;
    /** Extra space below each group. */
    groupGap: number;
    /**
     * Clamp on the per-row aspect sum before a row is force-closed, so a run of
     * ultra-wide panoramas can't produce a single skyscraper-tall row.
     */
    maxRowHeight: number;
}
export declare class JustifiedLayoutEngine {
    private items;
    private groups;
    private config;
    private layout;
    /** Per-item resolved geometry, indexed by item index — powers scroll anchoring. */
    private itemTops;
    private itemHeights;
    private dirty;
    setItems(items: GalleryItem[]): void;
    /** Returns true if any geometry field actually changed. */
    setConfig(patch: Partial<EngineConfig>): boolean;
    getConfig(): Readonly<EngineConfig>;
    private recomputeGroups;
    /** Compute (or return cached) layout for the current items + config. */
    compute(): Layout;
    getLayout(): Layout;
    /**
     * The visible window: the [startRow, endRow) slice of rows intersecting the
     * viewport expanded by `overscanPx` on each edge. Binary-searches the rows
     * (which are sorted by `y`) so cost is O(log n), independent of dataset size.
     */
    getWindow(scrollTop: number, viewportHeight: number, overscanPx: number): {
        startRow: number;
        endRow: number;
    };
    /** Top offset of an item — used to re-pin the scroll after a re-layout. */
    getItemTop(index: number): number;
    getItemHeight(index: number): number;
    /**
     * The topmost item at least partially visible at `scrollTop`, plus the pixel
     * offset between the viewport top and that item's top. The React layer stores
     * this before a density/resize re-layout and restores it afterwards so the
     * content under the user's eyes stays put (scroll anchoring).
     */
    findAnchor(scrollTop: number): {
        index: number;
        offset: number;
    };
}
//# sourceMappingURL=justified-engine.d.ts.map