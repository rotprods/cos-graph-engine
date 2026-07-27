import type { ComponentPropsWithRef, ReactElement, ReactNode } from 'react';
import { type IconGlyph } from '@higgsfield/quanta/icon';
/**
 * UploadField — the rail-style upload field (Figma SC App Builder "Media upload",
 * node 3322:51742 → the `image-field`). THE upload field for creation rails /
 * input panels (e.g. the `InputPanel` in `src/layouts/preset.tsx`): a rail-width,
 * bordered tile whose empty state is an icon-in-a-rounded-chip over a bold title +
 * muted description, and whose filled state is a white-ringed media preview with a
 * floating remove (X) button. Quanta primitives (`Icon`, `Media`, `Typography`) +
 * `q-` tokens only.
 *
 * This is DISTINCT from `@/components/dropzone` (the app-detail hero tile — bare
 * icon, small centered preview, no remove). Use `UploadField` for the rail; use
 * `Dropzone` for the app-detail generator hero.
 *
 * Like every upload surface in the template, the field is ONLY the trigger UI — it
 * must open `AssetLibraryModal` from `@/components/asset-library` (never a custom
 * picker). Pass the empty field as the modal `trigger`, and render the filled
 * field with `preview` + `onRemove` once an asset is picked:
 *
 * ```tsx
 * import { AssetLibraryModal } from '@/components/asset-library'
 * import { UploadField } from '@/components/upload-field'
 * import IconImageOutlined from '@material-symbols/svg-400/outlined/image.svg?react'
 *
 * const [asset, setAsset] = useState<{ src: string, name: string } | null>(null)
 *
 * {asset == null
 *   ? (
 *       <AssetLibraryModal
 *         onSelect={item => setAsset(item)}
 *         trigger={(
 *           <UploadField
 *             render={<button type="button" />}
 *             icon={IconImageOutlined}
 *             title="Upload a reference"
 *             subtitle="PNG or JPG, up to 20MB"
 *           />
 *         )}
 *       />
 *     )
 *   : (
 *       <UploadField
 *         preview={asset.src}
 *         previewAlt={asset.name}
 *         onRemove={() => setAsset(null)}
 *       />
 *     )}
 * ```
 *
 * `border` picks the outline: `dashed` (the primary upload target, default) or
 * `solid` (a secondary picker). The host swaps via `render` — keep the default
 * `<div>` for the passive filled tile, or render a `<button>` for the empty
 * trigger (it gains hover + focus affordances from the classes).
 *
 * Effects are pixel-matched to Figma: the field glass surface + sheen (field
 * node 3313:51351) and the icon chip's border / dual drop shadow / inner glow
 * (chip node 3313:51410). Those shadow values have no exact `q-` token, so they
 * are kept as literal values; every color / radius / spacing uses `q-` tokens.
 */
export type UploadFieldBorder = 'dashed' | 'solid';
export type UploadFieldProps = Omit<ComponentPropsWithRef<'div'>, 'title'> & {
    /** Leading glyph shown in the rounded chip above the text (empty state). */
    icon?: IconGlyph;
    /** Bold primary line (empty state). */
    title?: ReactNode;
    /** Muted helper line under the title (empty state). */
    subtitle?: ReactNode;
    /** Outline style — `dashed` upload target (default) or `solid` picker. */
    border?: UploadFieldBorder;
    /**
     * Filled state. Pass a picked image `src` (rendered as a white-ringed `Media`
     * preview) or a custom node. When set, the icon / title / subtitle empty state
     * is replaced by the preview.
     */
    preview?: ReactNode;
    /** Alt text for the string `preview` image. */
    previewAlt?: string;
    /**
     * Show the floating remove (X) button over the filled tile. Fired when it is
     * clicked. Only rendered together with `preview`.
     */
    onRemove?: () => void;
    /** Swap the host element (e.g. an interactive `<button>` for the modal trigger). */
    render?: ReactElement;
};
export declare function UploadField({ icon, title, subtitle, border, preview, previewAlt, onRemove, className, render, ref, ...props }: UploadFieldProps): any;
//# sourceMappingURL=upload-field.d.ts.map