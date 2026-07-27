"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.badge = badge;
exports.Badge = Badge;
const cx_ts_1 = require("../utils/cx.ts");
const VARIANT_CLASS = {
    blue: 'q-badge-blue',
    lime: 'q-badge-lime',
    pink: 'q-badge-pink',
    purple: 'q-badge-purple',
    limeSubtle: 'q-badge-lime-subtle',
    nBrand: 'q-badge-n-brand',
    nBlue: 'q-badge-n-blue',
};
const SHAPE_CLASS = {
    blue: 'q-badge-skew',
    lime: 'q-badge-skew',
    pink: 'q-badge-skew',
    purple: 'q-badge-skew',
    limeSubtle: 'q-badge-skew',
    nBrand: 'q-badge-compact',
    nBlue: 'q-badge-compact',
};
// xs is the default baked into the shape utilities; only sm adds a marker class.
const SIZE_CLASS = {
    xs: '',
    sm: 'q-badge-sm',
};
function badge(options = {}, ...extra) {
    const { variant = 'blue', size = 'xs' } = options;
    return (0, cx_ts_1.cx)('q-badge', SHAPE_CLASS[variant], VARIANT_CLASS[variant], SIZE_CLASS[size], ...extra);
}
function Badge({ variant = 'blue', size = 'xs', text, className, children, ...props }) {
    const isCompact = variant === 'nBrand' || variant === 'nBlue';
    const content = children ?? text ?? (isCompact ? 'new' : 'Tag');
    const label = (<span className="q-badge-text">
      <span className="q-badge-label">{content}</span>
    </span>);
    return (<span className={badge({ variant, size }, className)} {...props}>
      <span className="q-badge-frame">
        <span className="q-badge-surface">
          {label}
        </span>
      </span>
    </span>);
}
//# sourceMappingURL=badge.js.map