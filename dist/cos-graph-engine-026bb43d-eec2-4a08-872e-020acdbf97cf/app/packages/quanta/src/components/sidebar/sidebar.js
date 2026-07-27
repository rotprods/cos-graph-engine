"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = void 0;
const react_1 = require("react");
const use_render_1 = require("@base-ui/react/use-render");
const IconChevronGrabberVerticalOutlined_1 = require("@higgsfield-ai/icons/IconChevronGrabberVerticalOutlined");
const IconMagnifyingGlassOutlined_1 = require("@higgsfield-ai/icons/IconMagnifyingGlassOutlined");
const IconPinFilledThin_1 = require("@higgsfield-ai/icons/IconPinFilledThin");
const index_ts_1 = require("../icon/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const SidebarCollapseContext = (0, react_1.createContext)(null);
function Root({ collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange, product, flush = false, className, children, ...props }) {
    const [internalCollapsed, setInternalCollapsed] = (0, react_1.useState)(defaultCollapsed);
    const isControlled = collapsedProp != null;
    const collapsed = isControlled ? collapsedProp : internalCollapsed;
    const setCollapsed = (0, react_1.useCallback)((next) => {
        if (!isControlled)
            setInternalCollapsed(next);
        onCollapsedChange?.(next);
    }, [isControlled, onCollapsedChange]);
    const collapseContext = (0, react_1.useMemo)(() => ({ collapsed, toggle: () => setCollapsed(!collapsed) }), [collapsed, setCollapsed]);
    return (<SidebarCollapseContext.Provider value={collapseContext}>
      <aside data-collapsed={collapsed ? '' : undefined} data-product={product} className={(0, cx_ts_1.cx)('q-sidebar', collapsed && 'q-sidebar-collapsed', flush && 'q-sidebar-flush', className)} {...props}>
        {children}
      </aside>
    </SidebarCollapseContext.Provider>);
}
/* ── Header: layout slot for the switcher + toggle ─────────────────────────── */
function Header({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-header', className)} {...props}/>;
}
/**
 * The workspace switcher button (compose a Logo + Title inside). When the rail is
 * collapsed the Toggle is hidden, so clicking the switcher (just the logo then)
 * expands the rail — the collapse round-trips with no wiring. A custom `onClick`
 * runs first and can `preventDefault()` to keep the rail collapsed; when expanded
 * the switcher never auto-toggles, so its workspace-switching role is untouched.
 */
function Switcher({ className, type, onClick, ...props }) {
    const collapse = (0, react_1.useContext)(SidebarCollapseContext);
    return (<button type={type ?? 'button'} className={(0, cx_ts_1.cx)('q-sidebar-switcher', className)} onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented && collapse?.collapsed)
                collapse.toggle();
        }} {...props}/>);
}
/** Brand mark slot. */
function Logo({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-logo', className)} {...props}/>;
}
/** Workspace name (compose a SwitcherChevron after the text if wanted). */
function Title({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-switcher-name', 'text-q-body-sm-medium', className)} {...props}/>;
}
/** The up/down workspace-switcher chevron. */
function SwitcherChevron({ className }) {
    return <index_ts_1.Icon as={IconChevronGrabberVerticalOutlined_1.IconChevronGrabberVerticalOutlined} size="sm" color="secondary" className={(0, cx_ts_1.cx)('q-sidebar-switcher-chevron', className)}/>;
}
/**
 * Square icon button that collapses / expands the rail. Inside a `Sidebar.Root`
 * it is self-wiring: clicking flips the Root's collapsed state, it carries
 * `aria-expanded`, and an icon-only Toggle gets a default Collapse/Expand label.
 * A custom `onClick` runs first and can `preventDefault()` to suppress the flip.
 */
function Toggle({ className, type, children, onClick, 'aria-label': ariaLabel, ...props }) {
    const collapse = (0, react_1.useContext)(SidebarCollapseContext);
    // A string child names the button itself; an icon child needs the default label.
    const labelFromText = typeof children === 'string';
    const resolvedLabel = ariaLabel
        ?? (labelFromText || collapse == null ? undefined : collapse.collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    return (<button type={type ?? 'button'} aria-expanded={collapse ? !collapse.collapsed : undefined} aria-label={resolvedLabel} className={(0, cx_ts_1.cx)('q-sidebar-toggle', className)} onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented)
                collapse?.toggle();
        }} {...props}>
      {children}
    </button>);
}
/* ── Body ──────────────────────────────────────────────────────────────────── */
function Body({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-body', className)} {...props}/>;
}
function Search({ icon, className, inputClassName, placeholder = 'Search', ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-sidebar-search', className)}>
      {icon ?? <index_ts_1.Icon as={IconMagnifyingGlassOutlined_1.IconMagnifyingGlassOutlined} size="lg" className="q-sidebar-search-icon"/>}
      <input className={(0, cx_ts_1.cx)('q-sidebar-search-input', 'text-q-body-sm-medium', inputClassName)} placeholder={placeholder} {...props}/>
    </div>);
}
/* ── Section: an optional header + a stack of items ────────────────────────── */
function Section({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-section', className)} {...props}/>;
}
/** The section heading row (compose a SectionTitle + optional SectionActions). */
function SectionHeader({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-section-header', className)} {...props}/>;
}
function SectionTitle({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-section-title', 'text-q-label-xs-medium', className)} {...props}/>;
}
/** Trailing section-header actions (search / sort / add icon buttons). */
function SectionActions({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-section-actions', className)} {...props}/>;
}
/** The items stack inside a Section. */
function SectionItems({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-section-items', className)} {...props}/>;
}
/* ── Row parts (compose any row out of these) ──────────────────────────────── */
function ItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-icon', className)} {...props}/>;
}
function ItemLabel({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-label', 'text-q-body-sm-medium', className)} {...props}/>;
}
function ItemMeta({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-meta', 'text-q-caption-sm-regular', className)} {...props}/>;
}
function ItemEnd({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-sidebar-end', className)} {...props}/>;
}
/** A bare icon button for section-header / row actions (e.g. a menu trigger). */
function ActionButton({ className, type, ...props }) {
    return <button type={type ?? 'button'} className={(0, cx_ts_1.cx)('q-sidebar-action-button', className)} {...props}/>;
}
/** Build a row body from slots; falls back to `children` when no slot is set (back-compat). */
function rowBody({ start, title, meta, end }, children) {
    if (start == null && title == null && meta == null && end == null)
        return children;
    return (<>
      {start != null ? <ItemIcon>{start}</ItemIcon> : null}
      {title != null ? <ItemLabel>{title}</ItemLabel> : null}
      {meta != null ? <ItemMeta>{meta}</ItemMeta> : null}
      {end != null ? <ItemEnd>{end}</ItemEnd> : null}
    </>);
}
/**
 * A sidebar row. The common row is one tag — pass `start` / `title` / `meta` /
 * `end` slot props and the row builds the standard anatomy; compose `ItemIcon` /
 * `ItemLabel` / `ItemMeta` / `ItemEnd` (via `children`) for a bespoke layout.
 * Renders a `<button>`, an `<a>` when `href` is set, or any element via `render`.
 * Pass `onPinChange` for a hover-revealed pin toggle (it self-manages its pinned
 * state when `pinned` is omitted), or `action` for a sibling overlay control.
 */
function Item({ action, actionVisibility = 'always', size = 'md', variant = 'nav', selected = false, pinned, onPinChange, href, render, className, start, title, meta, end, children, ...rest }) {
    const [selfPinned, setSelfPinned] = (0, react_1.useState)(false);
    const pinnedResolved = pinned ?? selfPinned;
    const isLink = href != null;
    const main = (0, use_render_1.useRender)({
        render,
        defaultTagName: isLink ? 'a' : 'button',
        props: {
            className: (0, cx_ts_1.cx)('q-sidebar-row', size === 'sm' ? 'q-sidebar-item-sm' : 'q-sidebar-item', variant === 'project' && 'q-sidebar-projectitem', selected && 'q-sidebar-selected', className),
            ...(isLink ? { href } : { type: 'button' }),
            ...(selected ? { 'aria-current': 'page' } : {}),
            ...rest,
            children: rowBody({ start, title, meta, end }, children),
        },
    });
    const hasPin = onPinChange != null;
    if (action == null && !hasPin)
        return main;
    // Action/pin controls are siblings of the row, never nested inside the row
    // button/link — keeps dropdown triggers and pin buttons valid HTML.
    return (<div className={(0, cx_ts_1.cx)('q-sidebar-actionrow', hasPin && 'q-sidebar-pinrow', actionVisibility === 'hover' && 'q-sidebar-actionrow-hover', variant === 'project' && 'q-sidebar-actionrow-project', selected && 'q-sidebar-actionrow-selected', pinnedResolved && 'q-sidebar-pinned')}>
      {main}
      {action != null ? <span className="q-sidebar-action">{action}</span> : null}
      {hasPin ? (<button type="button" className="q-sidebar-pin" data-pinned={pinnedResolved ? '' : undefined} aria-pressed={pinnedResolved} aria-label={pinnedResolved ? 'Unpin' : 'Pin'} onClick={() => {
                if (pinned == null)
                    setSelfPinned(!pinnedResolved);
                onPinChange(!pinnedResolved);
            }}>
          <IconPinFilledThin_1.IconPinFilledThin />
        </button>) : null}
    </div>);
}
/* ── Footer ────────────────────────────────────────────────────────────────── */
function Footer({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-sidebar-footer', className)} {...props}/>;
}
function FooterItem({ variant = 'default', href, render, className, start, title, meta, end, children, ...rest }) {
    const isLink = href != null;
    const variantClass = variant === 'promo' ? 'q-sidebar-footeritem-promo' : variant === 'login' ? 'q-sidebar-footeritem-login' : undefined;
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: isLink ? 'a' : 'button',
        props: {
            className: (0, cx_ts_1.cx)('q-sidebar-row', 'q-sidebar-footeritem', variantClass, className),
            ...(isLink ? { href } : { type: 'button' }),
            ...rest,
            children: rowBody({ start, title, meta, end }, children),
        },
    });
}
/**
 * Thumbnail tile. Any corner overlay — e.g. a composed `Sidebar.SharedBadge` —
 * is passed as `children`; the badge is NOT a built-in feature of the thumbnail
 * (the thumb's CSS positions a `.q-sidebar-shared-badge` child at the corner).
 */
function ProjectThumbnail({ src, alt = '', fallback, className, children, ...props }) {
    return (<span className={(0, cx_ts_1.cx)('q-sidebar-project-thumb', className)} {...props}>
      {src != null
            ? <img src={src} alt={alt}/>
            : <span className="q-sidebar-project-thumb-fallback">{fallback}</span>}
      {children}
    </span>);
}
function Collaborators({ avatars = [], count, className, ...props }) {
    return (<span className={(0, cx_ts_1.cx)('q-sidebar-collaborators', className)} {...props}>
      {avatars.map((avatar, index) => (<span className="q-sidebar-collaborator-avatar" key={`${avatar.src}-${index}`}>
          <img src={avatar.src} alt={avatar.alt ?? ''}/>
        </span>))}
      {count != null ? <span className="q-sidebar-collaborator-count text-q-caption-xs-medium">{count}</span> : null}
    </span>);
}
function PromoBadge({ className, children = '50% OFF', ...props }) {
    return (<span className={(0, cx_ts_1.cx)('q-sidebar-promo-badge', className)} {...props}>
      {children}
    </span>);
}
exports.Sidebar = {
    Root,
    Header,
    Switcher,
    Logo,
    Title,
    SwitcherChevron,
    Toggle,
    Body,
    Search,
    Section,
    SectionHeader,
    SectionTitle,
    SectionActions,
    SectionItems,
    Item,
    ItemIcon,
    ItemLabel,
    ItemMeta,
    ItemEnd,
    ActionButton,
    Footer,
    FooterItem,
    ProjectThumbnail,
    Collaborators,
    PromoBadge,
};
//# sourceMappingURL=sidebar.js.map