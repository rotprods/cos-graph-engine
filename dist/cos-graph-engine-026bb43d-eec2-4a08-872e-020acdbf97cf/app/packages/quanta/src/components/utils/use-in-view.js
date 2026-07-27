"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInView = useInView;
const react_1 = require("react");
function useInView(options = {}) {
    const { threshold = 0.5, rootMargin, root = null, once = false } = options;
    const [node, setNode] = (0, react_1.useState)(null);
    const [inView, setInView] = (0, react_1.useState)(false);
    // Ref callback → state so the effect re-observes whenever React swaps the node.
    const ref = (0, react_1.useCallback)((next) => setNode(next), []);
    (0, react_1.useEffect)(() => {
        if (node == null || typeof IntersectionObserver === 'undefined')
            return;
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry == null)
                return;
            const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
            setInView(visible);
            if (visible && once)
                observer.disconnect();
        }, { threshold, rootMargin: rootMargin ?? undefined, root });
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, threshold, rootMargin, root, once]);
    return { ref, inView };
}
//# sourceMappingURL=use-in-view.js.map