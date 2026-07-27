"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMedia = listMedia;
const observability_1 = require("../observability");
const types_1 = require("./types");
async function listMedia(ctx, opts) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.list', {
        media_type: opts.type,
        ...(opts.size !== undefined ? { size: opts.size } : {}),
        ...(opts.cursor !== undefined ? { has_cursor: true } : {}),
    }, async () => {
        const body = (await ctx.mediaAdapter.listMedia(opts) ?? {});
        const items = (body.items ?? body.medias ?? []).map(m => ({
            id: m.id,
            // Same vocabulary as get/upload: backend discriminator first, plane fallback.
            type: m.type ?? types_1.REF_TYPE_BY_UPLOAD[opts.type],
            ...(m.url ? { url: m.url } : {}),
        }));
        const cursor = body.next_cursor ?? body.cursor ?? undefined;
        return { items, ...(cursor != null ? { cursor } : {}) };
    }, {
        successAttributes: result => ({ item_count: result.items.length, has_cursor: result.cursor !== undefined }),
    });
}
//# sourceMappingURL=list.js.map