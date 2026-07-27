import { ApiJobError } from '../errors';
/** Presign step (`getUploadUrl`) failed or returned no upload URL. */
export declare class PresignError extends ApiJobError {
    constructor(message?: string);
}
/** The binary PUT to the presigned URL failed. */
export declare class UploadTransferError extends ApiJobError {
    constructor(message?: string, status?: number);
}
/** Upload source is not a valid binary container. Usually caused by JSON-serializing File/Blob/bytes. */
export declare class InvalidMediaSourceError extends ApiJobError {
    constructor(message?: string);
}
/** The confirm step failed. */
export declare class ConfirmError extends ApiJobError {
    constructor(message?: string);
}
/** `uploadMediaFromUrl` could not fetch the remote URL (no `fetchBytes`, or fetch failed). */
export declare class UrlIngestError extends ApiJobError {
    constructor(message?: string);
}
/** The media adapter doesn't implement `getUploadUrl`/`confirmMedia`. */
export declare class UploadNotSupportedError extends ApiJobError {
    constructor();
}
/**
 * Confirm reported the media was blocked. One stable code; the specific wire
 * verdict ('ip_detected' | 'nsfw' | 'ip_check_rate_limit_reached') lives in
 * `data.status` — same one-code-one-class pattern as AccountSuspendedError.
 */
export declare class MediaModerationError extends ApiJobError<{
    status: string;
}> {
    constructor(status: string);
}
//# sourceMappingURL=errors.d.ts.map