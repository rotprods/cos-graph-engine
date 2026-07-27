"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGenerations = listGenerations;
const observability_1 = require("../observability");
const spec_1 = require("../spec");
async function listGenerations(ctx, opts = {}) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.list', {
        ...(opts.type ? { type: opts.type } : {}),
        ...(opts.size !== undefined ? { size: opts.size } : {}),
        ...(opts.cursor !== undefined ? { has_cursor: true } : {}),
        ...(opts.parentId ? { parent_id: opts.parentId } : {}),
        ...(opts.model !== undefined ? { model_count: Array.isArray(opts.model) ? opts.model.length : 1 } : {}),
        ...(opts.status !== undefined ? { status_count: Array.isArray(opts.status) ? opts.status.length : 1 } : {}),
    }, async () => {
        const body = (await ctx.adapter.listJobs(opts) ?? {});
        const items = (body.items ?? body.jobs ?? []).map(item => parseListItem(ctx, item, opts.type));
        const cursor = body.next_cursor ?? body.cursor ?? undefined;
        return { items, ...(cursor != null ? { cursor } : {}) };
    }, {
        successAttributes: result => ({ item_count: result.items.length, has_cursor: result.cursor !== undefined }),
    });
}
function parseListItem(ctx, item, fallbackType) {
    const entry = item.job_set_type ? ctx.registry.get(item.job_set_type) : undefined;
    if (entry) {
        return (0, spec_1.parseGeneration)({
            id: item.id,
            job_set_id: item.job_set_id,
            job_set_parent_id: item.job_set_parent_id,
            status: item.status ?? 'pending',
            result_url: item.result_url,
            min_result_url: item.min_result_url,
            thumbnail_url: item.thumbnail_url,
            params: item.params,
            created_at: item.created_at,
            fail_reason: item.fail_reason,
        }, entry);
    }
    // Unregistered job type: keep raw params in `extra` so nothing is dropped.
    const completed = item.status === 'completed' && Boolean(item.result_url);
    const results = completed ? buildUnknownListResults(item, fallbackType) : undefined;
    return {
        id: item.id,
        ...(item.job_set_id ? { jobSetId: item.job_set_id } : {}),
        ...(item.job_set_parent_id ? { parentJobSetId: item.job_set_parent_id } : {}),
        model: item.job_set_type ?? 'unknown',
        type: fallbackType ?? 'image',
        status: (item.status ?? 'pending'),
        input: { model: item.job_set_type ?? 'unknown', settings: {}, ...(item.params ? { extra: item.params } : {}) },
        ...(results ? { results } : {}),
        ...(item.fail_reason ? { failReason: item.fail_reason } : {}),
        ...(item.created_at !== undefined ? { createdAt: item.created_at } : {}),
    };
}
function buildUnknownListResults(item, fallbackType) {
    const results = { rawUrl: item.result_url };
    if (fallbackType === 'video') {
        if (item.thumbnail_url || item.min_result_url)
            results.thumbnailUrl = item.thumbnail_url ?? item.min_result_url ?? undefined;
        return results;
    }
    if (item.min_result_url)
        results.minUrl = item.min_result_url;
    else if (item.thumbnail_url)
        results.thumbnailUrl = item.thumbnail_url;
    return results;
}
//# sourceMappingURL=list.js.map