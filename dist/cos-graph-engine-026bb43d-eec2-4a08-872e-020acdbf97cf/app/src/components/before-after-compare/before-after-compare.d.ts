import type { ComponentProps, ReactNode } from 'react';
import { Media } from '@higgsfield/quanta/media';
/**
 * BeforeAfterCompare — a draggable before/after image comparison slider. Quanta
 * ships no compare surface, so this composes Quanta primitives (`Media`, `Icon`,
 * `Typography` + `q-` tokens) into the split-view reveal used by the Higgsfield
 * "Skin Enhancer" app hero: the enhanced (`after`) image fills the frame, the
 * original (`before`) image is clipped to the left of a vertical divider, and a
 * white pill handle (chevron-left / chevron-right) drags the divider across.
 *
 *   <BeforeAfterCompare
 *     beforeSrc={original}
 *     afterSrc={enhanced}
 *     beforeLabel="Original"
 *     afterLabel="Enhanced"
 *   />
 *
 * The handle is a real `role="slider"` control: click / drag anywhere on the
 * frame, or focus the handle and use ←/→ (Home/End for the extremes). Dragging
 * uses pointer capture (no window listeners) and reads geometry only from event
 * handlers, so nothing touches `window` during render / SSR.
 */
export interface BeforeAfterCompareProps {
    /** The "before" image (the original) — revealed on the LEFT of the divider. */
    beforeSrc: string;
    /** The "after" image (the enhanced result) — fills the frame behind the divider. */
    afterSrc: string;
    /** Alt text for the before image. */
    beforeAlt?: string;
    /** Alt text for the after image. */
    afterAlt?: string;
    /** Corner chip over the before (left) side. Set `null` to hide. Default "Before". */
    beforeLabel?: ReactNode;
    /** Corner chip over the after (right) side. Set `null` to hide. Default "After". */
    afterLabel?: ReactNode;
    /** Aspect ratio, forwarded to `Media` (default `square`). */
    ratio?: ComponentProps<typeof Media>['ratio'];
    /** Initial divider position, 0–100 (percent from the left). Default 50. */
    defaultPosition?: number;
    className?: string;
}
export declare function BeforeAfterCompare({ beforeSrc, afterSrc, beforeAlt, afterAlt, beforeLabel, afterLabel, ratio, defaultPosition, className, }: BeforeAfterCompareProps): any;
//# sourceMappingURL=before-after-compare.d.ts.map