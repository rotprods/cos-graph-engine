import type { ComponentProps, ReactNode } from 'react';
import type { ModalSize } from '../modal/index.ts';
import type { InputProps } from '../input/index.ts';
import { Kbd } from '../kbd/index.ts';
import { Modal } from '../modal/index.ts';
/** Scores an item against the query. >0 keeps the item (and orders by strength). */
export type CommandFilter = (value: string, search: string, keywords: string) => number;
export interface CommandProps extends Omit<ComponentProps<'div'>, 'onSelect'> {
    /** Controlled search value. */
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    /** Disable built-in filtering (caller filters items themselves). */
    shouldFilter?: boolean;
    /** Custom scorer: `(value, search, keywords) => number`; >0 keeps the item. */
    filter?: CommandFilter;
    /** Async state — keeps `Command.Empty` hidden while results are loading. */
    loading?: boolean;
    /** Arrow-key navigation wraps past the ends (default true). */
    loop?: boolean;
    /** Accessible label for the listbox. */
    label?: string;
}
/** Root: owns search + the item registry + keyboard navigation. */
declare function CommandRoot({ value, defaultValue, onValueChange, shouldFilter, filter, loading, loop, label, className, children, ...props }: CommandProps): any;
export type CommandInputProps = Omit<InputProps, 'value' | 'onChange'>;
/** The search box — drives the filter; arrow keys navigate the list. */
export declare function CommandInput({ start, className, placeholder, ...props }: CommandInputProps): any;
export type CommandListProps = ComponentProps<'div'>;
/** Scrollable listbox region. */
export declare function CommandList({ ref, className, children, ...props }: CommandListProps): any;
export type CommandEmptyProps = ComponentProps<'div'>;
/** Shown only when the query matches nothing — and never while loading. */
export declare function CommandEmpty({ className, children, ...props }: CommandEmptyProps): any;
export type CommandLoadingProps = ComponentProps<'div'>;
/** Render inside the list while results load (pair with `loading` on Command). */
export declare function CommandLoading({ className, children, ...props }: CommandLoadingProps): any;
export type CommandGroupProps = ComponentProps<'div'> & {
    heading?: ReactNode;
};
/** A labelled group; hides itself (and its heading) when nothing inside matches. */
export declare function CommandGroup({ heading, className, children, ...props }: CommandGroupProps): any;
export interface CommandItemProps extends Omit<ComponentProps<'div'>, 'onSelect' | 'title'> {
    /** Rich content shown in `<Command.Detail>` while this item is active. */
    detail?: ReactNode;
    /** Footer action label shown in `<Command.Action>` while this item is hovered/active (e.g. "Open dashboard"). */
    action?: ReactNode;
    /** Explicit search text (overrides the text extracted from children). */
    value?: string;
    /** Extra search terms beyond the children's text. */
    keywords?: string;
    disabled?: boolean;
    onSelect?: () => void;
}
/**
 * A selectable command row. Compose it from the exported parts (`ItemIcon` /
 * `ItemContent` / `ItemTitle` / `ItemDescription` / `ItemTrailing`), mirroring
 * `Dropdown.Item`. It registers itself for keyboard navigation and filters
 * itself out when it doesn't match the query (matched on its children's text +
 * `keywords`, or an explicit `value`).
 */
export declare function CommandItem({ detail, action, value, keywords, disabled, onSelect, className, children, ...props }: CommandItemProps): any;
type PartProps = ComponentProps<'span'>;
/** Leading slot — icon, avatar, dot, etc. */
export declare function CommandItemIcon({ className, ...props }: PartProps): any;
/** Content column — stacks the title and description. Optional: a bare
 * `Command.ItemTitle` works too (it grows + truncates on its own). */
export declare function CommandItemContent({ className, ...props }: PartProps): any;
/** Primary label. */
export declare function CommandItemTitle({ className, ...props }: PartProps): any;
/** Secondary line under the title. */
export declare function CommandItemDescription({ className, ...props }: PartProps): any;
/** Trailing slot — shortcut, badge, chevron, count… (pushed to the right). */
export declare function CommandItemTrailing({ className, ...props }: PartProps): any;
export declare function CommandSeparator({ className, ...props }: ComponentProps<'div'>): any;
/**
 * A keyboard-shortcut pill in an item's trailing slot. Composes the canonical
 * `Kbd` (the cmdk shortcut has no bespoke design — reuse Kbd rather than
 * reinvent the pill). For multi-key combos joined by a separator use
 * `KbdSequence` directly in the item's `ItemTrailing`.
 */
export declare function CommandShortcut(props: ComponentProps<typeof Kbd>): any;
export type CommandBodyProps = ComponentProps<'div'>;
/** Row region between Input and Footer — holds the List (left) + Detail (right). */
export declare function CommandBody({ className, ...props }: CommandBodyProps): any;
export type CommandDetailProps = ComponentProps<'div'>;
/**
 * Right pane — renders the active item's `detail`. Renders nothing (so the list
 * goes full-width) when the active item carries no `detail`.
 *
 * Its content lives in an absolutely-positioned scroll layer, so the pane
 * contributes ZERO height to the row: the LIST pane sizes the palette and the
 * detail fills that height + scrolls. That's what keeps showing/hiding it from
 * resizing the modal — without which a tall detail grows the centered modal,
 * shifts the row under the cursor, and ping-pongs the hover (the detail
 * appearing/disappearing loop). Self-contained: drop it straight into
 * `Command.Body`, no second `Modal.Workspace` needed.
 */
export declare function CommandDetail({ className, ...props }: CommandDetailProps): any;
export type CommandFooterProps = ComponentProps<'div'> & {
    /** Leading footer label/caption when Command.Footer is rendered in Command.Dialog. */
    caption?: ReactNode;
    /** Trailing footer actions when Command.Footer is rendered in Command.Dialog. */
    actions?: ReactNode;
    /** Stretch footer actions when rendered by Modal.Footer. */
    full?: boolean;
};
/** Bottom bar — e.g. brand on the left, an Enter-to-confirm action on the right. */
export declare function CommandFooter({ caption, actions, full: _full, children, className, ...props }: CommandFooterProps): any;
export interface CommandActionProps extends ComponentProps<'button'> {
    /** Label shown when no active item provides an `action` (e.g. "Select"). */
    fallback?: ReactNode;
}
/**
 * Footer confirm button. Shows the active item's `action` label (falling back to
 * `fallback`) followed by `children` (typically a `<Kbd>`), and runs the active
 * item on click — the click equivalent of pressing Enter.
 */
export declare function CommandAction({ fallback, className, children, ...props }: CommandActionProps): any;
export interface CommandDialogProps extends CommandProps {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Global hotkey to toggle the palette, e.g. `"mod+k"`. */
    shortcut?: string;
    /** Modal size preset. */
    size?: ModalSize;
    /** Class for the shared Modal.Content shell. */
    className?: string;
    backdropClassName?: string;
    container?: ComponentProps<typeof Modal.Content>['container'];
    initialFocus?: ComponentProps<typeof Modal.Content>['initialFocus'];
    finalFocus?: ComponentProps<typeof Modal.Content>['finalFocus'];
}
/** The command palette in the shared Modal shell with an optional hotkey. */
export declare function CommandDialog({ open, defaultOpen, onOpenChange, shortcut, size, label, className, backdropClassName, container, initialFocus, finalFocus, children, ...commandProps }: CommandDialogProps): any;
export declare const Command: typeof CommandRoot & {
    Root: typeof CommandRoot;
    Dialog: typeof CommandDialog;
    Input: typeof CommandInput;
    List: typeof CommandList;
    Empty: typeof CommandEmpty;
    Loading: typeof CommandLoading;
    Group: typeof CommandGroup;
    Item: typeof CommandItem;
    ItemIcon: typeof CommandItemIcon;
    ItemContent: typeof CommandItemContent;
    ItemTitle: typeof CommandItemTitle;
    ItemDescription: typeof CommandItemDescription;
    ItemTrailing: typeof CommandItemTrailing;
    Separator: typeof CommandSeparator;
    Shortcut: typeof CommandShortcut;
    Body: typeof CommandBody;
    Detail: typeof CommandDetail;
    Footer: typeof CommandFooter;
    Action: typeof CommandAction;
};
export {};
//# sourceMappingURL=cmdk.d.ts.map