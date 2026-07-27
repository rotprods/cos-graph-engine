import type { ComponentProps, ReactNode } from 'react';
/**
 * Kbd — a keyboard-shortcut pill, pinned to the Figma `_Shortcut` (node
 * 1157:4028): a single 20px-tall chip holding optional ⌘ / ⇧ glyphs and the
 * key, on a translucent white-5% surface with a subtle hairline.
 *
 *   h 20 · px 4 · gap 2 · radius 4 · caption-sm-medium 12 · text-primary
 *   surface transparent/dark/05 (white-5%) · border border/subtle
 *
 * Figma ships ONE size — there are no size variants. Compose a combo inside one
 * pill (`<Kbd>⌘ K</Kbd>`), or use `KbdSequence` for separate keys joined by a
 * separator. Tokens only: surface `bg-q-overlay-hover` (the theme-adaptive
 * white-5% / black-5% mirror of Figma's `transparent/dark/05`), border
 * `border-q-hairline border-q-border-subtle` (the 0.5px hairline matching Figma
 * exactly), radius `rounded-q-100`, type `text-q-caption-sm-medium`.
 */
export type KbdProps = ComponentProps<'kbd'>;
export declare function Kbd({ className, children, color: _color, ...props }: KbdProps): any;
/**
 * KbdSequence — lays out several keys, joined by a separator (default "+").
 * Pass a `keys` array (strings wrap in `<Kbd>`, nodes pass through) or `<Kbd>`
 * children. The separator is aria-hidden so the `<kbd>` semantics stay clean.
 */
export type KbdSequenceProps = Omit<ComponentProps<'span'>, 'children'> & {
    /** Separator rendered between keys. Default "+". Set to null to omit. */
    separator?: ReactNode;
    /** Keys to render. Strings are wrapped in `<Kbd>`; ReactNodes pass through. */
    keys?: ReactNode[];
    children?: ReactNode;
};
export declare function KbdSequence({ separator, keys, className, children, ...props }: KbdSequenceProps): any;
//# sourceMappingURL=kbd.d.ts.map