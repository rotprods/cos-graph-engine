import type { ComponentPropsWithRef, ElementType } from 'react';
import type { ClassValue } from '../utils/cx.ts';
/**
 * Typography — the single funnel for ALL text in quanta apps. It is the only
 * place a consumer should pick a type role: instead of writing raw
 * `text-2xl font-bold tracking-tight`, you pick a `variant` and Typography
 * applies the matching emitted composite utility (`text-q-<variant>` from
 * `src/css/tailwind/typography.css`, which carries font-family + size +
 * line-height + weight + letter-spacing together).
 *
 * Polymorphic via `as` (default `p`). Optional `color` maps to the
 * `text-q-text-*` semantic roles; omit it to inherit the surrounding colour.
 * `truncate` clamps to a single line with an ellipsis. `className` is applied
 * last so callers always win.
 *
 * The `TypographyVariant` union is the single source of truth for the variant
 * set — `VARIANT_CLASS` is `satisfies Record<TypographyVariant, string>`, so a
 * missing entry fails to compile, and the literal `text-q-*` strings are what
 * Tailwind's scanner extracts (via `@source "./typography.tsx"`).
 */
export type TypographyVariant = 'accent-2xs-bold' | 'accent-xs-bold' | 'accent-sm-bold' | 'accent-md-bold' | 'accent-lg-bold' | 'accent-xl-bold' | 'accent-2xl-bold' | 'accent-3xl-bold' | 'accent-4xl-bold' | 'accent-5xl-bold' | 'accent-6xl-bold' | 'body-sm-regular' | 'body-sm-medium' | 'body-sm-semi-bold' | 'body-md-regular' | 'body-md-medium' | 'body-md-semi-bold' | 'body-lg-regular' | 'body-lg-medium' | 'body-lg-semi-bold' | 'caption-xs-regular' | 'caption-xs-medium' | 'caption-xs-semi-bold' | 'caption-sm-regular' | 'caption-sm-medium' | 'caption-sm-semi-bold' | 'display-sm-medium' | 'display-sm-semi-bold' | 'display-sm-bold' | 'display-md-medium' | 'display-md-semi-bold' | 'display-md-bold' | 'display-lg-medium' | 'display-lg-semi-bold' | 'display-lg-bold' | 'headline-sm-medium' | 'headline-sm-semi-bold' | 'headline-sm-bold' | 'headline-md-medium' | 'headline-md-semi-bold' | 'headline-md-bold' | 'headline-lg-medium' | 'headline-lg-semi-bold' | 'headline-lg-bold' | 'label-xs-regular' | 'label-xs-medium' | 'label-xs-semi-bold' | 'label-xs-bold' | 'label-sm-regular' | 'label-sm-medium' | 'label-sm-semi-bold' | 'label-sm-bold' | 'label-md-regular' | 'label-md-medium' | 'label-md-semi-bold' | 'label-md-bold' | 'label-lg-regular' | 'label-lg-medium' | 'label-lg-semi-bold' | 'label-lg-bold' | 'mono-xs-regular' | 'mono-xs-medium' | 'mono-xs-semi-bold' | 'mono-sm-regular' | 'mono-sm-medium' | 'mono-sm-semi-bold' | 'mono-md-regular' | 'mono-md-medium' | 'mono-md-semi-bold' | 'mono-lg-regular' | 'mono-lg-medium' | 'mono-lg-semi-bold' | 'title-sm-medium' | 'title-sm-semi-bold' | 'title-sm-bold' | 'title-md-medium' | 'title-md-semi-bold' | 'title-md-bold' | 'title-lg-medium' | 'title-lg-semi-bold' | 'title-lg-bold';
export type TypographyColor = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'disabled' | 'link' | 'brand' | 'danger' | 'success' | 'warning' | 'info' | 'on-overlay-secondary' | 'on-overlay-tertiary';
export interface TypographyOptions {
    variant?: TypographyVariant;
    color?: TypographyColor;
    truncate?: boolean;
}
export type TypographyProps<E extends ElementType = 'p'> = TypographyOptions & {
    /** Render as a different element (e.g. `as="h1"` / `as="span"`). Default `p`. */
    as?: E;
} & Omit<ComponentPropsWithRef<E>, 'as' | 'color' | keyof TypographyOptions>;
/**
 * Recipe — the class string for a given variant/color/truncate, so non-Typography
 * elements (a Base UI part, an existing tag) can be styled identically:
 * `<Trigger className={typography({ variant: 'label-md-semi-bold' })} />`.
 */
export declare function typography(options?: TypographyOptions, ...extra: ClassValue[]): string;
export declare function Typography<E extends ElementType = 'p'>(props: TypographyProps<E>): any;
//# sourceMappingURL=typography.d.ts.map