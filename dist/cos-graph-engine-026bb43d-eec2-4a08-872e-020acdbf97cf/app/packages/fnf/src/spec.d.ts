import type { JobEntry } from './define-job';
import type { Generation, GenerationInput } from './types';
export interface JobResponse {
    id: string;
    job_set_id?: string;
    job_set_parent_id?: string | null;
    status: string;
    result_url?: string | null;
    min_result_url?: string | null;
    thumbnail_url?: string | null;
    params?: Record<string, unknown>;
    created_at?: number;
    fail_reason?: string | null;
}
/**
 * Parse a job's settings (applies schema defaults), wrapping a raw zod failure
 * into the typed `ValidationError` — so callers see a `validation` error with
 * structured issues, not a bare ZodError surfaced as `unknown`. Does NOT
 * snap/normalize values; that is the separate, opt-in `adjust()` step.
 */
export declare function parseSettings(input: GenerationInput, entry: JobEntry): Record<string, unknown>;
/**
 * Build the wire `params` body posted to the backend (prompt/media envelopes +
 * settings, flattened). No normalization here — settings go as provided (the
 * backend clamps); call `adjust()` first for client-side snapping.
 */
export declare function buildWireParams(input: GenerationInput, entry: JobEntry): Record<string, unknown>;
export declare function parseGeneration(job: JobResponse, entry: JobEntry): Generation;
//# sourceMappingURL=spec.d.ts.map