import type { ComponentProps, ReactElement, ReactNode } from 'react';
import type { ClassValue } from '../utils/cx.ts';
/**
 * Card — the reusable glass/solid surface that the overlay components (Modal,
 * Vault, Sonner, Dropdown, cmdk, NavigationMenu) each build inline today. Use
 * it for any panel, popover body, sheet, tile, or section that needs the
 * quanta glass look, instead of re-deriving the recipe.
 *
 *   <Card elevation="raised">
 *     <Card.Header title="Share" description="Anyone with the link"
 *       actions={<Button>Done</Button>} />
 *     <Card.Body>…</Card.Body>
 *     <Card.Footer>…</Card.Footer>
 *   </Card>
 *
 * `surface` = 'glass' (background-glass + 40px blur, no border/shadow — pixel-
 * identical to the Modal popup, default) | 'solid' (opaque secondary, no blur).
 * `elevation` = 'flat' (bare surface, default) | 'raised' (adds the floating
 * drop shadow for popovers/toasts/sheets). All slots are optional — a bare
 * `<Card>` with arbitrary children works too. `card()` is a class-builder for
 * styling a non-div element as a card surface.
 *
 * Host element is swappable via `render` (Base UI useRender) — keep the surface
 * but render a semantic or interactive root:
 *   <Card render={<article/>}>…</Card>
 *   <Card render={<a href="/p"/>}>…</Card>   ·   <Card render={<Link/>}>…</Card>
 */
export type CardSurface = 'glass' | 'solid';
export type CardElevation = 'flat' | 'raised';
export interface CardOptions {
    surface?: CardSurface;
    elevation?: CardElevation;
}
/** Build the card surface class string — usable to skin any element as a card. */
export declare function card(options?: CardOptions, ...extra: ClassValue[]): string;
export type CardProps = Omit<ComponentProps<'div'>, keyof CardOptions> & CardOptions & {
    /**
     * Swap the root element/component while keeping the surface styling — a
     * semantic `<article>` / `<section>`, or a clickable `<a>` / `<button>` /
     * framework `<Link>`. Defaults to a `<div>`.
     */
    render?: ReactElement;
};
declare function Root({ surface, elevation, className, render, ref, ...props }: CardProps): any;
export type CardHeaderProps = Omit<ComponentProps<'div'>, 'title'> & {
    /** Primary heading. Any node. */
    title?: ReactNode;
    /** Secondary line under the title. Any node. */
    description?: ReactNode;
    /** Trailing controls (buttons, close, etc.). Any node. */
    actions?: ReactNode;
};
declare function Header({ title, description, actions, children, className, ...props }: CardHeaderProps): any;
type DivProps = ComponentProps<'div'>;
declare function Title({ className, color: _color, ...props }: DivProps): any;
declare function Description({ className, color: _color, ...props }: DivProps): any;
declare function Body({ className, ...props }: DivProps): any;
export type CardFooterProps = ComponentProps<'div'> & {
    actions?: ReactNode;
};
declare function Footer({ actions, children, className, ...props }: CardFooterProps): any;
export declare const Card: typeof Root & {
    Header: typeof Header;
    Title: typeof Title;
    Description: typeof Description;
    Body: typeof Body;
    Footer: typeof Footer;
};
export {};
//# sourceMappingURL=card.d.ts.map