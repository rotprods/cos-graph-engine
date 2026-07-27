"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaModerationError = exports.UploadNotSupportedError = exports.UrlIngestError = exports.ConfirmError = exports.InvalidMediaSourceError = exports.UploadTransferError = exports.PresignError = void 0;
const errors_1 = require("../errors");
/** Presign step (`getUploadUrl`) failed or returned no upload URL. */
class PresignError extends errors_1.ApiJobError {
    constructor(message = 'Failed to create an upload URL') { super('presigned_failed', message); }
}
exports.PresignError = PresignError;
/** The binary PUT to the presigned URL failed. */
class UploadTransferError extends errors_1.ApiJobError {
    constructor(message = 'Upload transfer failed', status) { super('upload_failed', message, { status }); }
}
exports.UploadTransferError = UploadTransferError;
/** Upload source is not a valid binary container. Usually caused by JSON-serializing File/Blob/bytes. */
class InvalidMediaSourceError extends errors_1.ApiJobError {
    constructor(message = 'Media upload source must be Blob, ArrayBuffer, Uint8Array, or a read() function returning one') {
        super('invalid_media_source', message);
    }
}
exports.InvalidMediaSourceError = InvalidMediaSourceError;
/** The confirm step failed. */
class ConfirmError extends errors_1.ApiJobError {
    constructor(message = 'Failed to confirm upload') { super('confirm_failed', message); }
}
exports.ConfirmError = ConfirmError;
/** `uploadMediaFromUrl` could not fetch the remote URL (no `fetchBytes`, or fetch failed). */
class UrlIngestError extends errors_1.ApiJobError {
    constructor(message = 'Failed to ingest media from URL') { super('url_ingest_failed', message); }
}
exports.UrlIngestError = UrlIngestError;
/** The media adapter doesn't implement `getUploadUrl`/`confirmMedia`. */
class UploadNotSupportedError extends errors_1.ApiJobError {
    constructor() { super('upload_not_supported', 'This media adapter does not support uploads'); }
}
exports.UploadNotSupportedError = UploadNotSupportedError;
/**
 * Confirm reported the media was blocked. One stable code; the specific wire
 * verdict ('ip_detected' | 'nsfw' | 'ip_check_rate_limit_reached') lives in
 * `data.status` — same one-code-one-class pattern as AccountSuspendedError.
 */
class MediaModerationError extends errors_1.ApiJobError {
    constructor(status) {
        super('media_moderation_blocked', `Media blocked by moderation: ${status}`, { data: { status } });
    }
}
exports.MediaModerationError = MediaModerationError;
// Rehydration entries for the media codes (registered here — not in errors.ts —
// to avoid a circular import between the two halves). These run at IMPORT time,
// which is why this file is listed in package.json `sideEffects` — any future
// module that registers codes on import must be added there too, or production
// tree-shaking silently drops the registrations and cross-boundary rehydration
// degrades to the base ApiJobError.
(0, errors_1.registerErrorCode)('presigned_failed', j => new PresignError(j.message));
(0, errors_1.registerErrorCode)('upload_failed', j => new UploadTransferError(j.message, j.status));
(0, errors_1.registerErrorCode)('invalid_media_source', j => new InvalidMediaSourceError(j.message));
(0, errors_1.registerErrorCode)('confirm_failed', j => new ConfirmError(j.message));
(0, errors_1.registerErrorCode)('url_ingest_failed', j => new UrlIngestError(j.message));
(0, errors_1.registerErrorCode)('upload_not_supported', () => new UploadNotSupportedError());
(0, errors_1.registerErrorCode)('media_moderation_blocked', j => new MediaModerationError(j.data?.status ?? 'blocked'));
//# sourceMappingURL=errors.js.map