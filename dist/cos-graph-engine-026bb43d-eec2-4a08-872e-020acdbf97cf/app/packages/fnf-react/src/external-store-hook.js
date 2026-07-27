"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStore = useStore;
const react_1 = require("react");
/**
 * Bind any controller from this package (or your own `ExternalStore`
 * subclass) to a component: re-renders on every `commit()`, returns the
 * controller itself. This is the escape hatch the `use*` hooks are built on —
 * construct a controller yourself (module scope, context, a pool) and bind it
 * wherever it's read.
 */
function useStore(store) {
    (0, react_1.useSyncExternalStore)(store.subscribe, store.snapshot, store.snapshot);
    return store;
}
//# sourceMappingURL=external-store-hook.js.map