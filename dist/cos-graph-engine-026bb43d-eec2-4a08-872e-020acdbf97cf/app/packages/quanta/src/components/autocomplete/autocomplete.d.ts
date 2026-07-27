import type { ComponentProps, ReactNode } from 'react';
import { Autocomplete as Primitive } from '@base-ui/react/autocomplete';
export type AutocompleteRootProps = ComponentProps<typeof Primitive.Root> & {
    /**
     * Render the popup as a seamless extension of the input: same width, no gap,
     * merged corners so the field + list read as one continuous surface.
     */
    connected?: boolean;
};
export declare function AutocompleteRoot({ connected, ...props }: AutocompleteRootProps): any;
export type AutocompleteInputProps = Omit<ComponentProps<typeof Primitive.Input>, 'className'> & {
    className?: string;
    /** Class for the field-surface wrapper that holds the icon + input + clear. */
    controlClassName?: string;
    /** Leading slot (20px). Defaults to a search icon; pass `null` to remove. */
    start?: ReactNode;
    /** Show the auto-hiding Base UI Clear button (default true). */
    clear?: boolean;
    /** Accessible label for the clear button. */
    clearLabel?: string;
};
export declare function AutocompleteInput({ className, controlClassName, start, clear, clearLabel, ...props }: AutocompleteInputProps): any;
export type AutocompleteContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    /** Opaque surface instead of frosted glass. */
    solid?: boolean;
    /** Side offset of the popup from the input (px). */
    sideOffset?: number;
    /** Class for the Base UI Positioner. */
    positionerClassName?: string;
    /** Portal container. */
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
export declare function AutocompleteContent({ className, solid, sideOffset, positionerClassName, container, children, ...props }: AutocompleteContentProps): any;
export type AutocompleteListProps = Omit<ComponentProps<typeof Primitive.List>, 'className'> & {
    className?: string;
};
export declare function AutocompleteList({ className, ...props }: AutocompleteListProps): any;
export type AutocompleteItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'className'> & {
    className?: string;
};
export declare function AutocompleteItem({ className, ...props }: AutocompleteItemProps): any;
export type AutocompleteGroupProps = Omit<ComponentProps<typeof Primitive.Group>, 'className'> & {
    className?: string;
};
export declare function AutocompleteGroup({ className, ...props }: AutocompleteGroupProps): any;
export type AutocompleteGroupLabelProps = Omit<ComponentProps<typeof Primitive.GroupLabel>, 'className'> & {
    className?: string;
};
export declare function AutocompleteGroupLabel({ className, ...props }: AutocompleteGroupLabelProps): any;
/** Renders the filtered items of a group (Base UI Collection). No DOM of its own. */
export declare const AutocompleteCollection: any;
export type AutocompleteCollectionProps = ComponentProps<typeof Primitive.Collection>;
export type AutocompleteEmptyProps = Omit<ComponentProps<typeof Primitive.Empty>, 'className'> & {
    className?: string;
};
export declare function AutocompleteEmpty({ className, children, ...props }: AutocompleteEmptyProps): any;
export type AutocompleteClearProps = Omit<ComponentProps<typeof Primitive.Clear>, 'className'> & {
    className?: string;
};
export declare function AutocompleteClear({ className, children, ...props }: AutocompleteClearProps): any;
type PartProps = ComponentProps<'span'>;
export declare function AutocompleteItemIcon({ className, ...props }: PartProps): any;
export declare function AutocompleteItemContent({ className, ...props }: PartProps): any;
export declare function AutocompleteItemTitleRow({ className, ...props }: PartProps): any;
export declare function AutocompleteItemTitle({ className, ...props }: PartProps): any;
export declare function AutocompleteItemDescription({ className, ...props }: PartProps): any;
export declare function AutocompleteItemTrailing({ className, ...props }: PartProps): any;
/** `Autocomplete` namespace — the parts API. */
export declare const Autocomplete: typeof AutocompleteRoot & {
    Root: typeof AutocompleteRoot;
    Input: typeof AutocompleteInput;
    Content: typeof AutocompleteContent;
    List: typeof AutocompleteList;
    Item: typeof AutocompleteItem;
    Group: typeof AutocompleteGroup;
    GroupLabel: typeof AutocompleteGroupLabel;
    Collection: any;
    Empty: typeof AutocompleteEmpty;
    Clear: typeof AutocompleteClear;
    ItemIcon: typeof AutocompleteItemIcon;
    ItemContent: typeof AutocompleteItemContent;
    ItemTitleRow: typeof AutocompleteItemTitleRow;
    ItemTitle: typeof AutocompleteItemTitle;
    ItemDescription: typeof AutocompleteItemDescription;
    ItemTrailing: typeof AutocompleteItemTrailing;
};
export {};
//# sourceMappingURL=autocomplete.d.ts.map