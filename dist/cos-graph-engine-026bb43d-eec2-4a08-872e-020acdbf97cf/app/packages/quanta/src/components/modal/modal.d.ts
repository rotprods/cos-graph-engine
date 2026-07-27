import type { ComponentProps, ReactNode } from 'react';
import { Dialog as Primitive } from '@base-ui/react/dialog';
import type { ClassValue } from '../utils/cx.ts';
/**
 * Modal — Base UI Dialog (focus trap, scroll lock, escape, a11y, portal, and
 * exit-mount timing) skinned with quanta tokens, pixel-matched to the Figma
 * modal system (node 1947:1403). Dialog is centered (no Positioner), so the
 * glass card lives on `Popup` (z-q-modal) and the dim scrim on `Backdrop`.
 *
 * COMPOSITION-FIRST (same rules as Dropdown / NavigationMenu / Sidebar). The
 * component owns the DESIGN — the glass card, the 40px header row, the inset
 * body window, the 48px footer — and every title / control / caption / action is
 * CONTENT you compose. Header and Footer hold ANY nodes:
 *
 *   <Modal.Root>
 *     <Modal.Trigger render={<Button>Open</Button>} />
 *     <Modal.Content size="md">
 *       <Modal.Header>
 *         <Modal.Title>New element</Modal.Title>
 *         <Modal.CloseButton />
 *       </Modal.Header>
 *       <Modal.Body><Modal.Workspace>…</Modal.Workspace></Modal.Body>
 *       <Modal.Footer>
 *         <Modal.FooterCaption>{caption}</Modal.FooterCaption>
 *         <Modal.FooterActions>
 *           <Button variant="secondary">Cancel</Button>
 *           <Button>Confirm</Button>
 *         </Modal.FooterActions>
 *       </Modal.Footer>
 *     </Modal.Content>
 *   </Modal.Root>
 *
 * Header layouts (Figma default / back / search / tabs) are just different
 * compositions: drop a `Title` + `CloseButton`, a `BackButton` inside a
 * `HeaderLead`, a `Search`, or a Tabs pill + `Spacer` + `CloseButton`. Add
 * `flush` to a header whose row/pill spans the full width (search / tabs).
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export interface ModalOptions {
    size?: ModalSize;
}
/** Build the modal popup class string. Also usable to style a non-popup element. */
export declare function modal(options?: ModalOptions, ...extra: ClassValue[]): string;
type TitleProps = Omit<ComponentProps<typeof Primitive.Title>, 'className'> & {
    className?: string;
};
declare function Title({ className, ...props }: TitleProps): any;
type DescriptionProps = Omit<ComponentProps<typeof Primitive.Description>, 'className'> & {
    className?: string;
};
declare function Description({ className, ...props }: DescriptionProps): any;
type CloseButtonProps = Omit<ComponentProps<typeof Primitive.Close>, 'className'> & {
    className?: string;
};
/** Styled round dismiss button (Figma disc) — sits at the trailing end of a header. */
declare function CloseButton({ className, children, ...props }: CloseButtonProps): any;
type BackButtonProps = Omit<ComponentProps<'button'>, 'className'> & {
    className?: string;
};
/** Styled round back button (Figma disc) for the "back" header. */
declare function BackButton({ className, children, type, ...props }: BackButtonProps): any;
type SearchProps = Omit<ComponentProps<'input'>, 'className' | 'size'> & {
    className?: string;
    inputClassName?: string;
    icon?: ReactNode;
};
/** Search row for the "search" header (magnifier + input). */
declare function Search({ className, inputClassName, icon, placeholder, type, ...props }: SearchProps): any;
type ContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    /** Width preset (Figma sizes). Use className/style for one-off dimensions. */
    size?: ModalSize;
    backdropClassName?: string;
    /** Portal mount node. Defaults to document.body. */
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
declare function Content({ size, backdropClassName, container, className, children, initialFocus, ref, ...props }: ContentProps): any;
type HeaderProps = ComponentProps<'div'> & {
    /** Run the header content flush to the card padding (Figma search / tabs headers). */
    flush?: boolean;
};
declare function Header({ flush, className, ...props }: HeaderProps): any;
/** Leading group inside a header (e.g. a BackButton + Title) for the "back" layout. */
declare function HeaderLead({ className, ...props }: ComponentProps<'div'>): any;
/** Flex spacer — pushes following controls to the trailing end (header or footer). */
declare function Spacer({ className, ...props }: ComponentProps<'span'>): any;
type WorkspaceProps = ComponentProps<'div'> & {
    /** Apply the default content padding. Set false for edge-to-edge content. */
    padded?: boolean;
};
/**
 * The inset "window" — a frosted, lighter pane inside the body. Place a single
 * one to fill the body, or several inside your own layout div (flex row /
 * column / grid) for split layouts like the Figma "Left sidebar" / "Selector".
 */
declare function Workspace({ className, padded, ...props }: WorkspaceProps): any;
type BodyProps = ComponentProps<'div'> & {
    /** Padding for the auto-wrapped single Workspace (ignored when you nest your own). */
    padded?: boolean;
};
/**
 * Body — the scrollable region between header and footer. It imposes NO layout:
 * arrange Workspaces however you like, or pass a single `Modal.Workspace`. Plain
 * content with no Workspace anywhere is auto-wrapped in one full Workspace so the
 * window effect still applies. Scrolls (never crops) when content overflows.
 */
declare function Body({ className, padded, children, ...props }: BodyProps): any;
type FooterProps = ComponentProps<'div'> & {
    /** Stretch the footer for full-width actions (Figma footer type=full). */
    full?: boolean;
};
declare function Footer({ full, className, ...props }: FooterProps): any;
/** Leading footer caption (muted helper text). */
declare function FooterCaption({ className, ...props }: ComponentProps<'div'>): any;
type FooterActionsProps = ComponentProps<'div'> & {
    /** Stretch the actions to fill the footer width (each child grows equally). */
    full?: boolean;
};
/** Trailing footer actions (buttons), pushed to the right by default. */
declare function FooterActions({ full, className, ...props }: FooterActionsProps): any;
export declare const Modal: {
    Root: any;
    Trigger: any;
    Close: any;
    Content: typeof Content;
    Header: typeof Header;
    HeaderLead: typeof HeaderLead;
    Spacer: typeof Spacer;
    Title: typeof Title;
    Description: typeof Description;
    CloseButton: typeof CloseButton;
    BackButton: typeof BackButton;
    Search: typeof Search;
    Body: typeof Body;
    Workspace: typeof Workspace;
    Footer: typeof Footer;
    FooterCaption: typeof FooterCaption;
    FooterActions: typeof FooterActions;
};
export {};
//# sourceMappingURL=modal.d.ts.map