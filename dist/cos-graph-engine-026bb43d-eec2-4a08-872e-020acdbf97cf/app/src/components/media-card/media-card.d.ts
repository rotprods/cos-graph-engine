import type { ComponentPropsWithRef, ReactElement, ReactNode } from 'react';
import { Media } from '@higgsfield/quanta/media';
/**
 * MediaCard — a framed media tile for preset galleries and cover pickers
 * (Figma SC App Builder: preset tiles 2950:66661…66695, panel cover
 * 2950:66568). It composes `Media` (the fixed-ratio media box) into the
 * gallery card anatomy: a token frame (thin/thick border or `none` for a
 * frameless tile, radius/400, clipped corners), a bottom title — over the dark
 * scrim for gallery tiles, bare for covers — and an optional top-right `action`
 * slot. Pass `selected` to ring the active tile in the lime brand color (single
 * -select galleries).
 *
 *   <MediaCard render={<button type="button" />} src={preset.src} alt={preset.title}
 *     title={preset.title} onClick={pick} />
 *
 *   <MediaCard ratio="auto" frame="thin" scrim={false} titleVariant="accent"
 *     className="h-40" src={cover} title="How product works"
 *     action={<MediaCard.Action>Change<PencilIcon /></MediaCard.Action>} />
 *
 * The host element is swappable via `render` (Base UI `useRender`): keep the
 * default `<div>` for a passive cover, render a `<button>`/`<a>`/`<Link>` for
 * clickable tiles — interactive hosts get cursor/hover/focus styling from CSS
 * alone. Do NOT combine an interactive host with `action` (nested interactive
 * elements); the action slot is for passive (div) cards.
 *
 * `media` replaces the default `<Media.Image>` with any node (e.g.
 * `<Media.Video autoPlayInView>`); `children` compose extra overlays inside
 * the frame (badges, progress) — both keep the card fully composition-first.
 */
export type MediaCardFrame = 'none' | 'thin' | 'thick';
export type MediaCardTitleVariant = 'body' | 'accent';
export type MediaCardProps = Omit<ComponentPropsWithRef<'div'>, 'title'> & {
    /** Image source for the default `Media.Image`. Ignored when `media` is set. */
    src?: string;
    /** Alt text for the default image. */
    alt?: string;
    /** Aspect ratio, forwarded to `Media` (default `video` — the gallery tile). */
    ratio?: ComponentPropsWithRef<typeof Media>['ratio'];
    /** Custom media node (a `Media.Video`, a fallback…) instead of the image. */
    media?: ReactNode;
    /** Bottom title. Any node. */
    title?: ReactNode;
    /** Title style: gallery `body` (default) or uppercase `accent` cover. */
    titleVariant?: MediaCardTitleVariant;
    /** Dark gradient behind the title (default true; covers pass false). */
    scrim?: boolean;
    /** Border weight: `thick` gallery tile (default), `thin` cover, or `none` (frameless). */
    frame?: MediaCardFrame;
    /**
     * Mark the tile as the active choice — draws the lime brand ring
     * (`ring-q-brand-primary`). Pair with `aria-pressed` on a `<button>` host for
     * an accessible single-select gallery. Best with `frame="none"`.
     */
    selected?: boolean;
    /** Top-right slot — e.g. `MediaCard.Action`. Only on passive (div) cards. */
    action?: ReactNode;
    /** Extra overlay content composed inside the frame. */
    children?: ReactNode;
    /** Swap the host element — `<button>`/`<a>`/`<Link>` for clickable tiles. */
    render?: ReactElement;
};
declare function Root({ src, alt, ratio, media, title, titleVariant, scrim, frame, selected, action, children, className, render, ref, ...props }: MediaCardProps): any;
export type MediaCardActionProps = ComponentPropsWithRef<'button'>;
/**
 * The on-media glass chip (Figma "secondary - default - xs - r_sm",
 * 2950:66569): a 28px dark-glass pill pinned over imagery — "Change", "Edit".
 * A bespoke control: no Button variant covers the on-media dark glass look
 * (flagged in the variant registry). Compose the label with a trailing 16px
 * icon as children.
 */
declare function Action({ className, type, ...props }: MediaCardActionProps): any;
export declare const MediaCard: typeof Root & {
    Action: typeof Action;
};
export {};
//# sourceMappingURL=media-card.d.ts.map