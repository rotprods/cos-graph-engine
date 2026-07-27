"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobTimeoutError = exports.ConfirmationRejectedError = exports.JobAbortedError = exports.UnknownSubmitResponseError = exports.ValidationError = exports.ApiMessageError = exports.WorkspaceSelectionRequiredError = exports.AccountSuspendedError = exports.WorkspaceMemberSpendPausedError = exports.AutoTopUpSuspendedError = exports.GraceDailyLimitError = exports.BeatFitLimitError = exports.BatchRateLimitError = exports.UnlimitedGenerationNotAllowedError = exports.JobInProgressError = exports.SubscriptionRenewalFailedError = exports.NotEnoughBoostCreditsError = exports.KybVerificationRequiredError = exports.VpnDetectedError = exports.IpCheckRateLimitError = exports.IpDetectedError = exports.PromptNsfwError = exports.MinimumPlanError = exports.SharedTeamSubscriptionInactiveError = exports.RateLimitError = exports.OutOfCreditsError = exports.BillingError = exports.ApiJobError = void 0;
exports.throwIfAborted = throwIfAborted;
exports.errorFromResponse = errorFromResponse;
exports.registerErrorCode = registerErrorCode;
exports.errorFromJSON = errorFromJSON;
class ApiJobError extends Error {
    code;
    status;
    data;
    constructor(code, message, opts) {
        super(message);
        this.name = code;
        this.code = code;
        this.status = opts?.status;
        this.data = opts?.data;
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ...(this.status != null ? { status: this.status } : {}),
            ...(this.data !== undefined ? { data: this.data } : {}),
        };
    }
    /**
     * Type-guard sugar: `OutOfCreditsError.is(err)` narrows `err` to that class —
     * and `BillingError.is(err)` / `ApiJobError.is(err)` narrow to a tier.
     * In-process only (it's `instanceof`); across a serialization boundary switch
     * on `code`, or rehydrate with `errorFromJSON` first.
     */
    static is(value) {
        return value instanceof this;
    }
}
exports.ApiJobError = ApiJobError;
// ── billing mid-tier (instanceof grouping; data is a BillingContext) ──
class BillingError extends ApiJobError {
}
exports.BillingError = BillingError;
class OutOfCreditsError extends BillingError {
    // No pinned status: both backend not_enough_credits sites emit HTTP 403
    // (fnf-api src/exceptions/auth.py:71-88 private, src/exceptions/workspace.py:267-290
    // shared) — a hard-coded status here would survive errorFromResponse's
    // stamping (it only fills a null status) and misreport the wire. The real
    // status arrives via stamping, and errorFromJSON restores the serialized one.
    constructor(data) { super('out_of_credits', 'Not enough credits', { data }); }
}
exports.OutOfCreditsError = OutOfCreditsError;
class RateLimitError extends BillingError {
    constructor(data) {
        super('rate_limit', 'Rate limit reached', { data });
    }
}
exports.RateLimitError = RateLimitError;
class SharedTeamSubscriptionInactiveError extends BillingError {
    constructor(data) { super('workspace_subscription_inactive', 'Team subscription is inactive', { data }); }
}
exports.SharedTeamSubscriptionInactiveError = SharedTeamSubscriptionInactiveError;
class MinimumPlanError extends BillingError {
    constructor(data) {
        const plan = data.plan ? `${data.plan} plan or higher` : 'a higher plan';
        super('minimum_plan_required', `Requires ${plan}${data.feature ? ` for ${data.feature}` : ''}`, { data });
    }
}
exports.MinimumPlanError = MinimumPlanError;
// ── non-billing submission errors ──
class PromptNsfwError extends ApiJobError {
    constructor() { super('prompt_nsfw', 'Prompt flagged as unsafe'); }
}
exports.PromptNsfwError = PromptNsfwError;
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
class IpDetectedError extends ApiJobError {
    constructor(message = 'Protected content is not allowed') { super('ip_detected', message); }
}
exports.IpDetectedError = IpDetectedError;
/**
 * `detail.error_type: 'ip_check_rate_limit_reached'` at presign/confirm — the
 * eligibility (IP) check quota, not a generation rate limit (so no billing
 * context). Default message mirrors fnf-web's CONFIRM-side class
 * (src/shared/lib/ip-check/ip-check-rate-limit-error.ts); the product shows a
 * differently-worded upload variant at presign (ip-check-upload-rate-limit-
 * error.ts: 'Eligibility check upload limit reached…') that the SDK does not
 * distinguish — same code, one message.
 */
class IpCheckRateLimitError extends ApiJobError {
    constructor(message = 'You\'ve reached the eligibility check limit. Please try again later.') {
        super('ip_check_rate_limit_reached', message);
    }
}
exports.IpCheckRateLimitError = IpCheckRateLimitError;
class VpnDetectedError extends ApiJobError {
    constructor() { super('vpn_detected', 'VPN detected — this model is not available over a VPN'); }
}
exports.VpnDetectedError = VpnDetectedError;
class KybVerificationRequiredError extends ApiJobError {
    constructor() { super('kyb_verification_required', 'KYB verification required'); }
}
exports.KybVerificationRequiredError = KybVerificationRequiredError;
class NotEnoughBoostCreditsError extends ApiJobError {
    constructor() { super('not_enough_boost_credits', 'Not enough boost credits'); }
}
exports.NotEnoughBoostCreditsError = NotEnoughBoostCreditsError;
class SubscriptionRenewalFailedError extends ApiJobError {
    constructor() { super('subscription_renewal_failed', 'Subscription renewal failed'); }
}
exports.SubscriptionRenewalFailedError = SubscriptionRenewalFailedError;
class JobInProgressError extends ApiJobError {
    constructor() { super('job_in_progress', 'Another job is already in progress', { status: 409 }); }
}
exports.JobInProgressError = JobInProgressError;
class UnlimitedGenerationNotAllowedError extends ApiJobError {
    constructor() { super('unlimited_generation_not_allowed', 'Unlimited generation is not allowed for this request'); }
}
exports.UnlimitedGenerationNotAllowedError = UnlimitedGenerationNotAllowedError;
class BatchRateLimitError extends ApiJobError {
    constructor(concurrentBatchesLimit) {
        super('batch_rate_limit', 'Batch rate limit reached', { data: { concurrentBatchesLimit } });
    }
}
exports.BatchRateLimitError = BatchRateLimitError;
class BeatFitLimitError extends ApiJobError {
    constructor(concurrentBatchesLimit) {
        super('beat_fit_limit', 'Beat-fit batch limit reached', { data: { concurrentBatchesLimit } });
    }
}
exports.BeatFitLimitError = BeatFitLimitError;
class GraceDailyLimitError extends ApiJobError {
    constructor(graceType, graceData) {
        super('grace_daily_limit', 'Daily generation limit reached during grace period', { data: { graceType, graceData } });
    }
}
exports.GraceDailyLimitError = GraceDailyLimitError;
class AutoTopUpSuspendedError extends ApiJobError {
    constructor(autoTopUpType) {
        super('auto_top_up_suspended', 'Auto top-up is suspended', { data: { autoTopUpType } });
    }
}
exports.AutoTopUpSuspendedError = AutoTopUpSuspendedError;
class WorkspaceMemberSpendPausedError extends ApiJobError {
    constructor(data) {
        super('workspace_member_spend_paused', 'Spending is paused for this workspace member', { data });
    }
}
exports.WorkspaceMemberSpendPausedError = WorkspaceMemberSpendPausedError;
class AccountSuspendedError extends ApiJobError {
    constructor(suspendedCode) {
        super('account_suspended', suspendedCode === 'account_blocked' ? 'Account is blocked' : 'Account is suspended', { data: { suspendedCode } });
    }
}
exports.AccountSuspendedError = AccountSuspendedError;
class WorkspaceSelectionRequiredError extends ApiJobError {
    constructor(workspaces = []) {
        super('workspace_selection_required', 'Workspace selection required', { status: 409, data: { workspaces } });
    }
}
exports.WorkspaceSelectionRequiredError = WorkspaceSelectionRequiredError;
class ApiMessageError extends ApiJobError {
    constructor(message) { super('api_message', message); }
}
exports.ApiMessageError = ApiMessageError;
class ValidationError extends ApiJobError {
    constructor(message, issues) { super('validation', message, { status: 422, data: { issues } }); }
}
exports.ValidationError = ValidationError;
class UnknownSubmitResponseError extends ApiJobError {
    constructor(status, responseBody, responseUrl) {
        super('unknown', `Request failed${status != null ? ` with status ${status}` : ''}`, { status, data: { responseUrl, responseBody } });
    }
}
exports.UnknownSubmitResponseError = UnknownSubmitResponseError;
// ── client-side lifecycle errors (share the base; not submission responses) ──
class JobAbortedError extends ApiJobError {
    constructor(message = 'Operation aborted') { super('aborted', message); }
}
exports.JobAbortedError = JobAbortedError;
/** The host's `confirm` gate rejected — the user declined the submission. */
class ConfirmationRejectedError extends ApiJobError {
    constructor(message = 'Submission was not confirmed') { super('confirmation_rejected', message); }
}
exports.ConfirmationRejectedError = ConfirmationRejectedError;
/** Throw the typed `JobAbortedError` when the signal is already aborted. */
function throwIfAborted(signal) {
    if (signal?.aborted)
        throw new JobAbortedError();
}
class JobTimeoutError extends ApiJobError {
    generation;
    constructor(id, timeoutMs, generation) {
        super('timeout', `Polling job ${id} did not reach a terminal status within ${timeoutMs}ms`, { data: { generation } });
        this.generation = generation;
    }
}
exports.JobTimeoutError = JobTimeoutError;
function detailObject(body) {
    return typeof body.detail === 'object' && body.detail !== null && !Array.isArray(body.detail)
        ? body.detail
        : undefined;
}
// Runtime-checked readers for the loosely-typed backend `detail` (no schema lib;
// just enough to avoid blind `as` casts on primitives).
function str(v) {
    return typeof v === 'string' ? v : undefined;
}
function num(v) {
    return typeof v === 'number' ? v : undefined;
}
function record(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : undefined;
}
/**
 * Map the backend `workspace` detail to a `TeamErrorDetails`. Field names
 * (`type`/`role`/`is_enterprise`) mirror the product's ApiWorkspaceErrorDetails
 * (fnf-web src/module/workspace/shared/error/api-team-error-details.ts).
 */
function mapWorkspace(w) {
    const o = record(w);
    if (!o)
        return undefined;
    // Only return a team detail when BOTH fields are recognized values — never
    // fabricate Owner/Private from an absent/unknown field (that would mislabel a
    // Member as Owner). An unrecognized shape means "no team info", not a default.
    const type = str(o.type);
    const role = str(o.role);
    if ((type !== 'shared' && type !== 'private') || (role !== 'member' && role !== 'owner'))
        return undefined;
    return {
        workspaceType: type === 'shared' ? 'Shared' : 'Private',
        userRole: role === 'member' ? 'Member' : 'Owner',
        // Team-plan (enterprise) users have a separate credit-purchase flow in the
        // product — the bridge needs this to route them correctly.
        ...(typeof o.is_enterprise === 'boolean' ? { isEnterprise: o.is_enterprise } : {}),
    };
}
function billingFrom(d) {
    return {
        // Shared-workspace billing errors send plan_type 'Team' (capital T —
        // fnf-api src/exceptions/workspace.py:260,287 via TeamPlanFactory.team().name,
        // src/types_/team_subscription.py:149-153); every SubscriptionPlanType
        // member is lowercase, so normalize case before casting.
        plan: str(d.plan_type)?.toLowerCase(),
        billingPeriod: str(d.billing_period),
        team: mapWorkspace(d.workspace),
    };
}
// Wire error_type → the plan the backend names. Mirrors the product's native
// mapping (fnf-web src/entities/job/error/plan.ts, MinimumPlanError.assertResponse)
// exactly — the sdk-bridge forwards `data.plan` verbatim into the app's
// MinimumPlanError, so both paths must agree. The SDK reports what the backend
// means; translating legacy plan names to the new lineup (starter/plus/ultra)
// is the app/display layer's job.
const PLAN_TIERS = {
    // Bare spelling kept defensively — current fnf-api emits only the job_-prefixed
    // 'job_ultimate_plan_required' (src/consts/response.py:17; zero bare emit sites).
    ultimate_plan_required: { plan: 'ultimate' },
    job_ultimate_plan_required: { plan: 'ultimate' },
    minimum_pro_plan_required: { plan: 'pro' },
    job_minimum_pro_plan_required: { plan: 'pro' },
    job_minimum_creator_plan_required: { plan: 'creator' },
    avatar_minimum_pro_plan_required: { plan: 'pro', feature: 'avatar' },
    minimum_basic_plan_required: { plan: 'basic' },
    job_minimum_basic_plan_required: { plan: 'basic' },
    train_minimum_basic_plan_required: { plan: 'basic', feature: 'train' },
};
const ERROR_TYPE_MAP = {
    not_enough_credits: d => new OutOfCreditsError(billingFrom(d)),
    rate_limit_reached: d => new RateLimitError({ ...billingFrom(d), maxCount: num(d.concurrent_jobs_limit), isUnlimited: d.use_unlim === true }),
    batch_rate_limit_reached: d => new BatchRateLimitError(num(d.concurrent_batches_limit)),
    beat_fit_rate_limit_reached: d => new BeatFitLimitError(num(d.concurrent_batches_limit)),
    // HTTP 429 — unlim-battery concurrent-batch quota; detail carries workspace/
    // plan_type/billing_period/concurrent_batches_limit (fnf-api src/exceptions/auth.py:145-170).
    unlim_battery_rate_limit_reached: d => new ApiJobError('unlim_battery_rate_limit_reached', 'Unlimited battery rate limit reached', { data: { ...billingFrom(d), concurrentBatchesLimit: num(d.concurrent_batches_limit) } }),
    // HTTP 429 — enterprise workspace group credit limit; detail { text, limit_amount,
    // period, spent_in_period, cost } (fnf-api src/exceptions/credit_limit.py:30-56).
    enterprise_group_credit_limit_reached: d => new ApiJobError('enterprise_group_credit_limit_reached', str(d.text) ?? 'Workspace group credit limit reached', { data: { limitAmount: num(d.limit_amount), period: str(d.period), spentInPeriod: num(d.spent_in_period), cost: num(d.cost) } }),
    workspace_subscription_inactive: d => new SharedTeamSubscriptionInactiveError(billingFrom(d)),
    workspace_member_spend_paused: d => new WorkspaceMemberSpendPausedError({
        workspaceId: str(d.workspace_id),
        userId: str(d.user_id),
        pausedAt: str(d.paused_at) ?? null,
        pausedByUserId: str(d.paused_by_user_id) ?? null,
    }),
    subscription_renewal_failed: () => new SubscriptionRenewalFailedError(),
    unlimited_generation_not_allowed: () => new UnlimitedGenerationNotAllowedError(),
    // HTTP 403, bare { error_type } (fnf-api src/exceptions/job.py:70-75).
    free_generation_not_allowed: () => new ApiJobError('free_generation_not_allowed', 'Free generation is not allowed for this request'),
    // HTTP 403, bare { error_type } (fnf-api src/exceptions/job.py:86-91).
    generation_not_available: () => new ApiJobError('generation_not_available', 'Generation is not available'),
    grace_daily_limit_reached: d => new GraceDailyLimitError(str(record(d.data)?.type) ?? 'unlock_full_access_notice', d.data),
    // 'nsfw' is the only emitted wire type — 400 submit sites (fnf-api
    // src/handlers/job.py:160 et al.) and 422 media sites with detail.text
    // 'Restricted content detected' (src/handlers/media.py:274-281).
    // 'prompt_nsfw' is never emitted by current fnf-api (zero sites) — kept as a
    // defensive alias only.
    nsfw: () => new PromptNsfwError(),
    prompt_nsfw: () => new PromptNsfwError(),
    // Defensive: current fnf-api never emits 'ip_detected' as an HTTP error_type
    // (zero sites — it exists only as a 2xx confirm-body status and a job status).
    // Kept for the legacy 422 error-body shape fnf-web still defends against
    // (image-api/video-api read detail.error_type at presign/confirm). Backend
    // message wins when present.
    ip_detected: d => new IpDetectedError(str(d.message) ?? str(d.text)),
    ip_check_rate_limit_reached: d => new IpCheckRateLimitError(str(d.message) ?? str(d.text)),
    // HTTP 413 — detail { error_type, max_size_mb } (fnf-api src/utils/media_size.py:16-22).
    media_too_large: d => new ApiJobError('media_too_large', 'Media is too large', { data: { maxSizeMb: num(d.max_size_mb) } }),
    // HTTP 408 — content (IP) check timed out, retryable; detail { error_type, text }
    // (fnf-api src/handlers/media.py:282-290).
    request_timeout: d => new ApiJobError('request_timeout', str(d.text) ?? 'Request timed out — please try again'),
    non_eligible_vpn_detected: () => new VpnDetectedError(),
    not_enough_boost_credits: () => new NotEnoughBoostCreditsError(),
    auto_top_up_suspended: d => new AutoTopUpSuspendedError(str(d.error_type) ?? 'auto_top_up_suspended'),
    auto_top_up_charge_failed: () => new AutoTopUpSuspendedError('auto_top_up_charge_failed'),
    account_suspended: () => new AccountSuspendedError('account_suspended'),
    account_blocked: () => new AccountSuspendedError('account_blocked'),
    job_in_progress: () => new JobInProgressError(),
    workspace_selection_required: d => new WorkspaceSelectionRequiredError(Array.isArray(d.workspaces) ? d.workspaces : []),
    other: d => new ApiMessageError(str(d.text) ?? 'Request failed'),
};
function errorType(body) {
    const d = detailObject(body);
    return typeof d?.error_type === 'string' ? d.error_type : undefined;
}
function validationMessage(body) {
    const detail = body.detail;
    if (Array.isArray(detail) && detail.length > 0) {
        const msg = detail[0].msg;
        if (typeof msg === 'string')
            return msg;
    }
    return 'Validation failed';
}
function errorFromResponse(status, body) {
    const error = mapResponse(status, body);
    // Most factories receive only the detail object — stamp the HTTP status so
    // retry/telemetry keyed on err.status works (preserves any hard-coded status).
    if (error && error.status == null)
        error.status = status;
    return error;
}
function mapResponse(status, body) {
    if (status >= 200 && status < 300)
        return null;
    const safe = (typeof body === 'object' && body !== null ? body : {});
    // A bare string `detail` is a server message.
    if (typeof safe.detail === 'string')
        return new ApiMessageError(safe.detail);
    const detail = detailObject(safe);
    if (detail?.message === 'KYB verification required')
        return new KybVerificationRequiredError();
    // Minimum-plan: many error_types collapse to one class (plan/feature in data).
    const type = errorType(safe);
    if (type && PLAN_TIERS[type])
        return new MinimumPlanError(PLAN_TIERS[type]);
    if (type && ERROR_TYPE_MAP[type])
        return ERROR_TYPE_MAP[type](detail ?? {});
    if (status === 422)
        return new ValidationError(validationMessage(safe), safe.detail);
    // No blanket 409 → JobInProgressError: 409 is also workspace_selection_required.
    // job_in_progress is reachable only via its error_type (see ERROR_TYPE_MAP);
    // an unrecognized 409 (or any other status) keeps its body for diagnosis.
    return new UnknownSubmitResponseError(status, body);
}
// ── JSON → typed error (rehydrate across a worker/Comlink boundary by `code`) ──
const CODE_TO_CLASS = {
    out_of_credits: j => new OutOfCreditsError(j.data),
    rate_limit: j => new RateLimitError(j.data),
    workspace_subscription_inactive: j => new SharedTeamSubscriptionInactiveError(j.data ?? {}),
    minimum_plan_required: j => new MinimumPlanError(j.data ?? {}),
    prompt_nsfw: () => new PromptNsfwError(),
    ip_detected: j => new IpDetectedError(j.message),
    ip_check_rate_limit_reached: j => new IpCheckRateLimitError(j.message),
    vpn_detected: () => new VpnDetectedError(),
    kyb_verification_required: () => new KybVerificationRequiredError(),
    not_enough_boost_credits: () => new NotEnoughBoostCreditsError(),
    subscription_renewal_failed: () => new SubscriptionRenewalFailedError(),
    job_in_progress: () => new JobInProgressError(),
    unlimited_generation_not_allowed: () => new UnlimitedGenerationNotAllowedError(),
    batch_rate_limit: j => new BatchRateLimitError(j.data?.concurrentBatchesLimit),
    beat_fit_limit: j => new BeatFitLimitError(j.data?.concurrentBatchesLimit),
    grace_daily_limit: j => new GraceDailyLimitError(j.data?.graceType, j.data?.graceData),
    auto_top_up_suspended: j => new AutoTopUpSuspendedError(j.data?.autoTopUpType ?? 'auto_top_up_suspended'),
    workspace_member_spend_paused: j => new WorkspaceMemberSpendPausedError(j.data ?? {}),
    account_suspended: j => new AccountSuspendedError(j.data?.suspendedCode ?? 'account_suspended'),
    workspace_selection_required: j => new WorkspaceSelectionRequiredError(j.data?.workspaces ?? []),
    api_message: j => new ApiMessageError(j.message),
    validation: j => new ValidationError(j.message, j.data?.issues),
    // 'unknown' must rehydrate to the class — UnknownSubmitResponseError.is()
    // has to keep working across a Comlink boundary, body and URL intact.
    unknown: j => new UnknownSubmitResponseError(j.status, j.data?.responseBody, j.data?.responseUrl),
    aborted: j => new JobAbortedError(j.message),
    confirmation_rejected: j => new ConfirmationRejectedError(j.message),
    timeout: (j) => {
        // Preserve the serialized message — the constructor would otherwise rebuild
        // it as "within 0ms" (the original timeoutMs isn't carried in the payload).
        const e = new JobTimeoutError(j.data?.generation?.id ?? 'unknown', 0, j.data?.generation);
        if (j.message)
            e.message = j.message;
        return e;
    },
};
/**
 * Register a rehydrator for an error code. Used by the media half (and custom
 * error subclasses) so `errorFromJSON` restores `instanceof`/`.is()` identity
 * without a circular import into this module.
 */
function registerErrorCode(code, make) {
    CODE_TO_CLASS[code] = make;
}
function errorFromJSON(json) {
    const make = CODE_TO_CLASS[json.code];
    const error = make ? make(json) : new ApiJobError(json.code, json.message, { status: json.status, data: json.data });
    // Factories rebuild from `data` and may drop the serialized status — restore it.
    if (error.status == null && json.status != null)
        error.status = json.status;
    return error;
}
//# sourceMappingURL=errors.js.map