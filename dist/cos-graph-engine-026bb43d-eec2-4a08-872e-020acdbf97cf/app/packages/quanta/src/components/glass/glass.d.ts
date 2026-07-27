import type { ComponentProps, ReactElement } from 'react';
import type { ClassValue } from '../utils/cx.ts';
import { type SlotColor } from '../utils/slot.ts';
/**
 * Glass — a convincing "real glass" surface (frosted glassmorphism done well).
 * Pure quanta (no Base UI primitive); the host element is swappable via `render`
 * (Base UI `useRender`) so the surface can be an `<article>`, an `<a>`, a nav
 * `<header>`, etc. while keeping the glass look.
 *
 * The recipe layers MULTIPLE effects for realism (this is the whole point — see
 * glass.css for the token wiring):
 *   1. `backdrop-filter: blur(token) saturate(~1.6)` — the saturate makes the
 *      blurred backdrop pop like real glass.
 *   2. a translucent fill (`background-glass`).
 *   3. a SPECULAR EDGE HIGHLIGHT — inset box-shadows: a bright top/left light
 *      line (`transparent-light-*`) + a faint dark bottom/right, so light catches
 *      the glass edge.
 *   4. a TOP SHEEN — a `::before` linear-gradient (light → transparent) over the
 *      top portion, low opacity, for the glossy reflection.
 *   5. an elevation drop shadow for `raised`.
 *
 * `backdrop-filter` needs CONTENT BEHIND it to read — place Glass over a colorful
 * image/gradient (see stories).
 *
 *   <Glass blur="md" elevation="raised" rounded="600" interactive>
 *     …content…
 *   </Glass>
 */
export type GlassBlur = 'sm' | 'md' | 'lg';
export type GlassElevation = 'flat' | 'raised';
/** Radius token step (matches `--hf-radius-*`). */
export type GlassRounded = '200' | '300' | '400' | '500' | '600' | 'full';
export interface GlassOptions {
    /** Backdrop-blur radius (token-mapped). Default 'md'. */
    blur?: GlassBlur;
    /** Drop shadow. Default 'flat'. */
    elevation?: GlassElevation;
    /** Corner radius token step. Default '600' (24px — the quanta surface radius). */
    rounded?: GlassRounded;
    /** Subtle hover brighten + lift. Default false. */
    interactive?: boolean;
}
/** Build the glass surface class string — usable to skin any element as glass. */
export declare function glass(options?: GlassOptions, ...extra: ClassValue[]): string;
export type GlassProps = Omit<ComponentProps<'div'>, keyof GlassOptions> & GlassOptions & {
    /**
     * Optional faint tint applied to the glass (slot system). When set, the fill
     * and edge highlight pick up the color so the pane reads as e.g. brand glass.
     */
    tint?: SlotColor;
    /**
     * Swap the root element/component while keeping the glass surface — a semantic
     * `<article>` / `<section>` / `<header>`, or a clickable `<a>` / `<button>`.
     * Defaults to a `<div>`.
     */
    render?: ReactElement;
};
export declare function Glass({ blur, elevation, rounded, interactive, tint, className, style, render, ref, ...props }: GlassProps): any;
//# sourceMappingURL=glass.d.ts.map