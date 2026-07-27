import type { ComponentProps, ReactNode } from 'react';
/**
 * Divider — a presentational separator matching the Figma divider (node
 * 834:1556): a bare, edge-to-edge etched 2px line (a 1px darker rule overflowing
 * 1px above a 1px layout box). Renders a semantic `<hr>`; when a label is
 * supplied it switches to `<div role="separator">` with two rules flanking the
 * text. This single primitive is used everywhere — including dropdown menus (the
 * old inset `q-menu-separator` was dropped).
 *
 * Usage:
 *   <Divider />                           // horizontal etched rule
 *   <Divider orientation="vertical" />    // self-stretches inside a flex row
 *   <Divider>or</Divider>                 // labelled — text-q-text-tertiary caption
 */
export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerProps = Omit<ComponentProps<'hr'>, 'children'> & {
    orientation?: DividerOrientation;
    /** Optional inline label rendered between two rules (horizontal only). */
    children?: ReactNode;
};
export declare function Divider({ orientation, className, children, ...props }: DividerProps): any;
//# sourceMappingURL=divider.d.ts.map