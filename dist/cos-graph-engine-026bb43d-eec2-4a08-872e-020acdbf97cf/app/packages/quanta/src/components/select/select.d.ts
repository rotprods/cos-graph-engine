import type { ComponentProps, ReactNode, Ref } from 'react';
import { Select as Primitive } from '@base-ui/react/select';
/**
 * Select — a form-field dropdown on the Base UI `Select` primitive (controlled /
 * uncontrolled value, single or `multiple`, keyboard typeahead, ARIA listbox,
 * portal + positioning, hidden form input), skinned with quanta tokens.
 *
 * The TRIGGER looks like an `Input` field: the shared `q-field-control` surface
 * (bordered, ~40px tall, white-5% fill, lime focus ring, red `invalid` ring) with
 * a chevron `Select.Icon` on the right that flips on open and a placeholder when
 * empty. The POPUP is the dropdown glass/solid surface (`q-dropdown-content`),
 * and each option reuses the shared `q-menu-item*` row primitives (see menu.css),
 * so Select and Dropdown stay visually identical.
 *
 * COMPOSITION-FIRST. `Select.Item` renders whatever children you give it — wrap
 * `Select.ItemText` (the label echoed back into the trigger) with any leading
 * icon, badge, or meta, and a trailing check `Select.ItemIndicator` paints
 * automatically when the row is selected. Group options with `Select.Group` +
 * `Select.GroupLabel`, divide with `Select.Separator`:
 *
 *   <Select.Root defaultValue="soul" onValueChange={setModel}>
 *     <Select.Trigger>
 *       <Select.Value placeholder="Choose a model" />
 *       <Select.Icon />
 *     </Select.Trigger>
 *     <Select.Content>
 *       <Select.Group>
 *         <Select.GroupLabel>Models</Select.GroupLabel>
 *         <Select.Item value="soul">
 *           <Select.ItemIcon><HiggsfieldIcon /></Select.ItemIcon>
 *           <Select.ItemText>Soul 2.0</Select.ItemText>
 *           <Select.ItemIndicator />
 *         </Select.Item>
 *       </Select.Group>
 *     </Select.Content>
 *   </Select.Root>
 */
export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectContentSurface = 'glass' | 'solid';
export type SelectContentSize = 'default' | 'picker';
type RootProps<Value, Multiple extends boolean | undefined> = Primitive.Root.Props<Value, Multiple> & {
    /**
     * Render the popup as a seamless extension of the trigger: same width, no gap,
     * and merged corners so the field + list read as one continuous surface.
     */
    connected?: boolean;
};
/** Groups all parts; passes `value`/`defaultValue`/`onValueChange`/`multiple` straight through. */
declare function Root<Value, Multiple extends boolean | undefined = false>({ connected, ...props }: RootProps<Value, Multiple>): any;
type TriggerProps = Omit<ComponentProps<typeof Primitive.Trigger>, 'className'> & {
    className?: string;
    /** Trigger height/type scale. `md` (40px) is the default Figma field size. */
    size?: SelectSize;
    /** Invalid (error) state — paints the red field ring. */
    invalid?: boolean;
    /**
     * Skip the field-surface classes entirely — the `render` host owns ALL
     * styling. Use when the trigger is another quanta control, e.g. the builder
     * setting row: `<Select.Trigger bare render={<SettingTrigger label="Voice" />}>`.
     * Base UI still drives `data-popup-open` / `data-placeholder` on the host.
     */
    bare?: boolean;
};
declare function Trigger({ className, size, invalid, bare, ...props }: TriggerProps): any;
type ValueProps = Omit<ComponentProps<typeof Primitive.Value>, 'className'> & {
    className?: string;
};
declare function Value({ className, ...props }: ValueProps): any;
type IconProps = Omit<ComponentProps<typeof Primitive.Icon>, 'className'> & {
    className?: string;
};
declare function Icon({ className, children, ...props }: IconProps): any;
type ContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    positionerClassName?: string;
    surface?: SelectContentSurface;
    /** Popup scale: `default` menu rows or the compact `picker` builder rows. */
    size?: SelectContentSize;
    side?: ComponentProps<typeof Primitive.Positioner>['side'];
    align?: ComponentProps<typeof Primitive.Positioner>['align'];
    sideOffset?: ComponentProps<typeof Primitive.Positioner>['sideOffset'];
    alignOffset?: ComponentProps<typeof Primitive.Positioner>['alignOffset'];
    collisionPadding?: ComponentProps<typeof Primitive.Positioner>['collisionPadding'];
    /**
     * Whether the popup overlaps the trigger so the selected row aligns with the
     * trigger value. Off by default so the popup sits below the field like a menu.
     */
    alignItemWithTrigger?: boolean;
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
declare function Content({ className, positionerClassName, surface, size, side, align, sideOffset, alignOffset, collisionPadding, alignItemWithTrigger, container, children, ...props }: ContentProps): any;
type GroupProps = Omit<ComponentProps<typeof Primitive.Group>, 'className'> & {
    className?: string;
};
declare function Group({ className, ...props }: GroupProps): any;
type GroupLabelProps = Omit<ComponentProps<typeof Primitive.GroupLabel>, 'className'> & {
    className?: string;
};
declare function GroupLabel({ className, ...props }: GroupLabelProps): any;
type SeparatorProps = Omit<ComponentProps<typeof Primitive.Separator>, 'className'> & {
    className?: string;
};
declare function Separator({ className, ...props }: SeparatorProps): any;
type ItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'className'> & {
    className?: string;
    ref?: Ref<HTMLDivElement>;
};
declare function Item({ className, ...props }: ItemProps): any;
/** Leading icon slot (20px). Reuses the shared menu primitive. */
declare function ItemIcon({ className, ...props }: ComponentProps<'span'>): any;
/**
 * Content column — stacks `ItemText` over `ItemDescription` (shared menu
 * primitive). Use for two-line options like "1 minute / Choose duration…".
 * A `div` (not span): Base UI's `ItemText` renders a div and must nest validly.
 */
declare function ItemContent({ className, ...props }: ComponentProps<'div'>): any;
/** Secondary line under the option label. Reuses the shared menu primitive. */
declare function ItemDescription({ className, ...props }: ComponentProps<'span'>): any;
type ItemTextProps = Omit<ComponentProps<typeof Primitive.ItemText>, 'className'> & {
    className?: string;
};
/** The option label echoed back into the trigger `Value` when selected. */
declare function ItemText({ className, ...props }: ItemTextProps): any;
type ItemIndicatorProps = Omit<ComponentProps<typeof Primitive.ItemIndicator>, 'className'> & {
    className?: string;
    children?: ReactNode;
};
/** Trailing check — Base UI mounts it only while the row is selected. */
declare function ItemIndicator({ className, children, ...props }: ItemIndicatorProps): any;
export declare const Select: {
    Root: typeof Root;
    Trigger: typeof Trigger;
    Value: typeof Value;
    Icon: typeof Icon;
    Content: typeof Content;
    Group: typeof Group;
    GroupLabel: typeof GroupLabel;
    Separator: typeof Separator;
    Item: typeof Item;
    ItemIcon: typeof ItemIcon;
    ItemContent: typeof ItemContent;
    ItemText: typeof ItemText;
    ItemDescription: typeof ItemDescription;
    ItemIndicator: typeof ItemIndicator;
};
export {};
//# sourceMappingURL=select.d.ts.map