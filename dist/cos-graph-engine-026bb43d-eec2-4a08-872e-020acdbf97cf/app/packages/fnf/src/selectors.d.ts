import type { JobEntry } from './define-job';
import type { Generation, GenerationResults, GenerationStatus, MediaRef, OutputType } from './types';
/**
 * Selectors — pure, tree-shakeable derivations over the read model, so the
 * production layer doesn't re-derive them ad-hoc in every component
 * (`results?.raw?.url ?? min`, status bucketing, kind-by-extension, …).
 */
/** The full-quality result url, when the generation has produced one. */
export declare function getRawUrl(generation: Generation): string | undefined;
/** The best url for a grid/preview: min → thumbnail → raw. */
export declare function getPreviewUrl(generation: Generation): string | undefined;
/** The three buckets UI actually branches on. */
export type JobPhase = 'progress' | 'failed' | 'completed';
/**
 * Bucket a status (or generation) into the UI phases: anything non-terminal —
 * including statuses this SDK build doesn't know yet — is `progress`.
 */
export declare function getJobPhase(source: Generation | GenerationStatus): JobPhase;
/** Terminal = the backend will not change this job again (completed OR failed). */
export declare function isTerminalJobStatus(status: GenerationStatus): boolean;
/**
 * Failed-family terminal statuses (failed / nsfw / canceled / ip_detected).
 * NOTE: broader than `wait({ throwOnFail })`, which deliberately exempts
 * `canceled` (a user action, not a failure) — and than the product's fail
 * bucket (failed/nsfw/ip_detected). Here `canceled` still buckets as 'failed'
 * because the UI phases have nowhere else terminal-but-not-completed to go.
 */
export declare function isFailedJobStatus(status: GenerationStatus): boolean;
/** The generation finished successfully. */
export declare function isCompleted(generation: Generation): boolean;
/** The generation ended in a failed-family status (failed/nsfw/canceled/ip_detected). */
export declare function isFailed(generation: Generation): boolean;
/** Still in flight — the backend will keep changing it. */
export declare function isGenerating(generation: Generation): boolean;
/** NARROWING guard: after it, `generation.results` is non-optional — no `?.` in render code. */
export declare function hasResult(generation: Generation): generation is Generation & {
    results: GenerationResults;
};
/**
 * NARROWING guard by model: after `isFromJob(gen, seedance2_0)`, `gen.input` is
 * typed as that model's submit input — `gen.input.settings.duration`
 * autocompletes. The runtime check is just the model discriminator; the typed
 * view is sound because parse round-trips the declared shape.
 */
export declare function isFromJob<Type extends string, Settings, Env>(generation: Generation, entry: JobEntry<Type, Settings, Env>): generation is Generation & {
    model: Type;
    input: Generation['input'] & Env & {
        model: Type;
        settings: Settings;
    };
};
/**
 * The visual kind of a url / media ref / generation: a Generation answers from
 * its declared output type; urls answer by extension (query/hash stripped);
 * anything unrecognizable is undefined.
 */
export declare function getMediaType(source: string | MediaRef | Generation | undefined): OutputType | undefined;
//# sourceMappingURL=selectors.d.ts.map