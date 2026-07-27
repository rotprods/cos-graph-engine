import type { Generation } from '../types';
import type { GenerationContext } from './context';
export interface WaitOptions {
    /**
     * Fires on EVERY poll tick with the freshly fetched generation (including
     * intermediate and unknown statuses), and once for already-terminal inputs.
     */
    onProgress?: (g: Generation) => void;
    /**
     * Reject when any generation — including an already-terminal input — lands
     * on a failure status (`failed`/`nsfw`/`ip_detected`); `canceled` resolves.
     */
    throwOnFail?: boolean;
    /** Cancels the wait: pollers stop at the next checkpoint with `JobAbortedError`. */
    signal?: AbortSignal;
}
/**
 * Poll a batch to terminal statuses. Generations sharing a `jobSetId` are
 * polled as ONE set (when the adapter implements `getJobSet`): one request per
 * tick per set, and set-only gate fields (fnf's `ip_check_finished`) apply.
 * Generations without a set id — or on adapters without `getJobSet` — fall
 * back to per-job polling.
 *
 * On the first rejection (a `throwOnFail` failure, a timeout, the caller's
 * `signal`, or a network error) the remaining pollers are aborted — no
 * orphaned loops keep hitting the backend after the wait itself has thrown.
 */
export declare function waitGenerations(ctx: GenerationContext, generations: Generation[], opts?: WaitOptions): Promise<Generation[]>;
//# sourceMappingURL=wait.d.ts.map