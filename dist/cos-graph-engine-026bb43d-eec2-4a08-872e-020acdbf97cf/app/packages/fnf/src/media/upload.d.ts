import type { BinaryUploader, MediaBytes, MediaContext, SafeUploadResult, UploadInput, UploadResult, UploadSlot, UploadType } from './types';
/**
 * Full flow: presign → read bytes → PUT → confirm → submit-ready `UploadResult`.
 * `input.signal` cancels between steps (typed `JobAbortedError`) and aborts the PUT in flight.
 */
export declare function uploadMedia(ctx: MediaContext, input: UploadInput): Promise<UploadResult>;
/** No-throw variant for Comlink/iframe boundaries (mirrors `safeSubmit`). */
export declare function safeUploadMedia(ctx: MediaContext, input: UploadInput): Promise<SafeUploadResult>;
/** The `uploadMedia` options, minus the byte source, plus the URL to ingest. */
export type UploadFromUrlInput = Omit<UploadInput, 'source' | 'contentType'> & {
    url: string;
    maxBytes?: number;
};
/**
 * Download a remote URL then upload it — same options as `uploadMedia`
 *  (role/jobId/moderation flags pass through). Needs `BinaryUploader.fetchBytes`.
 */
export declare function uploadMediaFromUrl(ctx: MediaContext, input: UploadFromUrlInput): Promise<UploadResult>;
/** Step 1 — presign. Returns the upload slot (the bytes are PUT to `slot.uploadUrl`). */
export declare function getUploadUrl(ctx: MediaContext, req: {
    type: UploadType;
    filename?: string;
    contentType?: string;
    extra?: Record<string, unknown>;
}): Promise<UploadSlot>;
/** Step 2 — the raw binary PUT, via the injected uploader. */
export declare function transferBytes(uploader: BinaryUploader, slot: UploadSlot, bytes: MediaBytes, contentType?: string, signal?: AbortSignal): Promise<void>;
/** Step 3 — confirm. Normalizes to an `UploadResult`; throws on moderation block. */
export declare function confirmMedia(ctx: MediaContext, req: {
    mediaId: string;
    type: UploadType;
    filename?: string;
    jobId?: string;
    forceIpCheck?: boolean;
    forceNsfwCheck?: boolean;
    startSeconds?: number;
    endSeconds?: number;
    role?: string;
    throwOnModeration?: boolean;
    extra?: Record<string, unknown>;
}): Promise<UploadResult>;
/** The verdicts that block an upload (vs informational moderation statuses). */
export declare function isBlockedModeration(status: string): boolean;
//# sourceMappingURL=upload.d.ts.map