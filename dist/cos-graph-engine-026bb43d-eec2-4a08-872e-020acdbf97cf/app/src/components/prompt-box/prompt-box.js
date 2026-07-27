"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBox = void 0;
const react_1 = require("react");
const use_render_1 = require("@base-ui/react/use-render");
const star_shine_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/star_shine.svg?react"));
const utils_1 = require("@/lib/utils");
const SURFACE_CLASS = {
    plain: '',
    glass: 'q-prompt-box-glass',
};
function Root({ surface = 'plain', className, children: childrenProp, ...props }) {
    const children = react_1.Children.toArray(childrenProp);
    const modeRailChildren = [];
    const dockChildren = [];
    for (const child of children) {
        if ((0, react_1.isValidElement)(child) && child.type === ModeRail) {
            modeRailChildren.push(child);
        }
        else {
            dockChildren.push(child);
        }
    }
    return (<div className={(0, utils_1.cn)('q-prompt-box', SURFACE_CLASS[surface], className)} {...props}>
      {modeRailChildren}
      {dockChildren.length > 0
            ? (<div className="q-prompt-box-dock">
              <div className="q-prompt-box-dock-surface">{dockChildren}</div>
            </div>)
            : null}
    </div>);
}
function ModeRail({ hidden = false, className, ...props }) {
    if (hidden)
        return null;
    return <div className={(0, utils_1.cn)('q-prompt-box-mode-rail', className)} {...props}/>;
}
function Mode({ active = false, hidden = false, start, children, render, className, ref, ...props }) {
    const element = (0, use_render_1.useRender)({
        render,
        defaultTagName: 'button',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-prompt-box-mode', active && 'q-prompt-box-mode-active', className),
            ...(render == null ? { type: 'button' } : {}),
            ...(active ? { 'aria-pressed': true } : {}),
            children: (<>
          {start != null ? <span className="q-prompt-box-mode-icon">{start}</span> : null}
          {children != null ? <span className="q-prompt-box-mode-label">{children}</span> : null}
        </>),
            ...props,
        },
    });
    return hidden ? null : element;
}
function Body({ className, surfaceClassName, children, ...props }) {
    return (<div className={(0, utils_1.cn)('q-prompt-box-body', className)} {...props}>
      <div className={(0, utils_1.cn)('q-prompt-box-surface', surfaceClassName)}>{children}</div>
    </div>);
}
function Field({ className, rows = 1, ...props }) {
    return <textarea rows={rows} className={(0, utils_1.cn)('q-prompt-box-field', className)} {...props}/>;
}
/* ── Actions (the footer pill row) ─────────────────────────────────────────── */
function Actions({ className, ...props }) {
    return <div className={(0, utils_1.cn)('q-prompt-box-actions', className)} {...props}/>;
}
function Pill({ start, end, children, iconOnly = false, hidden = false, render, className, ref, ...props }) {
    const element = (0, use_render_1.useRender)({
        render,
        defaultTagName: 'button',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-prompt-box-pill', iconOnly && 'q-prompt-box-pill-icon-only', className),
            ...(render == null ? { type: 'button' } : {}),
            children: (<>
          {start != null ? <span className="q-prompt-box-pill-start">{start}</span> : null}
          {children != null ? <span className="q-prompt-box-pill-label">{children}</span> : null}
          {end != null ? <span className="q-prompt-box-pill-end">{end}</span> : null}
        </>),
            ...props,
        },
    });
    return hidden ? null : element;
}
function Uploads({ hidden = false, className, ...props }) {
    if (hidden)
        return null;
    return <div className={(0, utils_1.cn)('q-prompt-box-uploads', className)} {...props}/>;
}
function Upload({ label, src, alt = '', hidden = false, add, children, render, className, ref, ...props }) {
    const element = (0, use_render_1.useRender)({
        render,
        defaultTagName: 'button',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-prompt-box-upload', src != null && 'q-prompt-box-upload-filled', className),
            ...(render == null ? { type: 'button' } : {}),
            children: (<>
          {src != null ? <img className="q-prompt-box-upload-media" src={src} alt={alt}/> : null}
          <span className="q-prompt-box-upload-add">{add ?? <PlusGlyph />}</span>
          {label != null ? <span className="q-prompt-box-upload-label">{label}</span> : null}
          {children}
        </>),
            ...props,
        },
    });
    return hidden ? null : element;
}
/** The small "+" corner glyph rendered inside an empty Upload tile by default. */
function PlusGlyph() {
    return (<svg viewBox="0 0 16 16" fill="none" aria-hidden width="16" height="16">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>);
}
function Generate({ cost, oldCost, start, children = 'Generate', render, className, ref, ...props }) {
    const hasMeta = cost != null || oldCost != null || start != null;
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'button',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-prompt-box-generate', className),
            ...(render == null ? { type: 'button' } : {}),
            children: (<>
          <span className="q-prompt-box-generate-label">{children}</span>
          {hasMeta ? (<span className="q-prompt-box-generate-meta">
              {start ?? <star_shine_svg_react_1.default />}
              {oldCost != null ? <span className="q-prompt-box-generate-old">{oldCost}</span> : null}
              {cost != null ? <span className="q-prompt-box-generate-cost">{cost}</span> : null}
            </span>) : null}
        </>),
            ...props,
        },
    });
}
exports.PromptBox = {
    Root,
    ModeRail,
    Mode,
    Body,
    Field,
    Actions,
    Pill,
    Uploads,
    Upload,
    Generate,
};
//# sourceMappingURL=prompt-box.js.map