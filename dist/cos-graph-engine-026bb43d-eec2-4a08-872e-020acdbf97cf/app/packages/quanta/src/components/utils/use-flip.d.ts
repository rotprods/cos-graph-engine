/**
 * useFlip — layout (reflow/reorder/filter) animation via the FLIP technique
 * (First, Last, Invert, Play) driven by the Web Animations API.
 *
 * Attach the returned ref to a container; mark each animating child with
 * `data-flip-key="<stable id>"`. Whenever `dependency` changes, the hook reads
 * every child's *last* box (batched, before paint, in `useLayoutEffect`),
 * inverts it to where it *was* with a `transform`, then plays back to `none` —
 * a GPU-cheap transform tween, no layout thrash. New items fade + scale in.
 *
 * Degrades cleanly: no-ops under `prefers-reduced-motion` and where
 * `Element.animate` is unavailable (SSR / older test DOMs), so layout is always
 * correct even when the motion doesn't run.
 */
export type UseFlipOptions = {
    /** Move/enter duration (ms). Default 260. */
    duration?: number;
    /** CSS easing for the tween. Default a soft ease-out-back-ish curve. */
    easing?: string;
    /** Fade + scale newly-added items in. Default true. */
    animateEnter?: boolean;
};
export declare function useFlip<T extends HTMLElement = HTMLDivElement>(dependency: unknown, options?: UseFlipOptions): any;
//# sourceMappingURL=use-flip.d.ts.map