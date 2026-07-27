"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.typography = typography;
exports.Typography = Typography;
const react_1 = require("react");
const cx_ts_1 = require("../utils/cx.ts");
// Variant → its emitted composite utility. Literal `text-q-<variant>` strings
// so Tailwind's scanner extracts them; `satisfies Record<…>` makes the union
// the single source of truth (a missing entry fails to compile).
const VARIANT_CLASS = {
    'accent-2xs-bold': 'text-q-accent-2xs-bold',
    'accent-xs-bold': 'text-q-accent-xs-bold',
    'accent-sm-bold': 'text-q-accent-sm-bold',
    'accent-md-bold': 'text-q-accent-md-bold',
    'accent-lg-bold': 'text-q-accent-lg-bold',
    'accent-xl-bold': 'text-q-accent-xl-bold',
    'accent-2xl-bold': 'text-q-accent-2xl-bold',
    'accent-3xl-bold': 'text-q-accent-3xl-bold',
    'accent-4xl-bold': 'text-q-accent-4xl-bold',
    'accent-5xl-bold': 'text-q-accent-5xl-bold',
    'accent-6xl-bold': 'text-q-accent-6xl-bold',
    'body-sm-regular': 'text-q-body-sm-regular',
    'body-sm-medium': 'text-q-body-sm-medium',
    'body-sm-semi-bold': 'text-q-body-sm-semi-bold',
    'body-md-regular': 'text-q-body-md-regular',
    'body-md-medium': 'text-q-body-md-medium',
    'body-md-semi-bold': 'text-q-body-md-semi-bold',
    'body-lg-regular': 'text-q-body-lg-regular',
    'body-lg-medium': 'text-q-body-lg-medium',
    'body-lg-semi-bold': 'text-q-body-lg-semi-bold',
    'caption-xs-regular': 'text-q-caption-xs-regular',
    'caption-xs-medium': 'text-q-caption-xs-medium',
    'caption-xs-semi-bold': 'text-q-caption-xs-semi-bold',
    'caption-sm-regular': 'text-q-caption-sm-regular',
    'caption-sm-medium': 'text-q-caption-sm-medium',
    'caption-sm-semi-bold': 'text-q-caption-sm-semi-bold',
    'display-sm-medium': 'text-q-display-sm-medium',
    'display-sm-semi-bold': 'text-q-display-sm-semi-bold',
    'display-sm-bold': 'text-q-display-sm-bold',
    'display-md-medium': 'text-q-display-md-medium',
    'display-md-semi-bold': 'text-q-display-md-semi-bold',
    'display-md-bold': 'text-q-display-md-bold',
    'display-lg-medium': 'text-q-display-lg-medium',
    'display-lg-semi-bold': 'text-q-display-lg-semi-bold',
    'display-lg-bold': 'text-q-display-lg-bold',
    'headline-sm-medium': 'text-q-headline-sm-medium',
    'headline-sm-semi-bold': 'text-q-headline-sm-semi-bold',
    'headline-sm-bold': 'text-q-headline-sm-bold',
    'headline-md-medium': 'text-q-headline-md-medium',
    'headline-md-semi-bold': 'text-q-headline-md-semi-bold',
    'headline-md-bold': 'text-q-headline-md-bold',
    'headline-lg-medium': 'text-q-headline-lg-medium',
    'headline-lg-semi-bold': 'text-q-headline-lg-semi-bold',
    'headline-lg-bold': 'text-q-headline-lg-bold',
    'label-xs-regular': 'text-q-label-xs-regular',
    'label-xs-medium': 'text-q-label-xs-medium',
    'label-xs-semi-bold': 'text-q-label-xs-semi-bold',
    'label-xs-bold': 'text-q-label-xs-bold',
    'label-sm-regular': 'text-q-label-sm-regular',
    'label-sm-medium': 'text-q-label-sm-medium',
    'label-sm-semi-bold': 'text-q-label-sm-semi-bold',
    'label-sm-bold': 'text-q-label-sm-bold',
    'label-md-regular': 'text-q-label-md-regular',
    'label-md-medium': 'text-q-label-md-medium',
    'label-md-semi-bold': 'text-q-label-md-semi-bold',
    'label-md-bold': 'text-q-label-md-bold',
    'label-lg-regular': 'text-q-label-lg-regular',
    'label-lg-medium': 'text-q-label-lg-medium',
    'label-lg-semi-bold': 'text-q-label-lg-semi-bold',
    'label-lg-bold': 'text-q-label-lg-bold',
    'mono-xs-regular': 'text-q-mono-xs-regular',
    'mono-xs-medium': 'text-q-mono-xs-medium',
    'mono-xs-semi-bold': 'text-q-mono-xs-semi-bold',
    'mono-sm-regular': 'text-q-mono-sm-regular',
    'mono-sm-medium': 'text-q-mono-sm-medium',
    'mono-sm-semi-bold': 'text-q-mono-sm-semi-bold',
    'mono-md-regular': 'text-q-mono-md-regular',
    'mono-md-medium': 'text-q-mono-md-medium',
    'mono-md-semi-bold': 'text-q-mono-md-semi-bold',
    'mono-lg-regular': 'text-q-mono-lg-regular',
    'mono-lg-medium': 'text-q-mono-lg-medium',
    'mono-lg-semi-bold': 'text-q-mono-lg-semi-bold',
    'title-sm-medium': 'text-q-title-sm-medium',
    'title-sm-semi-bold': 'text-q-title-sm-semi-bold',
    'title-sm-bold': 'text-q-title-sm-bold',
    'title-md-medium': 'text-q-title-md-medium',
    'title-md-semi-bold': 'text-q-title-md-semi-bold',
    'title-md-bold': 'text-q-title-md-bold',
    'title-lg-medium': 'text-q-title-lg-medium',
    'title-lg-semi-bold': 'text-q-title-lg-semi-bold',
    'title-lg-bold': 'text-q-title-lg-bold',
};
// Color → semantic text-colour utility. Literal strings for the scanner.
const COLOR_CLASS = {
    primary: 'text-q-text-primary',
    secondary: 'text-q-text-secondary',
    tertiary: 'text-q-text-tertiary',
    inverse: 'text-q-text-inverse',
    disabled: 'text-q-text-disabled',
    link: 'text-q-text-link',
    brand: 'text-q-text-brand',
    danger: 'text-q-text-danger',
    success: 'text-q-text-success',
    warning: 'text-q-text-warning',
    info: 'text-q-text-info',
    'on-overlay-secondary': 'text-q-text-on-overlay-secondary',
    'on-overlay-tertiary': 'text-q-text-on-overlay-tertiary',
};
/**
 * Recipe — the class string for a given variant/color/truncate, so non-Typography
 * elements (a Base UI part, an existing tag) can be styled identically:
 * `<Trigger className={typography({ variant: 'label-md-semi-bold' })} />`.
 */
function typography(options = {}, ...extra) {
    const { variant = 'body-md-regular', color, truncate } = options;
    return (0, cx_ts_1.cx)(VARIANT_CLASS[variant], color && COLOR_CLASS[color], truncate && 'truncate', ...extra);
}
function Typography(props) {
    const { as, variant = 'body-md-regular', color, truncate, className, ...rest } = props;
    return (0, react_1.createElement)(as ?? 'p', {
        // className LAST so callers win.
        className: typography({ variant, color, truncate }, className),
        ...rest,
    });
}
//# sourceMappingURL=typography.js.map