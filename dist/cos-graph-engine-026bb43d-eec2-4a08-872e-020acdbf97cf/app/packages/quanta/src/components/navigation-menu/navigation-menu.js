"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigationMenu = void 0;
const react_1 = require("react");
const navigation_menu_1 = require("@base-ui/react/navigation-menu");
const use_render_1 = require("@base-ui/react/use-render");
const index_ts_1 = require("../divider/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const ROWS_CLASS = {
    1: 'q-nav-rows-1',
    2: 'q-nav-rows-2',
    3: 'q-nav-rows-3',
    4: 'q-nav-rows-4',
};
const MENU_SIZE_CLASS = {
    auto: '',
    image: 'q-nav-menu-size-image',
    video: 'q-nav-menu-size-video',
    audio: 'q-nav-menu-size-audio',
    plugins: 'q-nav-menu-size-plugins',
};
const MENU_LAYOUT_CLASS = {
    grid: 'q-nav-menu-layout-grid',
    columns: 'q-nav-menu-layout-columns',
    custom: 'q-nav-menu-layout-custom',
};
/**
 * Renders the `<nav>` bar (logo / list / actions are its children) PLUS the
 * single shared Portal › Positioner › Popup › Viewport that every Item's
 * `Content` morphs into when it opens.
 */
function Root({ side = 'bottom', align = 'center', sideOffset = 8, alignOffset, collisionPadding = 16, container, className, children, ...props }) {
    return (<navigation_menu_1.NavigationMenu.Root className={(0, cx_ts_1.cx)('q-nav-root', className)} {...props}>
      {children}
      <navigation_menu_1.NavigationMenu.Portal container={container}>
        <navigation_menu_1.NavigationMenu.Positioner className="q-nav-positioner" side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding}>
          <navigation_menu_1.NavigationMenu.Popup className="q-nav-popup">
            <navigation_menu_1.NavigationMenu.Viewport className="q-nav-viewport"/>
          </navigation_menu_1.NavigationMenu.Popup>
        </navigation_menu_1.NavigationMenu.Positioner>
      </navigation_menu_1.NavigationMenu.Portal>
    </navigation_menu_1.NavigationMenu.Root>);
}
/** Logo slot — content is the dev's. */
function Logo({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-nav-logo', className)} {...props}/>;
}
/** The horizontal bar of items. */
function List({ className, ...props }) {
    return <navigation_menu_1.NavigationMenu.List className={(0, cx_ts_1.cx)('q-nav-list', className)} {...props}/>;
}
/** A single bar slot. Put a `Link` inside for a plain item, or a `Trigger` +
 * `Content` pair for a panel trigger. */
function Item({ value, children, ...props }) {
    const autoId = (0, react_1.useId)();
    return <navigation_menu_1.NavigationMenu.Item value={value ?? autoId} {...props}>{children}</navigation_menu_1.NavigationMenu.Item>;
}
/** The bar pill that opens a panel. Compose its label/icon/badge as children. */
function Trigger({ className, accent, active, children, ...props }) {
    return (<navigation_menu_1.NavigationMenu.Trigger className={(0, cx_ts_1.cx)('q-nav-item', accent && 'q-nav-item-accent', className)} aria-current={active ? 'page' : undefined} {...props}>
      {children}
    </navigation_menu_1.NavigationMenu.Trigger>);
}
/** The panel mounted when its Item opens — wrap a `Menu` (or any content). */
function Content({ className, ...props }) {
    return <navigation_menu_1.NavigationMenu.Content className={(0, cx_ts_1.cx)('q-nav-content', className)} {...props}/>;
}
/** A plain bar link pill. Compose its label/icon/badge as children. */
function Link({ className, accent, active, children, ...props }) {
    return (<navigation_menu_1.NavigationMenu.Link className={(0, cx_ts_1.cx)('q-nav-item', accent && 'q-nav-item-accent', className)} aria-current={active ? 'page' : undefined} {...props}>
      {children}
    </navigation_menu_1.NavigationMenu.Link>);
}
/** Leading icon slot for a bar Trigger / Link (24px). */
function ItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-nav-item-icon', className)} {...props}/>;
}
/* ── Right-side actions ────────────────────────────────────────────────────── */
/** The actions cluster, pushed to the right end of the bar. */
function Actions({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-nav-actions', className)} {...props}/>;
}
/** A tighter sub-group of adjacent actions. */
function ActionsGroup({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-nav-actions-group', className)} {...props}/>;
}
/** A glass action pill (search / Pricing / Assets). Content is the dev's. */
function Action({ iconOnly, className, href, render, ...props }) {
    const cls = (0, cx_ts_1.cx)('q-nav-action', iconOnly && 'q-nav-action-icon', className);
    const isNativeButton = render == null && href == null;
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: href != null ? 'a' : 'button',
        props: {
            className: cls,
            ...(href != null ? { href } : {}),
            ...(isNativeButton ? { type: 'button' } : {}),
            ...props,
        },
    });
}
/** A divider — vertical in the bar/actions, reusing the Divider component. */
function Separator({ className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-nav-separator', className)} {...props}>
      <index_ts_1.Divider orientation="vertical"/>
    </div>);
}
function Menu({ rows = 2, size = 'auto', layout = 'grid', standalone = false, featured, className, children, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-nav-menu', standalone && 'q-nav-menu-static', MENU_SIZE_CLASS[size], MENU_LAYOUT_CLASS[layout], className)} {...props}>
      {layout === 'custom'
            ? children
            : (<div className={(0, cx_ts_1.cx)(layout === 'columns' ? 'q-nav-menu-columns' : 'q-nav-menu-grid', ROWS_CLASS[rows])}>
              {children}
            </div>)}
      {featured != null ? <div className="q-nav-featured">{featured}</div> : null}
    </div>);
}
/* ── Group: a labeled cluster of rows (its own full-height column) ─────────── */
function Group({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-nav-group', className)} {...props}/>;
}
/** Column heading inside a Group. */
function GroupLabel({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-nav-group-label', className)} {...props}/>;
}
/**
 * A panel row. Renders a real `NavigationMenu.Link` (keyboard + active state)
 * and reuses the shared `q-menu-item*` row primitives (see menu.css). Compose
 * any layout from `MenuItemIcon` / `MenuMedia` / `MenuItemContent` /
 * `MenuItemTitle` / `MenuItemDescription` / `MenuItemTrailing`. Include a
 * `MenuMedia` to get the rich 60px row.
 */
function MenuItem({ href, render, interactive = true, className, children, ...props }) {
    const itemClass = (0, cx_ts_1.cx)('q-menu-item', 'q-nav-menu-item', className);
    if (!interactive) {
        const staticProps = props;
        return href != null
            ? <a className={itemClass} href={href} {...staticProps}>{children}</a>
            : <div className={itemClass} {...props}>{children}</div>;
    }
    return (<navigation_menu_1.NavigationMenu.Link className={itemClass} href={href} render={render} {...props}>
      {children}
    </navigation_menu_1.NavigationMenu.Link>);
}
/** Leading icon (20px) for a default panel row. */
function MenuItemIcon({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-icon', className)} {...props}/>;
}
/** Leading media tile (44px glass) — its presence makes the row the large row. */
function MenuMedia({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-nav-menu-media', className)} {...props}/>;
}
/** Content column — stacks the title row and description. */
function MenuItemContent({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-label', className)} {...props}/>;
}
function MenuItemTitleRow({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title-row', className)} {...props}/>;
}
function MenuItemTitle({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-title', className)} {...props}/>;
}
function MenuItemDescription({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-description', className)} {...props}/>;
}
function MenuItemTrailing({ className, ...props }) {
    return <span className={(0, cx_ts_1.cx)('q-menu-item-trailing', className)} {...props}/>;
}
/** Horizontal separator inside custom NavigationMenu panels. */
function MenuSeparator({ className, ...props }) {
    return (<div className={(0, cx_ts_1.cx)('q-nav-menu-separator', className)} {...props}>
      <index_ts_1.Divider orientation="horizontal"/>
    </div>);
}
exports.NavigationMenu = {
    Root,
    Logo,
    List,
    Item,
    Trigger,
    Content,
    Link,
    ItemIcon,
    Actions,
    ActionsGroup,
    Action,
    Separator,
    Menu,
    Group,
    GroupLabel,
    MenuItem,
    MenuItemIcon,
    MenuMedia,
    MenuItemContent,
    MenuItemTitleRow,
    MenuItemTitle,
    MenuItemDescription,
    MenuItemTrailing,
    MenuSeparator,
};
//# sourceMappingURL=navigation-menu.js.map