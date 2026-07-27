import type { ComponentProps, ReactNode } from 'react';
import type { SlotColor } from '../utils/slot.ts';
/**
 * Progress — an animated progress indicator skinned with quanta tokens. The
 * accent is the slot system (`color` → `slotStyle`); the track is the neutral
 * `background-tertiary`. Two orthogonal axes plus a creative meter:
 *
 *   `variant`:
 *     - `bar`  (default) — a continuous fill. Omit `value` for indeterminate.
 *     - `line` — `steps` equal segments that fill in order.
 *     - `dots` — `steps` dots; the first `round(value/max · steps)` are filled.
 *
 *   `shape` (bar/line/dots): `linear` (default) or `circular` — the circular
 *     forms are a ring, a segmented ring, and a dotted ring. Pass `children` to
 *     label the center.
 *
 * Animations degrade under `prefers-reduced-motion` and `animated={false}`.
 */
export type ProgressVariant = 'bar' | 'dots' | 'line';
export type ProgressShape = 'linear' | 'circular';
export type ProgressSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
export type ProgressColor = SlotColor;
export interface ProgressProps extends Omit<ComponentProps<'div'>, 'color'> {
    /** Current value in `[0, max]`. Omit for an indeterminate `bar` / ring. */
    value?: number;
    /** Upper bound. Default 100. */
    max?: number;
    variant?: ProgressVariant;
    /** Linear (default) or circular — applies to bar / line / dots. */
    shape?: ProgressShape;
    /** Number of steps for line / dots. Default 4. */
    steps?: number;
    size?: ProgressSize;
    color?: ProgressColor;
    /** Transitions + indeterminate / active-step motion. Default true. */
    animated?: boolean;
    /** Center label for circular shapes (e.g. `62%`). */
    children?: ReactNode;
    'aria-label'?: string;
}
export declare function Progress({ value, max, variant, shape, steps, size, color, animated, className, style, children, 'aria-label': ariaLabel, ...props }: ProgressProps): any;
//# sourceMappingURL=progress.d.ts.map