import type { JobEntry } from '../define-job';
import type { ApiJobErrorJSON } from '../errors';
import type { Generation, GenerationInput } from '../types';
import type { GenerationContext } from './context';
export interface SubmitResult {
    generations: Generation[];
    /** Per-job errors from a `count > 1` fan-out where some (but not all) jobs failed. */
    failed?: ApiJobErrorJSON[];
    /** Human-readable summary of a partial failure. */
    warning?: string;
}
export type SafeSubmitResult = {
    ok: true;
    generations: Generation[];
    failed?: ApiJobErrorJSON[];
    warning?: string;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
        status?: number;
        data?: unknown;
    };
};
export declare function submit(ctx: GenerationContext, input: GenerationInput): Promise<SubmitResult>;
export declare function safeSubmit(ctx: GenerationContext, input: GenerationInput): Promise<SafeSubmitResult>;
/**
 * Normalize a create response into Generations. Backends differ: some return a
 * bare `string[]` of created job ids, some `{ id, status, … }`,
 * some `{ job_ids: [...] }`. Id-only responses become pending generations that
 * carry the submitted input (so `wait`/`get` can refresh them).
 */
export declare function generationsFromBody(body: unknown, entry: JobEntry, input: GenerationInput): Generation[];
//# sourceMappingURL=submit.d.ts.map