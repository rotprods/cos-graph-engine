import type { TileRect } from './justified-engine.ts';
import type { GalleryItem, LoadTier } from './types.ts';
/**
 * One gallery tile. It is absolutely positioned at the engine-computed rect and
 * composed from Quanta primitives:
 *   • `generating` items → `GenerationCard state="generating"` (the pulsing card).
 *   • ready items → a `GenerationCard` (image or hover-to-play video) that is the
 *     trigger of a `GenerationDetailModal`, preserving the click-to-open behavior.
 *
 * Load tiers (quality upgrade by distance) + fast-scroll placeholders are driven
 * by the `tier` / `fastScroll` props the engine layer computes — never by
 * per-tile measurement effects.
 */
export interface GalleryTileProps {
    item: GalleryItem;
    rect: TileRect;
    /** Row top, in content coordinates (the rect's x is row-relative). */
    top: number;
    tier: LoadTier;
    fastScroll: boolean;
    reducedMotion: boolean;
}
export declare function GalleryTile({ item, rect, top, tier, fastScroll, reducedMotion }: GalleryTileProps): any;
//# sourceMappingURL=gallery-tile.d.ts.map