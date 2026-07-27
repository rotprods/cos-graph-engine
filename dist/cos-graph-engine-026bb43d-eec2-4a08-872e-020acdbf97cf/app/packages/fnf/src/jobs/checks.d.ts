import type { MediaIssue } from '../groups/media';
import type { MediaInput, PromptInput } from '../types';
/**
 * Issue builders shared by the jobs' `validate` hooks, so the catalog's models
 * emit uniform pydantic-shaped issues instead of each declaration hand-rolling
 * (and slowly drifting) the same snippets. Consumers key on these shapes.
 */
/** `value` (when set) must sit in [min, max] — the batchSize/steps/seed pattern. */
export declare function intRange(field: string, value: number | null | undefined, min: number, max: number): MediaIssue[];
/** `value` (when set) must be one of `options` — membership for permissive runtime schemas. */
export declare function oneOf(field: string, value: unknown, options: readonly unknown[]): MediaIssue[];
/** `prompt.instruction` must contain at least `min` non-whitespace chars. */
export declare function promptRequired(prompt: PromptInput | undefined, min?: number): MediaIssue[];
/** `prompt.instruction` raw length must be below/within `max`, matching product validators. */
export declare function promptMax(prompt: PromptInput | undefined, max: number, opts?: {
    inclusive?: boolean;
}): MediaIssue[];
/** Refs attached under `role` (single or array), absent role = 0. */
export declare function countRefs(media: MediaInput | undefined, role: string): number;
/**
 * The product's seed source (fnf-web `randomSeed`): 1…1,000,000 inclusive.
 * Meant as a `z._default(z.number(), randomSeed)` so the wire always carries a
 * seed (prod always sends one) without burdening every caller to invent it.
 */
export declare function randomSeed(): number;
//# sourceMappingURL=checks.d.ts.map