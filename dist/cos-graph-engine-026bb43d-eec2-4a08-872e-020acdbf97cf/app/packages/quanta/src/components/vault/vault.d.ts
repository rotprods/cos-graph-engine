import type { ComponentProps, ReactNode } from 'react';
import { Drawer as Primitive } from '@base-ui/react/drawer';
/**
 * Vault — an edge-docked, swipeable drawer / sheet on Base UI Drawer (the Vaul
 * model), skinned with quanta tokens. Base UI owns the drag physics, snap points,
 * focus trap, scroll lock and a11y; quanta paints the surface and docks it to a
 * chosen edge. Composition mirrors Modal: Root / Trigger / Content / Header /
 * Body / Footer.
 *
 *   <Vault.Root side="bottom">
 *     <Vault.Trigger render={<Button>Open</Button>} />
 *     <Vault.Content>
 *       <Vault.Header title="Filters" />
 *       <Vault.Body>…</Vault.Body>
 *       <Vault.Footer actions={<Button>Apply</Button>} />
 *     </Vault.Content>
 *   </Vault.Root>
 */
export type VaultSide = 'bottom' | 'top' | 'left' | 'right';
export type VaultRootProps = ComponentProps<typeof Primitive.Root> & {
    side?: VaultSide;
};
/** Owns open state + the swipe gesture for the chosen edge. */
declare function Root({ side, children, ...props }: VaultRootProps): any;
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
declare function CloseButton({ className, children, ...props }: CloseButtonProps): any;
export type VaultContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    /** Override the side from Root (rarely needed). */
    side?: VaultSide;
    /** Show the grab handle. Defaults to true for the `bottom` side. */
    handle?: boolean;
    backdropClassName?: string;
    container?: ComponentProps<typeof Primitive.Portal>['container'];
};
/**
 * Portal + Backdrop + Viewport + the edge-docked, swipeable Popup. The
 * `Drawer.Viewport` is REQUIRED — it's what enables Base UI's swipe/drag,
 * snap-point handling and touch scroll-locking (without it the Popup renders
 * but is undraggable).
 */
declare function Content({ side: sideProp, handle, backdropClassName, container, className, children, ...props }: VaultContentProps): any;
export type VaultHeaderProps = Omit<ComponentProps<'div'>, 'title'> & {
    title?: ReactNode;
    /** Leading slot — a back button / icon / avatar before the title. Any node. */
    start?: ReactNode;
    /** Trailing slot — sits just before the close affordance. Any node. */
    end?: ReactNode;
    /** Close affordance: `true` (default button), `false` (none), or a custom node. */
    closeButton?: ReactNode | boolean;
};
declare function Header({ title, start, end, closeButton, children, className, ...props }: VaultHeaderProps): any;
type BodyProps = ComponentProps<'div'>;
/** Scrollable content region. */
declare function Body({ className, ...props }: BodyProps): any;
export type VaultFooterProps = ComponentProps<'div'> & {
    caption?: ReactNode;
    actions?: ReactNode;
    /** Stretch the actions to fill the footer width (full-width sheet buttons). */
    full?: boolean;
};
declare function Footer({ caption, actions, full, children, className, ...props }: VaultFooterProps): any;
export declare const Vault: {
    Root: typeof Root;
    Trigger: any;
    Content: typeof Content;
    Header: typeof Header;
    Body: typeof Body;
    Footer: typeof Footer;
    Title: typeof Title;
    Description: typeof Description;
    Close: any;
    CloseButton: typeof CloseButton;
};
export {};
//# sourceMappingURL=vault.d.ts.map