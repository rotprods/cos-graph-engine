"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const errors_1 = require("../errors");
const errors_2 = require("../media/errors");
(0, vitest_1.describe)('errorFromResponse', () => {
    (0, vitest_1.it)('returns null for a successful response', () => {
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(200, { ok: true })).toBeNull();
    });
    (0, vitest_1.it)('maps not_enough_credits to OutOfCreditsError carrying the real HTTP status', () => {
        // Both backend not_enough_credits sites emit HTTP 403 (fnf-api
        // src/exceptions/auth.py:71-88, src/exceptions/workspace.py:267-290) —
        // the class must not pin 402 over it.
        const err = (0, errors_1.errorFromResponse)(403, {
            detail: { error_type: 'not_enough_credits', plan_type: 'pro', billing_period: 'monthly', workspace: { type: 'shared', role: 'owner' } },
        });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.OutOfCreditsError);
        (0, vitest_1.expect)(err?.code).toBe('out_of_credits');
        (0, vitest_1.expect)(err?.status).toBe(403);
        (0, vitest_1.expect)(err.data).toEqual({ plan: 'pro', billingPeriod: 'monthly', team: { workspaceType: 'Shared', userRole: 'Owner' } });
        // the stamped status survives a toJSON round-trip
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
        (0, vitest_1.expect)(round).toBeInstanceOf(errors_1.OutOfCreditsError);
        (0, vitest_1.expect)(round.status).toBe(403);
    });
    (0, vitest_1.it)('lowercases plan_type before casting (shared workspaces send "Team")', () => {
        // fnf-api src/exceptions/workspace.py:260,287 send TeamPlanFactory.team().name = 'Team'
        // (src/types_/team_subscription.py:149-153) — outside the lowercase union as-is.
        const err = (0, errors_1.errorFromResponse)(403, {
            detail: { error_type: 'not_enough_credits', plan_type: 'Team', billing_period: 'monthly', workspace: { type: 'shared', role: 'member' } },
        });
        (0, vitest_1.expect)(err.data?.plan).toBe('team');
    });
    (0, vitest_1.it)('maps rate_limit_reached with maxCount + isUnlimited', () => {
        const err = (0, errors_1.errorFromResponse)(429, { detail: { error_type: 'rate_limit_reached', plan_type: 'basic', concurrent_jobs_limit: 3, use_unlim: true } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.RateLimitError);
        (0, vitest_1.expect)(err.data).toMatchObject({ plan: 'basic', maxCount: 3, isUnlimited: true });
    });
    (0, vitest_1.it)('maps both nsfw (real wire type) and prompt_nsfw (alias) to PromptNsfwError', () => {
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(400, { detail: { error_type: 'nsfw' } })).toBeInstanceOf(errors_1.PromptNsfwError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(400, { detail: { error_type: 'prompt_nsfw' } })).toBeInstanceOf(errors_1.PromptNsfwError);
    });
    (0, vitest_1.it)('maps the 422 ip_detected error-body shape to IpDetectedError (not the ValidationError fallback)', () => {
        const err = (0, errors_1.errorFromResponse)(422, { detail: { error_type: 'ip_detected' } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.IpDetectedError);
        (0, vitest_1.expect)(err?.code).toBe('ip_detected');
        (0, vitest_1.expect)(err?.status).toBe(422);
        (0, vitest_1.expect)(err?.message).toBe('Protected content is not allowed');
        // the backend's message wins when present
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(422, { detail: { error_type: 'ip_detected', message: 'IP found in media' } })?.message).toBe('IP found in media');
    });
    (0, vitest_1.it)('maps ip_check_rate_limit_reached (presign/confirm) to IpCheckRateLimitError', () => {
        const err = (0, errors_1.errorFromResponse)(422, { detail: { error_type: 'ip_check_rate_limit_reached' } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.IpCheckRateLimitError);
        (0, vitest_1.expect)(err?.code).toBe('ip_check_rate_limit_reached');
        (0, vitest_1.expect)(err?.message).toMatch(/eligibility check limit/);
    });
    (0, vitest_1.it)('collapses the minimum-plan error_types into MinimumPlanError with plan/feature in data', () => {
        // Plans are the backend-named (legacy) values, matching the product's
        // native mapping (fnf-web src/entities/job/error/plan.ts).
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'ultimate_plan_required' } }).data).toEqual({ plan: 'ultimate' });
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'job_minimum_pro_plan_required' } }).data).toEqual({ plan: 'pro' });
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'avatar_minimum_pro_plan_required' } }).data).toEqual({ plan: 'pro', feature: 'avatar' });
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'job_minimum_creator_plan_required' } }).data).toEqual({ plan: 'creator' });
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'train_minimum_basic_plan_required' } }).data).toEqual({ plan: 'basic', feature: 'train' });
    });
    (0, vitest_1.it)('maps the remaining typed billing/plan error_types', () => {
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'non_eligible_vpn_detected' } })).toBeInstanceOf(errors_1.VpnDetectedError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'not_enough_boost_credits' } })).toBeInstanceOf(errors_1.NotEnoughBoostCreditsError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'batch_rate_limit_reached', concurrent_batches_limit: 2 } })).toBeInstanceOf(errors_1.BatchRateLimitError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'auto_top_up_suspended' } })).toBeInstanceOf(errors_1.AutoTopUpSuspendedError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'grace_daily_limit_reached', data: { type: 'pay_less_notice' } } })).toBeInstanceOf(errors_1.GraceDailyLimitError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'workspace_member_spend_paused', workspace_id: 'w1', user_id: 'u1' } })).toBeInstanceOf(errors_1.WorkspaceMemberSpendPausedError);
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: 'account_blocked' } })).toBeInstanceOf(errors_1.AccountSuspendedError);
    });
    (0, vitest_1.it)('maps media_too_large to a base ApiJobError keeping status 413 and maxSizeMb', () => {
        // fnf-api src/utils/media_size.py:16-22 — HTTP 413, detail { error_type, max_size_mb }.
        const err = (0, errors_1.errorFromResponse)(413, { detail: { error_type: 'media_too_large', max_size_mb: 50 } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiJobError);
        (0, vitest_1.expect)(err?.code).toBe('media_too_large');
        (0, vitest_1.expect)(err?.status).toBe(413);
        (0, vitest_1.expect)(err?.data).toEqual({ maxSizeMb: 50 });
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
        (0, vitest_1.expect)(round.code).toBe('media_too_large');
        (0, vitest_1.expect)(round.status).toBe(413);
        (0, vitest_1.expect)(round.data).toEqual({ maxSizeMb: 50 });
    });
    (0, vitest_1.it)('maps request_timeout (content-check timeout) with the backend text as message', () => {
        // fnf-api src/handlers/media.py:282-290 — HTTP 408, detail { error_type, text }.
        const text = 'Content check is taking longer than expected. Please try again in a moment.';
        const err = (0, errors_1.errorFromResponse)(408, { detail: { error_type: 'request_timeout', text } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiJobError);
        (0, vitest_1.expect)(err?.code).toBe('request_timeout');
        (0, vitest_1.expect)(err?.status).toBe(408);
        (0, vitest_1.expect)(err?.message).toBe(text);
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
        (0, vitest_1.expect)(round.code).toBe('request_timeout');
        (0, vitest_1.expect)(round.message).toBe(text);
    });
    (0, vitest_1.it)('maps unlim_battery_rate_limit_reached with billing context + concurrentBatchesLimit', () => {
        // fnf-api src/exceptions/auth.py:145-170 — HTTP 429, detail carries
        // workspace/plan_type/billing_period/concurrent_batches_limit.
        const err = (0, errors_1.errorFromResponse)(429, {
            detail: { error_type: 'unlim_battery_rate_limit_reached', plan_type: 'Team', billing_period: 'monthly', workspace: { type: 'shared', role: 'member' }, concurrent_batches_limit: 4 },
        });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiJobError);
        (0, vitest_1.expect)(err?.code).toBe('unlim_battery_rate_limit_reached');
        (0, vitest_1.expect)(err?.status).toBe(429);
        (0, vitest_1.expect)(err?.data).toEqual({ plan: 'team', billingPeriod: 'monthly', team: { workspaceType: 'Shared', userRole: 'Member' }, concurrentBatchesLimit: 4 });
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
        (0, vitest_1.expect)(round.code).toBe('unlim_battery_rate_limit_reached');
        (0, vitest_1.expect)(round.data).toEqual(err?.data);
    });
    (0, vitest_1.it)('maps enterprise_group_credit_limit_reached with text + camelCased limit fields', () => {
        // fnf-api src/exceptions/credit_limit.py:30-56 — HTTP 429,
        // detail { text, limit_amount, period, spent_in_period, cost }.
        const text = 'You\'ve reached your weekly workspace group credit limit. Ask your workspace admin to increase the group limit or wait until it resets.';
        const err = (0, errors_1.errorFromResponse)(429, {
            detail: { error_type: 'enterprise_group_credit_limit_reached', text, limit_amount: 1000, period: 'every_week', spent_in_period: 990, cost: 20 },
        });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiJobError);
        (0, vitest_1.expect)(err?.code).toBe('enterprise_group_credit_limit_reached');
        (0, vitest_1.expect)(err?.status).toBe(429);
        (0, vitest_1.expect)(err?.message).toBe(text);
        (0, vitest_1.expect)(err?.data).toEqual({ limitAmount: 1000, period: 'every_week', spentInPeriod: 990, cost: 20 });
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
        (0, vitest_1.expect)(round.code).toBe('enterprise_group_credit_limit_reached');
        (0, vitest_1.expect)(round.message).toBe(text);
        (0, vitest_1.expect)(round.data).toEqual(err?.data);
    });
    (0, vitest_1.it)('maps the bare 403 gate codes to base ApiJobErrors preserving the wire code', () => {
        // fnf-api src/exceptions/job.py:70-75 and :86-91 — HTTP 403, bare { error_type }.
        for (const code of ['free_generation_not_allowed', 'generation_not_available']) {
            const err = (0, errors_1.errorFromResponse)(403, { detail: { error_type: code } });
            (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiJobError);
            (0, vitest_1.expect)(err?.code).toBe(code);
            (0, vitest_1.expect)(err?.status).toBe(403);
            const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(err.toJSON())));
            (0, vitest_1.expect)(round.code).toBe(code);
            (0, vitest_1.expect)(round.status).toBe(403);
            (0, vitest_1.expect)(round.message).toBe(err?.message);
        }
    });
    (0, vitest_1.it)('matches KYB by detail.message', () => {
        (0, vitest_1.expect)((0, errors_1.errorFromResponse)(403, { detail: { message: 'KYB verification required' } })).toBeInstanceOf(errors_1.KybVerificationRequiredError);
    });
    (0, vitest_1.it)('maps 409 workspace_selection_required, carrying workspaces in data', () => {
        const err = (0, errors_1.errorFromResponse)(409, { detail: { error_type: 'workspace_selection_required', workspaces: [{ id: 'w1', name: null, type: 'private' }] } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.WorkspaceSelectionRequiredError);
        (0, vitest_1.expect)(err.data?.workspaces).toEqual([{ id: 'w1', name: null, type: 'private' }]);
    });
    (0, vitest_1.it)('maps 409 job_in_progress (by error_type) to JobInProgressError', () => {
        const err = (0, errors_1.errorFromResponse)(409, { detail: { error_type: 'job_in_progress' } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.JobInProgressError);
        (0, vitest_1.expect)(err?.status).toBe(409);
    });
    (0, vitest_1.it)('maps a bare 409 (no error_type) to UnknownSubmitResponseError, not JobInProgressError', () => {
        const err = (0, errors_1.errorFromResponse)(409, { some: 'body' });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.UnknownSubmitResponseError);
        (0, vitest_1.expect)(err?.status).toBe(409);
        (0, vitest_1.expect)(err.data?.responseBody).toEqual({ some: 'body' });
    });
    (0, vitest_1.it)('maps 422 to ValidationError with the first detail message', () => {
        const err = (0, errors_1.errorFromResponse)(422, { detail: [{ msg: 'prompt too long' }] });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ValidationError);
        (0, vitest_1.expect)(err?.message).toBe('prompt too long');
        (0, vitest_1.expect)(err?.status).toBe(422);
    });
    (0, vitest_1.it)('maps a string detail to ApiMessageError', () => {
        const err = (0, errors_1.errorFromResponse)(400, { detail: 'something went wrong' });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.ApiMessageError);
        (0, vitest_1.expect)(err?.message).toBe('something went wrong');
    });
    (0, vitest_1.it)('falls back to UnknownSubmitResponseError (code unknown) for unmapped failures', () => {
        const err = (0, errors_1.errorFromResponse)(500, { detail: { weird: true } });
        (0, vitest_1.expect)(err).toBeInstanceOf(errors_1.UnknownSubmitResponseError);
        (0, vitest_1.expect)(err?.code).toBe('unknown');
        (0, vitest_1.expect)(err?.status).toBe(500);
    });
    (0, vitest_1.it)('every produced error is a ApiJobError', () => {
        for (const type of ['not_enough_credits', 'rate_limit_reached', 'nsfw', 'non_eligible_vpn_detected', 'workspace_selection_required']) {
            (0, vitest_1.expect)((0, errors_1.errorFromResponse)(402, { detail: { error_type: type } })).toBeInstanceOf(errors_1.ApiJobError);
        }
    });
});
(0, vitest_1.describe)('toJSON + errorFromJSON round-trip', () => {
    (0, vitest_1.it)('emits a uniform { code, message, status?, data? } shape', () => {
        // No pinned status — OutOfCreditsError carries whatever errorFromResponse
        // stamped (the backend emits 403; the class itself stays status-agnostic).
        const err = new errors_1.OutOfCreditsError({ plan: 'pro', billingPeriod: 'monthly' });
        (0, vitest_1.expect)(err.toJSON()).toEqual({ code: 'out_of_credits', message: 'Not enough credits', data: { plan: 'pro', billingPeriod: 'monthly' } });
    });
    (0, vitest_1.it)('rehydrates the right class + data from JSON (survives a Comlink boundary)', () => {
        const cases = [
            new errors_1.OutOfCreditsError({ plan: 'pro', team: { workspaceType: 'Shared', userRole: 'Member' } }),
            new errors_1.RateLimitError({ plan: 'basic', maxCount: 5, isUnlimited: false }),
            new errors_1.MinimumPlanError({ plan: 'plus', feature: 'avatar' }),
            new errors_1.BatchRateLimitError(4),
            new errors_1.AccountSuspendedError('account_blocked'),
            new errors_1.VpnDetectedError(),
            new errors_1.WorkspaceSelectionRequiredError([{ id: 'w1', name: 'Team', type: 'shared' }]),
        ];
        for (const original of cases) {
            const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(original.toJSON())));
            (0, vitest_1.expect)(round).toBeInstanceOf(original.constructor);
            (0, vitest_1.expect)(round.code).toBe(original.code);
            (0, vitest_1.expect)(round.data).toEqual(original.data);
        }
    });
    (0, vitest_1.it)('rehydrates ip_detected and ip_check_rate_limit_reached, preserving the message', () => {
        const ip = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(new errors_1.IpDetectedError('IP found in media').toJSON())));
        (0, vitest_1.expect)(ip).toBeInstanceOf(errors_1.IpDetectedError);
        (0, vitest_1.expect)(ip.code).toBe('ip_detected');
        (0, vitest_1.expect)(ip.message).toBe('IP found in media');
        const limit = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(new errors_1.IpCheckRateLimitError().toJSON())));
        (0, vitest_1.expect)(limit).toBeInstanceOf(errors_1.IpCheckRateLimitError);
        (0, vitest_1.expect)(limit.code).toBe('ip_check_rate_limit_reached');
        (0, vitest_1.expect)(limit.message).toMatch(/eligibility check limit/);
    });
    (0, vitest_1.it)('rehydrates code unknown to UnknownSubmitResponseError with status/body/url intact', () => {
        const original = new errors_1.UnknownSubmitResponseError(500, { weird: true }, 'https://api/jobs/demo');
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(original.toJSON())));
        (0, vitest_1.expect)(errors_1.UnknownSubmitResponseError.is(round)).toBe(true); // .is() works again after the round-trip
        (0, vitest_1.expect)(round.status).toBe(500);
        (0, vitest_1.expect)(round.data?.responseBody).toEqual({ weird: true });
        (0, vitest_1.expect)(round.data?.responseUrl).toBe('https://api/jobs/demo');
    });
    (0, vitest_1.it)('rehydrates an unknown code to a generic ApiJobError', () => {
        const round = (0, errors_1.errorFromJSON)({ code: 'some_future_code', message: 'hi', data: { x: 1 } });
        (0, vitest_1.expect)(round).toBeInstanceOf(errors_1.ApiJobError);
        (0, vitest_1.expect)(round.code).toBe('some_future_code');
        (0, vitest_1.expect)(round.data).toEqual({ x: 1 });
    });
    (0, vitest_1.it)('rehydrates the client-lifecycle codes, preserving the timeout message and generation', () => {
        const aborted = (0, errors_1.errorFromJSON)(new errors_1.JobAbortedError().toJSON());
        (0, vitest_1.expect)(aborted).toBeInstanceOf(errors_1.JobAbortedError);
        const gen = { id: 'j1', model: 'demo', type: 'image', status: 'in_progress', input: { model: 'demo', settings: {} } };
        const original = new errors_1.JobTimeoutError('j1', 60_000, gen);
        const round = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(original.toJSON())));
        (0, vitest_1.expect)(round).toBeInstanceOf(errors_1.JobTimeoutError);
        (0, vitest_1.expect)(round.message).toBe(original.message); // not rebuilt as "within 0ms"
        (0, vitest_1.expect)(round.data?.generation?.id).toBe('j1');
    });
    (0, vitest_1.it)('rehydrates media-pipeline errors to their classes (registered from the media half)', () => {
        const moderation = (0, errors_1.errorFromJSON)(JSON.parse(JSON.stringify(new errors_2.MediaModerationError('nsfw').toJSON())));
        (0, vitest_1.expect)(moderation).toBeInstanceOf(errors_2.MediaModerationError);
        (0, vitest_1.expect)(moderation.code).toBe('media_moderation_blocked');
        (0, vitest_1.expect)(moderation.data?.status).toBe('nsfw');
        const transfer = (0, errors_1.errorFromJSON)(new errors_2.UploadTransferError('Upload failed (503)', 503).toJSON());
        (0, vitest_1.expect)(transfer).toBeInstanceOf(errors_2.UploadTransferError);
        (0, vitest_1.expect)(transfer.status).toBe(503);
    });
    (0, vitest_1.it)('does not crash on a data-less payload for any registered code', () => {
        // A different SDK version (or hand-built payload) may legitimately omit data.
        for (const code of ['minimum_plan_required', 'out_of_credits', 'rate_limit', 'workspace_subscription_inactive']) {
            (0, vitest_1.expect)(() => (0, errors_1.errorFromJSON)({ code, message: 'x' })).not.toThrow();
        }
    });
    (0, vitest_1.it)('preserves the serialized status when the factory drops it', () => {
        const round = (0, errors_1.errorFromJSON)({ code: 'rate_limit', message: 'x', status: 429 });
        (0, vitest_1.expect)(round.status).toBe(429);
    });
});
(0, vitest_1.describe)('errorFromResponse stamps the HTTP status', () => {
    (0, vitest_1.it)('mapped errors without a hard-coded status carry the response status', () => {
        const err = (0, errors_1.errorFromResponse)(429, { detail: { error_type: 'rate_limit_reached' } });
        (0, vitest_1.expect)(err?.code).toBe('rate_limit');
        (0, vitest_1.expect)(err?.status).toBe(429);
        const auth = (0, errors_1.errorFromResponse)(401, { detail: 'Not authenticated' });
        (0, vitest_1.expect)(auth?.code).toBe('api_message');
        (0, vitest_1.expect)(auth?.status).toBe(401);
    });
    (0, vitest_1.it)('keeps the deliberately hard-coded statuses', () => {
        const err = (0, errors_1.errorFromResponse)(400, { detail: { error_type: 'job_in_progress' } });
        (0, vitest_1.expect)(err?.status).toBe(409); // JobInProgressError pins 409
    });
    (0, vitest_1.it)('stamps the real status on out_of_credits instead of a pinned 402', () => {
        // Backend emits 403 at both not_enough_credits sites (fnf-api
        // src/exceptions/auth.py:71-88, src/exceptions/workspace.py:267-290).
        const err = (0, errors_1.errorFromResponse)(403, { detail: { error_type: 'not_enough_credits' } });
        (0, vitest_1.expect)(err?.status).toBe(403);
    });
});
(0, vitest_1.describe)('.is() type-guard sugar', () => {
    const oc = new errors_1.OutOfCreditsError({ plan: 'pro' });
    (0, vitest_1.it)('narrows by leaf, mid-tier, and base', () => {
        (0, vitest_1.expect)(errors_1.OutOfCreditsError.is(oc)).toBe(true);
        (0, vitest_1.expect)(errors_1.RateLimitError.is(oc)).toBe(false);
        (0, vitest_1.expect)(errors_1.BillingError.is(oc)).toBe(true); // mid-tier groups all billing errors
        (0, vitest_1.expect)(errors_1.ApiJobError.is(oc)).toBe(true);
    });
    (0, vitest_1.it)('returns false for non-errors and plain JSON', () => {
        (0, vitest_1.expect)(errors_1.OutOfCreditsError.is(new Error('x'))).toBe(false);
        (0, vitest_1.expect)(errors_1.OutOfCreditsError.is(oc.toJSON())).toBe(false); // serialized form is not an instance
        (0, vitest_1.expect)(errors_1.ApiJobError.is(undefined)).toBe(false);
    });
});
//# sourceMappingURL=errors.test.js.map