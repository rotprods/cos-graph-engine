import type { ComponentProps, ReactNode } from 'react';
import { Avatar as Primitive } from '@base-ui/react/avatar';
/**
 * Avatar — circular presence pinned to the Figma "Avatar" component
 * (node 1405:5456). Renders, in priority order, a photo, a custom fallback, or
 * mono-cased initials on a palette-coloured disk; an optional dashed variant is
 * the empty / "add" placeholder.
 *
 * Composable parts (every part is a replaceable node with a default):
 *   • `fallback` — the disk CONTENT slot (defaults to initials from `alt`); pass
 *     any node to override.
 *   • `badge` — the rim slot (defaults to the presence `<Dot>` derived from
 *     `status`); pass any node — a count `<Badge>`, a verified check, a custom
 *     `<Dot>` — to replace it. `status` stays as the convenience default.
 *   • `render` (via Base UI Avatar.Root) swaps the host element.
 */
export type AvatarSize = 'xxs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';
export type AvatarColor = 'neutral' | 'orange' | 'mint' | 'blue' | 'pink' | 'purple' | 'brown' | 'yellow';
export type AvatarVariant = 'filled' | 'pending' | 'dashed';
type AvatarImageProps = Omit<ComponentProps<typeof Primitive.Image>, 'alt' | 'children' | 'className' | 'src'> & {
    className?: string;
};
export type AvatarProps = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
    size?: AvatarSize;
    src?: string;
    alt?: string;
    fallback?: ReactNode;
    color?: AvatarColor;
    status?: AvatarStatus;
    /**
     * Rim slot. Defaults to the presence `<Dot>` for `status`; pass any node
     * (a `<Badge>`, a verified icon, a custom `<Dot>`) to replace it.
     */
    badge?: ReactNode;
    variant?: AvatarVariant;
    imageProps?: AvatarImageProps;
};
export declare function Avatar({ size, src, alt, fallback, color, status, badge, variant, imageProps, className, ...props }: AvatarProps): any;
export {};
//# sourceMappingURL=avatar.d.ts.map