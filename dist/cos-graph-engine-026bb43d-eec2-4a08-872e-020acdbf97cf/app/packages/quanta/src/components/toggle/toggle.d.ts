import type { ComponentProps, ReactNode } from 'react';
import { Toggle as Primitive } from '@base-ui/react/toggle';
import { type SlotColor } from '../utils/slot.ts';
/**
 * Toggle — a two-state pressable button (Base UI `Toggle`). When pressed, a soft
 * slot tint (`q-slot-bg-10` + `q-slot-text`) derived from the `color` prop fills
 * it. State comes from Base UI's `data-pressed` attribute.
 *
 * Composable like Button/Chip: the label is `children`; `start` / `end` are
 * optional slots (any node — a leading icon, a trailing count `<Badge>`) that
 * default to nothing. The gap + `& svg` sizing space them; the legacy
 * icon-as-children pattern is byte-for-byte unchanged when no slot is passed.
 * Host element is swappable via Base UI `render` (passes straight through).
 */
export type ToggleSize = 'sm' | 'md' | 'lg';
export type ToggleProps = ComponentProps<typeof Primitive> & {
    /** Slot color for the pressed tint. Default 'brand'. */
    color?: SlotColor;
    size?: ToggleSize;
    /** Leading slot (icon, any node) before the label. */
    start?: ReactNode;
    /** Trailing slot (count, badge, any node) after the label. */
    end?: ReactNode;
};
export declare function Toggle({ color, size, start, end, className, style, children, ...props }: ToggleProps): any;
//# sourceMappingURL=toggle.d.ts.map