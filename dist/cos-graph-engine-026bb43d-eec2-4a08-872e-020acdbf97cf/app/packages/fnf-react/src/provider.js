"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFnfReactClients = createFnfReactClients;
exports.FnfProvider = FnfProvider;
exports.useFnf = useFnf;
exports.useFnfJobClient = useFnfJobClient;
exports.useFnfMediaClient = useFnfMediaClient;
exports.useFnfProfileClient = useFnfProfileClient;
exports.useFnfJobs = useFnfJobs;
exports.useFnfScopeKey = useFnfScopeKey;
exports.useFnfObservability = useFnfObservability;
exports.useOptionalFnfObservability = useOptionalFnfObservability;
const fnf_1 = require("@higgsfield/fnf");
const react_1 = require("react");
const FnfContext = (0, react_1.createContext)(null);
function createFnfReactClients(config) {
    const mediaAdapter = config.mediaAdapter ?? config.adapter;
    const profileAdapter = config.profileAdapter ?? config.adapter;
    const observability = config.observability ? observabilityOptionsFromContext((0, fnf_1.createObservabilityContext)(config.observability)) : undefined;
    return {
        jobClient: (0, fnf_1.createJobClient)({ adapter: config.adapter, jobs: config.jobs, ...(observability ? { observability } : {}) }),
        mediaClient: (0, fnf_1.createMediaClient)({
            mediaAdapter,
            ...(config.blobUploader ? { blobUploader: config.blobUploader } : {}),
            ...(config.resolveJob ? { resolveJob: config.resolveJob } : {}),
            ...(observability ? { observability } : {}),
        }),
        profileClient: (0, fnf_1.createProfileClient)({ profileAdapter, ...(observability ? { observability } : {}) }),
        jobs: config.jobs,
        ...(config.scopeKey ? { scopeKey: config.scopeKey } : {}),
        ...(observability ? { observability } : {}),
    };
}
function FnfProvider(props) {
    const { children, adapter, jobs, mediaAdapter, profileAdapter, blobUploader, resolveJob, scopeKey, observability, } = props;
    const value = (0, react_1.useMemo)(() => createFnfReactClients({
        adapter,
        jobs,
        ...(mediaAdapter ? { mediaAdapter } : {}),
        ...(profileAdapter ? { profileAdapter } : {}),
        ...(blobUploader ? { blobUploader } : {}),
        ...(resolveJob ? { resolveJob } : {}),
        ...(scopeKey ? { scopeKey } : {}),
        ...(observability ? { observability } : {}),
    }), [adapter, jobs, mediaAdapter, profileAdapter, blobUploader, resolveJob, scopeKey, observability]);
    return (0, react_1.createElement)(FnfContext.Provider, { value }, children);
}
function useFnf() {
    const value = (0, react_1.use)(FnfContext);
    if (!value)
        throw new Error('useFnf must be used inside <FnfProvider>');
    return value;
}
function useFnfJobClient() {
    return useFnf().jobClient;
}
function useFnfMediaClient() {
    return useFnf().mediaClient;
}
function useFnfProfileClient() {
    return useFnf().profileClient;
}
function useFnfJobs() {
    return useFnf().jobs;
}
function useFnfScopeKey() {
    return useFnf().scopeKey;
}
function useFnfObservability() {
    return useFnf().observability;
}
function useOptionalFnfObservability() {
    return (0, react_1.use)(FnfContext)?.observability;
}
function observabilityOptionsFromContext(ctx) {
    return {
        ...(ctx.observer ? { observer: ctx.observer } : {}),
        traceId: ctx.traceId,
        ...(ctx.parentId ? { parentId: ctx.parentId } : {}),
        attributes: ctx.attributes,
        ...(ctx.onObserverError ? { onObserverError: ctx.onObserverError } : {}),
        now: ctx.now,
        idFactory: ctx.idFactory,
    };
}
//# sourceMappingURL=provider.js.map