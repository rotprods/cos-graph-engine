"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRawUrl = getRawUrl;
exports.getPreviewUrl = getPreviewUrl;
exports.getJobPhase = getJobPhase;
exports.isTerminalJobStatus = isTerminalJobStatus;
exports.isFailedJobStatus = isFailedJobStatus;
exports.isCompleted = isCompleted;
exports.isFailed = isFailed;
exports.isGenerating = isGenerating;
exports.hasResult = hasResult;
exports.isFromJob = isFromJob;
exports.getMediaType = getMediaType;
const types_1 = require("./types");
/**
 * Selectors — pure, tree-shakeable derivations over the read model, so the
 * production layer doesn't re-derive them ad-hoc in every component
 * (`results?.raw?.url ?? min`, status bucketing, kind-by-extension, …).
 */
// ── urls ──
/** The full-quality result url, when the generation has produced one. */
function getRawUrl(generation) {
    return generation.results?.rawUrl;
}
/** The best url for a grid/preview: min → thumbnail → raw. */
function getPreviewUrl(generation) {
    const results = generation.results;
    return results?.minUrl ?? results?.thumbnailUrl ?? results?.rawUrl;
}
const FAILED_STATUSES = new Set([...types_1.TERMINAL_STATUSES].filter(status => status !== 'completed'));
/**
 * Bucket a status (or generation) into the UI phases: anything non-terminal —
 * including statuses this SDK build doesn't know yet — is `progress`.
 */
function getJobPhase(source) {
    const status = typeof source === 'string' ? source : source.status;
    if (status === 'completed')
        return 'completed';
    return FAILED_STATUSES.has(status) ? 'failed' : 'progress';
}
/** Terminal = the backend will not change this job again (completed OR failed). */
function isTerminalJobStatus(status) {
    return (0, types_1.isTerminal)(status);
}
/**
 * Failed-family terminal statuses (failed / nsfw / canceled / ip_detected).
 * NOTE: broader than `wait({ throwOnFail })`, which deliberately exempts
 * `canceled` (a user action, not a failure) — and than the product's fail
 * bucket (failed/nsfw/ip_detected). Here `canceled` still buckets as 'failed'
 * because the UI phases have nowhere else terminal-but-not-completed to go.
 */
function isFailedJobStatus(status) {
    return FAILED_STATUSES.has(status);
}
// ── predicates over the read model (UI branches + TS narrowing) ──
/** The generation finished successfully. */
function isCompleted(generation) {
    return generation.status === 'completed';
}
/** The generation ended in a failed-family status (failed/nsfw/canceled/ip_detected). */
function isFailed(generation) {
    return FAILED_STATUSES.has(generation.status);
}
/** Still in flight — the backend will keep changing it. */
function isGenerating(generation) {
    return !(0, types_1.isTerminal)(generation.status);
}
/** NARROWING guard: after it, `generation.results` is non-optional — no `?.` in render code. */
function hasResult(generation) {
    return generation.results != null;
}
/**
 * NARROWING guard by model: after `isFromJob(gen, seedance2_0)`, `gen.input` is
 * typed as that model's submit input — `gen.input.settings.duration`
 * autocompletes. The runtime check is just the model discriminator; the typed
 * view is sound because parse round-trips the declared shape.
 */
function isFromJob(generation, entry) {
    return generation.model === entry.jobSetType;
}
// ── media kind ──
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'svg']);
/**
 * The visual kind of a url / media ref / generation: a Generation answers from
 * its declared output type; urls answer by extension (query/hash stripped);
 * anything unrecognizable is undefined.
 */
function getMediaType(source) {
    if (source == null)
        return undefined;
    if (typeof source === 'object' && 'status' in source)
        return source.type;
    const url = typeof source === 'string' ? source : source.url;
    if (!url)
        return undefined;
    const path = url.split(/[?#]/)[0];
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    if (VIDEO_EXTENSIONS.has(extension))
        return 'video';
    if (IMAGE_EXTENSIONS.has(extension))
        return 'image';
    return undefined;
}
//# sourceMappingURL=selectors.js.map