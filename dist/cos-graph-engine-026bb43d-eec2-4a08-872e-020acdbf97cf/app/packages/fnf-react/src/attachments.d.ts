import type { MediaRef, UploadInput, UploadModeration, UploadResult } from '@higgsfield/fnf/media';
import type { FnfObservabilityOptions } from '@higgsfield/fnf/observability';
import { ApiJobError } from '@higgsfield/fnf/errors';
import { ExternalStore } from './external-store';
/** What the presenter needs from a media client — structural on purpose. */
export interface AttachmentsMediaClient {
    upload: (input: UploadInput) => Promise<UploadResult>;
}
/**
 * Everything `media.upload` accepts except the byte source — forwarded
 * VERBATIM. The presenter only fills defaults (filename/contentType from the
 * File, `throwOnModeration: false` so verdicts become item state, a
 * per-item cancellation signal); any of them can be overridden here.
 */
export type AttachmentUploadOptions = Omit<UploadInput, 'source'>;
export type AttachmentStatus = 'uploading' | 'ready' | 'blocked' | 'failed';
export interface Attachment {
    /** Stable local identity — survives the upload, safe as a React key. */
    readonly key: string;
    /** Present for file-born attachments (absent when a ready ref was added). */
    readonly file?: File;
    /** The media role this attachment was added for (drives the submit slot). */
    readonly role?: string;
    /** The submit-ready ref — present once `status` is `ready` (or `blocked`). */
    readonly ref?: MediaRef;
    /** Renderable immediately: a local object URL while uploading, the remote url after. */
    readonly previewUrl?: string;
    readonly status: AttachmentStatus;
    /** The typed upload failure when `status` is `failed`. */
    readonly error?: ApiJobError;
    /** The moderation verdict when the backend blocked the upload. */
    readonly moderation?: UploadModeration;
}
export interface AttachmentsOptions {
    /** Controller-wide upload options (per-`add` options override them). */
    upload?: AttachmentUploadOptions;
    /**
     * Measure intrinsic size/duration into `MediaRef.meta` from the local file
     * (default true; a no-op outside a DOM). Meta drives the SDK's media rules
     * and the product-parity 'auto' aspect-ratio resolution.
     */
    measure?: boolean;
    observability?: FnfObservabilityOptions;
}
/**
 * The attachments presenter: files in → previews now, uploads in flight,
 * submit-ready `MediaRef`s out. The frontend counterpart of fnf-web's
 * `InputMediaController`, rebuilt on the SDK media client:
 *
 *   const refs = await attachments.settled()       // wait out in-flight uploads
 *   client.submit({ media: { image: refs }, ... })
 *
 * Per-item lifecycle: `uploading` → `ready` | `blocked` (moderation verdict,
 * kept visible instead of thrown) | `failed` (typed error, `retry`-able).
 * Removing an in-flight item aborts its upload; object URLs are revoked when
 * the remote url takes over and on remove/clear/dispose. No counts, types,
 * or roles are restricted here — the job declarations validate media; the
 * presenter only presents.
 */
export declare class AttachmentsController extends ExternalStore {
    private readonly media;
    private readonly opts;
    private _items;
    private readonly inFlight;
    private readonly localUrls;
    private readonly aborts;
    private readonly uploadOpts;
    private readonly measure;
    private readonly observability;
    private seq;
    constructor(media: AttachmentsMediaClient, opts?: AttachmentsOptions);
    get items(): Attachment[];
    /** Submit-ready refs (ready items only, in display order). */
    get refs(): MediaRef[];
    get isUploading(): boolean;
    /**
     * Add files (uploaded immediately, preview available at once) or
     * already-uploaded refs (ready as-is). `opts` are upload options for THESE
     * entries, merged over the controller-wide ones (`role` lives here too).
     * Returns the new items' keys.
     */
    add(input: File | MediaRef | Array<File | MediaRef>, opts?: AttachmentUploadOptions): string[];
    /** Re-upload a failed file-born attachment with its original options. */
    retry(key: string): void;
    /** Remove the item; an in-flight upload is aborted. */
    remove(key: string): void;
    /** Reorder (drag-and-drop): move the item at `from` to position `to`. */
    move(from: number, to: number): void;
    clear(): void;
    /** `clear` + drop in-flight bookkeeping — call when the owner unmounts. */
    dispose(): void;
    /**
     * Wait for every in-flight upload to finish, then return the submit-ready
     * refs — the "user hit Generate while uploads are running" path. Failures
     * don't reject; they stay visible as `failed`/`blocked` items.
     */
    settled(): Promise<MediaRef[]>;
    private upload;
    private track;
    private patch;
    private createLocalUrl;
    private revokeLocalUrl;
}
//# sourceMappingURL=attachments.d.ts.map