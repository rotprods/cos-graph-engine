"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationRun = void 0;
const errors_1 = require("@higgsfield/fnf/errors");
const observability_1 = require("@higgsfield/fnf/observability");
const external_store_1 = require("./external-store");
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
class GenerationRun extends external_store_1.ExternalStore {
    client;
    active = null;
    _status = 'idle';
    _generations = [];
    _failed = [];
    _warning;
    _error;
    observability;
    constructor(client, opts = {}) {
        super();
        this.client = client;
        this.observability = (0, observability_1.createObservabilityContext)(opts.observability);
    }
    get status() {
        return this._status;
    }
    /** Live snapshots — updated on every poll tick while generating. */
    get generations() {
        return this._generations;
    }
    /** Per-job errors from a `count > 1` fan-out where some jobs failed to submit. */
    get failed() {
        return this._failed;
    }
    get warning() {
        return this._warning;
    }
    /** The run-level failure (submit rejected, polling died) — undefined otherwise. */
    get error() {
        return this._error;
    }
    get isRunning() {
        return this._status === 'submitting' || this._status === 'generating';
    }
    /**
     * Submit and poll to terminal. Resolves with the settled generations —
     * `[]` when the submit itself failed (the failure is in `error`).
     */
    async start(input) {
        this.active?.abort();
        const run = new AbortController();
        this.active = run;
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.start', inputAttributes(input));
        this._status = 'submitting';
        this._generations = [];
        this._failed = [];
        this._warning = undefined;
        this._error = undefined;
        this.commit();
        try {
            const submitted = await this.client.submit(input);
            (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.submitted', {
                generation_count: submitted.generations.length,
                failed_count: submitted.failed?.length ?? 0,
            });
            if (run.signal.aborted) {
                // Two cases share this signal: superseded by a newer start() (it owns
                // the state) and a plain abort() (nobody else will ever write — land
                // the machine ourselves or `submitting` sticks forever). The submit
                // DID happen: the created generations go into state too, so the UI
                // keeps a handle on them (to show, to `client.cancel`) even though
                // the documented hook pattern discards `start()`'s promise.
                if (run === this.active) {
                    this._generations = submitted.generations;
                    this._failed = submitted.failed ?? [];
                    this._warning = submitted.warning;
                    this._status = 'aborted';
                    (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.aborted', {
                        generation_count: submitted.generations.length,
                    });
                    this.commit();
                }
                return submitted.generations;
            }
            this._generations = submitted.generations;
            this._failed = submitted.failed ?? [];
            this._warning = submitted.warning;
            this._status = 'generating';
            this.commit();
            const done = await this.client.wait(submitted.generations, {
                signal: run.signal,
                onProgress: g => this.upsert(run, g),
            });
            if (run !== this.active)
                return done; // superseded while settling — the newer run owns the state
            this._generations = done;
            this._status = 'completed';
            (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.completed', {
                generation_count: done.length,
            });
            this.commit();
            return done;
        }
        catch (err) {
            if (run !== this.active)
                return []; // a newer start() owns the state now
            if (err instanceof errors_1.ApiJobError && err.code === 'aborted') {
                this._status = 'aborted';
                (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.aborted', {
                    generation_count: this._generations.length,
                });
            }
            else {
                this._error = err instanceof errors_1.ApiJobError ? err : new errors_1.ApiJobError('unexpected', err instanceof Error ? err.message : String(err));
                this._status = 'failed';
                (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.failed', {
                    generation_count: this._generations.length,
                    error_code: this._error.code,
                    ...(this._error.status !== undefined ? { error_status: this._error.status } : {}),
                });
            }
            this.commit();
            return this._generations;
        }
    }
    /** Stop polling (the backend job keeps running — see `client.cancel`). */
    abort() {
        this.active?.abort();
    }
    /** Abort if running and return to `idle` with empty state. */
    reset() {
        this.active?.abort();
        this.active = null;
        this._status = 'idle';
        this._generations = [];
        this._failed = [];
        this._warning = undefined;
        this._error = undefined;
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.reset');
        this.commit();
    }
    upsert(run, g) {
        if (run !== this.active)
            return;
        const at = this._generations.findIndex(existing => existing.id === g.id);
        this._generations = at >= 0
            ? [...this._generations.slice(0, at), g, ...this._generations.slice(at + 1)]
            : [...this._generations, g];
        (0, observability_1.observeEvent)(this.observability, 'fnf.react.generation_run.progress', generationAttributes(g));
        this.commit();
    }
}
exports.GenerationRun = GenerationRun;
function inputAttributes(input) {
    if (typeof input !== 'object' || input === null)
        return {};
    const record = input;
    return {
        ...(typeof record.model === 'string' ? { model: record.model } : {}),
        ...(typeof record.count === 'number' ? { count: record.count } : {}),
    };
}
function generationAttributes(g) {
    return {
        generation_id: g.id,
        model: g.model,
        type: g.type,
        status: g.status,
        ...(g.jobSetId ? { job_set_id: g.jobSetId } : {}),
    };
}
//# sourceMappingURL=generation-run.js.map