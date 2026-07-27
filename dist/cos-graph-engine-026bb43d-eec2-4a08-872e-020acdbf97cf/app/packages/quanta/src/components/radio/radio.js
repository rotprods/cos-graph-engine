"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.radio = radio;
exports.RadioGroup = RadioGroup;
exports.Radio = Radio;
exports.RadioLabel = RadioLabel;
const radio_1 = require("@base-ui/react/radio");
const radio_group_1 = require("@base-ui/react/radio-group");
const cx_ts_1 = require("../utils/cx.ts");
const index_ts_1 = require("../typography/index.ts");
const COLOR_CLASS = {
    brand: 'q-radio-brand',
    white: 'q-radio-white',
    neutral: 'q-radio-neutral',
    success: 'q-radio-success',
    error: 'q-radio-error',
    warning: 'q-radio-warning',
    info: 'q-radio-info',
};
const SIZE_CLASS = {
    sm: 'q-radio-sm',
    md: 'q-radio-md',
    lg: 'q-radio-lg',
};
const LABEL_DIRECTION_CLASS = {
    left: 'q-radio-label-left',
    right: 'q-radio-label-right',
};
const LABEL_SIZE_CLASS = {
    sm: 'q-radio-label-sm',
    md: 'q-radio-label-md',
};
// Title composite per label size (mirrors the old q-radio-label-{sm,md} @apply
// rules in radio.css, now applied by <Typography>).
const LABEL_TITLE_VARIANT = {
    sm: 'label-sm-medium',
    md: 'label-md-medium',
};
function radio(options = {}, ...extra) {
    const { color = 'brand', size = 'md' } = options;
    return (0, cx_ts_1.cx)('q-radio', COLOR_CLASS[color], SIZE_CLASS[size], ...extra);
}
function RadioGroup({ className, ...props }) {
    return (<radio_group_1.RadioGroup className={state => (0, cx_ts_1.cx)('q-radio-group', typeof className === 'function' ? className(state) : className)} {...props}/>);
}
function Radio({ color, size, className, ...props }) {
    return (<radio_1.Radio.Root className={state => radio({ color, size }, typeof className === 'function' ? className(state) : className)} {...props}>
      <span className="q-radio-box">
        {/* keepMounted so the dot can transition in AND out (scale + fade). */}
        <radio_1.Radio.Indicator keepMounted className="q-radio-indicator">
          <span className="q-radio-dot"/>
        </radio_1.Radio.Indicator>
      </span>
    </radio_1.Radio.Root>);
}
function RadioLabel({ value, label = 'Label', description, direction = 'left', size = 'sm', color, radioSize = size === 'md' ? 'md' : 'sm', radioProps, className, children, ...props }) {
    const radioNode = (<Radio value={value} color={color} size={radioSize} {...radioProps}/>);
    const textNode = (<span className="q-radio-label-text">
      <index_ts_1.Typography as="span" variant={LABEL_TITLE_VARIANT[size]} color="primary" className="q-radio-label-title">
        {children ?? label}
      </index_ts_1.Typography>
      {description
            ? (<index_ts_1.Typography as="span" variant="label-sm-regular" color="tertiary" className="q-radio-label-description">
              {description}
            </index_ts_1.Typography>)
            : null}
    </span>);
    return (<label className={(0, cx_ts_1.cx)('q-radio-label', LABEL_DIRECTION_CLASS[direction], LABEL_SIZE_CLASS[size], className)} {...props}>
      {direction === 'left' ? radioNode : textNode}
      {direction === 'left' ? textNode : radioNode}
    </label>);
}
//# sourceMappingURL=radio.js.map