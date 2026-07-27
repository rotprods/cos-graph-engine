import type { ComponentProps, ReactNode } from 'react';
import type { ClassValue } from '../utils/cx.ts';
import type { SlotColor } from '../utils/slot.ts';
/**
 * Chip — a selectable filter pill (a real toggle <button> with `aria-pressed`).
 * When `selected`, the chip takes the SOLID fill of the matching checkbox
 * (e.g. brand → solid #d1fe17 surface with #1a1a1a text). For a removable
 * labeled category use Tag; for a standalone two-state control use Toggle.
 *
 * Composable, like Button: the label is `children`; `start` / `end` are optional
 * slots (any node — a leading icon, a trailing count `<Badge>`) that default to
 * nothing. The gap + `& svg` sizing space them; the legacy icon-as-children
 * pattern (`<Chip><Icon/>Label</Chip>`) is byte-for-byte unchanged when no slot
 * is passed.
 */
export type ChipProps = Omit<ComponentProps<'button'>, 'color'> & {
    /** Semantic color when selected. Default 'brand'. */
    color?: ChipColor;
    size?: ChipSize;
    selected?: boolean;
    /** Leading slot (icon, any node) before the label. */
    start?: ReactNode;
    /** Trailing slot (count, badge, any node) after the label. */
    end?: ReactNode;
};
export type ChipColor = SlotColor;
export type ChipSize = 'xxs' | 'xs' | 'sm' | 'md';
export interface ChipOptions {
    color?: ChipColor;
    size?: ChipSize;
    selected?: boolean;
}
export declare function chip(options?: ChipOptions, ...extra: ClassValue[]): string;
export declare function Chip({ color, size, selected, className, type, start, end, children, ...props }: ChipProps): any;
//# sourceMappingURL=chip.d.ts.map