import type { ComponentProps } from 'react';
/**
 * Dot — a presence / status indicator pinned to the Figma `_AvatarStatus`
 * component (node 1418:94): a palette-coloured circle with an outer translucent
 * glass stroke and BackgroundGlassBlur. Standalone and generic — Avatar composes
 * it for its presence badge, but it is not avatar-specific.
 *
 * Figma ramp (fill box / outer stroke / visual box):
 *   md → 8px / 2px / 12px   sm → 6px / 1.5px / 9px   xs → 4px / 1.5px / 7px
 *
 * Optional decorative motion via `animation` (see DotAnimation) — colour-derived
 * and reduced-motion-safe.
 */
export type DotColor = 'green' | 'yellow' | 'red' | 'grey';
export type DotSize = 'md' | 'sm' | 'xs';
/**
 * Opt-in decorative motion (disabled under `prefers-reduced-motion`):
 *   pulse — radar-style rings ripple out of the dot (a live / online beacon)
 *   glow  — a soft coloured halo breathes around the dot
 */
export type DotAnimation = 'pulse' | 'glow';
export type DotProps = ComponentProps<'span'> & {
    color?: DotColor;
    size?: DotSize;
    /** Decorative motion — `pulse` (ripple rings) or `glow` (breathing halo). */
    animation?: DotAnimation;
    /** Accessible name; when set the dot is exposed as `role="img"`, otherwise it is hidden. */
    label?: string;
};
export declare function Dot({ color, size, animation, label, className, role, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden, ...props }: DotProps): any;
//# sourceMappingURL=dot.d.ts.map