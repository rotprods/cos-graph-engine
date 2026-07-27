import type { ComponentProps, ReactElement, ReactNode } from 'react';
/**
 * NotFound — a standalone empty / zero-results state primitive. Every slot is
 * a free ReactNode for full control:
 *
 *   <NotFound
 *     icon={<SearchIcon />}
 *     title="No results found"
 *     subtitle="Try a different search term"
 *     actions={<Button size="sm">Clear filters</Button>}
 *   />
 *
 * Matched to the Figma "Menu / Empty" state but framework-agnostic — drop it
 * into a menu, panel, list, or any container that needs an empty state.
 *
 * `size` scales the glass icon tile, icon and typography (sm / md / lg).
 * `variant` controls the surface: `plain` (transparent, drops into an existing
 * surface), `card` (its own frosted-glass panel) or `outline` (a subtle dashed
 * drop-zone). The glassy icon tile is identical across every size and variant.
 *
 * The host element is swappable via `render` (Base UI useRender) — e.g. make
 * the `outline` drop-zone a `<button>` / `<label>` upload trigger.
 */
export type NotFoundSize = 'sm' | 'md' | 'lg';
export type NotFoundVariant = 'plain' | 'card' | 'outline';
export type NotFoundProps = Omit<ComponentProps<'div'>, 'title'> & {
    /** Leading icon node — wrapped in the glass tile. Any ReactNode. */
    icon?: ReactNode;
    /** Primary line. Any ReactNode. */
    title?: ReactNode;
    /** Secondary line. Any ReactNode. */
    subtitle?: ReactNode;
    /** Trailing CTA cluster (e.g. a quanta Button). Any ReactNode. */
    actions?: ReactNode;
    /** Scale of the tile, icon and text. Defaults to `md`. */
    size?: NotFoundSize;
    /** Surface treatment — keeps the glassy tile in every case. Defaults to `plain`. */
    variant?: NotFoundVariant;
    /** Swap the root element/component (e.g. a `<button>` / `<label>` drop-zone). Defaults to `<div>`. */
    render?: ReactElement;
};
export declare function NotFound({ icon, title, subtitle, actions, size, variant, className, children, render, ref, ...props }: NotFoundProps): any;
//# sourceMappingURL=not-found.d.ts.map