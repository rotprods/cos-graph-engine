"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFetchUploader = createFetchUploader;
exports.createMemoryUploader = createMemoryUploader;
const errors_1 = require("../errors");
const errors_2 = require("./errors");
// The return type spells out `Uint8Array<ArrayBuffer>`: this file is compiled
// under EVERY consumer's tsconfig (packages ship source), and DOM-lib
// consumers (fnf-react) have the post-TS-5.7 `BodyInit` that rejects
// `ArrayBufferLike`-backed views — node-lib alone wouldn't catch it.
function toBodyInit(bytes) {
    if (bytes instanceof ArrayBuffer)
        return new Uint8Array(bytes); // a bare ArrayBuffer isn't a valid fetch body in every runtime; wrap it
    if (bytes instanceof Uint8Array) {
        // A SharedArrayBuffer-backed view is not a legal fetch body — copy out;
        // the normal ArrayBuffer-backed view re-wraps zero-copy.
        return bytes.buffer instanceof ArrayBuffer
            ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            : new Uint8Array(bytes);
    }
    return bytes;
}
/**
 * Default isomorphic `BinaryUploader` (Node / browser / Figma webview / CEP).
 * Does the raw presigned PUT with the file's Content-Type and NO auth header;
 * retries on 5xx / network error and bails on 4xx (presigned PUTs are
 * idempotent). An abort is a cancel, not a retryable failure — it surfaces as
 * the typed `JobAbortedError`. Adobe UXP — where webviews forbid a direct
 * host-bridge fetch but allow a cross-origin PUT — should inject its own uploader.
 *
 * `fetchBytes` is a basic reader for `uploadMediaFromUrl`. NOTE: it is NOT
 * SSRF-hardened — in a server/untrusted-URL context inject a uploader whose
 * `fetchBytes` enforces private-IP rejection / redirect / byte caps.
 */
function createFetchUploader(opts = {}) {
    // Lazy lookup (not a captured reference): keeps `this` off the call (CEP/polyfills
    // throw Illegal invocation on a detached fetch) and picks up late-installed polyfills.
    const doFetch = opts.fetch ?? ((...args) => globalThis.fetch(...args));
    const retries = opts.retries ?? 2;
    return {
        async transfer({ uploadUrl, bytes, contentType, signal }) {
            const body = toBodyInit(bytes);
            let lastStatus;
            let lastError;
            for (let attempt = 0; attempt <= retries; attempt++) {
                (0, errors_1.throwIfAborted)(signal);
                let res;
                try {
                    res = await doFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body, signal });
                }
                catch (err) {
                    (0, errors_1.throwIfAborted)(signal); // an aborted PUT is a cancel, not a retryable network error
                    lastError = err;
                    continue;
                }
                if (res.ok)
                    return;
                if (res.status < 500) {
                    const text = await res.text().catch(() => '');
                    throw new errors_2.UploadTransferError(`Upload failed (${res.status})${text ? `: ${text}` : ''}`, res.status); // 4xx — bail
                }
                lastStatus = res.status; // 5xx — retry
            }
            const cause = lastError instanceof Error ? `: ${lastError.message}` : '';
            throw new errors_2.UploadTransferError(`Upload failed after ${retries + 1} attempts${cause}`, lastStatus);
        },
        async fetchBytes(url, fetchOpts) {
            let res;
            try {
                res = await doFetch(url, { signal: fetchOpts?.signal });
            }
            catch (err) {
                (0, errors_1.throwIfAborted)(fetchOpts?.signal);
                throw new errors_2.UrlIngestError(`Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
            }
            if (!res.ok)
                throw new errors_2.UrlIngestError(`Failed to fetch ${url} (${res.status})`);
            // Cheap early reject when the server declares the size; the post-download
            // check below stays authoritative (Content-Length may be absent or encoded size).
            const declared = Number(res.headers.get('content-length'));
            if (fetchOpts?.maxBytes != null && declared > fetchOpts.maxBytes)
                throw new errors_2.UrlIngestError(`Media exceeds maxBytes (${declared} > ${fetchOpts.maxBytes})`);
            const buf = await res.arrayBuffer().catch((err) => {
                (0, errors_1.throwIfAborted)(fetchOpts?.signal);
                throw new errors_2.UrlIngestError(`Failed to read ${url}: ${err instanceof Error ? err.message : String(err)}`);
            });
            if (fetchOpts?.maxBytes != null && buf.byteLength > fetchOpts.maxBytes)
                throw new errors_2.UrlIngestError(`Media exceeds maxBytes (${buf.byteLength} > ${fetchOpts.maxBytes})`);
            return { bytes: new Uint8Array(buf), contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
        },
    };
}
/** A no-op uploader for tests / offline pipelines (pairs with `createMemoryMediaAdapter`). */
function createMemoryUploader() {
    return {
        async transfer() { },
        async fetchBytes() { return { bytes: new Uint8Array(), contentType: 'application/octet-stream' }; },
    };
}
//# sourceMappingURL=blob-uploader.js.map