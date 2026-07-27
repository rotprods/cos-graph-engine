"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = uploadMedia;
exports.safeUploadMedia = safeUploadMedia;
exports.uploadMediaFromUrl = uploadMediaFromUrl;
exports.getUploadUrl = getUploadUrl;
exports.transferBytes = transferBytes;
exports.confirmMedia = confirmMedia;
exports.isBlockedModeration = isBlockedModeration;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const errors_2 = require("./errors");
const mime_1 = require("./mime");
const types_1 = require("./types");
/**
 * Full flow: presign → read bytes → PUT → confirm → submit-ready `UploadResult`.
 * `input.signal` cancels between steps (typed `JobAbortedError`) and aborts the PUT in flight.
 */
async function uploadMedia(ctx, input) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.upload', {
        media_type: input.type ?? 'auto',
        has_role: Boolean(input.role),
        force_ip_check: input.forceIpCheck === true,
        force_nsfw_check: input.forceNsfwCheck === true,
    }, async () => {
        (0, errors_1.throwIfAborted)(input.signal);
        const bytes = await readSource(input.source);
        const contentType = contentTypeOf(input, bytes);
        const type = input.type ?? (0, mime_1.inferUploadType)(contentType);
        const filename = input.filename ?? (0, mime_1.defaultFilenameForContentType)(contentType, type);
        const slot = await getUploadUrl(ctx, { type, filename, contentType, extra: input.extra });
        (0, errors_1.throwIfAborted)(input.signal);
        // PUT with the slot's content type (the backend's signed value when the
        // presign returned one, else the same local inference fed into it).
        await (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.transfer', {
            media_id: slot.mediaId,
            media_type: type,
            content_type: slot.contentType,
        }, () => transferBytes(ctx.blobUploader, slot, bytes, undefined, input.signal));
        (0, errors_1.throwIfAborted)(input.signal);
        const result = await confirmMedia(ctx, {
            mediaId: slot.mediaId,
            type,
            filename,
            role: input.role,
            jobId: input.jobId,
            forceIpCheck: input.forceIpCheck,
            forceNsfwCheck: input.forceNsfwCheck,
            startSeconds: input.startSeconds,
            endSeconds: input.endSeconds,
            throwOnModeration: input.throwOnModeration,
            // The product sends its extra wire fields (surface) at confirm too.
            extra: input.extra,
        });
        // confirm doesn't know the slot's url/contentType; prefer the richer values.
        return {
            ...result,
            contentType,
            url: result.url ?? slot.url,
            ref: result.ref.url ? result.ref : { ...result.ref, ...(slot.url ? { url: slot.url } : {}) },
        };
    }, {
        successAttributes: result => ({
            media_id: result.mediaId,
            media_type: result.type,
            status: result.status,
            content_type: result.contentType,
            ...(result.moderation?.status ? { moderation_status: result.moderation.status } : {}),
        }),
    });
}
/** No-throw variant for Comlink/iframe boundaries (mirrors `safeSubmit`). */
async function safeUploadMedia(ctx, input) {
    try {
        return { ok: true, result: await uploadMedia(ctx, input) };
    }
    catch (err) {
        if (err instanceof errors_1.ApiJobError)
            return { ok: false, error: err.toJSON() };
        return { ok: false, error: { code: 'unexpected', message: err instanceof Error ? err.message : String(err) } };
    }
}
/**
 * Download a remote URL then upload it — same options as `uploadMedia`
 *  (role/jobId/moderation flags pass through). Needs `BinaryUploader.fetchBytes`.
 */
async function uploadMediaFromUrl(ctx, input) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.upload_from_url', {
        ...(input.maxBytes !== undefined ? { max_bytes: input.maxBytes } : {}),
        media_type: input.type ?? 'auto',
    }, async () => {
        if (!ctx.blobUploader.fetchBytes)
            throw new errors_2.UploadNotSupportedError();
        (0, errors_1.throwIfAborted)(input.signal);
        const { url, maxBytes, ...rest } = input;
        const { bytes, contentType } = await ctx.blobUploader.fetchBytes(url, { maxBytes, signal: input.signal });
        const filename = rest.filename ?? url.split('/').pop()?.split('?')[0];
        return uploadMedia(ctx, { ...rest, source: bytes, contentType, filename });
    }, {
        successAttributes: result => ({ media_id: result.mediaId, media_type: result.type, status: result.status }),
    });
}
// ── the individual steps (exported for callers that drive the flow themselves) ──
/** Step 1 — presign. Returns the upload slot (the bytes are PUT to `slot.uploadUrl`). */
async function getUploadUrl(ctx, req) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.presign', {
        media_type: req.type,
        ...(req.contentType ? { content_type: req.contentType } : {}),
    }, async () => {
        if (!ctx.mediaAdapter.getUploadUrl)
            throw new errors_2.UploadNotSupportedError();
        let raw;
        try {
            raw = (await ctx.mediaAdapter.getUploadUrl(req) ?? {});
        }
        catch (err) {
            // Adapters map their own HTTP failures to typed errors; a foreign throw
            // (custom adapter, socket error) still has to surface as the typed step
            // failure — same contract as confirmMedia below.
            if (err instanceof errors_1.ApiJobError)
                throw err;
            throw new errors_2.PresignError(err instanceof Error ? err.message : String(err));
        }
        const mediaId = str(raw.id) ?? str(raw.media_id);
        const uploadUrl = str(raw.upload_url) ?? str(raw.uploadUrl);
        if (!mediaId || !uploadUrl)
            throw new errors_2.PresignError();
        return {
            mediaId,
            uploadUrl,
            url: str(raw.url),
            type: req.type,
            // The backend's signed Content-Type wins — the product PUTs audio/video
            // with the presign response's content_type; a locally-inferred variant
            // (m4a/x-m4a…) could fail the presigned-URL signature.
            contentType: str(raw.content_type) ?? (0, mime_1.inferContentType)(req.filename, req.contentType),
            method: 'PUT',
        };
    }, {
        successAttributes: slot => ({ media_id: slot.mediaId, media_type: slot.type, content_type: slot.contentType }),
    });
}
/** Step 2 — the raw binary PUT, via the injected uploader. */
async function transferBytes(uploader, slot, bytes, contentType, signal) {
    await uploader.transfer({ uploadUrl: slot.uploadUrl, bytes, contentType: contentType ?? slot.contentType, signal });
}
/** Step 3 — confirm. Normalizes to an `UploadResult`; throws on moderation block. */
async function confirmMedia(ctx, req) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.media.confirm', {
        media_id: req.mediaId,
        media_type: req.type,
        force_ip_check: req.forceIpCheck === true,
        force_nsfw_check: req.forceNsfwCheck === true,
    }, async () => {
        if (!ctx.mediaAdapter.confirmMedia)
            throw new errors_2.UploadNotSupportedError();
        let raw = {};
        let blockedCode;
        try {
            raw = (await ctx.mediaAdapter.confirmMedia(req) ?? {});
        }
        catch (err) {
            // The backend signals a blocked upload in TWO shapes: a 2xx body with a
            // blocked status (handled below) and an HTTP 422 with the same verdict as
            // detail.error_type. throwOnModeration must not depend on which shape the
            // backend picked, so the 422 twin honors the opt-out too.
            if (err instanceof errors_1.ApiJobError) {
                if (req.throwOnModeration === false && (err.code === 'ip_detected' || err.code === 'ip_check_rate_limit_reached'))
                    blockedCode = err.code;
                else
                    throw err;
            }
            else {
                throw new errors_2.ConfirmError(err instanceof Error ? err.message : String(err));
            }
        }
        const moderation = moderationOf(raw) ?? (blockedCode ? { status: blockedCode } : undefined);
        const blocked = moderation && isBlockedModeration(moderation.status);
        if (blocked && req.throwOnModeration !== false)
            throw new errors_2.MediaModerationError(moderation.status);
        const id = str(raw.id) ?? req.mediaId;
        const url = str(raw.url) ?? str(raw.result_url);
        // The ref's `type` is the product's input-media discriminator (it goes on the
        // job wire verbatim, e.g. seedance medias[].data.type) — one per upload plane,
        // mirroring fnf-web's input-media model. Derived from the request, not the
        // response echo, so non-fnf adapters can't leak their own type strings.
        const ref = { id, type: types_1.REF_TYPE_BY_UPLOAD[req.type], ...(url ? { url } : {}), ...(req.role ? { role: req.role } : {}) };
        return {
            ref,
            mediaId: id,
            status: moderation?.status ?? str(raw.status) ?? 'uploaded',
            type: req.type,
            contentType: (0, mime_1.inferContentType)(req.filename, undefined),
            filename: req.filename ?? (0, mime_1.defaultFilenameForContentType)((0, mime_1.inferContentType)(req.filename, undefined), req.type),
            ...(url ? { url } : {}),
            ...(moderation ? { moderation } : {}),
        };
    }, {
        successAttributes: result => ({
            media_id: result.mediaId,
            media_type: result.type,
            status: result.status,
            ...(result.moderation?.status ? { moderation_status: result.moderation.status } : {}),
        }),
    });
}
/** The verdicts that block an upload (vs informational moderation statuses). */
function isBlockedModeration(status) {
    return status === 'ip_detected' || status === 'nsfw' || status === 'ip_check_rate_limit_reached';
}
// ── helpers ──
const MODERATION_STATUSES = new Set(['ip_detected', 'nsfw', 'ip_check_rate_limit_reached', 'not_ready']);
function moderationOf(raw) {
    const status = str(raw.status);
    const ipCheckFinished = bool(raw.ip_check_finished);
    const ipDetected = bool(raw.ip_detected);
    // Only surface `moderation` when the confirm actually carries IP/NSFW signal —
    // a plain `uploaded` status is the upload state, not a moderation verdict.
    if ((status == null || !MODERATION_STATUSES.has(status)) && ipCheckFinished === undefined && ipDetected === undefined)
        return undefined;
    return { status: status ?? 'not_ready', ...(ipCheckFinished !== undefined ? { ipCheckFinished } : {}), ...(ipDetected !== undefined ? { ipDetected } : {}) };
}
async function readSource(source) {
    const bytes = typeof source === 'object' && source !== null && 'read' in source ? await source.read() : source;
    if (!isMediaBytes(bytes))
        throw new errors_2.InvalidMediaSourceError();
    return bytes;
}
function contentTypeOf(input, bytes) {
    const fromBlob = typeof Blob !== 'undefined' && bytes instanceof Blob && bytes.type ? bytes.type : undefined;
    return (0, mime_1.inferContentType)(input.filename, input.contentType ?? fromBlob);
}
function isMediaBytes(value) {
    return (value instanceof Uint8Array
        || value instanceof ArrayBuffer
        || (typeof Blob !== 'undefined' && value instanceof Blob));
}
function str(v) {
    return typeof v === 'string' ? v : undefined;
}
function bool(v) {
    return typeof v === 'boolean' ? v : v === null ? null : undefined;
}
//# sourceMappingURL=upload.js.map