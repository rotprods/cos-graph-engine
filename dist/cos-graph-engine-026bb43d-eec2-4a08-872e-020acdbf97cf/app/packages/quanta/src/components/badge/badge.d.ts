import type { ComponentProps, ReactNode } from 'react';
import type { ClassValue } from '../utils/cx.ts';
/**
 * Badge — a small presentational status marker. Figma variants Blue/Lime/Pink/
 * Purple/LimeSubtle are skewed uppercase caps; NBrand/NBlue are compact "new" markers.
 * Two sizes (Figma node 526:456): xs (default) and sm.
 */
export type BadgeVariant = 'blue' | 'lime' | 'pink' | 'purple' | 'limeSubtle' | 'nBrand' | 'nBlue';
export type BadgeSize = 'xs' | 'sm';
export interface BadgeOptions {
    variant?: BadgeVariant;
    size?: BadgeSize;
}
export type BadgeProps = ComponentProps<'span'> & {
    text?: ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
};
export declare function badge(options?: BadgeOptions, ...extra: ClassValue[]): string;
export declare function Badge({ variant, size, text, className, children, ...props }: BadgeProps): any;
//# sourceMappingURL=badge.d.ts.map