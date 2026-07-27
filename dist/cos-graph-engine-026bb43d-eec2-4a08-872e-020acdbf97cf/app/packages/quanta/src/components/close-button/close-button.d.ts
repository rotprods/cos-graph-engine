import type { ComponentProps, ReactNode } from 'react';
import { IconCrossMediumOutlined as CloseIcon } from '@higgsfield-ai/icons/IconCrossMediumOutlined';
import type { ClassValue } from '../utils/cx.ts';
/**
 * CloseButton — the round dismiss control for modals, dialogs, sheets and any
 * overlay, pixel-matched to the Figma "CloseButton" (node 2052:109). A faint
 * disc with a cross glyph: white-5% fill + primary icon at rest, a stronger
 * fill on hover, and a lime focus ring on keyboard focus.
 *
 *   <CloseButton onClick={close} />          // standalone <button>
 *   <Dialog.Close className={closeButton()}/> // style a framework close part
 *
 * Sizes map to the Figma 24 / 32 / 40 / 48 discs (`sm` / `md` / `lg` / `xl`).
 */
export type CloseButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export interface CloseButtonOptions {
    /** Disc size — Figma 24/32/40/48. Defaults to `md` (32). */
    size?: CloseButtonSize;
}
/**
 * Build the close-button class string. Use this to apply the styling to a
 * non-`<button>` close element, e.g. a Base UI `Dialog.Close` / `Toast.Close`.
 */
export declare function closeButton({ size }?: CloseButtonOptions, ...extra: ClassValue[]): string;
export { CloseIcon };
export type CloseButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
    size?: CloseButtonSize;
    /** Override the default cross glyph. */
    children?: ReactNode;
};
export declare function CloseButton({ size, className, type, children, 'aria-label': ariaLabel, ...props }: CloseButtonProps): any;
//# sourceMappingURL=close-button.d.ts.map