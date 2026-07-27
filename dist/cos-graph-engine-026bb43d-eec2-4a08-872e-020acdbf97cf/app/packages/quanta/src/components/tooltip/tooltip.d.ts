import type { ComponentProps, ReactNode } from 'react';
import { Tooltip as Primitive } from '@base-ui/react/tooltip';
/**
 * Tooltip — a hover/focus popup on the Base UI `Tooltip` primitive (open timing,
 * focus/hover triggers, ARIA, portal + collision-aware positioning), skinned
 * with quanta's `q-tooltip-*` presentation utilities (see `tooltip.css`).
 *
 * COMPOSITION-FIRST. The parts mirror Base UI: `Tooltip.Provider` (optional,
 * groups delay so adjacent tooltips open instantly), `Tooltip.Root` (open state
 * + delay), `Tooltip.Trigger` (anchor — `render` any element/quanta component),
 * `Tooltip.Content` (the popup; bundles Portal → Positioner → Popup and an
 * optional Arrow). The skin is the standard small inverted surface
 * (`background-inverse` + `text-inverse`).
 *
 *   <Tooltip.Root>
 *     <Tooltip.Trigger render={<Button iconOnly aria-label="Settings"><Icon><GearIcon /></Icon></Button>} />
 *     <Tooltip.Content>Settings</Tooltip.Content>
 *   </Tooltip.Root>
 *
 * Wrap a cluster of triggers in `Tooltip.Provider` to share the open delay:
 *
 *   <Tooltip.Provider delay={300}>
 *     <Tooltip.Root>…</Tooltip.Root>
 *     <Tooltip.Root>…</Tooltip.Root>
 *   </Tooltip.Provider>
 */
export type TooltipSide = NonNullable<ComponentProps<typeof Primitive.Positioner>['side']>;
export type TooltipAlign = NonNullable<ComponentProps<typeof Primitive.Positioner>['align']>;
export type TooltipProviderProps = ComponentProps<typeof Primitive.Provider>;
declare function Provider(props: TooltipProviderProps): any;
export type TooltipRootProps = Omit<ComponentProps<typeof Primitive.Root>, 'children'> & {
    /** Trigger + Content. */
    children?: ReactNode;
    /** Delay (ms) before opening on hover. Default 600 (Base UI). */
    delay?: number;
    /** Delay (ms) before closing after the pointer leaves. Default 0. */
    closeDelay?: number;
    /** Allow hovering into the popup itself without closing. */
    hoverable?: boolean;
};
/**
 * Root groups the parts and owns open state. `delay` / `closeDelay` are forwarded
 * to the Trigger (where Base UI reads them); `hoverable` maps to Base UI's
 * `disableHoverablePopup` (inverted), defaulting to a non-hoverable tooltip.
 */
declare function Root({ delay, closeDelay, hoverable, children, ...props }: TooltipRootProps): any;
export type TooltipTriggerProps = Omit<ComponentProps<typeof Primitive.Trigger>, 'className'> & {
    className?: string;
};
/**
 * Trigger is a pure anchor: Base UI renders the caller's element (via `render`),
 * which owns all presentation, so there is no `q-tooltip-trigger` skin — any
 * `className` is forwarded straight through.
 */
declare function Trigger({ className, delay, closeDelay, ...props }: TooltipTriggerProps): any;
export type TooltipContentProps = Omit<ComponentProps<typeof Primitive.Popup>, 'className'> & {
    className?: string;
    positionerClassName?: string;
    side?: TooltipSide;
    align?: TooltipAlign;
    sideOffset?: ComponentProps<typeof Primitive.Positioner>['sideOffset'];
    alignOffset?: ComponentProps<typeof Primitive.Positioner>['alignOffset'];
    collisionPadding?: ComponentProps<typeof Primitive.Positioner>['collisionPadding'];
    container?: ComponentProps<typeof Primitive.Portal>['container'];
    /** Render a pointing arrow on the anchored side. */
    arrow?: boolean;
    /** Keep the popup mounted while hidden (e.g. for exit animations). */
    keepMounted?: boolean;
};
declare function Content({ className, positionerClassName, side, align, sideOffset, alignOffset, collisionPadding, container, arrow, keepMounted, children, ...props }: TooltipContentProps): any;
export declare const Tooltip: {
    Provider: typeof Provider;
    Root: typeof Root;
    Trigger: typeof Trigger;
    Content: typeof Content;
};
export {};
//# sourceMappingURL=tooltip.d.ts.map