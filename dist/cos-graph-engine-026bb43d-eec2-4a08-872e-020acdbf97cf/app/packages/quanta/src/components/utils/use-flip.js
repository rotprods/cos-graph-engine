"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFlip = useFlip;
const react_1 = require("react");
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
function useFlip(dependency, options = {}) {
    const { duration = 260, easing = 'cubic-bezier(0.22, 1, 0.36, 1)', animateEnter = true } = options;
    const ref = (0, react_1.useRef)(null);
    const prevRects = (0, react_1.useRef)(new Map());
    const isFirstRun = (0, react_1.useRef)(true);
    (0, react_1.useLayoutEffect)(() => {
        const container = ref.current;
        if (container == null)
            return;
        const items = Array.from(container.children).filter((child) => child instanceof HTMLElement && child.dataset.flipKey != null);
        // Batch READS (measure every "last" box) before any WRITE, to avoid thrash.
        const nextRects = new Map();
        for (const el of items)
            nextRects.set(el.dataset.flipKey, el.getBoundingClientRect());
        const reduced = typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION).matches;
        const canAnimate = typeof items[0]?.animate === 'function';
        if (!isFirstRun.current && !reduced && canAnimate) {
            for (const el of items) {
                const key = el.dataset.flipKey;
                const last = nextRects.get(key);
                const first = prevRects.current.get(key);
                if (first == null) {
                    // New item — fade + scale in (Invert/Play has nothing to invert).
                    if (animateEnter) {
                        el.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration, easing });
                    }
                    continue;
                }
                const dx = first.left - last.left;
                const dy = first.top - last.top;
                // Invert to the old spot, then Play back to the natural position.
                if (dx !== 0 || dy !== 0) {
                    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing });
                }
            }
        }
        prevRects.current = nextRects;
        isFirstRun.current = false;
    }, [dependency, duration, easing, animateEnter]);
    return ref;
}
//# sourceMappingURL=use-flip.js.map