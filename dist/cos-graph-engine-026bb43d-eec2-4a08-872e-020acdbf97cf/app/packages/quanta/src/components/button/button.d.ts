import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react';
import type { ClassValue } from '../utils/cx.ts';
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'dangerSoft' | 'brandSoft' | 'marketingPrimary' | 'marketingSecondary' | 'marketingTertiary' | 'marketingGhost' | 'specialBrand' | 'specialPink';
export type ButtonSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
export interface ButtonOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    iconOnly?: boolean;
}
/** Build the button class string. Also usable to style non-button elements. */
export declare function button(options?: ButtonOptions, ...extra: ClassValue[]): string;
type ButtonProps<E extends ElementType> = ButtonOptions & {
    /** Render as a different element (e.g. `as="a"`) with button styling. */
    as?: E;
    /**
     * Merge button styling onto the single child instead of rendering an element.
     * Use to compose with trigger primitives —
     * `<Tooltip.Trigger render={<Button>…</Button>} />` or
     * `<Button asChild><a href>…</a></Button>` — so there's no extra DOM node and
     * one ref reaches the child. Composes via Base UI's `useRender` (the public
     * successor to radix `Slot`). Takes precedence over `as`.
     */
    asChild?: boolean;
    className?: string;
    /** The label. Any node. */
    children?: ReactNode;
    /**
     * Leading slot before the label — defaults to nothing; pass any node (a quanta
     * icon, `<Avatar>`, `<Dot>`, a spinner…). Gap + icon sizing come from the size.
     */
    start?: ReactNode;
    /** Trailing slot after the label — any node (a `<Badge>`, chevron, kbd…). */
    end?: ReactNode;
} & Omit<ComponentPropsWithRef<E>, 'as' | 'asChild' | 'className' | 'children' | 'start' | 'end' | keyof ButtonOptions>;
/**
 * Button — composite + AI-friendly: every part is a replaceable node with a
 * sensible default (nothing). The label is `children`; `start` / `end` are slots
 * that take any node, so you compose OTHER quanta components into the button
 * rather than hand-rolling markup:
 *
 *   <Button>Save</Button>                                  // label only
 *   <Button start={<PlusIcon/>}>New project</Button>       // leading icon
 *   <Button end={<Badge variant="nBrand">new</Badge>}>Upgrade</Button>
 *   <Button iconOnly aria-label="Search" start={<SearchIcon/>} />
 *   <Button as="a" href="/x">Link</Button>  ·  <Button asChild><a/></Button>
 */
export declare function Button<E extends ElementType = 'button'>(props: ButtonProps<E>): any;
export {};
//# sourceMappingURL=button.d.ts.map