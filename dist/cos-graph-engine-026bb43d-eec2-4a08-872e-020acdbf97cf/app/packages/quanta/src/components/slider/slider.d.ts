import type { ComponentProps } from 'react';
/**
 * Slider — segmented step control (a.k.a. "control bar"). Visual pinned to the
 * Figma CardSizeControl component (node 1332:3549): equal segments, cumulative
 * left-anchored fill bar, centered tick inside every segment.
 *
 * Supports two modes:
 *   - `mode="stepped"` (default) — N discrete notches. Value `k` (0..N-1) sits at
 *     `k/(N-1)` of the track, so step 0 is the empty start (reachable) and the
 *     last step fills the bar. Drag/click snap to the nearest notch; the fill
 *     edge lands exactly on the current notch's tick.
 *   - `mode="continuous"` — a free 0..1 (or min..max) bar; drag-anywhere, with
 *     an optional `step` to quantize. Ticks are hidden by default.
 *
 * Visuals (default-dark theme — light theme inherits via the same semantic
 * tokens):
 *   - track: `bg-q-background-tertiary`, `rounded-lg` (8px), `h-7` (28px),
 *            `overflow-hidden` so the fill bar is clipped by the rounded shape.
 *   - fill:  absolute, anchored to the track edges (`inset-y-0 left-0`),
 *            `bg-q-overlay-hover` (white-5%) with a
 *            `border-r-q-thin border-q-border-strong` (white-20%) divider on
 *            the right edge. `rounded-l-lg` matches the outer track radius;
 *            when full it also rounds the right corner and drops the divider.
 *            width transitions 200 ms ease-out except while actively dragging.
 *   - tick:  decorative overlay inset by `050` (2 px) on all sides; a `w-px
 *            h-2` mark per segment, `bg-q-border-strong`, rounded-sm.
 *
 * Pointer: a single Pointer Events handler on the track captures the pointer
 * and tracks mouse / touch / pen identically; `touch-action: none` keeps the
 * page from scrolling during a drag.
 */
export type SliderMode = 'stepped' | 'continuous';
type CommonProps = Omit<ComponentProps<'div'>, 'onChange' | 'defaultValue' | 'onPointerDown' | 'onPointerMove' | 'onPointerUp'> & {
    /** Disable interaction. Visual remains rendered, opacity dimmed. */
    disabled?: boolean;
    /** Render the per-segment ticks. Default: true in stepped, false in continuous. */
    showTicks?: boolean;
    /** Called continuously as the value changes (drag / key / click). */
    onChange?: (value: number) => void;
    /** Called once when the user releases the pointer (drag end). */
    onChangeEnd?: (value: number) => void;
    'aria-label'?: string;
};
export type SteppedSliderProps = CommonProps & {
    mode?: 'stepped';
    /** Number of discrete steps. Min 2. Default 3. */
    steps?: number;
    /** 0-indexed selected step. */
    value?: number;
    defaultValue?: number;
};
export type ContinuousSliderProps = CommonProps & {
    mode: 'continuous';
    /** Range min. Default 0. */
    min?: number;
    /** Range max. Default 1. */
    max?: number;
    /** Snap increment. Default 0 (= free, no snap). */
    step?: number;
    /** Number of tick marks to render when showTicks is true. Default 0. */
    steps?: number;
    /** Current value in [min..max]. */
    value?: number;
    defaultValue?: number;
};
export type SliderProps = SteppedSliderProps | ContinuousSliderProps;
export declare function Slider(rawProps: SliderProps): any;
export {};
//# sourceMappingURL=slider.d.ts.map