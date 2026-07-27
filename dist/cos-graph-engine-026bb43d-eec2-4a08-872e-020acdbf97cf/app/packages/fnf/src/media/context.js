"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMediaContext = createMediaContext;
const observability_1 = require("../observability");
const blob_uploader_1 = require("./blob-uploader");
/** Resolve media config into the shared context every media operation consumes. */
function createMediaContext(config) {
    return {
        mediaAdapter: config.mediaAdapter,
        blobUploader: config.blobUploader ?? (0, blob_uploader_1.createFetchUploader)(),
        resolveJob: config.resolveJob,
        observability: (0, observability_1.createObservabilityContext)(config.observability),
    };
}
//# sourceMappingURL=context.js.map