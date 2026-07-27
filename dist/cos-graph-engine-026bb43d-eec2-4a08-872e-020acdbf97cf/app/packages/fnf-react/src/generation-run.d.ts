import type { Generation, SubmitResult, WaitOptions } from '@higgsfield/fnf/client';
import type { ApiJobErrorJSON } from '@higgsfield/fnf/errors';
import type { FnfObservabilityOptions } from '@higgsfield/fnf/observability';
import { ApiJobError } from '@higgsfield/fnf/errors';
import { ExternalStore } from './external-store';
/**
 * The slice of a job client a run needs — structural, so the real
 * `JobClient`, a context-bound pair of free functions, or an app wrapper all
 * fit. `Input` is inferred from `submit`, so model autocomplete flows through.
 */
export interface GenerationRunClient<Input> {
    submit: (input: Input) => Promise<SubmitResult>;
    wait: (generations: Generation[], opts?: WaitOptions) => Promise<Generation[]>;
}
export type GenerationRunStatus = 'idle' | 'submitting' | 'generating' | 'completed' | 'failed' | 'aborted';
export interface GenerationRunOptions {
    observability?: FnfObservabilityOptions;
}
/**
 * One submit-to-terminal lifecycle as observable state: submit the input,
 * then poll the batch live until every generation settles.
 *
 *   idle → submitting → generating → completed
 *                     ↘ failed / aborted
 *
 * Errors are STATE, not throws (`start` never rejects — the safeSubmit
 * philosophy): read `error` for the run-level failure, `failed`/`warning`
 * for partial fan-out failures, and each generation's own `status` for
 * per-job verdicts (failed/nsfw/ip_detected resolve, they don't throw).
 * Starting again aborts the previous run.
 */
export declare class GenerationRun<Input> extends ExternalStore {
    private readonly client;
    private active;
    private _status;
    private _generations;
    private _failed;
    private _warning;
    private _error;
    private readonly observability;
    constructor(client: GenerationRunClient<Input>, opts?: GenerationRunOptions);
    get status(): GenerationRunStatus;
    /** Live snapshots — updated on every poll tick while generating. */
    get generations(): Generation[];
    /** Per-job errors from a `count > 1` fan-out where some jobs failed to submit. */
    get failed(): ApiJobErrorJSON[];
    get warning(): string | undefined;
    /** The run-level failure (submit rejected, polling died) — undefined otherwise. */
    get error(): ApiJobError | undefined;
    get isRunning(): boolean;
    /**
     * Submit and poll to terminal. Resolves with the settled generations —
     * `[]` when the submit itself failed (the failure is in `error`).
     */
    start(input: Input): Promise<Generation[]>;
    /** Stop polling (the backend job keeps running — see `client.cancel`). */
    abort(): void;
    /** Abort if running and return to `idle` with empty state. */
    reset(): void;
    private upsert;
}
//# sourceMappingURL=generation-run.d.ts.map