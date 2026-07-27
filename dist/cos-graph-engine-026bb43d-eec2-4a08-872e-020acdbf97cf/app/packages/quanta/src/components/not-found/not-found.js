"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFound = NotFound;
const use_render_1 = require("@base-ui/react/use-render");
const index_ts_1 = require("../typography/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const SIZE_CLASS = {
    sm: 'q-not-found-sm',
    md: 'q-not-found-md',
    lg: 'q-not-found-lg',
};
const VARIANT_CLASS = {
    plain: 'q-not-found-plain',
    card: 'q-not-found-card',
    outline: 'q-not-found-outline',
};
// Per-size composite typography for the title / subtitle lines — exact
// equivalents of the former `q-not-found-{title,subtitle}` @apply rules (which
// stepped the composite by size via descendant selectors). Now funneled through
// <Typography> so the type lives in one place.
const TITLE_VARIANT = {
    sm: 'caption-xs-medium',
    md: 'caption-sm-medium',
    lg: 'body-sm-medium',
};
const SUBTITLE_VARIANT = {
    sm: 'caption-xs-regular',
    md: 'caption-sm-regular',
    lg: 'body-sm-regular',
};
function NotFound({ icon, title, subtitle, actions, size = 'md', variant = 'plain', className, children, render, ref, ...props }) {
    // `ref` must go to useRender's dedicated `ref` option — it is NOT picked up
    // from `props`, so spreading it there would drop it (it would never reach the
    // rendered root / `render` element).
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: (0, cx_ts_1.cx)('q-not-found', SIZE_CLASS[size], VARIANT_CLASS[variant], className),
            children: (<>
          {icon != null ? <span className="q-not-found-icon">{icon}</span> : null}
          {(title != null || subtitle != null) ? (<span className="q-not-found-text">
              {title != null ? <index_ts_1.Typography as="span" variant={TITLE_VARIANT[size]} color="secondary">{title}</index_ts_1.Typography> : null}
              {subtitle != null ? <index_ts_1.Typography as="span" variant={SUBTITLE_VARIANT[size]} color="tertiary">{subtitle}</index_ts_1.Typography> : null}
            </span>) : null}
          {actions != null ? <span className="q-not-found-actions">{actions}</span> : null}
          {children}
        </>),
            ...props,
        },
    });
}
//# sourceMappingURL=not-found.js.map