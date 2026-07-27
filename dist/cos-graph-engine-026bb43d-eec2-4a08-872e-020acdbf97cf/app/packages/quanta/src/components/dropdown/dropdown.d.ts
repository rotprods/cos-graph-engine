import type { ComponentProps, ReactNode, Ref } from 'react';
import { Menu as Primitive } from '@base-ui/react/menu';
/**
 * Dropdown — a click-triggered menu on the Base UI `Menu` primitive (roving
 * focus, typeahead, keyboard, ARIA, portal + positioning, submenu timing),
 * skinned with quanta's `q-dropdown-*` presentation utilities (see
 * `dropdown.css`). The row shell reuses the shared `q-menu-item*` primitives
 * (see `menu.css`) so the dropdown and navigation-menu stay visually identical.
 *
 * SLOTS BY DEFAULT, composition when you need it. The common row is one tag —
 * pass `start` / `media` / `title` / `subtitle` / `badge` / `end` and `Item`
 * builds the standard anatomy (and, for `selectable` rows, the indicator) for
 * you. Drop down to the exported parts only for a bespoke layout:
 *
 *   <Dropdown.Root selectionMode="single" onSelected={([id]) => setModel(id)}>
 *     <Dropdown.Trigger render={<Button>Open</Button>} />
 *     <Dropdown.Content withSearch>
 *       <Dropdown.Group>
 *         <Dropdown.Label>Models</Dropdown.Label>
 *
 *         // easy — slot props build the row + indicator
 *         <Dropdown.Item
 *           selectable
 *           media={<img src={cover} />}
 *           title="Soul 2.0"
 *           subtitle="Ultra-real visuals"
 *           badge={<Badge variant="lime" text="new" />}
 *         />
 *         <Dropdown.Item title="Credits" end="2,482 left" />
 *
 *         // full control — compose the parts yourself
 *         <Dropdown.Item value="custom">
 *           <Dropdown.ItemContent>
 *             <Dropdown.ItemTitleRow><Dropdown.ItemTitle>Custom</Dropdown.ItemTitle></Dropdown.ItemTitleRow>
 *           </Dropdown.ItemContent>
 *         </Dropdown.Item>
 *       </Dropdown.Group>
 *     </Dropdown.Content>
 *   </Dropdown.Root>
 *
 * SELECTION STATE just works. A `selectable` Item is stateful on its own — with
 * no `value` and no handlers it toggles internally (keyed by its `title`/text
 * through `Root`, or its own state as a last resort). To be notified, pass ONE
 * handler: `onSelected` on Root (the full `string[]`) or `onCheckedChange` on
 * the Item (that row's boolean). Control it by passing `selected` on Root or
 * `checked` on the Item; either still fires the handlers.
 *
 * `withSearch` on Content adds a filter bar that hides non-matching Items (and
 * empty Groups / Subs) live. An Item's searchable text is its `value` prop, or
 * — when omitted — the plain text extracted from its children.
 */
export type DropdownIndicator = 'check' | 'checkbox' | 'switch';
export type DropdownSelectionMode = 'single' | 'multiple';
export type DropdownContentSurface = 'glass' | 'solid';
export type DropdownContentShape = 'default' | 'panel';
export type DropdownContentSize = 'compact' | 'default' | 'large';
type TriggerProps = Omit<ComponentProps<typeof Primitive.Trigger>, 'className'> & {
    className?: string;
};
declare function Trigger({ className, onPointerEnter, onPointerLeave, ...props }: TriggerProps): any;
type RootProps = ComponentProps<typeof Primitive.Root> & {
    /** Controlled set of selected item `value`s. Pair with `onSelected`. */
    selected?: string[];
    /** Initial selection for the uncontrolled (internal-state) case. */
    defaultSelected?: string[];
    /** Subscribe to selection changes — fires with the next `string[]`. */
    onSelected?: (selected: string[]) => void;
    /** 'multiple' (default) toggles items independently; 'single' keeps one. */
    selectionMode?: DropdownSelectionMode;
    /** Open from pointer hover as well as click. Pointer leave closes after a short menu-safe delay. */
    openOnHover?: boolean;
};
/**
 * Root owns selection state. Uncontrolled by default (internal `useState`
 * seeded by `defaultSelected`); pass `selected` to control it. Either way,
 * `onSelected` fires with the next array on every change.
 */
declare function Root({ open, defaultOpen, onOpenChange, selected, defaultSelected, onSelected, selectionMode, openOnHover, ...props }: RootProps): any;
type ContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    positionerClassName?: string;
    size?: DropdownContentSize;
    surface?: DropdownContentSurface;
    shape?: DropdownContentShape;
    side?: ComponentProps<typeof Primitive.Positioner>['side'];
    align?: ComponentProps<typeof Primitive.Positioner>['align'];
    sideOffset?: ComponentProps<typeof Primitive.Positioner>['sideOffset'];
    alignOffset?: ComponentProps<typeof Primitive.Positioner>['alignOffset'];
    collisionPadding?: ComponentProps<typeof Primitive.Positioner>['collisionPadding'];
    container?: ComponentProps<typeof Primitive.Portal>['container'];
    /** Show a search bar that filters items live. */
    withSearch?: boolean;
    searchPlaceholder?: string;
    /** Rendered in place of the list when a search filters out every item. */
    notFound?: ReactNode;
};
declare function Content({ className, positionerClassName, size, surface, shape, side, align, sideOffset, alignOffset, collisionPadding, container, withSearch, searchPlaceholder, notFound, children, onPointerEnter, onPointerLeave, ...props }: ContentProps): any;
type SeparatorProps = Omit<ComponentProps<typeof Primitive.Separator>, 'className'> & {
    className?: string;
};
declare function Separator({ className, ...props }: SeparatorProps): any;
type GroupProps = Omit<ComponentProps<typeof Primitive.Group>, 'className'> & {
    className?: string;
};
declare function Group({ className, children, ...props }: GroupProps): any;
/** Section label (Figma _MenuLabel). Standalone, or as a Group's heading.
 * Reuses the shared `q-menu-group-label` primitive (also used by cmdk). */
declare function Label({ className, ...props }: ComponentProps<'div'>): any;
type PartProps = ComponentProps<'span'>;
declare function ItemIcon({ className, ...props }: PartProps): any;
/** Leading media tile (image/icon, 36px) for rich rows. */
declare function ItemMedia({ className, ...props }: PartProps): any;
/** Content column — stacks the title row and description (Figma 2px gap). */
declare function ItemContent({ className, ...props }: PartProps): any;
declare function ItemTitleRow({ className, ...props }: PartProps): any;
declare function ItemTitle({ className, ...props }: PartProps): any;
declare function ItemDescription({ className, ...props }: PartProps): any;
/** Inline meta inside the title row (e.g. a count). */
declare function ItemMeta({ className, ...props }: PartProps): any;
/** Trailing slot — count, indicator, chevron, button… (pushed to the right). */
declare function ItemTrailing({ className, ...props }: PartProps): any;
/** Small inset metadata chip. */
declare function ItemMetaChip({ className, ...props }: PartProps): any;
/** Submenu affordance chevron for use inside a SubTrigger's ItemTrailing. */
declare function ItemSubChevron({ className }: {
    className?: string;
}): any;
/**
 * Selection indicator for a `selectable` Item. Reads the row's checked state
 * from context, so place it anywhere (typically inside ItemTrailing). The
 * `indicator` style mirrors a real Checkbox / Switch, or a trailing check.
 */
declare function ItemIndicator({ indicator }: {
    indicator?: DropdownIndicator;
}): any;
type ItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'className' | 'title'> & {
    className?: string;
    ref?: Ref<HTMLDivElement>;
    /** Stable identity for search + Root selection. Defaults to the row's `title` / text. */
    value?: string;
    /** Stateful selectable row (stays open on toggle) instead of a plain action. */
    selectable?: boolean;
    disabled?: boolean;
    /** Destructive row — red title + icon (Figma _MenuActions "Delete"). */
    danger?: boolean;
    /** Controlled checked state (wins over Root / internal state). */
    checked?: boolean;
    /** Notified on every toggle of a selectable row — controlled or not. */
    onCheckedChange?: ComponentProps<typeof Primitive.CheckboxItem>['onCheckedChange'];
    /** Action handler for non-selectable items (closes on click). */
    onSelect?: ComponentProps<typeof Primitive.Item>['onClick'];
    /** Leading icon — small `ItemIcon` slot. */
    start?: ReactNode;
    /** Leading 36px media tile (`ItemMedia` slot). Wins over `start`. */
    media?: ReactNode;
    /** Primary line. Providing any slot prop switches the row to slot rendering. */
    title?: ReactNode;
    /** Secondary line under the title. */
    subtitle?: ReactNode;
    /** Inline node beside the title (badge, count…). */
    badge?: ReactNode;
    /** Trailing content (shortcut, meta…). A selectable row's indicator is appended automatically. */
    end?: ReactNode;
    /** Selection indicator style for a selectable slot row. */
    indicator?: DropdownIndicator;
    children?: ReactNode;
};
declare function Item(props: ItemProps): any;
declare function Sub({ children, ...props }: ComponentProps<typeof Primitive.SubmenuRoot>): any;
type SubTriggerProps = Omit<ComponentProps<typeof Primitive.SubmenuTrigger>, 'className' | 'title'> & {
    className?: string;
    disabled?: boolean;
    /** Leading icon (small `ItemIcon` slot). */
    start?: ReactNode;
    /** Primary line. Providing any slot prop switches to slot rendering. */
    title?: ReactNode;
    /** Secondary line under the title. */
    subtitle?: ReactNode;
    /** Trailing content before the submenu chevron (which is always appended). */
    end?: ReactNode;
};
declare function SubTrigger({ className, disabled, start, title, subtitle, end, children, ...props }: SubTriggerProps): any;
type SubContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    /**
     * Gap (px) between the parent menu's outer edge and the nested submenu.
     * Pre-compensated for the parent's 8px content padding. Default 4.
     */
    sideOffset?: number;
    /**
     * Cross-axis nudge (px). Defaults to -8 so the submenu's first row lines up
     * with the trigger (cancels the 8px content padding).
     */
    alignOffset?: number;
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
declare function SubContent({ className, sideOffset, alignOffset, container, children, ...props }: SubContentProps): any;
export declare const Dropdown: {
    Root: typeof Root;
    Trigger: typeof Trigger;
    Content: typeof Content;
    Group: typeof Group;
    Label: typeof Label;
    Separator: typeof Separator;
    Item: typeof Item;
    ItemIcon: typeof ItemIcon;
    ItemMedia: typeof ItemMedia;
    ItemContent: typeof ItemContent;
    ItemTitleRow: typeof ItemTitleRow;
    ItemTitle: typeof ItemTitle;
    ItemDescription: typeof ItemDescription;
    ItemMeta: typeof ItemMeta;
    ItemTrailing: typeof ItemTrailing;
    ItemMetaChip: typeof ItemMetaChip;
    ItemIndicator: typeof ItemIndicator;
    ItemSubChevron: typeof ItemSubChevron;
    Sub: typeof Sub;
    SubTrigger: typeof SubTrigger;
    SubContent: typeof SubContent;
};
export {};
//# sourceMappingURL=dropdown.d.ts.map