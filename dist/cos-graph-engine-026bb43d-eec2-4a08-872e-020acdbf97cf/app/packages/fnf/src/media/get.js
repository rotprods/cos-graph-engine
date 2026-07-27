"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMedia = getMedia;
const observability_1 = require("../observability");
const types_1 = require("./types");
/**
 * Get a single media item by id. The backend route is per-type (image/video/
 * audio), so the type must be supplied — the adapter routes on it. Normalizes
 * the raw payload to a `MediaRef` usable as a job input: the backend's own
 * discriminator wins (fetched media can carry a job type like
 * `nano_banana_job`, valid on the wire), else the plane's input type — the
 * same vocabulary upload produces, so get-then-submit matches upload-then-submit.
 */
async function getMedia(ctx, id, type) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.get', { media_id: id, media_type: type }, async () => {
        const raw = (await ctx.mediaAdapter.getMedia({ id, type }) ?? {});
        return {
            id: raw.id ?? id,
            type: raw.type ?? types_1.REF_TYPE_BY_UPLOAD[type],
            ...(raw.url ? { url: raw.url } : {}),
        };
    }, {
        successAttributes: ref => ({ ref_type: ref.type }),
    });
}
//# sourceMappingURL=get.js.map