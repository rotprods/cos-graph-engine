import type { ComponentProps, ReactNode } from 'react';
import { Tabs as Primitive } from '@base-ui/react/tabs';
import { type SlotColor } from '../utils/slot.ts';
/**
 * Tabs — Base UI primitive (roving focus, keyboard, ARIA) skinned with quanta.
 * Variants cover the Figma underline tabs, text-pill tabs, and segmented
 * controls. `Tabs.List` includes a Base UI indicator so active states animate
 * between tab positions.
 *
 * Multi-part: `export const Tabs = { Root, List, Tab, Panel }`.
 */
export type TabsVariant = 'underline' | 'pill' | 'segmented' | 'soft';
export type TabsShape = 'rounded' | 'pill' | 'icon';
export type TabsSurface = 'glass' | 'flat';
export type TabsTone = 'default' | 'accent' | 'glass' | 'solid' | 'brandSoft' | 'brand';
export interface TabsOptions {
    color?: SlotColor;
    shape?: TabsShape;
    surface?: TabsSurface;
    tone?: TabsTone;
    variant?: TabsVariant;
}
export type RootProps = Omit<ComponentProps<typeof Primitive.Root>, 'className'> & {
    className?: string;
} & TabsOptions;
declare function Root({ color, className, shape, style, surface, tone, variant, ...props }: RootProps): any;
export type ListProps = Omit<ComponentProps<typeof Primitive.List>, 'className'> & {
    className?: string;
    indicator?: boolean;
    /** Stretch the list to its container width and size tabs equally. */
    fullWidth?: boolean;
    /**
     * Data-driven tabs: renders a `Tabs.Tab` per item instead of composing
     * children. Each item takes the same props as `Tabs.Tab` (`value`, `start`,
     * `end`, `subtitle`, `iconOnly`, `disabled`…) plus `label` for the text.
     * Falls back to `children` when omitted (back-compat).
     */
    items?: TabItem[];
};
declare function List({ children, items, className, indicator, fullWidth, ...props }: ListProps): any;
export type TabProps = Omit<ComponentProps<typeof Primitive.Tab>, 'className'> & {
    children?: ReactNode;
    className?: string;
    iconOnly?: boolean;
    /** Leading slot (icon / any node). Canonical — matches Button/Chip/Input/Item. */
    start?: ReactNode;
    /** Trailing slot (icon / badge / any node), after the label. */
    end?: ReactNode;
    /** Muted secondary label rendered after the primary text. */
    subtitle?: ReactNode;
    /** @deprecated Use `start`. */
    icon?: ReactNode;
    /** @deprecated Use `end`. */
    iconEnd?: ReactNode;
    /** @deprecated Use `subtitle`. */
    secondaryText?: ReactNode;
    /** Class for the inner content wrapper (gap/padding live here). */
    contentClassName?: string;
};
/** A data-driven tab for `Tabs.List items` — every `Tabs.Tab` prop plus `label` (the text). */
export type TabItem = Omit<TabProps, 'children'> & {
    label?: ReactNode;
};
declare function Tab({ children, className, iconOnly, start, end, subtitle, icon, iconEnd, secondaryText, contentClassName, ...props }: TabProps): any;
export type PanelProps = Omit<ComponentProps<typeof Primitive.Panel>, 'className'> & {
    className?: string;
};
declare function Panel({ className, ...props }: PanelProps): any;
export declare const Tabs: {
    Root: typeof Root;
    List: typeof List;
    Tab: typeof Tab;
    Panel: typeof Panel;
};
export {};
//# sourceMappingURL=tabs.d.ts.map