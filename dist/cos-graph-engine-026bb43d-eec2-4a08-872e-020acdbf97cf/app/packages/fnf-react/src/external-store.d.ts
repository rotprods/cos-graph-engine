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
export declare class ExternalStore {
    private version;
    private readonly listeners;
    readonly snapshot: () => number;
    readonly subscribe: (listener: () => void) => (() => void);
    protected commit(): void;
}
//# sourceMappingURL=external-store.d.ts.map