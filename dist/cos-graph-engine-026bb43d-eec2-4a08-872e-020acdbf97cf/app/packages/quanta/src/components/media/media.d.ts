import type { ComponentProps, ReactNode } from 'react';
/**
 * Media — a pure-quanta presentational surface for images & videos held at a
 * fixed aspect ratio. It is the building block for media grids, video cards, and
 * cover tiles: a clipped `aspect-ratio` box you fill with an `Image`/`Video`, an
 * automatic `Fallback` (mirrors Avatar's onError→fallback flow), an absolutely-
 * positioned `Overlay` (scrims, play buttons, badges), and a `Caption` strip.
 *
 * Composition parts (each replaceable / optional):
 *   • `Media.Root`    — the aspect-ratio box; clips overflow and owns the corner
 *     radius. `ratio` picks a preset (square/video/portrait/wide/auto) or pass a
 *     numeric `ratio` (e.g. `4 / 3`) for a custom value. `rounded` selects a
 *     radius token; children inherit it via `overflow: hidden`.
 *   • `Media.Image`   — `<img>` filling the box; `fit` = object-fit cover|contain,
 *     lazy-loaded by default, calls `onError` → caller can flip to `Fallback`.
 *   • `Media.Video`   — `<video>` filling the box; controls/autoPlay/loop/muted/
 *     poster pass straight through, `fit` = object-fit.
 *   • `Media.Fallback`— the empty / broken-source slot: a tinted box with centered
 *     content (an `<Icon>`, initials, or any node).
 *   • `Media.Overlay` — an absolutely-positioned layer (gradient scrim, centered
 *     play button, top-right badge) the caller fills; `placement` positions it.
 *   • `Media.Caption` — a small label region rendered under / over the media.
 *
 * Tokens only. No Base UI — this is a layout/presentation primitive.
 */
export type MediaRatio = 'square' | 'video' | 'portrait' | 'wide' | 'auto';
export type MediaFit = 'cover' | 'contain';
export type MediaRounded = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type MediaOverlayPlacement = 'fill' | 'top' | 'bottom' | 'center';
export type MediaRootProps = Omit<ComponentProps<'div'>, 'children'> & {
    /**
     * Aspect ratio. A preset name, or a number (e.g. `16 / 9`, `4 / 3`) for a
     * custom ratio applied via the `aspect-ratio` CSS property.
     */
    ratio?: MediaRatio | number;
    /** Corner radius token. The box clips, so the media follows the curve. */
    rounded?: MediaRounded;
    children?: ReactNode;
};
declare function Root({ ratio, rounded, className, style, children, ...props }: MediaRootProps): any;
export type MediaImageProps = Omit<ComponentProps<'img'>, 'children'> & {
    /** object-fit. `cover` (default) crops to fill; `contain` letterboxes. */
    fit?: MediaFit;
};
declare function Image({ fit, loading, decoding, className, alt, ...props }: MediaImageProps): any;
export type MediaVideoProps = Omit<ComponentProps<'video'>, 'children'> & {
    /** object-fit. `cover` (default) crops to fill; `contain` letterboxes. */
    fit?: MediaFit;
    /**
     * Autoplay (muted) ONLY while the video is on screen, and pause when it scrolls
     * away — the optimized feed/gallery pattern (IntersectionObserver, no scroll
     * listeners). Forces `muted` + `playsInline` (required for programmatic
     * autoplay) and lazies `preload` to `metadata`. Pass `loop` for short clips.
     */
    autoPlayInView?: boolean;
    /** Visibility ratio (0..1) at which an `autoPlayInView` clip starts. Default 0.5. */
    inViewThreshold?: number;
};
declare function Video({ fit, autoPlayInView, inViewThreshold, muted, playsInline, preload, className, ref: forwardedRef, ...props }: MediaVideoProps): any;
export type MediaFallbackProps = ComponentProps<'div'>;
/** The empty / broken-source slot — a tinted box with centered content. */
declare function Fallback({ className, ...props }: MediaFallbackProps): any;
export type MediaOverlayProps = ComponentProps<'div'> & {
    /** Where the overlay sits: full bleed, a top/bottom band, or centered. */
    placement?: MediaOverlayPlacement;
};
/** An absolutely-positioned layer — gradient scrim, play button, corner badge. */
declare function Overlay({ placement, className, ...props }: MediaOverlayProps): any;
export type MediaCaptionProps = ComponentProps<'div'>;
/** A small label region. Compose Typography / Badge / text inside it. */
declare function Caption({ className, ...props }: MediaCaptionProps): any;
export declare const Media: typeof Root & {
    Root: typeof Root;
    Image: typeof Image;
    Video: typeof Video;
    Fallback: typeof Fallback;
    Overlay: typeof Overlay;
    Caption: typeof Caption;
};
/**
 * Convenience hook for the broken-source pattern: wire `onError` to flip a flag,
 * then render `Media.Fallback` instead of `Media.Image`. Mirrors Avatar's
 * onError→fallback flow without forcing it on every consumer.
 *
 *   const { failed, onError } = useMediaFallback()
 *   {failed ? <Media.Fallback>…</Media.Fallback>
 *           : <Media.Image src={src} onError={onError} />}
 */
export declare function useMediaFallback(): {
    failed: any;
    onError: () => any;
    reset: () => any;
};
export {};
//# sourceMappingURL=media.d.ts.map