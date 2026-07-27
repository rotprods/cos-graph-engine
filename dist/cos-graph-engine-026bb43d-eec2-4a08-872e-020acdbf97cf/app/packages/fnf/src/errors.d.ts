import type { Generation } from './types';
/**
 * Error taxonomy for the fnf SDK.
 *
 * `ApiJobError` is the generic superclass every SDK error extends. Each
 * error carries a stable `code` (the cross-boundary discriminator — survives
 * `toJSON`/Comlink where `instanceof` does not) and an optional typed `data`
 * payload. Serialization is uniform: `toJSON()` emits `{ code, message, status?,
 * data? }` at the base, so subclasses never need their own override and nothing
 * is silently dropped across a worker/iframe boundary. Rehydrate with
 * `errorFromJSON`.
 */
export type SubscriptionPlanType = 'free' | 'basic' | 'pro' | 'ultimate' | 'creator' | 'team-plan' | 'enterprise-plan' | 'starter' | 'plus' | 'ultra' | 'max' | 'team' | 'scale' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual' | 'quarterly' | 'eighteen_month' | 'two_year';
export interface TeamErrorDetails {
    workspaceType: 'Shared' | 'Private';
    userRole: 'Owner' | 'Member';
    isEnterprise?: boolean;
}
export type AutoTopUpErrorType = 'auto_top_up_suspended' | 'auto_top_up_charge_failed' | 'auto_top_up_in_progress';
export type MinimumPlanFeature = 'avatar' | 'train';
export type GraceLimitReachedType = 'downgrade_notice' | 'pay_less_notice' | 'unlock_full_access_notice';
/**
 * Plan/billing context shared by the billing errors (structured, not flattened).
 * All fields are optional — the backend doesn't guarantee every one on every
 * error, so the shape stays honest rather than casting absent values.
 */
export interface BillingContext {
    plan?: SubscriptionPlanType;
    billingPeriod?: BillingPeriod;
    team?: TeamErrorDetails;
}
export interface ApiJobErrorJSON<D = unknown> {
    code: string;
    message: string;
    status?: number;
    data?: D;
}
export declare class ApiJobError<D = unknown> extends Error {
    readonly code: string;
    readonly status?: number;
    readonly data?: D;
    constructor(code: string, message: string, opts?: {
        status?: number;
        data?: D;
    });
    toJSON(): ApiJobErrorJSON<D>;
    /**
     * Type-guard sugar: `OutOfCreditsError.is(err)` narrows `err` to that class —
     * and `BillingError.is(err)` / `ApiJobError.is(err)` narrow to a tier.
     * In-process only (it's `instanceof`); across a serialization boundary switch
     * on `code`, or rehydrate with `errorFromJSON` first.
     */
    static is<T extends ApiJobError>(this: new (...args: never[]) => T, value: unknown): value is T;
}
export declare class BillingError<D extends BillingContext = BillingContext> extends ApiJobError<D> {
}
export declare class OutOfCreditsError extends BillingError {
    constructor(data: BillingContext);
}
export declare class RateLimitError extends BillingError<BillingContext & {
    maxCount?: number;
    isUnlimited?: boolean;
}> {
    constructor(data: BillingContext & {
        maxCount?: number;
        isUnlimited?: boolean;
    });
}
export declare class SharedTeamSubscriptionInactiveError extends BillingError {
    constructor(data: BillingContext);
}
export declare class MinimumPlanError extends BillingError<BillingContext & {
    feature?: MinimumPlanFeature;
}> {
    constructor(data: BillingContext & {
        feature?: MinimumPlanFeature;
    });
}
export declare class PromptNsfwError extends ApiJobError {
    constructor();
}
/**
 * The protected-content (IP) check blocked the media. Current fnf-api never
 * emits `ip_detected` as an HTTP `detail.error_type` (zero sites) — it exists
 * only as a 2xx confirm-body status (`status: 'ip_detected'`, the media half's
 * MediaModerationError) and a job status. This class covers the legacy HTTP 422
 * error-body shape fnf-web still defends against at presign/confirm
 * (fnf-web src/entities/input-media/api/image-api.ts, video-api.ts → its
 * IpDetectedError). Lives here, not media/errors.ts: errors.ts owns the wire
 * error_type catalog and must not import from media/.
 */
export declare class IpDetectedError extends ApiJobError {
    constructor(message?: string);
}
/**
 * `detail.error_type: 'ip_check_rate_limit_reached'` at presign/confirm — the
 * eligibility (IP) check quota, not a generation rate limit (so no billing
 * context). Default message mirrors fnf-web's CONFIRM-side class
 * (src/shared/lib/ip-check/ip-check-rate-limit-error.ts); the product shows a
 * differently-worded upload variant at presign (ip-check-upload-rate-limit-
 * error.ts: 'Eligibility check upload limit reached…') that the SDK does not
 * distinguish — same code, one message.
 */
export declare class IpCheckRateLimitError extends ApiJobError {
    constructor(message?: string);
}
export declare class VpnDetectedError extends ApiJobError {
    constructor();
}
export declare class KybVerificationRequiredError extends ApiJobError {
    constructor();
}
export declare class NotEnoughBoostCreditsError extends ApiJobError {
    constructor();
}
export declare class SubscriptionRenewalFailedError extends ApiJobError {
    constructor();
}
export declare class JobInProgressError extends ApiJobError {
    constructor();
}
export declare class UnlimitedGenerationNotAllowedError extends ApiJobError {
    constructor();
}
export declare class BatchRateLimitError extends ApiJobError<{
    concurrentBatchesLimit?: number;
}> {
    constructor(concurrentBatchesLimit?: number);
}
export declare class BeatFitLimitError extends ApiJobError<{
    concurrentBatchesLimit?: number;
}> {
    constructor(concurrentBatchesLimit?: number);
}
export declare class GraceDailyLimitError extends ApiJobError<{
    graceType: GraceLimitReachedType;
    graceData?: unknown;
}> {
    constructor(graceType: GraceLimitReachedType, graceData?: unknown);
}
export declare class AutoTopUpSuspendedError extends ApiJobError<{
    autoTopUpType: AutoTopUpErrorType;
}> {
    constructor(autoTopUpType: AutoTopUpErrorType);
}
export declare class WorkspaceMemberSpendPausedError extends ApiJobError<{
    workspaceId?: string;
    userId?: string;
    pausedAt?: string | null;
    pausedByUserId?: string | null;
}> {
    constructor(data: {
        workspaceId?: string;
        userId?: string;
        pausedAt?: string | null;
        pausedByUserId?: string | null;
    });
}
export declare class AccountSuspendedError extends ApiJobError<{
    suspendedCode: 'account_suspended' | 'account_blocked';
}> {
    constructor(suspendedCode: 'account_suspended' | 'account_blocked');
}
export declare class WorkspaceSelectionRequiredError extends ApiJobError<{
    workspaces: Array<{
        id: string;
        name: string | null;
        type: 'private' | 'shared';
    }>;
}> {
    constructor(workspaces?: Array<{
        id: string;
        name: string | null;
        type: 'private' | 'shared';
    }>);
}
export declare class ApiMessageError extends ApiJobError {
    constructor(message: string);
}
export declare class ValidationError extends ApiJobError<{
    issues?: unknown;
}> {
    constructor(message: string, issues?: unknown);
}
export declare class UnknownSubmitResponseError extends ApiJobError<{
    responseUrl?: string;
    responseBody?: unknown;
}> {
    constructor(status?: number, responseBody?: unknown, responseUrl?: string);
}
export declare class JobAbortedError extends ApiJobError {
    constructor(message?: string);
}
/** The host's `confirm` gate rejected — the user declined the submission. */
export declare class ConfirmationRejectedError extends ApiJobError {
    constructor(message?: string);
}
/** Throw the typed `JobAbortedError` when the signal is already aborted. */
export declare function throwIfAborted(signal?: AbortSignal): void;
export declare class JobTimeoutError extends ApiJobError<{
    generation?: Generation;
}> {
    readonly generation?: Generation;
    constructor(id: string, timeoutMs: number, generation?: Generation);
}
export declare function errorFromResponse(status: number, body: unknown): ApiJobError | null;
/**
 * Register a rehydrator for an error code. Used by the media half (and custom
 * error subclasses) so `errorFromJSON` restores `instanceof`/`.is()` identity
 * without a circular import into this module.
 */
export declare function registerErrorCode(code: string, make: (j: ApiJobErrorJSON<any>) => ApiJobError): void;
export declare function errorFromJSON(json: ApiJobErrorJSON<any>): ApiJobError;
//# sourceMappingURL=errors.d.ts.map