"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollGeneration = pollGeneration;
exports.pollJobSetGroup = pollJobSetGroup;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const spec_1 = require("../spec");
const types_1 = require("../types");
const get_1 = require("./get");
/**
 * The Nth consecutive failed tick is rethrown (the counter resets on any
 * success) — at the default 2s interval that tolerates ~a minute of continuous
 * backend unavailability. The product polls through outages indefinitely
 * (react-query keeps interval-refetching an errored query), so this is a
 * diagnosability backstop against a hard-down backend, not parity: it surfaces
 * the real 5xx/network error instead of a 10-minute JobTimeoutError.
 */
const MAX_CONSECUTIVE_TRANSIENT_FAILURES = 30;
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
async function pollGeneration(ctx, id, opts = {}) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.poll', { generation_id: id }, async () => {
        const { sleep, isActive } = ctx.scheduler;
        let deadline = Date.now() + ctx.poll.timeoutMs;
        let transientFailures = 0;
        let lastKnown;
        while (true) {
            (0, errors_1.throwIfAborted)(opts.signal);
            if (isActive && !isActive()) {
                const pausedAt = Date.now();
                await sleepUnlessAborted(sleep, ctx.poll.intervalMs, opts.signal);
                deadline += Date.now() - pausedAt; // pause does not consume the timeout
                continue;
            }
            let gen;
            try {
                gen = await (0, get_1.getGeneration)(ctx, id, opts.entry);
                transientFailures = 0;
            }
            catch (err) {
                if (!isTransientPollError(err) || ++transientFailures >= MAX_CONSECUTIVE_TRANSIENT_FAILURES)
                    throw err;
            }
            if (gen) {
                lastKnown = gen;
                (0, observability_1.observeEvent)(ctx.observability, 'fnf.job.poll.progress', generationAttributes(gen));
                opts.onProgress?.(gen);
                if ((0, types_1.isTerminal)(gen.status))
                    return gen;
            }
            if (Date.now() >= deadline)
                throw new errors_1.JobTimeoutError(id, ctx.poll.timeoutMs, lastKnown);
            await sleepUnlessAborted(sleep, ctx.poll.intervalMs, opts.signal);
        }
    }, {
        successAttributes: generation => ({ status: generation.status, model: generation.model }),
    });
}
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
async function pollJobSetGroup(ctx, jobSetId, members, opts = {}) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.poll', {
        job_set_id: jobSetId,
        generation_count: members.length,
    }, async () => {
        const getJobSet = ctx.adapter.getJobSet;
        if (!getJobSet)
            throw new errors_1.ApiJobError('not_supported', 'pollJobSetGroup requires an adapter with getJobSet');
        const current = new Map(members.map(g => [g.id, g]));
        const { sleep, isActive } = ctx.scheduler;
        let deadline = Date.now() + ctx.poll.timeoutMs;
        let transientFailures = 0;
        while (true) {
            (0, errors_1.throwIfAborted)(opts.signal);
            if (isActive && !isActive()) {
                const pausedAt = Date.now();
                await sleepUnlessAborted(sleep, ctx.poll.intervalMs, opts.signal);
                deadline += Date.now() - pausedAt; // pause does not consume the timeout
                continue;
            }
            let body;
            try {
                body = await getJobSet(jobSetId);
                transientFailures = 0;
            }
            catch (err) {
                if (!isTransientPollError(err) || ++transientFailures >= MAX_CONSECUTIVE_TRANSIENT_FAILURES)
                    throw err;
            }
            for (const job of Array.isArray(body) ? body : []) {
                const known = current.get(job.id);
                if (!known)
                    continue; // the caller isn't waiting on this set member
                const entry = (job.job_set_type ? ctx.registry.get(job.job_set_type) : undefined) ?? ctx.registry.get(known.model);
                // Fail fast like the singles path (`getGeneration`): an unresolvable type
                // is a local configuration error no amount of further polling can fix.
                if (!entry)
                    throw new errors_1.ApiJobError('unknown_model', `Cannot resolve job type for job ${job.id} in set ${jobSetId}: '${job.job_set_type ?? known.model}' is not registered`);
                const gen = (0, spec_1.parseGeneration)(job, entry);
                current.set(job.id, gen);
                (0, observability_1.observeEvent)(ctx.observability, 'fnf.job.poll.progress', generationAttributes(gen));
                opts.onProgress?.(gen);
            }
            if ([...current.values()].every(g => (0, types_1.isTerminal)(g.status)))
                return members.map(m => current.get(m.id));
            if (Date.now() >= deadline) {
                const pending = [...current.values()].find(g => !(0, types_1.isTerminal)(g.status));
                throw new errors_1.JobTimeoutError(pending.id, ctx.poll.timeoutMs, pending);
            }
            await sleepUnlessAborted(sleep, ctx.poll.intervalMs, opts.signal);
        }
    }, {
        successAttributes: generations => ({ terminal_count: generations.filter(g => (0, types_1.isTerminal)(g.status)).length }),
    });
}
/**
 * Is this fetch failure worth retrying on the next tick? The product never
 * lets one blip kill a multi-minute wait: fnf-web's job polling
 * (`use-job-status-polling`) rides react-query's `refetchInterval: 5000` with
 * default retries, so a 502 or a dropped socket just means the next tick.
 * Transient = the adapter's `network` code (a thrown fetch) or a retryable
 * HTTP status (any 5xx, 429). Everything else — 404/401/422, `unknown_model`,
 * aborts, timeouts — is deterministic and rethrown immediately.
 */
function isTransientPollError(err) {
    if (err instanceof errors_1.ApiJobError && err.code === 'network')
        return true;
    const status = err?.status;
    return typeof status === 'number' && (status >= 500 || status === 429);
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
/** Sleep that wakes early on abort and then throws the typed `JobAbortedError`. */
async function sleepUnlessAborted(sleep, ms, signal) {
    if (!signal) {
        await sleep(ms);
        return;
    }
    (0, errors_1.throwIfAborted)(signal);
    let onAbort;
    const aborted = new Promise((resolve) => {
        onAbort = resolve;
        signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        await Promise.race([sleep(ms), aborted]);
    }
    finally {
        if (onAbort)
            signal.removeEventListener('abort', onAbort);
    }
    (0, errors_1.throwIfAborted)(signal);
}
//# sourceMappingURL=poll.js.map