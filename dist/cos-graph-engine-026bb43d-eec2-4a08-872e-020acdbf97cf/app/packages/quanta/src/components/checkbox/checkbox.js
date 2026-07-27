"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkbox = checkbox;
exports.Checkbox = Checkbox;
exports.CheckboxLabel = CheckboxLabel;
const checkbox_1 = require("@base-ui/react/checkbox");
const cx_ts_1 = require("../utils/cx.ts");
const index_ts_1 = require("../typography/index.ts");
/**
 * Indicator glyphs inlined to match the Figma checkbox EXACTLY (node 481:795):
 * a chunky 2px-stroke check on a 10×8 grid with round caps/joins — distinct from
 * the package `IconCheckmark2MediumOutlined`, which is a different shape on a
 * 24×24 grid at stroke 1.5 (≈half the weight). `currentColor` inherits the
 * indicator fg (icon-inverse on the filled disk). The minus mirrors the check's
 * weight so checked/indeterminate read as one family.
 */
function CheckGlyph() {
    return (<svg viewBox="0 0 10 8" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 4.06L3.34 6.4L8.56 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
function MinusGlyph() {
    return (<svg viewBox="0 0 10 8" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>);
}
const COLOR_CLASS = {
    brand: 'q-checkbox-brand',
    white: 'q-checkbox-white',
};
const SIZE_CLASS = {
    sm: 'q-checkbox-sm',
    md: 'q-checkbox-md',
    lg: 'q-checkbox-lg',
};
const LABEL_DIRECTION_CLASS = {
    left: 'q-checkbox-label-left',
    right: 'q-checkbox-label-right',
};
const LABEL_SIZE_CLASS = {
    sm: 'q-checkbox-label-sm',
    md: 'q-checkbox-label-md',
};
// Title composite per label size (mirrors q-checkbox-label-{sm,md} in checkbox.css).
// The md case still carries a line-height override via the q-checkbox-label-title class.
const LABEL_TITLE_VARIANT = {
    sm: 'label-sm-medium',
    md: 'label-md-medium',
};
function checkbox(options = {}, ...extra) {
    const { color = 'brand', size = 'md' } = options;
    return (0, cx_ts_1.cx)('q-checkbox', COLOR_CLASS[color], SIZE_CLASS[size], ...extra);
}
function Checkbox({ color, size, className, indeterminate, ...props }) {
    return (<checkbox_1.Checkbox.Root indeterminate={indeterminate} className={state => checkbox({ color, size }, typeof className === 'function' ? className(state) : className)} {...props}>
      <span className="q-checkbox-box">
        <checkbox_1.Checkbox.Indicator className="q-checkbox-indicator">
          {indeterminate ? <MinusGlyph /> : <CheckGlyph />}
        </checkbox_1.Checkbox.Indicator>
      </span>
    </checkbox_1.Checkbox.Root>);
}
function CheckboxLabel({ label = 'Label', description, direction = 'left', size = 'sm', color, checkboxSize = size === 'md' ? 'md' : 'sm', checkboxProps, className, children, ...props }) {
    const checkboxNode = (<Checkbox color={color} size={checkboxSize} {...checkboxProps}/>);
    const textNode = (<span className="q-checkbox-label-text">
      <index_ts_1.Typography as="span" variant={LABEL_TITLE_VARIANT[size]} color="primary" className="q-checkbox-label-title">
        {children ?? label}
      </index_ts_1.Typography>
      {description
            ? (<index_ts_1.Typography as="span" variant="label-sm-regular" color="tertiary" className="q-checkbox-label-description">
              {description}
            </index_ts_1.Typography>)
            : null}
    </span>);
    return (<label className={(0, cx_ts_1.cx)('q-checkbox-label', LABEL_DIRECTION_CLASS[direction], LABEL_SIZE_CLASS[size], className)} {...props}>
      {direction === 'left' ? checkboxNode : textNode}
      {direction === 'left' ? textNode : checkboxNode}
    </label>);
}
//# sourceMappingURL=checkbox.js.map