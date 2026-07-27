"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectGenerationMedia = selectGenerationMedia;
exports.getGenerationPrompt = getGenerationPrompt;
exports.getGenerationStatusLabel = getGenerationStatusLabel;
exports.getGenerationCreatedLabel = getGenerationCreatedLabel;
exports.getGenerationFailureLabel = getGenerationFailureLabel;
const client_1 = require("@higgsfield/fnf/client");
function selectGenerationMedia(generation) {
    const phase = (0, client_1.getJobPhase)(generation);
    const outputType = (0, client_1.getMediaType)(generation) ?? generation.type;
    if (!(0, client_1.hasResult)(generation)) {
        return {
            kind: "empty",
            phase,
            outputType,
            terminal: (0, client_1.isTerminalJobStatus)(generation.status),
            reason: phase === "failed" ? "failed" : generation.status === "completed" ? "preview_unavailable" : "pending",
        };
    }
    const rawUrl = (0, client_1.getRawUrl)(generation);
    const previewUrl = (0, client_1.getPreviewUrl)(generation);
    if (!rawUrl) {
        return {
            kind: "empty",
            phase,
            outputType,
            terminal: (0, client_1.isTerminalJobStatus)(generation.status),
            reason: generation.status === "completed" ? "preview_unavailable" : "pending",
        };
    }
    if (outputType === "video") {
        const posterUrl = generation.results.thumbnailUrl
            ?? (previewUrl && (0, client_1.getMediaType)(previewUrl) === "image" ? previewUrl : undefined);
        return {
            kind: "video",
            phase,
            rawUrl,
            ...(previewUrl ? { previewUrl } : {}),
            ...(posterUrl ? { posterUrl } : {}),
        };
    }
    return {
        kind: "image",
        phase,
        rawUrl,
        previewUrl: previewUrl ?? rawUrl,
    };
}
function getGenerationPrompt(generation) {
    const prompt = generation.input.prompt?.instruction?.trim();
    return prompt && prompt.length > 0 ? prompt : undefined;
}
function getGenerationStatusLabel(generation) {
    return generation.status.replaceAll("_", " ");
}
function getGenerationCreatedLabel(generation) {
    if (generation.createdAt === undefined)
        return undefined;
    const ms = generation.createdAt > 10_000_000_000 ? generation.createdAt : generation.createdAt * 1000;
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(ms));
}
function getGenerationFailureLabel(generation) {
    return generation.failReason?.trim() || ((0, client_1.getJobPhase)(generation) === "failed" ? getGenerationStatusLabel(generation) : undefined);
}
//# sourceMappingURL=higgsfield-generation-results.js.map