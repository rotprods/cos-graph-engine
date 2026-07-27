import type { ComponentProps } from 'react';
import type { SlotColor } from '../utils/slot.ts';
/**
 * Loader — an indeterminate loading indicator, slot-tinted with the quanta
 * colour system (`color` → `slotStyle`, so light/dark and any `defineTheme()`
 * brand are automatic). One component, four motifs that echo the rest of the
 * system:
 *
 *   - `dots`   — four dots blinking in sequence around a circle (the accent).
 *   - `circle` (default) — a spinning ring with an accent arc over a neutral track.
 *   - `stars`  — twinkling sparkles, the marketing/“AI” motif (cf. specialBrand).
 *   - `shine`  — an accent gloss sweeping across a tile (the media-grid shimmer).
 *
 * `role="status"` + `aria-label` announce it to assistive tech; the glyphs are
 * decorative. Motion degrades under `prefers-reduced-motion` and can be turned
 * off per-instance with `animated={false}`.
 */
export type LoaderVariant = 'dots' | 'circle' | 'stars' | 'shine';
export type LoaderSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
export type LoaderColor = SlotColor;
export interface LoaderProps extends Omit<ComponentProps<'div'>, 'color'> {
    variant?: LoaderVariant;
    size?: LoaderSize;
    color?: LoaderColor;
    /** Run the animation. Default true. */
    animated?: boolean;
    'aria-label'?: string;
}
export declare function Loader({ variant, size, color, animated, className, style, 'aria-label': ariaLabel, ...props }: LoaderProps): any;
//# sourceMappingURL=loader.d.ts.map