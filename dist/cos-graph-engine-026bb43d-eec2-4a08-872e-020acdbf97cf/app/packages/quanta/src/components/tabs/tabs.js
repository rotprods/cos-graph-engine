"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = void 0;
const react_1 = require("react");
const tabs_1 = require("@base-ui/react/tabs");
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const VARIANT_CLASS = {
    underline: 'q-tabs-underline',
    pill: 'q-tabs-pill',
    segmented: 'q-tabs-segmented',
    soft: 'q-tabs-soft',
};
const SHAPE_CLASS = {
    rounded: 'q-tabs-shape-rounded',
    pill: 'q-tabs-shape-pill',
    icon: 'q-tabs-shape-icon',
};
const SURFACE_CLASS = {
    glass: 'q-tabs-surface-glass',
    flat: 'q-tabs-surface-flat',
};
const TONE_CLASS = {
    default: 'q-tabs-tone-default',
    accent: 'q-tabs-tone-accent',
    glass: 'q-tabs-tone-glass',
    solid: 'q-tabs-tone-solid',
    brandSoft: 'q-tabs-tone-brand-soft',
    brand: 'q-tabs-tone-brand',
};
function Root({ color = 'brand', className, shape = 'rounded', style, surface = 'glass', tone, variant = 'underline', ...props }) {
    const resolvedTone = tone ?? (variant === 'segmented' ? 'glass' : 'default');
    return (<tabs_1.Tabs.Root style={{ ...(0, slot_ts_1.slotStyle)(color), ...style }} className={(0, cx_ts_1.cx)('q-tabs', VARIANT_CLASS[variant], SHAPE_CLASS[shape], SURFACE_CLASS[surface], TONE_CLASS[resolvedTone], className)} {...props}/>);
}
function List({ children, items, className, indicator = true, fullWidth = false, ...props }) {
    return (<tabs_1.Tabs.List className={(0, cx_ts_1.cx)('q-tabs-list', fullWidth && 'q-tabs-list-fill', className)} {...props}>
      {items != null
            ? items.map(({ label, ...tab }, index) => (<Tab key={tab.value != null ? String(tab.value) : index} {...tab}>{label}</Tab>))
            : children}
      {indicator ? (<tabs_1.Tabs.Indicator className="q-tabs-indicator" renderBeforeHydration/>) : null}
    </tabs_1.Tabs.List>);
}
/**
 * Wrap each string/number child in a width-locking "ghost" span. The visible
 * text can switch weight (medium ↔ semibold) on selection without changing the
 * box width, because an invisible bold copy reserves the widest footprint via
 * a 1×1 grid stack. This kills the sub-pixel reflow that made the sliding
 * indicator and neighbouring tabs wobble on select. Non-text nodes (icons)
 * pass through untouched.
 */
function lockTextWidth(children) {
    return react_1.Children.map(children, (child) => {
        if (typeof child === 'string' || typeof child === 'number') {
            return (<span className="q-tabs-tab-text" data-text={String(child)}>
          {child}
        </span>);
        }
        return child;
    });
}
function Tab({ children, className, iconOnly = false, start, end, subtitle, icon, iconEnd, secondaryText, contentClassName, ...props }) {
    // Canonical start/end/subtitle, with the legacy icon/iconEnd/secondaryText
    // names kept as aliases (byte-identical rendering) for back-compat.
    const lead = start ?? icon;
    const trail = end ?? iconEnd;
    const sub = subtitle ?? secondaryText;
    // Slot mode only when a slot prop is supplied. Otherwise render children
    // bare inside the flex content (preserving the icon-as-children pattern used
    // by the underline/pill/segmented variants, where the content gap spaces an
    // inline <Icon/> + label).
    const useSlots = lead != null || trail != null || sub != null;
    return (<tabs_1.Tabs.Tab className={(0, cx_ts_1.cx)('q-tabs-tab', iconOnly && 'q-tabs-tab-icon-only', className)} {...props}>
      <span className={(0, cx_ts_1.cx)('q-tabs-tab-content', contentClassName)}>
        {useSlots ? (<>
            {lead != null ? <span className="q-tabs-tab-icon">{lead}</span> : null}
            {children != null ? <span className="q-tabs-tab-label">{lockTextWidth(children)}</span> : null}
            {sub != null ? <span className="q-tabs-tab-secondary">{sub}</span> : null}
            {trail != null ? <span className="q-tabs-tab-icon">{trail}</span> : null}
          </>) : (lockTextWidth(children))}
      </span>
    </tabs_1.Tabs.Tab>);
}
function Panel({ className, ...props }) {
    return (<tabs_1.Tabs.Panel className={(0, cx_ts_1.cx)('q-tabs-panel', className)} {...props}/>);
}
exports.Tabs = { Root, List, Tab, Panel };
//# sourceMappingURL=tabs.js.map