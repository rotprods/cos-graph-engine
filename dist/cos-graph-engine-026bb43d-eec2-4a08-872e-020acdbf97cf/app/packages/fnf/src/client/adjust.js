"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjust = adjust;
const normalize_1 = require("../normalize");
const context_1 = require("./context");
/**
 * Snap the requested setting kinds (e.g. `'near-aspect-ratio'`) to their nearest
 * allowed values, returning a NEW input plus the list of changes. This is the
 * one place that normalizes — `submit()` deliberately does not, so callers opt in
 * explicitly (UI preview, agent canonicalization) and the submit path stays pure.
 *
 *   const { input, adjustments } = adjust(ctx, raw, ['near-aspect-ratio'])
 *   await submit(ctx, input)
 */
function adjust(ctx, input, kinds) {
    const entry = (0, context_1.entryFor)(ctx, input.model);
    const { settings, adjustments } = (0, normalize_1.normalizeSettings)((input.settings ?? {}), entry.normalizers, new Set(kinds));
    return { input: { ...input, settings }, adjustments };
}
//# sourceMappingURL=adjust.js.map