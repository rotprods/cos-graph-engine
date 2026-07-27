"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
exports.card = card;
const use_render_1 = require("@base-ui/react/use-render");
const index_ts_1 = require("../typography/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const SURFACE_CLASS = {
    glass: '',
    solid: 'q-card-solid',
};
const ELEVATION_CLASS = {
    flat: '',
    raised: 'q-card-raised',
};
/** Build the card surface class string — usable to skin any element as a card. */
function card(options = {}, ...extra) {
    const { surface = 'glass', elevation = 'flat' } = options;
    return (0, cx_ts_1.cx)('q-card', SURFACE_CLASS[surface], ELEVATION_CLASS[elevation], ...extra);
}
function Root({ surface, elevation, className, render, ref, ...props }) {
    // `ref` must go to useRender's dedicated `ref` option — it is NOT picked up
    // from `props`, so spreading it there would drop it (it would never reach the
    // rendered root / `render` element).
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: { className: card({ surface, elevation }, className), ...props },
    });
}
function Header({ title, description, actions, children, className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-card-header', className)} {...props}>
      {children ?? (<>
          {title != null || description != null
                ? (<div className="q-card-heading">
                  {title != null ? <Title>{title}</Title> : null}
                  {description != null ? <Description>{description}</Description> : null}
                </div>)
                : null}
          {actions != null ? <div className="q-card-actions">{actions}</div> : null}
        </>)}
    </div>);
}
// Title / Description render through Typography (exact-equivalent of the
// composite + color the q-card-title / q-card-description CSS already applied):
// `as="div"` preserves the original tag, the q-card-* class is kept (recipe /
// external styling + sibling selectors), and className stays last so callers win.
function Title({ className, color: _color, ...props }) {
    return <index_ts_1.Typography as="div" variant="body-md-semi-bold" color="primary" className={(0, cx_ts_1.cx)('q-card-title', className)} {...props}/>;
}
function Description({ className, color: _color, ...props }) {
    return <index_ts_1.Typography as="div" variant="body-sm-regular" color="secondary" className={(0, cx_ts_1.cx)('q-card-description', className)} {...props}/>;
}
function Body({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-card-body', className)} {...props}/>;
}
function Footer({ actions, children, className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-card-footer', className)} {...props}>
      {children ?? (actions != null ? <div className="q-card-actions">{actions}</div> : null)}
    </div>);
}
exports.Card = Object.assign(Root, {
    Header,
    Title,
    Description,
    Body,
    Footer,
});
//# sourceMappingURL=card.js.map