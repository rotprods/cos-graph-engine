"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.buttonGroup = buttonGroup;
exports.ButtonGroup = ButtonGroup;
const react_1 = require("react");
const cx_ts_1 = require("../utils/cx.ts");
/**
 * Orientation → axis class. The literal strings (not a template) are what the
 * Tailwind scanner extracts from this file — see `@source "./button-group.tsx"`
 * in button-group.css. `satisfies Record<…>` keeps the union the single source
 * of truth.
 */
const ORIENTATION_CLASS = {
    horizontal: 'q-button-group-horizontal',
    vertical: 'q-button-group-vertical',
};
/** Build the button-group class string. Also usable to style a non-div host. */
function buttonGroup(options = {}, ...extra) {
    const { orientation = 'horizontal', attached = true } = options;
    return (0, cx_ts_1.cx)('q-button-group', ORIENTATION_CLASS[orientation], attached ? 'q-button-group-attached' : 'q-button-group-spaced', ...extra);
}
/** Children that already declare the prop keep their own value; otherwise inject the group default. */
function injectSharedProps(children, shared) {
    if (shared.size === undefined && shared.variant === undefined)
        return children;
    return react_1.Children.map(children, (child) => {
        if (!(0, react_1.isValidElement)(child))
            return child;
        const childProps = child.props;
        const next = {};
        if (shared.size !== undefined && childProps.size === undefined)
            next.size = shared.size;
        if (shared.variant !== undefined && childProps.variant === undefined)
            next.variant = shared.variant;
        return Object.keys(next).length
            ? (0, react_1.cloneElement)(child, next)
            : child;
    });
}
/**
 * ButtonGroup — a pure-quanta layout that groups quanta `<Button>`s into a row
 * or column. Two shapes:
 *
 *   attached (default) → a segmented control: inner radii removed, adjacent
 *     borders collapse to one shared hairline, only the outer corners round.
 *   spaced            → independent buttons with a small gap.
 *
 * It renders a `role="group"` div (pass `aria-label` to name it) and forwards
 * `ref` + `...props` to that div. Set `size` / `variant` once and they propagate
 * to every child `<Button>` (a child's own value wins).
 *
 *   <ButtonGroup aria-label="Text style" variant="outline">
 *     <Button>Bold</Button><Button>Italic</Button><Button>Underline</Button>
 *   </ButtonGroup>
 */
function ButtonGroup({ orientation = 'horizontal', attached = true, size, variant, className, children, ...props }) {
    return (<div role="group" className={buttonGroup({ orientation, attached }, className)} {...props}>
      {injectSharedProps(children, { size, variant })}
    </div>);
}
//# sourceMappingURL=button-group.js.map