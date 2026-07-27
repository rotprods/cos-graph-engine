"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closestAspectRatio = closestAspectRatio;
exports.clampDuration = clampDuration;
exports.normalizeSettings = normalizeSettings;
const ADJUST_BY_KIND = {
    aspectRatio: 'near-aspect-ratio',
    duration: 'near-duration',
};
function ratio(value) {
    const parts = value.split(':');
    if (parts.length !== 2)
        return null;
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0)
        return null;
    return w / h;
}
function closestAspectRatio(value, options) {
    if (options.includes(value))
        return value;
    const target = ratio(value);
    if (target == null)
        return options[0] ?? value;
    let best = options[0] ?? value;
    let bestDist = Infinity;
    for (const option of options) {
        const r = ratio(option);
        if (r == null)
            continue;
        const dist = Math.abs(Math.log(r) - Math.log(target));
        if (dist < bestDist) {
            bestDist = dist;
            best = option;
        }
    }
    return best;
}
function clampDuration(value, n) {
    if (n.values && n.values.length > 0) {
        let best = n.values[0];
        let bestDist = Infinity;
        for (const candidate of n.values) {
            const dist = Math.abs(candidate - value);
            if (dist < bestDist) {
                bestDist = dist;
                best = candidate;
            }
        }
        return best;
    }
    let out = value;
    if (n.min !== undefined)
        out = Math.max(n.min, out);
    if (n.max !== undefined)
        out = Math.min(n.max, out);
    return out;
}
function normalizeSettings(settings, normalizers, enabled) {
    const out = { ...settings };
    const adjustments = [];
    for (const [key, n] of Object.entries(normalizers)) {
        // Opt-in per kind: a normalizer runs only when its `adjust` name was requested.
        if (!enabled.has(ADJUST_BY_KIND[n.kind]))
            continue;
        const value = out[key];
        if (value == null)
            continue;
        const next = n.kind === 'aspectRatio'
            ? closestAspectRatio(String(value), n.options)
            : clampDuration(Number(value), n);
        if (next !== value)
            adjustments.push({ field: key, from: value, to: next });
        out[key] = next;
    }
    return { settings: out, adjustments };
}
//# sourceMappingURL=normalize.js.map