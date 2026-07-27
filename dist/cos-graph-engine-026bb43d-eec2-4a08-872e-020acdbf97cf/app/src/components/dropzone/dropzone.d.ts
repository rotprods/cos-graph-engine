import type { ComponentPropsWithRef, ReactElement, ReactNode } from 'react';
import { type IconGlyph } from '@higgsfield/quanta/icon';
/**
 * Dropzone — a labelled file / picker drop target (Figma App-detail
 * "File Upload Area [1.1]", node 3309:86544). Quanta ships no upload surface, so
 * this composes Quanta primitives (`Icon`, `Typography` + `q-` tokens) into the
 * bordered, centered "icon → title → subtitle" tile the app pages use for
 * "Upload Image" / "Select Animal" style inputs.
 *
 *   <Dropzone icon={IconUpload} title="Upload Image"
 *     subtitle="PNG, JPG or Paste from Clipboard" />
 *
 * `border` picks the outline: `dashed` (the primary upload target, default) or
 * `solid` (a secondary picker). The host element swaps via `render` — keep the
 * default `<div>` for a passive tile or render a `<button>` / `<label>` to make
 * the whole area interactive (it gets hover + focus affordances from the classes).
 *
 * Once something is chosen, pass a `preview` node (typically a `DropzonePreview`)
 * to show the AFTER-SELECTION state (Figma node 3309:83654): the same bordered
 * tile now centered on a small preview card. The tile stays interactive, so
 * clicking it re-opens the picker to change the selection.
 */
export type DropzoneBorder = 'dashed' | 'solid';
export type DropzoneProps = Omit<ComponentPropsWithRef<'div'>, 'title'> & {
    /** Leading glyph shown above the text (a Material Symbols / quanta icon). */
    icon?: IconGlyph;
    /** Bold primary line. */
    title?: ReactNode;
    /** Muted helper line under the title. */
    subtitle?: ReactNode;
    /** Outline style — `dashed` upload target (default) or `solid` picker. */
    border?: DropzoneBorder;
    /**
     * After-selection content. When set, the icon / title / subtitle empty state
     * is replaced by this node (a `DropzonePreview` of the chosen image / option),
     * centered in the same bordered tile.
     */
    preview?: ReactNode;
    /** Swap the host element (e.g. an interactive `<button>` / `<label>`). */
    render?: ReactElement;
};
export declare function Dropzone({ icon, title, subtitle, border, preview, className, render, ref, ...props }: DropzoneProps): any;
//# sourceMappingURL=dropzone.d.ts.map