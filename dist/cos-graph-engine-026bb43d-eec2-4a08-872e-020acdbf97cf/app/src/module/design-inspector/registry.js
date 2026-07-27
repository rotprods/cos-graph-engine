"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHiggsfieldDesignElement = registerHiggsfieldDesignElement;
exports.createHiggsfieldDesignRef = createHiggsfieldDesignRef;
exports.composeHiggsfieldDesignRefs = composeHiggsfieldDesignRefs;
exports.getHiggsfieldDesignMeta = getHiggsfieldDesignMeta;
exports.findHiggsfieldDesignElement = findHiggsfieldDesignElement;
const designMetaByElement = new WeakMap();
function assignRef(ref, value) {
    if (!ref) {
        return;
    }
    if (typeof ref === "function") {
        ref(value);
        return;
    }
    try {
        ref.current = value;
    }
    catch {
        // Some refs are intentionally immutable. Design instrumentation is a
        // preview-only helper and must never break the app's original ref behavior.
    }
}
function registerHiggsfieldDesignElement(element, meta) {
    if (!element) {
        return;
    }
    designMetaByElement.set(element, {
        ...meta,
        tagName: meta.tagName ?? element.tagName.toLowerCase(),
    });
}
function createHiggsfieldDesignRef(meta) {
    return (element) => registerHiggsfieldDesignElement(element, meta);
}
function composeHiggsfieldDesignRefs(ref, designRef) {
    return (element) => {
        assignRef(ref, element);
        designRef(element);
    };
}
function getHiggsfieldDesignMeta(element) {
    return designMetaByElement.get(element);
}
function findHiggsfieldDesignElement(target) {
    let current = target;
    while (current && current !== document.documentElement && current !== document.body) {
        const meta = designMetaByElement.get(current);
        if (meta) {
            return { element: current, meta };
        }
        current = current.parentElement;
    }
    return null;
}
//# sourceMappingURL=registry.js.map