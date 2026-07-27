import type { ComponentType, ReactElement, Ref, SVGProps } from 'react';
import type { ClassValue } from '../utils/cx.ts';
/**
 * Icon — paints a glyph from `@higgsfield-ai/icons` (or any SVG component) with
 * quanta's standardized size, color, and a11y. It replaces the scattered
 * `& svg { width/height }` rules across components: every consumer sizes via the
 * `--hf-icon-*` token scale (xs..xl -> 12/16/20/24/28px) and inherits color from
 * `currentColor` by default.
 *
 * NODE-ONLY: Icon renders the glyph itself as the single, primary element — no
 * wrapper. The size/color/a11y/ref props are applied DIRECTLY to the glyph
 * `<svg>`, so the output is exactly one element. Supply the glyph one of two
 * tree-shake-friendly ways (static per-icon imports keep bundlers pulling only
 * the one glyph you reference):
 *
 *   import { IconMagnifyingGlassOutlined } from '@higgsfield-ai/icons/IconMagnifyingGlassOutlined'
 *   <Icon as={IconMagnifyingGlassOutlined} size="md" label="Search" />        // `as`
 *   <Icon size="md" label="Search"><IconMagnifyingGlassOutlined /></Icon>     // children
 *
 * Sizing strategy (icon.css): `q-icon` sets `width`/`height: var(--hf-icon-<size>)`
 * on the `<svg>` itself, overriding whatever intrinsic `width`/`height` the glyph
 * carries, so every icon renders at the requested token size.
 *
 * a11y: decorative by default (`aria-hidden`). Pass `label` to expose it as
 * `role="img"` with an accessible name.
 *
 * ref: forwarded to the glyph as the React 19 ref-as-prop. It reaches the `<svg>`
 * DOM node only for glyphs that forward their ref; the `@higgsfield-ai/icons`
 * glyphs are plain function components that spread props onto the svg but do not
 * forward ref, so for those the ref lands on the component, not the svg element.
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/**
 * Quanta icon color tokens -> `text-q-icon-*` utilities. Default is `currentColor`
 * (the icon inherits the surrounding text color) — omit `color` for that.
 */
export type IconColor = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'accent' | 'inverse' | 'disabled' | 'error' | 'success' | 'warning' | 'info';
export interface IconOptions {
    size?: IconSize;
    color?: IconColor;
}
/** A glyph component shape (matches every `@higgsfield-ai/icons/<Icon>` export). */
export type IconGlyph = ComponentType<SVGProps<SVGSVGElement>>;
export type IconProps = {
    /** Token size (default `md` = 20px). Maps to `var(--hf-icon-<size>)`. */
    size?: IconSize;
    /** Quanta icon color token. Omit to inherit `currentColor`. */
    color?: IconColor;
    /**
     * Accessible name. When set, the icon is exposed as `role="img"` with this
     * label; otherwise it is decorative (`aria-hidden`).
     */
    label?: string;
    /** Extra classes appended after the recipe classes (caller wins ordering). */
    className?: string;
    /** Forwarded to the glyph (ref-as-prop). See the component JSDoc on ref. */
    ref?: Ref<SVGSVGElement>;
    /**
     * Glyph component to render (e.g. `IconMagnifyingGlassOutlined`). Alternative
     * to passing the glyph element as `children`. Takes precedence when both are
     * given.
     */
    as?: IconGlyph;
    /** The glyph element when not using `as` (e.g. `<IconMagnifyingGlassOutlined />`). */
    children?: ReactElement<SVGProps<SVGSVGElement>>;
};
/** Recipe — the composite icon class string, for styling a glyph element directly. */
export declare function icon(options?: IconOptions, ...extra: ClassValue[]): string;
export declare function Icon({ size, color, as: As, children, label, className, ref, role, 'aria-label': ariaLabel, 'aria-hidden': ariaHidden, }: IconProps & Pick<SVGProps<SVGSVGElement>, 'role' | 'aria-label' | 'aria-hidden'>): any;
//# sourceMappingURL=icon.d.ts.map