import type { ComponentProps } from 'react';
import { type GridGap } from './grid-gap.ts';
export type { GridGap };
/**
 * Grid — a pure-quanta CSS-grid layout primitive covering "all kinds of grids".
 * No Base UI: it is a thin, token-clean wrapper over `display: grid` that lets
 * you express column counts, auto-fit/auto-fill responsive tracks, gaps, flow,
 * and item alignment without ever inlining an arbitrary value.
 *
 * Parts: `Grid` (the track) + `Grid.Item` (an optional cell that can span).
 *
 *   <Grid cols={3} gap={4}>…</Grid>                  // 3 equal columns
 *   <Grid cols="auto-fit" minColWidth="16rem" gap={4}>…</Grid>  // responsive
 *   <Grid cols={4} gap={3}>
 *     <Grid.Item colSpan={2} rowSpan={2}>featured</Grid.Item>
 *     …
 *   </Grid>
 *
 * Column count is wired through the private `--q-grid-cols` / `--q-grid-min`
 * CSS vars (the sanctioned dynamic-style escape hatch — like `--q-slider-width`),
 * read by the `q-grid` utility. The gap uses the native Tailwind `gap-N` scale
 * (mapped exhaustively below), so spacing stays on the shared spacing scale.
 *
 * RESPONSIVE NOTE: per-breakpoint `cols` objects ({ base, tablet, desktop }) are
 * intentionally OUT OF SCOPE here — use `cols="auto-fit"` + `minColWidth` for
 * fluid layouts (the columns reflow automatically), or set `--q-grid-cols` per
 * breakpoint on a wrapper. FLAGGED in the manifest.
 */
export type GridCols = number | 'auto-fit' | 'auto-fill';
export type GridFlow = 'row' | 'col' | 'dense';
export type GridAlign = 'start' | 'center' | 'end' | 'stretch';
export type GridJustify = 'start' | 'center' | 'end' | 'stretch';
/** 1..12 — the span steps for `Grid.Item`. */
export type GridSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GridProps = ComponentProps<'div'> & {
    /**
     * A fixed number of equal columns, or `'auto-fit'`/`'auto-fill'` to lay out as
     * many `minColWidth`-wide columns as fit. Defaults to a single column.
     */
    cols?: GridCols;
    /** Min column width for `auto-fit`/`auto-fill` tracks. Token-based length. */
    minColWidth?: string;
    /** Native Tailwind gap step applied to both axes. Ignored if gapX/gapY set. */
    gap?: GridGap;
    /** Native Tailwind column-gap step (overrides `gap` horizontally). */
    gapX?: GridGap;
    /** Native Tailwind row-gap step (overrides `gap` vertically). */
    gapY?: GridGap;
    /** grid-auto-flow. */
    flow?: GridFlow;
    /** align-items. */
    align?: GridAlign;
    /** justify-items. */
    justify?: GridJustify;
    /**
     * FLIP-animate the cells when the layout changes (reorder / filter / add).
     * Give each animating child a stable `flipKey` (e.g. `Grid.Item flipKey={id}`)
     * so the hook can match cells across renders. Honors `prefers-reduced-motion`.
     */
    animate?: boolean;
};
declare function Root({ cols, minColWidth, gap, gapX, gapY, flow, align, justify, animate, className, style, ref, children, ...props }: GridProps): any;
export type GridItemProps = ComponentProps<'div'> & {
    /** Number of columns this cell spans (1..12). */
    colSpan?: GridSpan;
    /** Number of rows this cell spans (1..12). */
    rowSpan?: GridSpan;
    /** 1-based column line this cell starts on. */
    colStart?: GridSpan;
    /** Stable id for FLIP layout animation (see Grid `animate`). Sets `data-flip-key`. */
    flipKey?: string | number;
};
declare function Item({ colSpan, rowSpan, colStart, flipKey, className, style, ...props }: GridItemProps): any;
export declare const Grid: typeof Root & {
    Item: typeof Item;
};
//# sourceMappingURL=grid.d.ts.map