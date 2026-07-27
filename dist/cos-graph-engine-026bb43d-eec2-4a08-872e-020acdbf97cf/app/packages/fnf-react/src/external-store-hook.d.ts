import type { ExternalStore } from './external-store';
/**
 * Bind any controller from this package (or your own `ExternalStore`
 * subclass) to a component: re-renders on every `commit()`, returns the
 * controller itself. This is the escape hatch the `use*` hooks are built on —
 * construct a controller yourself (module scope, context, a pool) and bind it
 * wherever it's read.
 */
export declare function useStore<T extends ExternalStore>(store: T): T;
//# sourceMappingURL=external-store-hook.d.ts.map