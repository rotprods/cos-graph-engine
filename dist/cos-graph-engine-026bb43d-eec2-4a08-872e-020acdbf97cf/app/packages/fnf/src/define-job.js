"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineJob = defineJob;
const prompt_1 = require("./groups/prompt");
const z_1 = require("./z");
function defineJob(config) {
    const { prompt, media, settings } = config.params;
    // Non-`wrapped` media formats carry no role tag on the wire, so they can only
    // represent one role — guard the invariant the types alone can't (callers may
    // bypass with `as`). See mediaCodec serialize/parse.
    if (media && media.format !== 'wrapped' && media.roles.length !== 1) {
        throw new Error(`defineJob('${config.jobSetType}'): media format '${media.format}' supports exactly one role, got ${media.roles.length} [${media.roles.join(', ')}] — use format 'wrapped' for multi-role media`);
    }
    const wireNames = collectWireNames(settings);
    assertNoWireCollisions(config.jobSetType, settings, wireNames, prompt ?? false, media);
    return {
        jobSetType: config.jobSetType,
        outputType: config.outputType,
        media,
        prompt: prompt ?? false,
        settingsMap: settings,
        settingsSchema: z_1.z.object(settings),
        normalizers: collectNormalizers(settings),
        wireNames,
        // Type-erased on the entry (the registry is heterogeneous); the runtime
        // value IS the caller's typed input — same erasure as settingsSchema.
        credits: config.credits,
        validate: config.validate,
        finalize: config.finalize,
        restore: config.restore,
    };
}
/**
 * Duplicate effective wire keys (two settings → one key via z.wire / a shared
 * tagged schema instance, or a settings key shadowing a prompt/media wire key)
 * would serialize last-write-wins and parse back ambiguously — fail at
 * definition time instead.
 */
function assertNoWireCollisions(jobSetType, settings, wireNames, prompt, media) {
    const reserved = new Set([...(prompt ? prompt_1.promptCodec.wireKeys : []), ...(media ? [media.field] : [])]);
    const seen = new Map();
    for (const key of Object.keys(settings)) {
        const wireKey = wireNames[key] ?? key;
        const clash = seen.get(wireKey);
        if (clash !== undefined)
            throw new Error(`defineJob('${jobSetType}'): settings '${clash}' and '${key}' both serialize to wire key '${wireKey}'`);
        if (reserved.has(wireKey))
            throw new Error(`defineJob('${jobSetType}'): settings key '${key}' collides with the ${prompt && prompt_1.promptCodec.wireKeys.includes(wireKey) ? 'prompt' : 'media'} wire key '${wireKey}'`);
        seen.set(wireKey, key);
    }
}
function collectNormalizers(settings) {
    const out = {};
    for (const [key, schema] of Object.entries(settings)) {
        const n = (0, z_1.getNormalize)(schema);
        if (n)
            out[key] = n;
    }
    return out;
}
function collectWireNames(settings) {
    const out = {};
    for (const [key, schema] of Object.entries(settings)) {
        const name = (0, z_1.getWireName)(schema);
        if (name !== undefined && name !== key)
            out[key] = name;
    }
    return out;
}
//# sourceMappingURL=define-job.js.map