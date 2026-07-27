import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react';
import { NavigationMenu as Primitive } from '@base-ui/react/navigation-menu';
/**
 * NavigationMenu — the product header: a logo, a bar of nav items (each either a
 * plain link or a trigger for a morphing mega-menu panel), and a right-side
 * actions cluster. Built on the Base UI `NavigationMenu` primitive (keyboard +
 * roving focus, hover/click open, the shared size-morphing popup, ARIA, portal +
 * positioning), skinned with quanta's `q-nav-*` utilities.
 *
 * COMPOSITION-FIRST (same rules as Dropdown). No `label` / `title` / `subtitle`
 * / `start` / `end` props — every part is a node you compose, so a bar item or
 * a panel row can hold ANY content. The component owns the design (the bar pill,
 * the glass action pills, the accent treatment, the morphing panel, the row
 * shell + 44px media tile); you own the content.
 *
 *   <NavigationMenu.Root>
 *     <NavigationMenu.Logo><Wordmark/></NavigationMenu.Logo>
 *     <NavigationMenu.List>
 *       <NavigationMenu.Item>                         // trigger + panel
 *         <NavigationMenu.Trigger>
 *           <NavigationMenu.ItemIcon><ImageIcon/></NavigationMenu.ItemIcon>
 *           Image
 *         </NavigationMenu.Trigger>
 *         <NavigationMenu.Content>
 *           <NavigationMenu.Menu size="image" layout="columns">…</NavigationMenu.Menu>
 *         </NavigationMenu.Content>
 *       </NavigationMenu.Item>
 *
 *       <NavigationMenu.Item>                          // plain link
 *         <NavigationMenu.Link href="/sc" accent>
 *           <NavigationMenu.ItemIcon><Spark/></NavigationMenu.ItemIcon>
 *           Supercomputer
 *           <Badge variant="nBrand">new</Badge>
 *         </NavigationMenu.Link>
 *       </NavigationMenu.Item>
 *     </NavigationMenu.List>
 *
 *     <NavigationMenu.Actions>
 *       <NavigationMenu.ActionsGroup>
 *         <NavigationMenu.Action iconOnly aria-label="Search"><Search/></NavigationMenu.Action>
 *         <NavigationMenu.Action href="/pricing"><Diamond/>Pricing<Badge>30% OFF</Badge></NavigationMenu.Action>
 *       </NavigationMenu.ActionsGroup>
 *       <NavigationMenu.Separator />
 *       <Avatar … />
 *     </NavigationMenu.Actions>
 *   </NavigationMenu.Root>
 *
 * PANEL ROWS are pure composition too — a `MenuItem` is a styled row that holds
 * whatever parts you nest. A row that contains a `MenuMedia` (the 44px tile)
 * automatically becomes the rich 60px "large" row (`label/md` title, muted
 * description) — driven by the composed content, not a prop.
 */
/** Rows of items a column holds before wrapping to the next column. */
export type NavRows = 1 | 2 | 3 | 4;
export type NavMenuSize = 'auto' | 'image' | 'video' | 'audio' | 'plugins';
export type NavMenuLayout = 'grid' | 'columns' | 'custom';
export type NavigationMenuRootProps = Omit<ComponentProps<typeof Primitive.Root>, 'className'> & {
    className?: string;
    side?: ComponentProps<typeof Primitive.Positioner>['side'];
    align?: ComponentProps<typeof Primitive.Positioner>['align'];
    sideOffset?: ComponentProps<typeof Primitive.Positioner>['sideOffset'];
    alignOffset?: ComponentProps<typeof Primitive.Positioner>['alignOffset'];
    collisionPadding?: ComponentProps<typeof Primitive.Positioner>['collisionPadding'];
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
/**
 * Renders the `<nav>` bar (logo / list / actions are its children) PLUS the
 * single shared Portal › Positioner › Popup › Viewport that every Item's
 * `Content` morphs into when it opens.
 */
declare function Root({ side, align, sideOffset, alignOffset, collisionPadding, container, className, children, ...props }: NavigationMenuRootProps): any;
/** Logo slot — content is the dev's. */
declare function Logo({ className, ...props }: ComponentProps<'div'>): any;
type ListProps = Omit<ComponentProps<typeof Primitive.List>, 'className'> & {
    className?: string;
};
/** The horizontal bar of items. */
declare function List({ className, ...props }: ListProps): any;
export type NavigationMenuItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'className'> & {
    className?: string;
    /** Stable identity for controlled open state; auto-generated otherwise. */
    value?: string;
};
/** A single bar slot. Put a `Link` inside for a plain item, or a `Trigger` +
 * `Content` pair for a panel trigger. */
declare function Item({ value, children, ...props }: NavigationMenuItemProps): any;
export type NavigationMenuTriggerProps = Omit<ComponentProps<typeof Primitive.Trigger>, 'className'> & {
    className?: string;
    /** Lime accent treatment. */
    accent?: boolean;
    /** Current-section indication — sets `aria-current="page"` + the active style. */
    active?: boolean;
    ref?: Ref<HTMLButtonElement>;
};
/** The bar pill that opens a panel. Compose its label/icon/badge as children. */
declare function Trigger({ className, accent, active, children, ...props }: NavigationMenuTriggerProps): any;
type ContentProps = Omit<ComponentProps<typeof Primitive.Content>, 'className'> & {
    className?: string;
};
/** The panel mounted when its Item opens — wrap a `Menu` (or any content). */
declare function Content({ className, ...props }: ContentProps): any;
export type NavigationMenuLinkProps = Omit<ComponentProps<typeof Primitive.Link>, 'className'> & {
    className?: string;
    /** Lime accent treatment. */
    accent?: boolean;
    /** Current-section indication — sets `aria-current="page"` + the active style. */
    active?: boolean;
};
/** A plain bar link pill. Compose its label/icon/badge as children. */
declare function Link({ className, accent, active, children, ...props }: NavigationMenuLinkProps): any;
/** Leading icon slot for a bar Trigger / Link (24px). */
declare function ItemIcon({ className, ...props }: ComponentProps<'span'>): any;
/** The actions cluster, pushed to the right end of the bar. */
declare function Actions({ className, ...props }: ComponentProps<'div'>): any;
/** A tighter sub-group of adjacent actions. */
declare function ActionsGroup({ className, ...props }: ComponentProps<'div'>): any;
export type NavigationMenuActionProps = Omit<ComponentProps<'button'>, 'type'> & {
    /** Square icon-only pill (e.g. search). */
    iconOnly?: boolean;
    /** Render an `<a>` instead of a `<button>`. */
    href?: string;
    /** Swap the underlying element (e.g. a framework `<Link>` or quanta `Button`). */
    render?: ReactElement;
};
/** A glass action pill (search / Pricing / Assets). Content is the dev's. */
declare function Action({ iconOnly, className, href, render, ...props }: NavigationMenuActionProps): any;
/** A divider — vertical in the bar/actions, reusing the Divider component. */
declare function Separator({ className, ...props }: ComponentProps<'div'>): any;
export type NavigationMenuMenuProps = Omit<ComponentProps<'div'>, 'children'> & {
    /** Rows of items per column before wrapping (1–4; 2–4 typical). Default 2. */
    rows?: NavRows;
    /** Figma-sized panel surface. Defaults to content-sized. */
    size?: NavMenuSize;
    /** `grid` wraps items; `columns` matches Figma mega menus; `custom` leaves content raw. */
    layout?: NavMenuLayout;
    /** Standalone (outside a Root) panel — adds the glass surface + border. */
    standalone?: boolean;
    /** Side rail content (promo / imagery / CTA). Any node. */
    featured?: ReactNode;
    children?: ReactNode;
};
declare function Menu({ rows, size, layout, standalone, featured, className, children, ...props }: NavigationMenuMenuProps): any;
declare function Group({ className, ...props }: ComponentProps<'div'>): any;
/** Column heading inside a Group. */
declare function GroupLabel({ className, ...props }: ComponentProps<'div'>): any;
export type NavigationMenuMenuItemProps = {
    href?: string;
    render?: ComponentProps<typeof Primitive.Link>['render'];
    /** Set false to render a static row (no `NavigationMenu.Link`) outside a Root. */
    interactive?: boolean;
    className?: string;
    children?: ReactNode;
} & Omit<ComponentProps<typeof Primitive.Link>, 'href' | 'render' | 'className'>;
/**
 * A panel row. Renders a real `NavigationMenu.Link` (keyboard + active state)
 * and reuses the shared `q-menu-item*` row primitives (see menu.css). Compose
 * any layout from `MenuItemIcon` / `MenuMedia` / `MenuItemContent` /
 * `MenuItemTitle` / `MenuItemDescription` / `MenuItemTrailing`. Include a
 * `MenuMedia` to get the rich 60px row.
 */
declare function MenuItem({ href, render, interactive, className, children, ...props }: NavigationMenuMenuItemProps): any;
/** Leading icon (20px) for a default panel row. */
declare function MenuItemIcon({ className, ...props }: ComponentProps<'span'>): any;
/** Leading media tile (44px glass) — its presence makes the row the large row. */
declare function MenuMedia({ className, ...props }: ComponentProps<'span'>): any;
/** Content column — stacks the title row and description. */
declare function MenuItemContent({ className, ...props }: ComponentProps<'span'>): any;
declare function MenuItemTitleRow({ className, ...props }: ComponentProps<'span'>): any;
declare function MenuItemTitle({ className, ...props }: ComponentProps<'span'>): any;
declare function MenuItemDescription({ className, ...props }: ComponentProps<'span'>): any;
declare function MenuItemTrailing({ className, ...props }: ComponentProps<'span'>): any;
/** Horizontal separator inside custom NavigationMenu panels. */
declare function MenuSeparator({ className, ...props }: ComponentProps<'div'>): any;
export declare const NavigationMenu: {
    Root: typeof Root;
    Logo: typeof Logo;
    List: typeof List;
    Item: typeof Item;
    Trigger: typeof Trigger;
    Content: typeof Content;
    Link: typeof Link;
    ItemIcon: typeof ItemIcon;
    Actions: typeof Actions;
    ActionsGroup: typeof ActionsGroup;
    Action: typeof Action;
    Separator: typeof Separator;
    Menu: typeof Menu;
    Group: typeof Group;
    GroupLabel: typeof GroupLabel;
    MenuItem: typeof MenuItem;
    MenuItemIcon: typeof MenuItemIcon;
    MenuMedia: typeof MenuMedia;
    MenuItemContent: typeof MenuItemContent;
    MenuItemTitleRow: typeof MenuItemTitleRow;
    MenuItemTitle: typeof MenuItemTitle;
    MenuItemDescription: typeof MenuItemDescription;
    MenuItemTrailing: typeof MenuItemTrailing;
    MenuSeparator: typeof MenuSeparator;
};
export {};
//# sourceMappingURL=navigation-menu.d.ts.map