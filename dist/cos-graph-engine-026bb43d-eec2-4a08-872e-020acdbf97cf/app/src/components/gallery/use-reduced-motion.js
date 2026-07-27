"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useReducedMotion = useReducedMotion;
const react_1 = require("react");
/**
 * Tracks the `prefers-reduced-motion` media query. When true, the gallery does
 * NOT autoplay videos on hover (posters stay put) and skips fade-in transitions.
 */
function useReducedMotion() {
    const [reduced, setReduced] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (typeof window === 'undefined' || window.matchMedia == null)
            return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return reduced;
}
//# sourceMappingURL=use-reduced-motion.js.map