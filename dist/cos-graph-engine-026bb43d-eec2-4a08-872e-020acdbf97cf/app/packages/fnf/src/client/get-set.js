"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobSetGenerations = getJobSetGenerations;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const spec_1 = require("../spec");
/**
 * Fetch ALL jobs of one job set in a single request — the one-shot read
 * counterpart of `pollJobSetGroup`'s tick (same adapter route, same gate
 * semantics, no loop). For callers that schedule reads themselves — a query
 * cache's `refetchInterval`, a realtime-triggered re-read — instead of
 * holding the SDK's poll loop open.
 *
 * Requires an adapter with `getJobSet`; throws the typed `not_supported`
 * otherwise (same contract as `pollJobSetGroup`).
 */
async function getJobSetGenerations(ctx, jobSetId) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.get_set', { job_set_id: jobSetId }, async () => {
        const getJobSet = ctx.adapter.getJobSet;
        if (!getJobSet)
            throw new errors_1.ApiJobError('not_supported', 'getSet requires an adapter with getJobSet');
        const body = await getJobSet(jobSetId);
        return (Array.isArray(body) ? body : []).map((job) => {
            const entry = job.job_set_type ? ctx.registry.get(job.job_set_type) : undefined;
            // Fail fast like the singles path (`getGeneration`): an unresolvable type
            // is a local configuration error.
            if (!entry)
                throw new errors_1.ApiJobError('unknown_model', `Cannot resolve job type for job ${job.id} in set ${jobSetId}: '${job.job_set_type ?? 'unknown'}' is not registered`);
            return (0, spec_1.parseGeneration)(job, entry);
        });
    }, {
        successAttributes: generations => ({ generation_count: generations.length }),
    });
}
//# sourceMappingURL=get-set.js.map