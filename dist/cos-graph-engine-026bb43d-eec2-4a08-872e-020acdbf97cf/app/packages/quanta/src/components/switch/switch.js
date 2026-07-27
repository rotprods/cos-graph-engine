"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Switch = Switch;
exports.SwitchLabel = SwitchLabel;
const switch_1 = require("@base-ui/react/switch");
const index_ts_1 = require("../typography/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const SIZE_CLASS = {
    small: 'q-switch-small',
    medium: 'q-switch-medium',
    default: 'q-switch-default',
};
function Switch({ className, color = 'brand', size = 'small', style, ...props }) {
    return (<switch_1.Switch.Root style={{ ...(0, slot_ts_1.slotStyle)(color), ...style }} 
    // className can be a string or a `(state) => string` — resolve the
    // caller's value against state before merging with our base classes.
    className={state => (0, cx_ts_1.cx)('q-switch', SIZE_CLASS[size], typeof className === 'function' ? className(state) : className)} {...props}>
      <switch_1.Switch.Thumb className="q-switch-thumb"/>
    </switch_1.Switch.Root>);
}
const LABEL_DIRECTION_CLASS = {
    left: 'q-switch-label-left',
    right: 'q-switch-label-right',
};
const LABEL_SIZE_CLASS = {
    sm: 'q-switch-label-sm',
    md: 'q-switch-label-md',
};
// Title composite per label size — the exact variants the size utilities used to
// apply via descendant selectors (`.q-switch-label-sm .q-switch-label-title`).
const LABEL_TITLE_VARIANT = {
    sm: 'label-sm-medium',
    md: 'label-md-medium',
};
/**
 * SwitchLabel — a Switch paired with a title + optional description, the same
 * labelled-control composite as `CheckboxLabel` / `RadioLabel`. `label` /
 * `description` take any node; `children` overrides the title. Compose richer
 * titles (e.g. a Badge) by passing nodes to `label`.
 */
function SwitchLabel({ label = 'Label', description, direction = 'left', size = 'sm', color, switchSize = size === 'md' ? 'default' : 'medium', switchProps, className, children, ...props }) {
    const switchNode = <Switch color={color} size={switchSize} {...switchProps}/>;
    const textNode = (<span className="q-switch-label-text">
      <index_ts_1.Typography as="span" variant={LABEL_TITLE_VARIANT[size]} color="primary" className="q-switch-label-title">
        {children ?? label}
      </index_ts_1.Typography>
      {description
            ? (<index_ts_1.Typography as="span" variant="label-sm-regular" color="tertiary" className="q-switch-label-description">
              {description}
            </index_ts_1.Typography>)
            : null}
    </span>);
    return (<label className={(0, cx_ts_1.cx)('q-switch-label', LABEL_DIRECTION_CLASS[direction], LABEL_SIZE_CLASS[size], className)} {...props}>
      {direction === 'left' ? switchNode : textNode}
      {direction === 'left' ? textNode : switchNode}
    </label>);
}
//# sourceMappingURL=switch.js.map