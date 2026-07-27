"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refsFor = refsFor;
exports.firstMetaSize = firstMetaSize;
exports.firstMetaDuration = firstMetaDuration;
exports.integerRange = integerRange;
exports.requiredPromptOrRole = requiredPromptOrRole;
exports.extractAngleRefIds = extractAngleRefIds;
exports.batch = batch;
function refsFor(media, role) {
    const value = media?.[role];
    return Array.isArray(value) ? value : value ? [value] : [];
}
function firstMetaSize(media, roles) {
    for (const role of roles) {
        for (const ref of refsFor(media, role)) {
            const { width, height } = ref.meta ?? {};
            if (width != null && height != null && height > 0)
                return { width, height };
        }
    }
    return undefined;
}
function firstMetaDuration(media, roles) {
    for (const role of roles) {
        for (const ref of refsFor(media, role)) {
            const seconds = ref.meta?.durationSec;
            if (seconds != null)
                return seconds;
        }
    }
    return undefined;
}
function integerRange(field, value, min, max) {
    if (value == null)
        return [];
    if (Number.isInteger(value) && value >= min && value <= max)
        return [];
    return [{ loc: ['settings', field], msg: `${field} must be an integer between ${min} and ${max}` }];
}
function requiredPromptOrRole(input, role, message) {
    const prompt = (input.prompt?.instruction ?? '').trim();
    if (prompt.length > 0 || refsFor(input.media, role).length > 0)
        return [];
    return [{ loc: ['prompt'], msg: message }];
}
function extractAngleRefIds(text) {
    const ids = new Set();
    for (const match of text.matchAll(/<<<([^>]+)>>>/g)) {
        const value = match[1]?.trim();
        if (!value || /^(image|video|audio|cast)_/.test(value))
            continue;
        if (value.startsWith('element_')) {
            const id = value.slice('element_'.length);
            if (id && !/^\d+$/.test(id))
                ids.add(id);
            continue;
        }
        ids.add(value);
    }
    return [...ids];
}
function batch(settings, fallback = 1) {
    return typeof settings.batchSize === 'number' ? settings.batchSize : fallback;
}
//# sourceMappingURL=video-helpers.js.map