"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vault = void 0;
const react_1 = require("react");
const drawer_1 = require("@base-ui/react/drawer");
const cx_ts_1 = require("../utils/cx.ts");
const index_ts_1 = require("../close-button/index.ts");
const index_ts_2 = require("../icon/index.ts");
/** side → which edge the popup docks to + its slide/dismiss gesture. */
const SIDE_CLASS = {
    bottom: 'q-vault-bottom',
    top: 'q-vault-top',
    left: 'q-vault-left',
    right: 'q-vault-right',
};
const SWIPE_DIRECTION = {
    bottom: 'down',
    top: 'up',
    left: 'left',
    right: 'right',
};
const VaultContext = (0, react_1.createContext)('bottom');
/* ── Passthrough parts (Base UI owns behavior). ─────────────────────────────── */
const Trigger = drawer_1.Drawer.Trigger;
const Close = drawer_1.Drawer.Close;
/** Owns open state + the swipe gesture for the chosen edge. */
function Root({ side = 'bottom', children, ...props }) {
    return (<VaultContext.Provider value={side}>
      <drawer_1.Drawer.Root swipeDirection={SWIPE_DIRECTION[side]} {...props}>
        {children}
      </drawer_1.Drawer.Root>
    </VaultContext.Provider>);
}
function Title({ className, ...props }) {
    return <drawer_1.Drawer.Title className={(0, cx_ts_1.cx)('q-vault-title', className)} {...props}/>;
}
function Description({ className, ...props }) {
    return <drawer_1.Drawer.Description className={(0, cx_ts_1.cx)('q-vault-description', className)} {...props}/>;
}
function CloseButton({ className, children, ...props }) {
    return (<drawer_1.Drawer.Close aria-label="Close" className={(0, index_ts_1.closeButton)({}, className)} {...props}>
      {children ?? <index_ts_2.Icon as={index_ts_1.CloseIcon} size="md"/>}
    </drawer_1.Drawer.Close>);
}
/**
 * Portal + Backdrop + Viewport + the edge-docked, swipeable Popup. The
 * `Drawer.Viewport` is REQUIRED — it's what enables Base UI's swipe/drag,
 * snap-point handling and touch scroll-locking (without it the Popup renders
 * but is undraggable).
 */
function Content({ side: sideProp, handle, backdropClassName, container, className, children, ...props }) {
    const ctxSide = (0, react_1.useContext)(VaultContext);
    const side = sideProp ?? ctxSide;
    const showHandle = handle ?? side === 'bottom';
    return (<drawer_1.Drawer.Portal container={container}>
      <drawer_1.Drawer.Backdrop className={(0, cx_ts_1.cx)('q-vault-backdrop', backdropClassName)}/>
      <drawer_1.Drawer.Viewport className="q-vault-viewport">
        <drawer_1.Drawer.Popup className={(0, cx_ts_1.cx)('q-vault', SIDE_CLASS[side], className)} {...props}>
          {showHandle ? <span className="q-vault-handle" aria-hidden/> : null}
          {children}
        </drawer_1.Drawer.Popup>
      </drawer_1.Drawer.Viewport>
    </drawer_1.Drawer.Portal>);
}
function Header({ title, start, end, closeButton = true, children, className, ...props }) {
    const close = closeButton === true ? <CloseButton /> : closeButton === false ? null : closeButton;
    const titleNode = title != null ? <Title>{title}</Title> : null;
    // start/end flank the title in a leading group (space-between keeps close at
    // the trailing edge). Without a flank slot, the bare title/spacer is unchanged.
    let lead;
    if (children != null)
        lead = children;
    else if (start != null || end != null)
        lead = <div className="q-vault-header-lead">{start}{titleNode}{end}</div>;
    else
        lead = titleNode ?? <span />;
    return (<div className={(0, cx_ts_1.cx)('q-vault-header', className)} {...props}>
      {lead}
      {close}
    </div>);
}
/** Scrollable content region. */
function Body({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-vault-body', className)} {...props}/>;
}
function Footer({ caption, actions, full = false, children, className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-vault-footer', className)} {...props}>
      {children ?? (<>
          {caption != null ? <span className="q-vault-caption">{caption}</span> : null}
          {actions != null ? <div className={(0, cx_ts_1.cx)('q-vault-actions', full && 'q-vault-actions-full')}>{actions}</div> : null}
        </>)}
    </div>);
}
exports.Vault = {
    Root,
    Trigger,
    Content,
    Header,
    Body,
    Footer,
    Title,
    Description,
    Close,
    CloseButton,
};
//# sourceMappingURL=vault.js.map