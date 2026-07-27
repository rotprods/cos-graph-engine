"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNoopObserver = createNoopObserver;
exports.composeObservers = composeObservers;
exports.createConsoleObserver = createConsoleObserver;
exports.createObservabilityContext = createObservabilityContext;
exports.observeEvent = observeEvent;
exports.observeAsync = observeAsync;
exports.withObservedTransport = withObservedTransport;
exports.withObservedGenerationBackend = withObservedGenerationBackend;
exports.withObservedMediaBackend = withObservedMediaBackend;
exports.withObservedProfileBackend = withObservedProfileBackend;
exports.withObservedUploader = withObservedUploader;
const errors_1 = require("../errors");
let fallbackSeq = 0;
function createNoopObserver() {
    return () => { };
}
function composeObservers(...observers) {
    const live = observers.filter(Boolean);
    return (event) => {
        for (const observer of live) {
            const result = observer(event);
            if (isPromiseLike(result))
                void result.catch(() => { });
        }
    };
}
function createConsoleObserver(consoleLike = console) {
    return (event) => {
        const log = event.phase === 'error' ? consoleLike.error : consoleLike.debug;
        log.call(consoleLike, `[${event.name}] ${event.phase}`, event);
    };
}
function createObservabilityContext(options) {
    const idFactory = options?.idFactory ?? defaultId;
    return {
        ...(options?.observer ? { observer: options.observer } : {}),
        traceId: options?.traceId ?? idFactory(),
        ...(options?.parentId ? { parentId: options.parentId } : {}),
        attributes: () => normalizeAttributes(typeof options?.attributes === 'function'
            ? safeReadAttributes(options.attributes)
            : options?.attributes),
        ...(options?.onObserverError ? { onObserverError: options.onObserverError } : {}),
        now: options?.now ?? Date.now,
        idFactory,
    };
}
function observeEvent(ctx, name, attributes = {}, options = {}) {
    const obs = asContext(ctx);
    if (!obs.observer)
        return;
    const event = makeEvent(obs, {
        name,
        phase: options.phase ?? 'event',
        attributes,
        ...(options.parentId ? { parentId: options.parentId } : {}),
        ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
        ...(options.error !== undefined ? { error: errorInfo(options.error) } : {}),
    });
    emit(obs, event);
}
async function observeAsync(ctx, name, attributes, fn, options = {}) {
    const obs = asContext(ctx);
    if (!obs.observer)
        return fn();
    const id = obs.idFactory();
    const startedAt = obs.now();
    const base = { ...attributes, ...options.attributes };
    emit(obs, makeEvent(obs, {
        id,
        name,
        phase: 'start',
        attributes: base,
        ...(options.parentId ? { parentId: options.parentId } : {}),
    }));
    try {
        const result = await fn();
        emit(obs, makeEvent(obs, {
            id,
            name,
            phase: 'success',
            durationMs: Math.max(0, obs.now() - startedAt),
            attributes: { ...base, ...safeReadAttributes(() => options.successAttributes?.(result) ?? {}) },
            ...(options.parentId ? { parentId: options.parentId } : {}),
        }));
        return result;
    }
    catch (error) {
        emit(obs, makeEvent(obs, {
            id,
            name,
            phase: 'error',
            durationMs: Math.max(0, obs.now() - startedAt),
            attributes: { ...base, ...safeReadAttributes(() => options.errorAttributes?.(error) ?? {}) },
            error: errorInfo(error),
            ...(options.parentId ? { parentId: options.parentId } : {}),
        }));
        throw error;
    }
}
function withObservedTransport(transport, observability) {
    const ctx = asContext(observability);
    return req => observeAsync(ctx, 'fnf.transport.request', {
        method: req.method,
        path: sanitizePath(req.path),
    }, () => transport(req), {
        successAttributes: res => ({ status: res.status }),
        errorAttributes: (error) => {
            const info = errorInfo(error);
            return {
                ...(info.status !== undefined ? { status: info.status } : {}),
                error_code: info.code,
            };
        },
    });
}
function withObservedGenerationBackend(backend, observability) {
    const ctx = asContext(observability);
    return {
        createJobs: req => observeAsync(ctx, 'fnf.backend.generation.create_jobs', { job_set_type: req.jobSetType }, () => backend.createJobs(req)),
        getJob: id => observeAsync(ctx, 'fnf.backend.generation.get_job', { generation_id: id }, () => backend.getJob(id)),
        ...(backend.getJobSet ? { getJobSet: id => observeAsync(ctx, 'fnf.backend.generation.get_job_set', { job_set_id: id }, () => backend.getJobSet(id)) } : {}),
        listJobs: query => observeAsync(ctx, 'fnf.backend.generation.list_jobs', listQueryAttributes(query), () => backend.listJobs(query)),
        estimateCost: req => observeAsync(ctx, 'fnf.backend.generation.estimate_cost', { job_set_type: req.jobSetType }, () => backend.estimateCost(req)),
        ...(backend.cancelJob ? { cancelJob: id => observeAsync(ctx, 'fnf.backend.generation.cancel_job', { generation_id: id }, () => backend.cancelJob(id)) } : {}),
        // Attributes carry the job type only — never the params or the resolved
        // confirmation token (privacy rule: tokens don't go into observability).
        ...(backend.confirm ? { confirm: req => observeAsync(ctx, 'fnf.backend.generation.confirm', { job_set_type: req.jobSetType }, () => backend.confirm(req)) } : {}),
    };
}
function withObservedMediaBackend(backend, observability) {
    const ctx = asContext(observability);
    return {
        getMedia: query => observeAsync(ctx, 'fnf.backend.media.get_media', { media_id: query.id, media_type: query.type }, () => backend.getMedia(query)),
        listMedia: query => observeAsync(ctx, 'fnf.backend.media.list_media', { media_type: query.type, ...(query.size !== undefined ? { size: query.size } : {}) }, () => backend.listMedia(query)),
        ...(backend.getUploadUrl
            ? {
                getUploadUrl: req => observeAsync(ctx, 'fnf.backend.media.get_upload_url', {
                    media_type: req.type,
                    ...(req.contentType ? { content_type: req.contentType } : {}),
                }, () => backend.getUploadUrl(req)),
            }
            : {}),
        ...(backend.confirmMedia
            ? {
                confirmMedia: req => observeAsync(ctx, 'fnf.backend.media.confirm_media', {
                    media_id: req.mediaId,
                    media_type: req.type,
                }, () => backend.confirmMedia(req)),
            }
            : {}),
    };
}
function withObservedProfileBackend(backend, observability) {
    const ctx = asContext(observability);
    return {
        getUser: () => observeAsync(ctx, 'fnf.backend.profile.get_user', {}, () => backend.getUser()),
        listWorkspaces: () => observeAsync(ctx, 'fnf.backend.profile.list_workspaces', {}, () => backend.listWorkspaces()),
        getCurrentWorkspace: () => observeAsync(ctx, 'fnf.backend.profile.get_current_workspace', {}, () => backend.getCurrentWorkspace()),
        getWorkspaceWallet: () => observeAsync(ctx, 'fnf.backend.profile.get_workspace_wallet', {}, () => backend.getWorkspaceWallet()),
        switchWorkspace: req => observeAsync(ctx, 'fnf.backend.profile.switch_workspace', { workspace_id: req.workspaceId }, () => backend.switchWorkspace(req)),
    };
}
function withObservedUploader(uploader, observability) {
    const ctx = asContext(observability);
    return {
        transfer: args => observeAsync(ctx, 'fnf.media.transfer', {
            content_type: args.contentType,
        }, () => uploader.transfer(args)),
        ...(uploader.fetchBytes
            ? {
                fetchBytes: (url, opts) => observeAsync(ctx, 'fnf.media.fetch_bytes', {
                    ...(opts?.maxBytes !== undefined ? { max_bytes: opts.maxBytes } : {}),
                }, () => uploader.fetchBytes(url, opts), {
                    successAttributes: result => ({ content_type: result.contentType }),
                }),
            }
            : {}),
    };
}
function asContext(ctx) {
    if (isObservabilityContext(ctx))
        return ctx;
    return createObservabilityContext(ctx);
}
function isObservabilityContext(value) {
    return typeof value === 'object'
        && value !== null
        && 'traceId' in value
        && 'idFactory' in value
        && 'now' in value
        && 'attributes' in value;
}
function makeEvent(ctx, event) {
    return {
        id: event.id ?? ctx.idFactory(),
        traceId: ctx.traceId,
        ...(event.parentId ?? ctx.parentId ? { parentId: event.parentId ?? ctx.parentId } : {}),
        name: event.name,
        phase: event.phase,
        timestamp: ctx.now(),
        ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
        attributes: normalizeAttributes({ ...ctx.attributes(), ...event.attributes }),
        ...(event.error ? { error: event.error } : {}),
    };
}
function emit(ctx, event) {
    if (!ctx.observer)
        return;
    try {
        const result = ctx.observer(event);
        if (isPromiseLike(result)) {
            void result.catch((error) => {
                ctx.onObserverError?.(error, event);
            });
        }
    }
    catch (error) {
        ctx.onObserverError?.(error, event);
    }
}
function errorInfo(error) {
    if (error instanceof errors_1.ApiJobError) {
        return {
            code: error.code,
            ...(error.status !== undefined ? { status: error.status } : {}),
            name: error.name,
        };
    }
    if (error instanceof Error)
        return { code: 'unexpected', name: error.name };
    return { code: 'unexpected' };
}
function normalizeAttributes(attrs) {
    const out = {};
    for (const [key, value] of Object.entries(attrs ?? {})) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)
            out[key] = value;
    }
    return out;
}
function safeReadAttributes(read) {
    try {
        return read();
    }
    catch {
        return {};
    }
}
function sanitizePath(path) {
    const [pathname, query] = path.split('?', 2);
    if (!query)
        return pathname;
    const keys = [...new URLSearchParams(query).keys()];
    return keys.length > 0 ? `${pathname}?${keys.join('&')}` : pathname;
}
function listQueryAttributes(query) {
    return {
        ...(query.type ? { type: query.type } : {}),
        ...(query.size !== undefined ? { size: query.size } : {}),
        ...(query.cursor !== undefined ? { has_cursor: true } : {}),
        ...(query.parentId ? { parent_id: query.parentId } : {}),
        ...(query.status !== undefined ? { status_count: Array.isArray(query.status) ? query.status.length : 1 } : {}),
        ...(query.model !== undefined ? { model_count: Array.isArray(query.model) ? query.model.length : 1 } : {}),
    };
}
function defaultId() {
    const crypto = globalThis.crypto;
    if (crypto?.randomUUID)
        return crypto.randomUUID();
    fallbackSeq += 1;
    return `fnf-obs-${Date.now().toString(36)}-${fallbackSeq.toString(36)}`;
}
function isPromiseLike(value) {
    return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}
//# sourceMappingURL=index.js.map