import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react';
import { Media } from '@higgsfield/quanta/media';
/**
 * GenerationCard — a single generation result tile for feed / history grids
 * (Figma Supercomputer-2 "Feed/Card" 2001:84301 + Cinema-Studio-V4 generating
 * state 20037:25838). It composes `Media` (a fixed-ratio, radius/300 clipped
 * box) into the two states a generation moves through:
 *
 *   • `ready` (default) — the finished asset: a cover `Media.Image` (or any
 *     custom `media` node — e.g. a `Media.Video`), with an optional bottom
 *     `title` over the media scrim.
 *   • `generating` — the in-progress placeholder: a dark canvas with a brand
 *     gradient glow pulsing at the TOP of the card and a "Generating" status
 *     pill (spinner + brand label). The pulse is a CSS animation that honors
 *     `prefers-reduced-motion`.
 *
 *   <GenerationCard src={cover} alt="Pool float" />
 *   <GenerationCard state="generating" ratio="portrait" />
 *
 * Tokens only, composition-first: `media` swaps the default image, `children`
 * compose extra overlays inside the frame, and the host element is swappable via
 * `render` (Base UI `useRender`) for clickable tiles.
 */
export type GenerationCardState = 'ready' | 'generating';
export type GenerationCardProps = Omit<ComponentProps<'div'>, 'title'> & {
    /** Lifecycle state — `ready` shows the asset, `generating` the pulsing placeholder. */
    state?: GenerationCardState;
    /** Image source for the default `Media.Image` (ready state). Ignored when `media` is set. */
    src?: string;
    /** Alt text for the default image. */
    alt?: string;
    /** Aspect ratio, forwarded to `Media` (default `video`). */
    ratio?: ComponentProps<typeof Media>['ratio'];
    /** Custom media node (a `Media.Video`, a fallback…) instead of the default image. */
    media?: ReactNode;
    /** Optional bottom title, over the media scrim. Ready state only. */
    title?: ReactNode;
    /** Status pill label shown while generating. Default `Generating`. */
    generatingLabel?: ReactNode;
    /** Extra overlay content composed inside the frame. */
    children?: ReactNode;
    /** Swap the host element — `<button>`/`<a>`/`<Link>` for clickable tiles. */
    render?: ReactElement;
    ref?: Ref<Element>;
};
declare function GenerationCard({ state, src, alt, ratio, media, title, generatingLabel, className, children, render, ref, ...props }: GenerationCardProps): any;
export { GenerationCard };
//# sourceMappingURL=generation-card.d.ts.map