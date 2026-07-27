"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalStore = void 0;
/**
 * The minimal external-store base every controller in this package extends —
 * the same shape as fnf-web's `SyncExternalStorage` (the InputMediaController
 * pattern): the controller itself is the stable object React holds, and the
 * snapshot is a version counter that bumps on every `commit()`. Reads go
 * through the controller's getters, so renders never chase object identity.
 *
 * Framework-agnostic on purpose: controllers are fully usable (and testable)
 * without React; `useStore` is the one-line binding.
 */
class ExternalStore {
    version = 0;
    listeners = new Set();
    snapshot = () => this.version;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    commit() {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
exports.ExternalStore = ExternalStore;
//# sourceMappingURL=external-store.js.map