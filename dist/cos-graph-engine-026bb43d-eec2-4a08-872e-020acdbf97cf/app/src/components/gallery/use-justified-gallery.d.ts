import type { RefObject } from 'react';
import type { Layout, LayoutRow } from './justified-engine.ts';
import type { GalleryItem } from './types.ts';
/**
 * Density presets — index 0 is the largest / least-dense tiles, index 4 the
 * smallest / densest. The value is the target row height in px that the engine
 * packs against.
 */
export declare const DENSITY_ROW_HEIGHTS: readonly [320, 250, 200, 160, 128];
export declare const DEFAULT_DENSITY = 2;
export interface UseJustifiedGalleryResult {
    viewportRef: RefObject<HTMLDivElement | null>;
    layout: Layout;
    /** The [startRow, endRow) slice of rows currently rendered. */
    visibleRows: LayoutRow[];
    /** Current scroll offset (px) — used to classify each tile's load tier. */
    scrollTop: number;
    viewportHeight: number;
    /** True during a fast fling — tiles should render cheap placeholders. */
    fastScroll: boolean;
    density: number;
    setDensity: (level: number) => void;
    itemCount: number;
    loadingMore: boolean;
}
export declare function useJustifiedGallery(items: GalleryItem[]): UseJustifiedGalleryResult;
//# sourceMappingURL=use-justified-gallery.d.ts.map