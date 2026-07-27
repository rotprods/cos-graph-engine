import type { ComponentProps, ReactNode } from 'react';
import { Accordion as Primitive } from '@base-ui/react/accordion';
/**
 * Accordion — Base UI `accordion` (roving focus, keyboard, ARIA, the
 * `--accordion-panel-height` collapse var) skinned with quanta. Base UI owns all
 * behaviour/state/`data-*`; quanta only paints + forwards `className`/`ref`.
 *
 * Two looks via `Root`'s `variant`:
 *   • `list` (default) — a flat column of rows separated by hairline rules.
 *   • `separated` — each item is its own bordered glass card with a gap between.
 *
 * The `Trigger` renders inside the Base UI `Header` and shows the caller's label
 * plus a chevron `Icon` that rotates 180° on `[data-panel-open]`. The `Panel`
 * animates its height open/closed off the Base UI `--accordion-panel-height` var
 * (degrades under `prefers-reduced-motion`).
 *
 * Multi-part: `export const Accordion = { Root, Item, Trigger, Panel }`.
 */
export type AccordionVariant = 'list' | 'separated';
export type AccordionSize = 'sm' | 'md' | 'lg';
export type AccordionRootProps = Omit<ComponentProps<typeof Primitive.Root>, 'className'> & {
    className?: string;
    /** Visual look: a hairline-separated list (default) or standalone glass cards. */
    variant?: AccordionVariant;
    /** Density: scales row padding, the trigger + card radius, and typography. */
    size?: AccordionSize;
};
declare function Root({ className, variant, size, ...props }: AccordionRootProps): any;
export type AccordionItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'className'> & {
    className?: string;
};
declare function Item({ className, ...props }: AccordionItemProps): any;
export type AccordionTriggerProps = Omit<ComponentProps<typeof Primitive.Trigger>, 'className'> & {
    className?: string;
    /** Class for the Base UI `Header` wrapper (the `<h3>`). */
    headerClassName?: string;
    /** Leading slot (icon / any node), before the label. */
    start?: ReactNode;
    /** Replace the default rotating chevron in the trailing slot. */
    end?: ReactNode;
};
/**
 * Trigger renders inside the Base UI `Header` (an `<h3>`). The caller's label is
 * `children`; a chevron in the trailing slot rotates 180° on `[data-panel-open]`.
 */
declare function Trigger({ children, className, headerClassName, start, end, ...props }: AccordionTriggerProps): any;
export type AccordionPanelProps = Omit<ComponentProps<typeof Primitive.Panel>, 'className'> & {
    className?: string;
    /** Class for the inner content wrapper (padding/typography live here). */
    contentClassName?: string;
};
/**
 * Panel animates height via the Base UI `--accordion-panel-height` var. The panel
 * itself is `overflow: hidden` and transitions `height`; an inner wrapper holds
 * the real padding so content doesn't reflow during the collapse.
 */
declare function Panel({ children, className, contentClassName, ...props }: AccordionPanelProps): any;
export declare const Accordion: {
    Root: typeof Root;
    Item: typeof Item;
    Trigger: typeof Trigger;
    Panel: typeof Panel;
};
export {};
//# sourceMappingURL=accordion.d.ts.map