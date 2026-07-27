import type { ComponentProps, ReactNode } from 'react';
import type { ButtonSize, ButtonVariant } from '../button/index.ts';
import type { ClassValue } from '../utils/cx.ts';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export interface ButtonGroupOptions {
    /** Layout axis. `horizontal` (default) lays buttons in a row; `vertical` in a column. */
    orientation?: ButtonGroupOrientation;
    /**
     * `true` (default) joins the buttons into a segmented control: inner corner
     * radii are removed and adjacent borders collapse onto one shared hairline so
     * only the outer corners stay rounded. `false` renders a spaced row/column
     * with a small gap between independent buttons.
     */
    attached?: boolean;
}
/** Build the button-group class string. Also usable to style a non-div host. */
export declare function buttonGroup(options?: ButtonGroupOptions, ...extra: ClassValue[]): string;
export type ButtonGroupProps = ComponentProps<'div'> & ButtonGroupOptions & {
    /**
     * Propagate one `size` to every child `<Button>` via `cloneElement`, so the
     * caller sets it once for the whole group. A child's own `size` wins (it is
     * only injected where the child didn't set one).
     */
    size?: ButtonSize;
    /** Propagate one `variant` to every child `<Button>` — same precedence as `size`. */
    variant?: ButtonVariant;
    /** The grouped buttons. Any node; quanta `<Button>`s get `size`/`variant` injected. */
    children?: ReactNode;
};
/**
 * ButtonGroup — a pure-quanta layout that groups quanta `<Button>`s into a row
 * or column. Two shapes:
 *
 *   attached (default) → a segmented control: inner radii removed, adjacent
 *     borders collapse to one shared hairline, only the outer corners round.
 *   spaced            → independent buttons with a small gap.
 *
 * It renders a `role="group"` div (pass `aria-label` to name it) and forwards
 * `ref` + `...props` to that div. Set `size` / `variant` once and they propagate
 * to every child `<Button>` (a child's own value wins).
 *
 *   <ButtonGroup aria-label="Text style" variant="outline">
 *     <Button>Bold</Button><Button>Italic</Button><Button>Underline</Button>
 *   </ButtonGroup>
 */
export declare function ButtonGroup({ orientation, attached, size, variant, className, children, ...props }: ButtonGroupProps): any;
//# sourceMappingURL=button-group.d.ts.map