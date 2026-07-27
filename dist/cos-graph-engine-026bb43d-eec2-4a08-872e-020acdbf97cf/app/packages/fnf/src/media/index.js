"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMediaFromUrl = exports.uploadMedia = exports.transferBytes = exports.safeUploadMedia = exports.isBlockedModeration = exports.getUploadUrl = exports.confirmMedia = exports.REF_TYPE_BY_UPLOAD = exports.resolveMedia = exports.inferUploadType = exports.inferContentType = exports.defaultFilenameForContentType = exports.listMedia = exports.getMedia = exports.UrlIngestError = exports.UploadTransferError = exports.UploadNotSupportedError = exports.PresignError = exports.MediaModerationError = exports.InvalidMediaSourceError = exports.ConfirmError = exports.createDomMediaMetaResolver = exports.createMediaContext = exports.createMediaClient = exports.createMemoryUploader = exports.createFetchUploader = exports.resolveMediaMeta = void 0;
// The opt-in measurement step for the meta rules (dimensionsWithin/durationsWithin):
// fill MediaRef.meta before validating. The DOM resolver is the browser capability;
// resolveMediaMeta is the pure orchestration over any resolver.
var media_meta_1 = require("../media-meta");
Object.defineProperty(exports, "resolveMediaMeta", { enumerable: true, get: function () { return media_meta_1.resolveMediaMeta; } });
var blob_uploader_1 = require("./blob-uploader");
Object.defineProperty(exports, "createFetchUploader", { enumerable: true, get: function () { return blob_uploader_1.createFetchUploader; } });
Object.defineProperty(exports, "createMemoryUploader", { enumerable: true, get: function () { return blob_uploader_1.createMemoryUploader; } });
var client_1 = require("./client");
Object.defineProperty(exports, "createMediaClient", { enumerable: true, get: function () { return client_1.createMediaClient; } });
var context_1 = require("./context");
Object.defineProperty(exports, "createMediaContext", { enumerable: true, get: function () { return context_1.createMediaContext; } });
var dom_meta_resolver_1 = require("./dom-meta-resolver");
Object.defineProperty(exports, "createDomMediaMetaResolver", { enumerable: true, get: function () { return dom_meta_resolver_1.createDomMediaMetaResolver; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "ConfirmError", { enumerable: true, get: function () { return errors_1.ConfirmError; } });
Object.defineProperty(exports, "InvalidMediaSourceError", { enumerable: true, get: function () { return errors_1.InvalidMediaSourceError; } });
Object.defineProperty(exports, "MediaModerationError", { enumerable: true, get: function () { return errors_1.MediaModerationError; } });
Object.defineProperty(exports, "PresignError", { enumerable: true, get: function () { return errors_1.PresignError; } });
Object.defineProperty(exports, "UploadNotSupportedError", { enumerable: true, get: function () { return errors_1.UploadNotSupportedError; } });
Object.defineProperty(exports, "UploadTransferError", { enumerable: true, get: function () { return errors_1.UploadTransferError; } });
Object.defineProperty(exports, "UrlIngestError", { enumerable: true, get: function () { return errors_1.UrlIngestError; } });
var get_1 = require("./get");
Object.defineProperty(exports, "getMedia", { enumerable: true, get: function () { return get_1.getMedia; } });
var list_1 = require("./list");
Object.defineProperty(exports, "listMedia", { enumerable: true, get: function () { return list_1.listMedia; } });
var mime_1 = require("./mime");
Object.defineProperty(exports, "defaultFilenameForContentType", { enumerable: true, get: function () { return mime_1.defaultFilenameForContentType; } });
Object.defineProperty(exports, "inferContentType", { enumerable: true, get: function () { return mime_1.inferContentType; } });
Object.defineProperty(exports, "inferUploadType", { enumerable: true, get: function () { return mime_1.inferUploadType; } });
var resolve_1 = require("./resolve");
Object.defineProperty(exports, "resolveMedia", { enumerable: true, get: function () { return resolve_1.resolveMedia; } });
// Upload kind → product input-media discriminator (media_input/video_input/
// audio_input) — the vocabulary media adapters answer presigns with.
var types_1 = require("./types");
Object.defineProperty(exports, "REF_TYPE_BY_UPLOAD", { enumerable: true, get: function () { return types_1.REF_TYPE_BY_UPLOAD; } });
var upload_1 = require("./upload");
Object.defineProperty(exports, "confirmMedia", { enumerable: true, get: function () { return upload_1.confirmMedia; } });
Object.defineProperty(exports, "getUploadUrl", { enumerable: true, get: function () { return upload_1.getUploadUrl; } });
Object.defineProperty(exports, "isBlockedModeration", { enumerable: true, get: function () { return upload_1.isBlockedModeration; } });
Object.defineProperty(exports, "safeUploadMedia", { enumerable: true, get: function () { return upload_1.safeUploadMedia; } });
Object.defineProperty(exports, "transferBytes", { enumerable: true, get: function () { return upload_1.transferBytes; } });
Object.defineProperty(exports, "uploadMedia", { enumerable: true, get: function () { return upload_1.uploadMedia; } });
Object.defineProperty(exports, "uploadMediaFromUrl", { enumerable: true, get: function () { return upload_1.uploadMediaFromUrl; } });
//# sourceMappingURL=index.js.map