import type { ReactElement } from 'react';
/**
 * GenerationDetailModal — the full-screen "Viewer / Image" lightbox that opens
 * when a generation card is clicked (Figma SC App Builder, node 3019:100235).
 *
 * ── Anatomy ──────────────────────────────────────────────────────────────────
 * A full-viewport overlay (NOT a centered card) with three stacked layers:
 *   1. Backdrop — the generation itself, cover-filled, darkened by a scrim and
 *      washed by a heavy backdrop blur so the media reads as frosted glass behind
 *      everything. This is the "lightbox" effect.
 *   2. Stage — the crisp, contained media (image or video) centred in the left
 *      region.
 *   3. Info panel — a frosted glass card pinned to the right holding: an author
 *      row (avatar + name + Share + Close), a collapsible "Details" block
 *      (status / type / size / uploaded / last used + prompt), and a sticky
 *      action footer ("Turn to video" CTA + Download / Like / Share / More).
 *
 * ── Why Base UI Dialog directly (not Quanta `Modal`) ─────────────────────────
 * Quanta's `Modal` paints a centred, width-capped glass CARD (`q-modal`: fixed
 * 50/50 translate, `width: min(...)`, own backdrop-blur, 24px radius). A
 * full-bleed lightbox with an image backdrop + a right-docked panel is a
 * different surface entirely — reusing `Modal.Content` would mean overriding
 * nearly every one of those utilities. So we compose Base UI's `Dialog`
 * primitive (the same one `Modal` wraps — focus trap, scroll lock, escape,
 * a11y, portal, exit-mount timing) directly and skin it with Quanta tokens +
 * Quanta content components (`Media`, `Avatar`, `Button`, `Typography`, `Icon`,
 * and the `glass()` recipe).
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 * Mirrors `AssetLibraryModal({ trigger })`: pass the generation card as
 * `trigger` and (optionally) the `generation` data. Another agent can wire this
 * to the History grid by rendering a card element as the trigger:
 *
 *   <GenerationDetailModal
 *     trigger={<GenerationCard … />}
 *     generation={{ src, mediaType: 'image', author: { name }, prompt, … }}
 *   />
 */
export interface GenerationDetail {
    /** Media source (image or video). Reuse a local `/presets/*` asset. */
    src: string;
    /** Renders a `<video>` when `'video'`, otherwise an `<img>`. Default `'image'`. */
    mediaType?: 'image' | 'video';
    /** Poster shown before a video plays. */
    poster?: string;
    /** Aspect ratio (width / height) of the crisp preview. Default `2 / 3` (portrait). */
    aspectRatio?: number;
    /** Author shown in the panel header. */
    author?: {
        name: string;
        role?: string;
        avatarSrc?: string;
    };
    /** Storage status label (paired with a cloud glyph). */
    status?: string;
    /** File type, e.g. `JPG` / `MP4`. */
    fileType?: string;
    /** Human file size, e.g. `2.4 MB`. */
    size?: string;
    /** When the asset was created / uploaded. */
    uploadedAt?: string;
    /** When the asset was last used. */
    lastUsedAt?: string;
    /** The generation prompt. */
    prompt?: string;
}
export interface GenerationDetailModalProps {
    /** The trigger element (e.g. a generation card). Rendered as the dialog trigger. */
    trigger: ReactElement;
    /** Data shown in the viewer. Falls back to a demo generation when omitted. */
    generation?: GenerationDetail;
    /** Controlled open state (optional — the dialog self-manages otherwise). */
    open?: boolean;
    /** Open-state change callback (optional). */
    onOpenChange?: (open: boolean) => void;
    /** Start opened (uncontrolled). Handy for previews. */
    defaultOpen?: boolean;
}
export declare function GenerationDetailModal({ trigger, generation, open, onOpenChange, defaultOpen }: GenerationDetailModalProps): any;
/**
 * Standalone demo — renders its own trigger button so the viewer can be
 * previewed without touching shared templates. Import into `main.tsx`
 * temporarily, or drop anywhere for a visual check.
 */
export declare function GenerationDetailDemo(): any;
export default GenerationDetailDemo;
//# sourceMappingURL=generation-detail.d.ts.map