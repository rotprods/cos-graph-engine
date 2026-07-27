"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowPlatformAdapter = createWorkflowPlatformAdapter;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const fetch_transport_1 = require("./fetch-transport");
const job_response_normalize_1 = require("./job-response-normalize");
/**
 * Workflow Platform adapter.
 *
 * The SDK keeps doing typed validation and param serialization, then sends
 * static WFP routes. WFP owns final fnf.internal route selection and
 * product-specific request-body quirks. This adapter intentionally stays under:
 * `/user`, `/workspaces/*`, and `/jobs/*`.
 */
function createWorkflowPlatformAdapter(options = {}) {
    if (!options.transport && !options.baseUrl)
        throw new Error('createWorkflowPlatformAdapter requires `baseUrl` or an explicit `transport`');
    const baseTransport = options.transport ?? (0, fetch_transport_1.createFetchTransport)({
        baseUrl: (options.baseUrl ?? '').replace(/\/$/, ''),
        headers: async () => cleanHeaders({
            ...(await authorizationHeader(options.getToken)),
            ...(await optionalNamedHeader('hf-user-id', options.userId)),
            ...(await optionalNamedHeader('hf-workspace-id', options.workspaceId)),
            ...(await optionalNamedHeader('hf-app-id', options.appId)),
        }),
        fetch: options.fetch,
    });
    const transport = options.observability ? (0, observability_1.withObservedTransport)(baseTransport, options.observability) : baseTransport;
    async function send(method, path, body) {
        let res;
        try {
            res = await transport({ method, path, body });
        }
        catch (err) {
            if (err instanceof errors_1.ApiJobError)
                throw err;
            throw new errors_1.ApiJobError('network', `Network error: ${err instanceof Error ? err.message : String(err)}`);
        }
        const normalized = unwrapData(res.body);
        const error = (0, errors_1.errorFromResponse)(res.status, normalized);
        if (error)
            throw error;
        return normalized;
    }
    return {
        // ── jobs ──
        ...(options.confirm ? { confirm: options.confirm } : {}),
        createJobs: ({ jobSetType, params, confirmationToken }) => send('POST', '/jobs/submit', {
            job_set_type: jobSetType,
            params,
            ...(confirmationToken !== undefined ? { confirmation_token: confirmationToken } : {}),
        }),
        getJob: async (id) => normalizeJobReadBody(await send('GET', `/jobs/${encodeURIComponent(id)}`)),
        getJobSet: async (id) => (0, job_response_normalize_1.normalizeJobSetBody)(await send('GET', `/jobs/sets/${encodeURIComponent(id)}`)),
        async listJobs(query) {
            if (query.parentId !== undefined)
                throw new errors_1.ApiJobError('not_supported', 'GET /jobs has no parent filter - the Workflow Platform feed cannot list a job set\'s children (parentId)');
            return (0, job_response_normalize_1.normalizeJobListBody)(await send('GET', jobsFeedPath(query)));
        },
        estimateCost: ({ jobSetType, params }) => send('POST', '/jobs/cost', {
            job_set_type: jobSetType,
            params,
        }),
        cancelJob: id => send('POST', `/jobs/${encodeURIComponent(id)}/cancel`),
        // ── media through WFP /jobs static routes ──
        getMedia: query => send('GET', mediaGetPath(query)),
        listMedia: query => send('GET', mediaListPath(query)),
        getUploadUrl: req => send('POST', '/jobs/media/presign', mediaPresignBody(req)),
        confirmMedia: req => send('POST', `/jobs/media/${encodeURIComponent(req.mediaId)}/confirm`, mediaConfirmBody(req)),
        // ── profile ──
        getUser: () => send('GET', '/user'),
        listWorkspaces: () => send('GET', '/workspaces'),
        getCurrentWorkspace: () => send('GET', '/workspaces/current'),
        getWorkspaceWallet: () => send('GET', '/workspaces/wallet'),
        switchWorkspace: (req) => send('POST', '/workspaces/switch', {
            workspace_id: req.workspaceId,
        }),
    };
}
async function authorizationHeader(getToken) {
    const token = await getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
async function optionalNamedHeader(name, source) {
    const value = typeof source === 'function' ? await source() : source;
    return typeof value === 'string' && value.trim() !== '' ? { [name]: value } : {};
}
function cleanHeaders(headers) {
    const out = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value)
            out[key] = value;
    }
    return out;
}
function unwrapData(body) {
    if (isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'data'))
        return body.data;
    return body;
}
function normalizeJobReadBody(body) {
    if (isRecord(body) && isRecord(body.job))
        return (0, job_response_normalize_1.normalizeJobLike)(body.job, body.job_set);
    if (isRecord(body))
        return (0, job_response_normalize_1.normalizeJobLike)(body);
    return body;
}
function jobsFeedPath(query) {
    const search = new URLSearchParams();
    append(search, 'gen_type', query.type);
    append(search, 'cursor', query.cursor);
    append(search, 'size', query.size);
    appendMany(search, 'status', query.status);
    appendMany(search, 'job_set_type', query.model);
    const qs = search.toString();
    return qs ? `/jobs?${qs}` : '/jobs';
}
function mediaGetPath(query) {
    return pathWithQuery(`/jobs/media/${encodeURIComponent(query.id)}`, {
        type: query.type,
    });
}
function mediaListPath(query) {
    return pathWithQuery('/jobs/media', {
        type: query.type,
        cursor: query.cursor,
        size: query.size,
    });
}
function mediaPresignBody(req) {
    return cleanBody({
        type: req.type,
        filename: req.filename,
        content_type: req.contentType,
        extra: req.extra,
    });
}
function mediaConfirmBody(req) {
    return cleanBody({
        type: req.type,
        filename: req.filename,
        job_id: req.jobId,
        force_ip_check: req.forceIpCheck,
        force_nsfw_check: req.forceNsfwCheck,
        start_seconds: req.startSeconds,
        end_seconds: req.endSeconds,
        extra: req.extra,
    });
}
function pathWithQuery(path, query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
        append(search, key, value);
    const qs = search.toString();
    return qs ? `${path}?${qs}` : path;
}
function append(search, key, value) {
    if (value !== undefined)
        search.append(key, String(value));
}
function appendMany(search, key, value) {
    if (Array.isArray(value)) {
        for (const item of value)
            search.append(key, item);
        return;
    }
    if (value !== undefined)
        search.append(key, value);
}
function cleanBody(body) {
    const out = {};
    for (const [key, value] of Object.entries(body)) {
        if (value !== undefined)
            out[key] = value;
    }
    return out;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=workflow-platform-adapter.js.map