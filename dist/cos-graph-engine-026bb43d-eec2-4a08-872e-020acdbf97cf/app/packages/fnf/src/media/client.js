"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaClient = createMediaClient;
const context_1 = require("./context");
const get_1 = require("./get");
const list_1 = require("./list");
const resolve_1 = require("./resolve");
const upload_1 = require("./upload");
/**
 * Compose the media operations into a client. Sugar over the free functions —
 * every method binds the shared media context. Build a context and call the
 * operations directly if you only need one:
 *
 *   const ctx = createMediaContext(config)
 *   await getMedia(ctx, id, 'image')
 */
function createMediaClient(config) {
    const ctx = (0, context_1.createMediaContext)(config);
    return {
        get: (id, type) => (0, get_1.getMedia)(ctx, id, type),
        list: opts => (0, list_1.listMedia)(ctx, opts),
        resolve: refs => (0, resolve_1.resolveMedia)(ctx, refs),
        upload: input => (0, upload_1.uploadMedia)(ctx, input),
        uploadFromUrl: input => (0, upload_1.uploadMediaFromUrl)(ctx, input),
        getUploadUrl: req => (0, upload_1.getUploadUrl)(ctx, req),
        confirm: req => (0, upload_1.confirmMedia)(ctx, req),
    };
}
//# sourceMappingURL=client.js.map