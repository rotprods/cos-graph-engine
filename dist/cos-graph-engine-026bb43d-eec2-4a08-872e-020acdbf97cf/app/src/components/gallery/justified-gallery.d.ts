import type { GalleryItem } from './types.ts';
import './gallery.css';
/**
 * JustifiedGallery — the virtualized, Flickr-style justified-masonry feed that
 * backs the History tab.
 *
 * Architecture:
 *   • `JustifiedLayoutEngine` (plain TS) owns all layout + windowing math.
 *   • `useJustifiedGallery` wires the engine to scroll / resize / density and
 *     exposes only the visible window of rows.
 *   • This component renders that window as absolutely-positioned `GalleryTile`s
 *     over a fixed-height sizer, so the DOM only ever holds a screenful of tiles
 *     regardless of dataset size.
 */
export interface JustifiedGalleryProps {
    /** The dataset. Defaults to the seeded demo history (with a generating tile). */
    items?: GalleryItem[];
}
export declare function JustifiedGallery({ items }: JustifiedGalleryProps): any;
//# sourceMappingURL=justified-gallery.d.ts.map