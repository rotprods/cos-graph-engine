import type { JobEntry } from '../define-job';
import type { Generation } from '../types';
import type { GenerationContext } from './context';
/** Options for `pollGeneration` (the per-job inner loop of `wait`). */
export interface PollOptions {
    /** Fallback entry when the job response carries no `job_set_type`. */
    entry?: JobEntry;
    /** Cancels the poll loop with `JobAbortedError` at the next checkpoint. */
    signal?: AbortSignal;
    /** Fires after every fetch with the current generation (any status). */
    onProgress?: (g: Generation) => void;
}
/**
 * Poll one job to a terminal status.
 *
 * - `opts.onProgress` fires after EVERY fetch — intermediate, unknown, and
 *   terminal statuses alike — so novel backend statuses are observable instead
 *   of silently polling to the deadline.
 * - While the scheduler reports inactive (backgrounded tab/plugin) the loop
 *   sleeps WITHOUT consuming the timeout: the deadline shifts by the paused
 *   duration. Use `opts.signal` to cancel a poll that may pause indefinitely.
 * - Cancellation is cooperative: the abort is honored at the next checkpoint
 *   (loop top / sleep), throwing `JobAbortedError`.
 * - Transient fetch failures (network blips, 5xx/429) are missed ticks, not
 *   verdicts: the loop sleeps the normal interval and retries — still
 *   consuming deadline time — up to a consecutive-failure backstop, after
 *   which the last error is rethrown. Deterministic errors stay fatal.
 */
export declare function pollGeneration(ctx: GenerationContext, id: string, opts?: PollOptions): Promise<Generation>;
/**
 * Poll the members of ONE job set to terminal statuses via the adapter's
 * `getJobSet` — one request per tick for the whole batch, instead of one per
 * job. Gate fields like fnf's `ip_check_finished` (a `completed` job whose IP
 * check hasn't settled maps to the non-terminal `ip_detect` and keeps
 * polling) reach the client through whichever read carries them: on the
 * fnf-web adapter BOTH `getJob` and `getJobSet` payloads do — the mapping
 * lives in the adapter's `mapJob` — so the set path is an efficiency win,
 * not the only gate-aware read.
 *
 * Same pause/abort/timeout/transient-failure semantics as `pollGeneration`.
 * `opts.onProgress` fires per MEMBER per fetch. Members missing from a set
 * payload keep their last-known state (and keep the loop alive until they
 * settle or time out).
 */
export declare function pollJobSetGroup(ctx: GenerationContext, jobSetId: string, members: Generation[], opts?: Omit<PollOptions, 'entry'>): Promise<Generation[]>;
//# sourceMappingURL=poll.d.ts.map