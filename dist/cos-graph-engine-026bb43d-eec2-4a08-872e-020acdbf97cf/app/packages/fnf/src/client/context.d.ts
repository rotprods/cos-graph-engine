import type { GenerationBackend } from '../backend';
import type { JobEntry } from '../define-job';
import type { FnfObservabilityContext, FnfObservabilityOptions } from '../observability';
import type { Registry } from '../registry';
export interface ClientConfig<Jobs extends readonly JobEntry[] = readonly JobEntry[]> {
    /** The transport-agnostic jobs adapter. Use one from `@higgsfield/fnf-adapters`, or your own. */
    adapter: GenerationBackend;
    /** Registered jobs — the source of `model`/`settings` autocomplete on `submit`. */
    jobs: Jobs;
    poll?: {
        intervalMs?: number;
        timeoutMs?: number;
    };
    scheduler?: {
        sleep?: (ms: number) => Promise<void>;
        isActive?: () => boolean;
    };
    observability?: FnfObservabilityOptions;
}
/**
 * The single shared dependency every job operation needs. Build one with
 * `createContext(config)` and pass it to any operation — you do not need the
 * full client to call `submit(ctx, …)` or `listGenerations(ctx, …)`.
 */
export interface GenerationContext {
    adapter: GenerationBackend;
    registry: Registry;
    poll: {
        intervalMs: number;
        timeoutMs: number;
    };
    scheduler: {
        sleep: (ms: number) => Promise<void>;
        isActive?: () => boolean;
    };
    observability: FnfObservabilityContext;
}
/** Resolve user config into the shared context every operation consumes. */
export declare function createContext(config: ClientConfig<readonly JobEntry[]>): GenerationContext;
export declare function entryFor(ctx: GenerationContext, model: string): JobEntry;
//# sourceMappingURL=context.d.ts.map