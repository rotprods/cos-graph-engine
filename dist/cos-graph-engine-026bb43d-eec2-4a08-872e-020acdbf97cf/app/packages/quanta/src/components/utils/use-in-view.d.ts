/**
 * useInView — reports whether an element is intersecting the viewport (or a
 * scroll `root`) via `IntersectionObserver`, the main-thread-cheap way to drive
 * viewport-only behaviour: lazy reveals, and — the headline use — autoplaying a
 * video only while it is on screen (see `Media.Video autoPlayInView`).
 *
 * SSR / test safe: when `IntersectionObserver` is unavailable it no-ops and
 * reports `inView: false`. Attach the returned `ref` (a ref callback, so it
 * re-observes if the node changes) to the element you want to track.
 */
export type UseInViewOptions = {
    /** Visibility ratio (0..1) at/above which the element counts as in view. Default 0.5. */
    threshold?: number;
    /** Grow/shrink the detection box, e.g. `'200px'` to pre-trigger before entry. */
    rootMargin?: string;
    /** Scroll container to observe against; defaults to the browser viewport. */
    root?: Element | null;
    /** Latch to `true` on first entry and stop observing (one-shot reveals). */
    once?: boolean;
};
export declare function useInView<T extends Element = HTMLElement>(options?: UseInViewOptions): {
    readonly ref: any;
    readonly inView: any;
};
//# sourceMappingURL=use-in-view.d.ts.map