"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modal = void 0;
exports.modal = modal;
const IconChevronLeftMediumOutlined_1 = require("@higgsfield-ai/icons/IconChevronLeftMediumOutlined");
const IconMagnifyingGlass2Outlined_1 = require("@higgsfield-ai/icons/IconMagnifyingGlass2Outlined");
const react_1 = require("react");
const dialog_1 = require("@base-ui/react/dialog");
const cx_ts_1 = require("../utils/cx.ts");
const index_ts_1 = require("../close-button/index.ts");
const index_ts_2 = require("../icon/index.ts");
const SIZE_CLASS = {
    xs: 'q-modal-size-xs',
    sm: 'q-modal-size-sm',
    md: 'q-modal-size-md',
    lg: 'q-modal-size-lg',
    xl: 'q-modal-size-xl',
    '2xl': 'q-modal-size-2xl',
};
/** Build the modal popup class string. Also usable to style a non-popup element. */
function modal(options = {}, ...extra) {
    const { size = 'md' } = options;
    return (0, cx_ts_1.cx)('q-modal', SIZE_CLASS[size], ...extra);
}
/** Populate every ref in `refs` with the same node (object or callback refs). */
function mergeRefs(...refs) {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function')
                ref(node);
            else if (ref)
                ref.current = node;
        }
    };
}
/* ── Passthrough parts (Base UI owns behavior; quanta only names them). ─────── */
const Root = dialog_1.Dialog.Root;
const Trigger = dialog_1.Dialog.Trigger;
/** Raw dismiss trigger — wrap a Button via `render`, or pass your own children. */
const Close = dialog_1.Dialog.Close;
function Title({ className, ...props }) {
    return <dialog_1.Dialog.Title className={(0, cx_ts_1.cx)('q-modal-title', className)} {...props}/>;
}
function Description({ className, ...props }) {
    return <dialog_1.Dialog.Description className={(0, cx_ts_1.cx)('q-modal-description', className)} {...props}/>;
}
/** Styled round dismiss button (Figma disc) — sits at the trailing end of a header. */
function CloseButton({ className, children, ...props }) {
    return (<dialog_1.Dialog.Close aria-label="Close" className={(0, index_ts_1.closeButton)({}, className)} {...props}>
      {children ?? <index_ts_2.Icon as={index_ts_1.CloseIcon} size="md"/>}
    </dialog_1.Dialog.Close>);
}
/** Styled round back button (Figma disc) for the "back" header. */
function BackButton({ className, children, type, ...props }) {
    return (<button type={type ?? 'button'} aria-label="Back" className={(0, index_ts_1.closeButton)({}, className)} {...props}>
      {children ?? <index_ts_2.Icon as={IconChevronLeftMediumOutlined_1.IconChevronLeftMediumOutlined} size="md"/>}
    </button>);
}
/** Search row for the "search" header (magnifier + input). */
function Search({ className, inputClassName, icon, placeholder = 'Search', type, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-modal-search', className)}>
      <span className="q-modal-search-icon">{icon ?? <index_ts_2.Icon as={IconMagnifyingGlass2Outlined_1.IconMagnifyingGlass2Outlined} size="md"/>}</span>
      <input className={(0, cx_ts_1.cx)('q-modal-search-input', inputClassName)} placeholder={placeholder} type={type ?? 'search'} {...props}/>
    </div>);
}
function Content({ size = 'md', backdropClassName, container, className, children, initialFocus, ref, ...props }) {
    // Focus the popup itself (not the first tabbable) so opening doesn't ring the ✕.
    const popupRef = (0, react_1.useRef)(null);
    return (<dialog_1.Dialog.Portal container={container}>
      <dialog_1.Dialog.Backdrop className={(0, cx_ts_1.cx)('q-modal-backdrop', backdropClassName)}/>
      <dialog_1.Dialog.Popup ref={mergeRefs(popupRef, ref)} initialFocus={initialFocus ?? popupRef} className={modal({ size }, className)} {...props}>
        {children}
      </dialog_1.Dialog.Popup>
    </dialog_1.Dialog.Portal>);
}
function Header({ flush = false, className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-header', flush && 'q-modal-header-flush', className)} {...props}/>;
}
/** Leading group inside a header (e.g. a BackButton + Title) for the "back" layout. */
function HeaderLead({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-header-lead', className)} {...props}/>;
}
/** Flex spacer — pushes following controls to the trailing end (header or footer). */
function Spacer({ className, ...props }) {
    return <span aria-hidden className={(0, cx_ts_1.cx)('q-modal-spacer', className)} {...props}/>;
}
/**
 * The inset "window" — a frosted, lighter pane inside the body. Place a single
 * one to fill the body, or several inside your own layout div (flex row /
 * column / grid) for split layouts like the Figma "Left sidebar" / "Selector".
 */
function Workspace({ className, padded = true, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-workspace', padded && 'q-modal-workspace-padded', className)} {...props}/>;
}
/**
 * Body — the scrollable region between header and footer. It imposes NO layout:
 * arrange Workspaces however you like, or pass a single `Modal.Workspace`. Plain
 * content with no Workspace anywhere is auto-wrapped in one full Workspace so the
 * window effect still applies. Scrolls (never crops) when content overflows.
 */
function Body({ className, padded = true, children, ...props }) {
    const hasWorkspace = (nodes) => react_1.Children.toArray(nodes).some(c => (0, react_1.isValidElement)(c) && (c.type === Workspace || hasWorkspace(c.props.children)));
    return (<div className={(0, cx_ts_1.cx)('q-modal-body', className)} {...props}>
      {hasWorkspace(children) ? children : <Workspace padded={padded}>{children}</Workspace>}
    </div>);
}
function Footer({ full = false, className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-footer', full && 'q-modal-footer-full', className)} {...props}/>;
}
/** Leading footer caption (muted helper text). */
function FooterCaption({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-caption', className)} {...props}/>;
}
/** Trailing footer actions (buttons), pushed to the right by default. */
function FooterActions({ full = false, className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-modal-actions', full && 'q-modal-actions-full', className)} {...props}/>;
}
exports.Modal = {
    Root,
    Trigger,
    Close,
    Content,
    Header,
    HeaderLead,
    Spacer,
    Title,
    Description,
    CloseButton,
    BackButton,
    Search,
    Body,
    Workspace,
    Footer,
    FooterCaption,
    FooterActions,
};
//# sourceMappingURL=modal.js.map