import type { ListOptions } from '@higgsfield/fnf/client';
/** The feed page query (filters/size) — the cache owns the cursor. */
export type JobsQuery = Omit<ListOptions, 'cursor'>;
export interface FnfScopeOptions {
    scopeKey?: string;
}
export interface FnfCreditsKeyOptions extends FnfScopeOptions {
    includeOnDemand?: boolean;
}
/**
 * The package's query-key namespace — a PUBLIC CONTRACT. Apps invalidate and
 * read by these keys, so their shape is versioned deliberately: always build
 * keys through these factories, never inline the literals. Object segments
 * hash order-independently (TanStack's `hashKey` sorts object keys), so two
 * `jobs({ type: 'video', size: 50 })` calls always hit the same entry.
 */
export declare const fnfKeys: {
    /** Every fnf-owned cache entry — invalidate this to drop them all. */
    root: readonly ["fnf"];
    /** Every fnf-owned cache entry for one user/workspace scope. */
    scope: (scopeKey: string) => readonly ["fnf", "scope", string];
    /** One generation by job id (`client.get`). */
    job: (id: string, opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, string] | readonly ["fnf", "job", string];
    /** All members of one job set (`client.getSet`). */
    jobSet: (jobSetId: string, opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, string] | readonly ["fnf", "job-set", string];
    /** Every feed — the `setQueriesData` target `applyGenerations` patches. */
    jobsRoot: readonly ["fnf", "jobs"];
    /** Every feed inside one user/workspace scope. */
    scopedJobsRoot: (scopeKey: string) => readonly ["fnf", "scope", string, string];
    /** One feed (a page list) for this query. */
    jobs: (query?: JobsQuery, opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, JobsQuery] | readonly ["fnf", "jobs", JobsQuery];
    cost: (input: unknown, opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, unknown] | readonly ["fnf", "cost", unknown];
    profileRoot: readonly ["fnf", "profile"];
    profile: (opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string] | readonly ["fnf", "profile"];
    profileSnapshot: (opts?: FnfCreditsKeyOptions) => readonly ["fnf", "scope", string, string, "snapshot"] | readonly ["fnf", "profile", "snapshot"] | readonly ["fnf", "scope", string, string, "snapshot", {
        readonly includeOnDemand: boolean;
    }] | readonly ["fnf", "profile", "snapshot", {
        readonly includeOnDemand: boolean;
    }];
    profileUser: (opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, "user"] | readonly ["fnf", "profile", "user"];
    profileWorkspaces: (opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, "workspaces"] | readonly ["fnf", "profile", "workspaces"];
    profileCurrentWorkspace: (opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, "current-workspace"] | readonly ["fnf", "profile", "current-workspace"];
    profileWallet: (opts?: FnfScopeOptions) => readonly ["fnf", "scope", string, string, "wallet"] | readonly ["fnf", "profile", "wallet"];
    profileCredits: (opts?: FnfCreditsKeyOptions) => readonly ["fnf", "scope", string, string, "credits"] | readonly ["fnf", "profile", "credits"] | readonly ["fnf", "scope", string, string, "credits", {
        readonly includeOnDemand: boolean;
    }] | readonly ["fnf", "profile", "credits", {
        readonly includeOnDemand: boolean;
    }];
};
//# sourceMappingURL=keys.d.ts.map