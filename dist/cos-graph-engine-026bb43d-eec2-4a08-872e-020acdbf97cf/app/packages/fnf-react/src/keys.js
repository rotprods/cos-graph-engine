"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fnfKeys = void 0;
function scoped(scopeKey, segment) {
    return ['fnf', 'scope', scopeKey, segment];
}
/**
 * The package's query-key namespace — a PUBLIC CONTRACT. Apps invalidate and
 * read by these keys, so their shape is versioned deliberately: always build
 * keys through these factories, never inline the literals. Object segments
 * hash order-independently (TanStack's `hashKey` sorts object keys), so two
 * `jobs({ type: 'video', size: 50 })` calls always hit the same entry.
 */
exports.fnfKeys = {
    /** Every fnf-owned cache entry — invalidate this to drop them all. */
    root: ['fnf'],
    /** Every fnf-owned cache entry for one user/workspace scope. */
    scope: (scopeKey) => ['fnf', 'scope', scopeKey],
    /** One generation by job id (`client.get`). */
    job: (id, opts) => opts?.scopeKey ? [...scoped(opts.scopeKey, 'job'), id] : ['fnf', 'job', id],
    /** All members of one job set (`client.getSet`). */
    jobSet: (jobSetId, opts) => opts?.scopeKey ? [...scoped(opts.scopeKey, 'job-set'), jobSetId] : ['fnf', 'job-set', jobSetId],
    /** Every feed — the `setQueriesData` target `applyGenerations` patches. */
    jobsRoot: ['fnf', 'jobs'],
    /** Every feed inside one user/workspace scope. */
    scopedJobsRoot: (scopeKey) => scoped(scopeKey, 'jobs'),
    /** One feed (a page list) for this query. */
    jobs: (query = {}, opts) => opts?.scopeKey ? [...scoped(opts.scopeKey, 'jobs'), query] : ['fnf', 'jobs', query],
    cost: (input, opts) => opts?.scopeKey ? [...scoped(opts.scopeKey, 'cost'), input] : ['fnf', 'cost', input],
    profileRoot: ['fnf', 'profile'],
    profile: (opts) => opts?.scopeKey ? scoped(opts.scopeKey, 'profile') : ['fnf', 'profile'],
    profileSnapshot: (opts) => opts?.includeOnDemand === undefined
        ? [...exports.fnfKeys.profile(opts), 'snapshot']
        : [...exports.fnfKeys.profile(opts), 'snapshot', { includeOnDemand: opts.includeOnDemand }],
    profileUser: (opts) => [...exports.fnfKeys.profile(opts), 'user'],
    profileWorkspaces: (opts) => [...exports.fnfKeys.profile(opts), 'workspaces'],
    profileCurrentWorkspace: (opts) => [...exports.fnfKeys.profile(opts), 'current-workspace'],
    profileWallet: (opts) => [...exports.fnfKeys.profile(opts), 'wallet'],
    profileCredits: (opts) => opts?.includeOnDemand === undefined
        ? [...exports.fnfKeys.profile(opts), 'credits']
        : [...exports.fnfKeys.profile(opts), 'credits', { includeOnDemand: opts.includeOnDemand }],
};
//# sourceMappingURL=keys.js.map