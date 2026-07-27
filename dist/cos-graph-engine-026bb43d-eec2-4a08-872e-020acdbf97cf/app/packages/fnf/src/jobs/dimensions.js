"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aspectRatioDimensions = aspectRatioDimensions;
exports.lookupSize = lookupSize;
exports.closestRatioBySize = closestRatioBySize;
exports.firstSizeMeta = firstSizeMeta;
exports.simplifyRatio = simplifyRatio;
const errors_1 = require("../errors");
/**
 * Dimensions with a fixed short side, snapped to even numbers — the derivation
 * fnf-web's submit strategies (soul/kling/seedance/nano) all hand-roll. Meant
 * for a job's `finalize` hook: `{ ...wire, ...aspectRatioDimensions(ratio, 1080) }`.
 */
function aspectRatioDimensions(aspectRatio, shortSide) {
    const match = /^(\d+):(\d+)$/.exec((aspectRatio ?? '').trim());
    const w = match ? Number(match[1]) : 16;
    const h = match ? Number(match[2]) : 9;
    const normalized = match ? `${w}:${h}` : '16:9';
    const even = (value) => Math.round(value / 2) * 2;
    if (w >= h)
        return { width: even(shortSide * (w / h)), height: shortSide, normalized };
    return { width: shortSide, height: even(shortSide * (h / w)), normalized };
}
/**
 * Guarded lookup into a `resolution × ratio → [width, height]` size table —
 * the shape every table-based model (nano-banana-2, seedance, soul, and most
 * of the fnf-web catalog) carries. The settings schemas are deliberately
 * permissive at runtime (see z.aspectRatio), so an unknown ratio/resolution
 * from a JS caller must surface as the typed ValidationError, not as a
 * `undefined is not iterable` TypeError from a bare destructure.
 */
function lookupSize(map, resolution, ratio) {
    const row = map[resolution];
    if (!row) {
        throw new errors_1.ValidationError(`resolution '${resolution}' is not supported (allowed: ${Object.keys(map).join(', ')})`, [
            { loc: ['settings', 'resolution'], msg: `resolution '${resolution}' is not supported` },
        ]);
    }
    const size = row[ratio];
    if (!size) {
        throw new errors_1.ValidationError(`aspect ratio '${ratio}' is not supported (allowed: ${Object.keys(row).join(', ')})`, [
            { loc: ['settings', 'aspectRatio'], msg: `aspect ratio '${ratio}' is not supported` },
        ]);
    }
    return { width: size[0], height: size[1] };
}
/**
 * The closest allowed ratio for an intrinsic size, by LINEAR distance on w/h —
 * the exact rule fnf-web's `getSeedance2_0ClosestAspectRatio` /
 * `getNanoBanana2ClosestAspectRatio` use to resolve 'auto' from the first
 * attached image. (Not log-distance: `adjust()`'s closestAspectRatio snaps
 * user-typed ratios, this mirrors the product's auto-resolution.)
 */
function closestRatioBySize(ratios, size) {
    const target = size.width / size.height;
    let best = ratios[0];
    let bestDiff = Infinity;
    for (const option of ratios) {
        const [w, h] = option.split(':').map(Number);
        if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0)
            continue;
        const diff = Math.abs(target - w / h);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = option;
        }
    }
    return best;
}
/**
 * The first ref across `roles` (in order) whose meta carries a known size —
 * the product resolves 'auto' from the FIRST attached image. Populate meta
 * from app data or `resolveMediaMeta`; undefined means no local knowledge.
 */
function firstSizeMeta(media, roles) {
    for (const role of roles) {
        const value = media?.[role];
        const refs = Array.isArray(value) ? value : value ? [value] : [];
        for (const ref of refs) {
            const { width, height } = ref.meta ?? {};
            if (width != null && height != null && height > 0)
                return { width, height };
        }
    }
    return undefined;
}
/** Reduce a pixel size to its smallest integer `w:h` (720×1280 → '9:16'). */
function simplifyRatio(width, height) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const div = gcd(Math.round(width), Math.round(height)) || 1;
    return `${Math.round(width) / div}:${Math.round(height) / div}`;
}
//# sourceMappingURL=dimensions.js.map