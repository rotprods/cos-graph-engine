import type { JobResponse } from '../spec';
export type NormalizedJobResponse = JobResponse & {
    job_set_type?: string;
    cost?: number | null;
};
type UnknownRecord = Record<string, unknown>;
/** Normalize product/feed job payloads into the SDK's flat job read shape. */
export declare function normalizeProductJob(job: UnknownRecord, set?: UnknownRecord): NormalizedJobResponse;
export declare function normalizeJobListBody(body: unknown): unknown;
export declare function normalizeJobSetBody(body: unknown): unknown;
export declare function normalizeJobLike(job: unknown, set?: unknown): NormalizedJobResponse;
export {};
//# sourceMappingURL=job-response-normalize.d.ts.map