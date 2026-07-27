import type { ComponentProps, ReactNode } from 'react';
import { useRender } from '@base-ui/react/use-render';
/**
 * Sidebar — the product navigation rail, pixel-matched to the Figma "Sidebar"
 * system (primitives 2438:253, variants 2441:1407).
 *
 * SLOTS BY DEFAULT, composition when you need it (same rules as Dropdown). The
 * component owns the DESIGN — the rail, the 36px switcher, the row shells, the
 * pin / action overlays, the collapsed icon-strip. A row is one tag: pass
 * `start` / `title` / `meta` / `end` and it builds the anatomy; compose the
 * exported parts (`ItemIcon` / `ItemLabel` / `ItemMeta` / `ItemEnd`) via
 * `children` only for a bespoke layout.
 *
 *   <Sidebar.Root product="cinema-studio">
 *     <Sidebar.Header>
 *       <Sidebar.Switcher>
 *         <Sidebar.Logo><Logo/></Sidebar.Logo>
 *         <Sidebar.Title>Cinema Studio <Sidebar.SwitcherChevron/></Sidebar.Title>
 *       </Sidebar.Switcher>
 *       <Sidebar.Toggle><CollapseIcon/></Sidebar.Toggle>
 *     </Sidebar.Header>
 *
 *     <Sidebar.Body>
 *       <Sidebar.Section>
 *         <Sidebar.SectionItems>
 *           <Sidebar.Item selected start={<HomeIcon/>} title="Home" />
 *         </Sidebar.SectionItems>
 *       </Sidebar.Section>
 *
 *       <Sidebar.Section>
 *         <Sidebar.SectionHeader>
 *           <Sidebar.SectionTitle>Projects</Sidebar.SectionTitle>
 *         </Sidebar.SectionHeader>
 *         <Sidebar.SectionItems>
 *           <Sidebar.Item
 *             variant="project"
 *             start={<Sidebar.ProjectThumbnail src={cover}/>}
 *             title="Blue Horizon"
 *             meta="484"
 *             onPinChange={togglePin}
 *           />
 *         </Sidebar.SectionItems>
 *       </Sidebar.Section>
 *     </Sidebar.Body>
 *
 *     <Sidebar.Footer>
 *       <Sidebar.FooterItem variant="promo" start={<DiamondIcon/>} title="Pricing" end={<Sidebar.PromoBadge/>} />
 *     </Sidebar.Footer>
 *   </Sidebar.Root>
 *
 * Collapsing to the icon strip is BUILT IN: `Sidebar.Toggle` flips the rail with
 * no wiring, the Root owns the state (uncontrolled via `defaultCollapsed`, or
 * controlled via `collapsed` + `onCollapsedChange`), and collapsed labels / meta
 * / actions hide while icons centre. Rows render a `<button>`, an `<a>` when
 * `href` is set, or any element via `render` (Base UI useRender, e.g. a Link).
 */
export type SidebarItemSize = 'md' | 'sm';
export type SidebarItemVariant = 'nav' | 'project';
export type SidebarFooterVariant = 'default' | 'promo' | 'login';
export type SidebarProduct = 'cinema-studio' | 'marketing-studio' | 'supercomputer';
export type SidebarActionVisibility = 'always' | 'hover';
export type SidebarRootProps = ComponentProps<'aside'> & {
    /** Icon-strip mode (controlled): labels/meta/actions hide and icons center. */
    collapsed?: boolean;
    /** Initial collapsed state when uncontrolled (Toggle drives it from here). */
    defaultCollapsed?: boolean;
    /** Fires whenever the collapsed state changes (Toggle, or a controlled set). */
    onCollapsedChange?: (collapsed: boolean) => void;
    /** Figma product variant; controls the variant rail width only. */
    product?: SidebarProduct;
    /** Square corners (docked flush to a screen edge). */
    flush?: boolean;
};
declare function Root({ collapsed: collapsedProp, defaultCollapsed, onCollapsedChange, product, flush, className, children, ...props }: SidebarRootProps): any;
declare function Header({ className, ...props }: ComponentProps<'div'>): any;
/**
 * The workspace switcher button (compose a Logo + Title inside). When the rail is
 * collapsed the Toggle is hidden, so clicking the switcher (just the logo then)
 * expands the rail — the collapse round-trips with no wiring. A custom `onClick`
 * runs first and can `preventDefault()` to keep the rail collapsed; when expanded
 * the switcher never auto-toggles, so its workspace-switching role is untouched.
 */
declare function Switcher({ className, type, onClick, ...props }: ComponentProps<'button'>): any;
/** Brand mark slot. */
declare function Logo({ className, ...props }: ComponentProps<'span'>): any;
/** Workspace name (compose a SwitcherChevron after the text if wanted). */
declare function Title({ className, ...props }: ComponentProps<'span'>): any;
/** The up/down workspace-switcher chevron. */
declare function SwitcherChevron({ className }: {
    className?: string;
}): any;
/**
 * Square icon button that collapses / expands the rail. Inside a `Sidebar.Root`
 * it is self-wiring: clicking flips the Root's collapsed state, it carries
 * `aria-expanded`, and an icon-only Toggle gets a default Collapse/Expand label.
 * A custom `onClick` runs first and can `preventDefault()` to suppress the flip.
 */
declare function Toggle({ className, type, children, onClick, 'aria-label': ariaLabel, ...props }: ComponentProps<'button'>): any;
declare function Body({ className, ...props }: ComponentProps<'div'>): any;
export type SidebarSearchProps = Omit<ComponentProps<'input'>, 'size'> & {
    /** Leading icon, defaults to a magnifier. */
    icon?: ReactNode;
    className?: string;
    inputClassName?: string;
};
declare function Search({ icon, className, inputClassName, placeholder, ...props }: SidebarSearchProps): any;
declare function Section({ className, ...props }: ComponentProps<'div'>): any;
/** The section heading row (compose a SectionTitle + optional SectionActions). */
declare function SectionHeader({ className, ...props }: ComponentProps<'div'>): any;
declare function SectionTitle({ className, ...props }: ComponentProps<'span'>): any;
/** Trailing section-header actions (search / sort / add icon buttons). */
declare function SectionActions({ className, ...props }: ComponentProps<'span'>): any;
/** The items stack inside a Section. */
declare function SectionItems({ className, ...props }: ComponentProps<'div'>): any;
declare function ItemIcon({ className, ...props }: ComponentProps<'span'>): any;
declare function ItemLabel({ className, ...props }: ComponentProps<'span'>): any;
declare function ItemMeta({ className, ...props }: ComponentProps<'span'>): any;
declare function ItemEnd({ className, ...props }: ComponentProps<'span'>): any;
/** A bare icon button for section-header / row actions (e.g. a menu trigger). */
declare function ActionButton({ className, type, ...props }: ComponentProps<'button'>): any;
type RowSlotProps = {
    /** Leading icon — `ItemIcon` slot. */
    start?: ReactNode;
    /** Row label — `ItemLabel` slot. */
    title?: ReactNode;
    /** Trailing count — `ItemMeta` slot. */
    meta?: ReactNode;
    /** Trailing content (pin, collaborators, badge) — `ItemEnd` slot. */
    end?: ReactNode;
};
type RowOwnProps = {
    /** Interactive row action rendered as a sibling overlay, not inside the row button. */
    action?: ReactNode;
    /** Whether the sibling row action is always visible or revealed on row hover/focus. */
    actionVisibility?: SidebarActionVisibility;
    /** Link target: renders an `<a>` instead of a `<button>`. */
    href?: string;
    /** Swap the host element (Base UI useRender, e.g. a router Link). */
    render?: useRender.RenderProp;
};
type RowProps = Omit<ComponentProps<'button'>, 'title'> & RowOwnProps;
export type SidebarItemProps = RowProps & RowSlotProps & {
    size?: SidebarItemSize;
    /** Figma row primitive: NavItem or ProjectItem. */
    variant?: SidebarItemVariant;
    selected?: boolean;
    /** Pinned visual state — controlled. Omit (with `onPinChange`) to let the row manage its own pin. */
    pinned?: boolean;
    /** Enable a pin toggle (a pin button that reveals on hover). `(next) => void`. */
    onPinChange?: (pinned: boolean) => void;
};
/**
 * A sidebar row. The common row is one tag — pass `start` / `title` / `meta` /
 * `end` slot props and the row builds the standard anatomy; compose `ItemIcon` /
 * `ItemLabel` / `ItemMeta` / `ItemEnd` (via `children`) for a bespoke layout.
 * Renders a `<button>`, an `<a>` when `href` is set, or any element via `render`.
 * Pass `onPinChange` for a hover-revealed pin toggle (it self-manages its pinned
 * state when `pinned` is omitted), or `action` for a sibling overlay control.
 */
declare function Item({ action, actionVisibility, size, variant, selected, pinned, onPinChange, href, render, className, start, title, meta, end, children, ...rest }: SidebarItemProps): any;
declare function Footer({ className, ...props }: ComponentProps<'div'>): any;
export type SidebarFooterItemProps = Omit<RowProps, 'action' | 'actionVisibility'> & RowSlotProps & {
    variant?: SidebarFooterVariant;
};
declare function FooterItem({ variant, href, render, className, start, title, meta, end, children, ...rest }: SidebarFooterItemProps): any;
export type SidebarProjectThumbnailProps = ComponentProps<'span'> & {
    src?: string;
    alt?: string;
    fallback?: ReactNode;
};
/**
 * Thumbnail tile. Any corner overlay — e.g. a composed `Sidebar.SharedBadge` —
 * is passed as `children`; the badge is NOT a built-in feature of the thumbnail
 * (the thumb's CSS positions a `.q-sidebar-shared-badge` child at the corner).
 */
declare function ProjectThumbnail({ src, alt, fallback, className, children, ...props }: SidebarProjectThumbnailProps): any;
export type SidebarCollaboratorsProps = ComponentProps<'span'> & {
    avatars?: Array<{
        src: string;
        alt?: string;
    }>;
    count?: ReactNode;
};
declare function Collaborators({ avatars, count, className, ...props }: SidebarCollaboratorsProps): any;
export type SidebarPromoBadgeProps = ComponentProps<'span'>;
declare function PromoBadge({ className, children, ...props }: SidebarPromoBadgeProps): any;
export declare const Sidebar: {
    Root: typeof Root;
    Header: typeof Header;
    Switcher: typeof Switcher;
    Logo: typeof Logo;
    Title: typeof Title;
    SwitcherChevron: typeof SwitcherChevron;
    Toggle: typeof Toggle;
    Body: typeof Body;
    Search: typeof Search;
    Section: typeof Section;
    SectionHeader: typeof SectionHeader;
    SectionTitle: typeof SectionTitle;
    SectionActions: typeof SectionActions;
    SectionItems: typeof SectionItems;
    Item: typeof Item;
    ItemIcon: typeof ItemIcon;
    ItemLabel: typeof ItemLabel;
    ItemMeta: typeof ItemMeta;
    ItemEnd: typeof ItemEnd;
    ActionButton: typeof ActionButton;
    Footer: typeof Footer;
    FooterItem: typeof FooterItem;
    ProjectThumbnail: typeof ProjectThumbnail;
    Collaborators: typeof Collaborators;
    PromoBadge: typeof PromoBadge;
};
export {};
//# sourceMappingURL=sidebar.d.ts.map