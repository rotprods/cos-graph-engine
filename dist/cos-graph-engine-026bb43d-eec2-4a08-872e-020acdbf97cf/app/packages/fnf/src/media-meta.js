"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMediaMeta = resolveMediaMeta;
/**
 * Fill in missing `meta` on every media ref of a submit input — the opt-in
 * async step in front of the sync meta rules (`dimensionsWithin`,
 * `durationsWithin`), mirroring how `adjust` fronts submit:
 *
 *   const measured = await resolveMediaMeta(input, resolver)
 *   await jobs.submit(measured) // meta rules now judge every ref
 *
 * Pure with respect to its arguments: returns a NEW input; refs that already
 * carry meta are untouched (the app usually knows sizes already — fnf's
 * InputImageMedia does); a resolver failure leaves that ref as-is rather than
 * failing the whole step. All refs resolve in parallel.
 */
async function resolveMediaMeta(input, resolve) {
    const media = input.media;
    if (!media)
        return input;
    const out = {};
    await Promise.all(Object.entries(media).map(async ([role, value]) => {
        if (value === undefined)
            return;
        out[role] = Array.isArray(value)
            ? await Promise.all(value.map(ref => withMeta(ref, resolve)))
            : await withMeta(value, resolve);
    }));
    return { ...input, media: out };
}
async function withMeta(ref, resolve) {
    if (ref.meta)
        return ref;
    try {
        const meta = await resolve(ref);
        return meta ? { ...ref, meta } : ref;
    }
    catch {
        return ref; // measurement is best-effort; the backend re-validates anyway
    }
}
//# sourceMappingURL=media-meta.js.map