import type { BinaryUploader } from './types';
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
export declare function createFetchUploader(opts?: {
    fetch?: typeof globalThis.fetch;
    retries?: number;
}): BinaryUploader;
/** A no-op uploader for tests / offline pipelines (pairs with `createMemoryMediaAdapter`). */
export declare function createMemoryUploader(): BinaryUploader;
//# sourceMappingURL=blob-uploader.d.ts.map