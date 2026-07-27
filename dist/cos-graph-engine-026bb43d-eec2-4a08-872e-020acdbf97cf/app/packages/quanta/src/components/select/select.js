"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Select = void 0;
const react_1 = require("react");
const check_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/check.svg?react"));
const keyboard_arrow_down_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?react"));
const select_1 = require("@base-ui/react/select");
const cx_ts_1 = require("../utils/cx.ts");
/* ── Root (owns value/open state via Base UI) ──────────────────────────────── */
/**
 * `connected` flows Root → Trigger + Content so both parts coordinate the
 * seamless seam (the popup attaches flush to the field as one surface) without
 * the caller wiring two props.
 */
const SelectUiContext = (0, react_1.createContext)({ connected: false });
/** Groups all parts; passes `value`/`defaultValue`/`onValueChange`/`multiple` straight through. */
function Root({ connected = false, ...props }) {
    return (<SelectUiContext.Provider value={{ connected }}>
      <select_1.Select.Root {...props}/>
    </SelectUiContext.Provider>);
}
/* ── Trigger (the form-field surface) ──────────────────────────────────────── */
const TRIGGER_SIZE_CLASS = {
    sm: 'q-select-trigger-sm',
    md: '',
    lg: 'q-select-trigger-lg',
};
function Trigger({ className, size = 'md', invalid = false, bare = false, ...props }) {
    const { connected } = (0, react_1.useContext)(SelectUiContext);
    return (<select_1.Select.Trigger className={(0, cx_ts_1.cx)(!bare && 'q-field-control', !bare && 'q-select-trigger', !bare && TRIGGER_SIZE_CLASS[size], !bare && connected && 'q-select-trigger-connected', invalid && 'q-field-control-invalid', className)} data-invalid={invalid ? '' : undefined} {...props}/>);
}
function Value({ className, ...props }) {
    return <select_1.Select.Value className={(0, cx_ts_1.cx)('q-select-value', className)} {...props}/>;
}
function Icon({ className, children, ...props }) {
    return (<select_1.Select.Icon className={(0, cx_ts_1.cx)('q-select-icon', className)} {...props}>
      {children ?? <keyboard_arrow_down_svg_react_1.default />}
    </select_1.Select.Icon>);
}
/* ── Content (Portal + Positioner + Popup + scrollable List) ───────────────── */
const SURFACE_CLASS = {
    glass: '',
    solid: 'q-dropdown-content-solid',
};
/** `picker` — the builder-picker preset (Duration / Aspect Ratio / Voice rows):
 * compact two-line rows, body-sm titles, accent check. */
const CONTENT_SIZE_CLASS = {
    default: '',
    picker: 'q-select-content-picker',
};
function Content({ className, positionerClassName, surface = 'glass', size = 'default', side = 'bottom', align = 'start', sideOffset = 4, alignOffset, collisionPadding, alignItemWithTrigger = false, container, children, ...props }) {
    const { connected } = (0, react_1.useContext)(SelectUiContext);
    // Connected = the popup NESTS the field: a wider rounded card that overlaps and
    // sits BEHIND the still-rounded trigger (the field gets a higher z-index), with
    // top padding so the rows clear the field. We pull the popup up over the trigger
    // (negative sideOffset, tuned to the default 40px field) and centre it so the
    // narrower field tucks inside the wider popup. It is rendered WITHOUT the portal
    // so the trigger can paint on top of the popup in the same stacking context.
    const tree = (<select_1.Select.Positioner className={(0, cx_ts_1.cx)('q-select-positioner', connected && 'q-select-positioner-connected', positionerClassName)} side={side} align={connected ? 'center' : align} sideOffset={connected ? -48 : sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding} alignItemWithTrigger={alignItemWithTrigger}>
      <select_1.Select.Popup className={(0, cx_ts_1.cx)('q-dropdown-content', 'q-select-content', SURFACE_CLASS[surface], CONTENT_SIZE_CLASS[size], connected && 'q-select-content-connected', className)} {...props}>
        <select_1.Select.ScrollUpArrow className="q-select-scroll-arrow q-select-scroll-arrow-up"/>
        <select_1.Select.List className="q-select-list">{children}</select_1.Select.List>
        <select_1.Select.ScrollDownArrow className="q-select-scroll-arrow q-select-scroll-arrow-down"/>
      </select_1.Select.Popup>
    </select_1.Select.Positioner>);
    return connected ? tree : <select_1.Select.Portal container={container}>{tree}</select_1.Select.Portal>;
}
function Group({ className, ...props }) {
    return <select_1.Select.Group className={(0, cx_ts_1.cx)('q-select-group', className)} {...props}/>;
}
function GroupLabel({ className, ...props }) {
    return <select_1.Select.GroupLabel className={(0, cx_ts_1.cx)('q-menu-group-label', className)} {...props}/>;
}
function Separator({ className, ...props }) {
    return <select_1.Select.Separator className={(0, cx_ts_1.cx)('q-select-separator', className)} {...props}/>;
}
function Item({ className, ...props }) {
    return <select_1.Select.Item className={(0, cx_ts_1.cx)('q-menu-item', 'q-select-item', className)} {...props}/>;
}
/** Leading icon slot (20px). Reuses the shared menu primitive. */
function ItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-icon', className)} {...props}/>;
}
/**
 * Content column — stacks `ItemText` over `ItemDescription` (shared menu
 * primitive). Use for two-line options like "1 minute / Choose duration…".
 * A `div` (not span): Base UI's `ItemText` renders a div and must nest validly.
 */
function ItemContent({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-menu-item-label', className)} {...props}/>;
}
/** Secondary line under the option label. Reuses the shared menu primitive. */
function ItemDescription({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-description', className)} {...props}/>;
}
/** The option label echoed back into the trigger `Value` when selected. */
function ItemText({ className, ...props }) {
    return <select_1.Select.ItemText className={(0, cx_ts_1.cx)('q-select-item-text', className)} {...props}/>;
}
/** Trailing check — Base UI mounts it only while the row is selected. */
function ItemIndicator({ className, children, ...props }) {
    return (<select_1.Select.ItemIndicator className={(0, cx_ts_1.cx)('q-select-item-indicator', className)} {...props}>
      {children ?? <check_svg_react_1.default className="q-dropdown-check"/>}
    </select_1.Select.ItemIndicator>);
}
exports.Select = {
    Root,
    Trigger,
    Value,
    Icon,
    Content,
    Group,
    GroupLabel,
    Separator,
    Item,
    ItemIcon,
    ItemContent,
    ItemText,
    ItemDescription,
    ItemIndicator,
};
//# sourceMappingURL=select.js.map