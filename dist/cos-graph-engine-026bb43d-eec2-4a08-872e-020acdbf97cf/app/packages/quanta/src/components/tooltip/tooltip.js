"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tooltip = void 0;
const react_1 = require("react");
const tooltip_1 = require("@base-ui/react/tooltip");
const cx_ts_1 = require("../utils/cx.ts");
function Provider(props) {
    return <tooltip_1.Tooltip.Provider {...props}/>;
}
/* Delay flows Root → Trigger via context so callers set it once on Root. */
const DelayContext = (0, react_1.createContext)({});
/**
 * Root groups the parts and owns open state. `delay` / `closeDelay` are forwarded
 * to the Trigger (where Base UI reads them); `hoverable` maps to Base UI's
 * `disableHoverablePopup` (inverted), defaulting to a non-hoverable tooltip.
 */
function Root({ delay, closeDelay, hoverable = false, children, ...props }) {
    return (<tooltip_1.Tooltip.Root disableHoverablePopup={!hoverable} {...props}>
      <DelayContext.Provider value={{ delay, closeDelay }}>{children}</DelayContext.Provider>
    </tooltip_1.Tooltip.Root>);
}
/**
 * Trigger is a pure anchor: Base UI renders the caller's element (via `render`),
 * which owns all presentation, so there is no `q-tooltip-trigger` skin — any
 * `className` is forwarded straight through.
 */
function Trigger({ className, delay, closeDelay, ...props }) {
    const ctx = (0, react_1.useContext)(DelayContext);
    return (<tooltip_1.Tooltip.Trigger className={className} delay={delay ?? ctx.delay} closeDelay={closeDelay ?? ctx.closeDelay} {...props}/>);
}
function Content({ className, positionerClassName, side = 'top', align = 'center', sideOffset = 6, alignOffset, collisionPadding = 8, container, arrow = false, keepMounted, children, ...props }) {
    return (<tooltip_1.Tooltip.Portal container={container} keepMounted={keepMounted}>
      <tooltip_1.Tooltip.Positioner className={(0, cx_ts_1.cx)('q-tooltip-positioner', positionerClassName)} side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding}>
        <tooltip_1.Tooltip.Popup role="tooltip" className={(0, cx_ts_1.cx)('q-tooltip', className)} {...props}>
          {children}
          {arrow ? <tooltip_1.Tooltip.Arrow className="q-tooltip-arrow"/> : null}
        </tooltip_1.Tooltip.Popup>
      </tooltip_1.Tooltip.Positioner>
    </tooltip_1.Tooltip.Portal>);
}
exports.Tooltip = {
    Provider,
    Root,
    Trigger,
    Content,
};
//# sourceMappingURL=tooltip.js.map