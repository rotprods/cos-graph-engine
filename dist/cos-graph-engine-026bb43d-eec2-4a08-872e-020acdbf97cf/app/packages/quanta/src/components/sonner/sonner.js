"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.toast = exports.sonnerManager = void 0;
exports.Toaster = Toaster;
const react_1 = require("react");
const toast_1 = require("@base-ui/react/toast");
const IconCircleCheckOutlined_1 = require("@higgsfield-ai/icons/IconCircleCheckOutlined");
const IconCircleInfoOutlined_1 = require("@higgsfield-ai/icons/IconCircleInfoOutlined");
const IconCircleXOutlined_1 = require("@higgsfield-ai/icons/IconCircleXOutlined");
const IconExclamationTriangleOutlined_1 = require("@higgsfield-ai/icons/IconExclamationTriangleOutlined");
const index_ts_1 = require("../close-button/index.ts");
const index_ts_2 = require("../icon/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
/** Distinguish the `{ label, onClick }` config from an arbitrary ReactNode action. */
function isActionConfig(a) {
    return typeof a === 'object' && a !== null && !(0, react_1.isValidElement)(a) && 'label' in a;
}
const VARIANT_CLASS = {
    default: 'q-sonner-default',
    success: 'q-sonner-success',
    error: 'q-sonner-error',
    warning: 'q-sonner-warning',
    info: 'q-sonner-info',
    loading: 'q-sonner-loading',
};
/** bottom-* swipes down, top-* swipes up; all dismiss horizontally too. */
const SWIPE = {
    'top-left': ['up', 'left'],
    'top-center': ['up'],
    'top-right': ['up', 'right'],
    'bottom-left': ['down', 'left'],
    'bottom-center': ['down'],
    'bottom-right': ['down', 'right'],
};
/* ── The module-level manager — the imperative API talks to this. ───────────── */
exports.sonnerManager = toast_1.Toast.createToastManager();
function emit(variant, title, options = {}) {
    const { description, duration, icon, action, id } = options;
    // The config object → Base UI's built-in Action button (back-compat); any
    // other node → rendered verbatim in the action slot.
    const cfg = action != null && isActionConfig(action) ? action : undefined;
    const customAction = action != null && !isActionConfig(action) ? action : undefined;
    return exports.sonnerManager.add({
        title,
        description,
        type: variant,
        timeout: duration,
        id,
        data: { variant, icon, action: customAction },
        actionProps: cfg
            ? { children: cfg.label, onClick: cfg.onClick }
            : undefined,
    });
}
/** Imperative toast API (sonner-shaped). */
exports.toast = Object.assign((title, options) => emit('default', title, options), {
    success: (title, options) => emit('success', title, options),
    error: (title, options) => emit('error', title, options),
    warning: (title, options) => emit('warning', title, options),
    info: (title, options) => emit('info', title, options),
    loading: (title, options) => emit('loading', title, { duration: 0, ...options }),
    message: (title, options) => emit('default', title, options),
    dismiss: (id) => exports.sonnerManager.close(id),
    /** Pending → resolved/rejected, sonner-style. */
    promise: (promise, msgs) => exports.sonnerManager.promise(promise, {
        loading: msgs.loading,
        success: msgs.success,
        error: msgs.error,
    }),
});
function Glyph({ variant }) {
    // The status glyphs come from @higgsfield-ai/icons; <Icon size="md"> = 20px,
    // matching the previous `size-5`. Decorative — the toast title carries meaning.
    switch (variant) {
        case 'success':
            return <index_ts_2.Icon as={IconCircleCheckOutlined_1.IconCircleCheckOutlined} size="md"/>;
        case 'error':
            return <index_ts_2.Icon as={IconCircleXOutlined_1.IconCircleXOutlined} size="md"/>;
        case 'warning':
            return <index_ts_2.Icon as={IconExclamationTriangleOutlined_1.IconExclamationTriangleOutlined} size="md"/>;
        case 'info':
            return <index_ts_2.Icon as={IconCircleInfoOutlined_1.IconCircleInfoOutlined} size="md"/>;
        case 'loading':
            // Hand-rolled spinner (not a glyph from the icon package): keep the inline
            // SVG so its custom q-sonner-spinner animation + currentColor strokes stay.
            return <svg viewBox="0 0 20 20" fill="none" aria-hidden className="size-5 q-sonner-spinner"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5"/><path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
        default:
            return null;
    }
}
/* ── The rendered toast + the viewport ─────────────────────────────────────── */
function SonnerToast({ toast: t, swipe }) {
    const variant = (t.data?.variant ?? t.type ?? 'default');
    const icon = t.data?.icon ?? <Glyph variant={variant}/>;
    const actionNode = t.data?.action;
    return (<toast_1.Toast.Root toast={t} swipeDirection={swipe} className={(0, cx_ts_1.cx)('q-sonner', VARIANT_CLASS[variant])}>
      {icon ? <span className="q-sonner-icon">{icon}</span> : null}
      <div className="q-sonner-text">
        <toast_1.Toast.Title className="q-sonner-title"/>
        <toast_1.Toast.Description className="q-sonner-description"/>
      </div>
      {actionNode != null
            ? <div className="q-sonner-action-slot">{actionNode}</div>
            : t.actionProps ? <toast_1.Toast.Action className="q-sonner-action"/> : null}
      <toast_1.Toast.Close className="q-sonner-close" aria-label="Dismiss"><index_ts_2.Icon as={index_ts_1.CloseIcon} size="sm"/></toast_1.Toast.Close>
    </toast_1.Toast.Root>);
}
function ToastList({ swipe }) {
    const { toasts } = toast_1.Toast.useToastManager();
    return toasts.map(t => <SonnerToast key={t.id} toast={t} swipe={swipe}/>);
}
/**
 * Mount once near the app root. Toasts collapse into a glassy stack and expand
 * on hover/focus (or always, with `expand`). `limit` caps the visible pile;
 * Base UI owns the stack offsets, swipe-to-dismiss, timing, focus and a11y.
 */
function Toaster({ position = 'bottom-right', limit = 3, duration = 5000, expand = false, gap, className, style, ...props }) {
    const viewportStyle = gap == null
        ? style
        : { ...style, ...{ '--q-sonner-gap': `${gap}px` } };
    return (<toast_1.Toast.Provider toastManager={exports.sonnerManager} limit={limit} timeout={duration}>
      <toast_1.Toast.Portal>
        <toast_1.Toast.Viewport data-position={position} data-expand={expand ? '' : undefined} style={viewportStyle} className={(0, cx_ts_1.cx)('q-sonner-viewport', className)} {...props}>
          <ToastList swipe={SWIPE[position]}/>
        </toast_1.Toast.Viewport>
      </toast_1.Toast.Portal>
    </toast_1.Toast.Provider>);
}
//# sourceMappingURL=sonner.js.map