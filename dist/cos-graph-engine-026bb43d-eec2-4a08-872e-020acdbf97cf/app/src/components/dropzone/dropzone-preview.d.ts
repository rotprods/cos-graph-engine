import type { ReactNode } from 'react';
import { type IconGlyph } from '@higgsfield/quanta/icon';
/**
 * DropzonePreview — the small preview card shown inside a `Dropzone` once a
 * selection is made (Figma App-detail after-selection state, node 3309:83654).
 * Two flavours, chosen by whether `label` is set:
 *
 *   • plain (no `label`) — the uploaded image: a ~100px white-ringed thumbnail
 *     with a raised shadow (the "Upload Image" tile once a photo is picked).
 *   • captioned (`label` set) — the chosen option: a ~88px white-ringed, slightly
 *     tilted card with a blurred dark scrim carrying a glyph + name (the
 *     "Select Animal" tile once an animal is picked).
 *
 * Quanta `Media` / `Icon` / `Typography` + `q-` tokens only.
 */
export interface DropzonePreviewProps {
    /** Preview image source. */
    src: string;
    /** Alt text (defaults to the string `label`, else empty). */
    alt?: string;
    /** Overlay caption — set it for the tilted, scrimmed "selected option" card. */
    label?: ReactNode;
    /** Small glyph shown above the caption in the overlay. */
    icon?: IconGlyph;
    className?: string;
}
export declare function DropzonePreview({ src, alt, label, icon, className }: DropzonePreviewProps): any;
//# sourceMappingURL=dropzone-preview.d.ts.map