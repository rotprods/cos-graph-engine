"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSwitchWorkspaceMutation = exports.switchWorkspaceMutationOptions = exports.useFnfWirePreview = exports.getWirePreview = exports.Realtime = exports.useFnfScopeKey = exports.useFnfProfileClient = exports.useFnfObservability = exports.useFnfMediaClient = exports.useFnfJobs = exports.useFnfJobClient = exports.useFnf = exports.FnfProvider = exports.createFnfReactClients = exports.setProfileSnapshot = exports.profileWorkspacesQueryOptions = exports.profileWalletQueryOptions = exports.profileUserQueryOptions = exports.profileSnapshotQueryOptions = exports.profileCurrentWorkspaceQueryOptions = exports.profileCreditsQueryOptions = exports.RefCountPool = exports.fnfKeys = exports.jobsFeedQueryOptions = exports.flattenFeedPages = exports.jobSetQueryOptions = exports.useGenerationRun = exports.GenerationRun = exports.generationQueryOptions = exports.DEFAULT_POLL_INTERVAL_MS = exports.foldGeneration = exports.removeGenerationQueries = exports.prependGenerations = exports.applyGenerations = exports.useStore = exports.ExternalStore = exports.costQueryOptions = exports.useAttachments = exports.AttachmentsController = void 0;
// Attachments — the input-media presenter: files in, submit-ready refs out
var attachments_1 = require("./attachments");
Object.defineProperty(exports, "AttachmentsController", { enumerable: true, get: function () { return attachments_1.AttachmentsController; } });
var attachments_hook_1 = require("./attachments-hook");
Object.defineProperty(exports, "useAttachments", { enumerable: true, get: function () { return attachments_hook_1.useAttachments; } });
var cost_query_1 = require("./cost-query");
Object.defineProperty(exports, "costQueryOptions", { enumerable: true, get: function () { return cost_query_1.costQueryOptions; } });
// The base the controllers share — extend it for your own presenters
var external_store_1 = require("./external-store");
Object.defineProperty(exports, "ExternalStore", { enumerable: true, get: function () { return external_store_1.ExternalStore; } });
var external_store_hook_1 = require("./external-store-hook");
Object.defineProperty(exports, "useStore", { enumerable: true, get: function () { return external_store_hook_1.useStore; } });
// Cache door — the ONE way generation snapshots enter the query cache
var generation_cache_1 = require("./generation-cache");
Object.defineProperty(exports, "applyGenerations", { enumerable: true, get: function () { return generation_cache_1.applyGenerations; } });
Object.defineProperty(exports, "prependGenerations", { enumerable: true, get: function () { return generation_cache_1.prependGenerations; } });
Object.defineProperty(exports, "removeGenerationQueries", { enumerable: true, get: function () { return generation_cache_1.removeGenerationQueries; } });
var generation_fold_1 = require("./generation-fold");
Object.defineProperty(exports, "foldGeneration", { enumerable: true, get: function () { return generation_fold_1.foldGeneration; } });
// Query factories — pull-shaped reads as TanStack queryOptions
var generation_query_1 = require("./generation-query");
Object.defineProperty(exports, "DEFAULT_POLL_INTERVAL_MS", { enumerable: true, get: function () { return generation_query_1.DEFAULT_POLL_INTERVAL_MS; } });
Object.defineProperty(exports, "generationQueryOptions", { enumerable: true, get: function () { return generation_query_1.generationQueryOptions; } });
// Submit — one submit-to-terminal lifecycle as observable state
var generation_run_1 = require("./generation-run");
Object.defineProperty(exports, "GenerationRun", { enumerable: true, get: function () { return generation_run_1.GenerationRun; } });
var generation_run_hook_1 = require("./generation-run-hook");
Object.defineProperty(exports, "useGenerationRun", { enumerable: true, get: function () { return generation_run_hook_1.useGenerationRun; } });
var job_set_query_1 = require("./job-set-query");
Object.defineProperty(exports, "jobSetQueryOptions", { enumerable: true, get: function () { return job_set_query_1.jobSetQueryOptions; } });
var jobs_feed_query_1 = require("./jobs-feed-query");
Object.defineProperty(exports, "flattenFeedPages", { enumerable: true, get: function () { return jobs_feed_query_1.flattenFeedPages; } });
Object.defineProperty(exports, "jobsFeedQueryOptions", { enumerable: true, get: function () { return jobs_feed_query_1.jobsFeedQueryOptions; } });
// Keys — the public query-key contract (build keys ONLY through these)
var keys_1 = require("./keys");
Object.defineProperty(exports, "fnfKeys", { enumerable: true, get: function () { return keys_1.fnfKeys; } });
var pool_1 = require("./pool");
Object.defineProperty(exports, "RefCountPool", { enumerable: true, get: function () { return pool_1.RefCountPool; } });
// Profile queries — account/workspace/wallet reads as TanStack queryOptions
var profile_query_1 = require("./profile-query");
Object.defineProperty(exports, "profileCreditsQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileCreditsQueryOptions; } });
Object.defineProperty(exports, "profileCurrentWorkspaceQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileCurrentWorkspaceQueryOptions; } });
Object.defineProperty(exports, "profileSnapshotQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileSnapshotQueryOptions; } });
Object.defineProperty(exports, "profileUserQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileUserQueryOptions; } });
Object.defineProperty(exports, "profileWalletQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileWalletQueryOptions; } });
Object.defineProperty(exports, "profileWorkspacesQueryOptions", { enumerable: true, get: function () { return profile_query_1.profileWorkspacesQueryOptions; } });
Object.defineProperty(exports, "setProfileSnapshot", { enumerable: true, get: function () { return profile_query_1.setProfileSnapshot; } });
// Provider — stable SDK clients from one React context
var provider_1 = require("./provider");
Object.defineProperty(exports, "createFnfReactClients", { enumerable: true, get: function () { return provider_1.createFnfReactClients; } });
Object.defineProperty(exports, "FnfProvider", { enumerable: true, get: function () { return provider_1.FnfProvider; } });
Object.defineProperty(exports, "useFnf", { enumerable: true, get: function () { return provider_1.useFnf; } });
Object.defineProperty(exports, "useFnfJobClient", { enumerable: true, get: function () { return provider_1.useFnfJobClient; } });
Object.defineProperty(exports, "useFnfJobs", { enumerable: true, get: function () { return provider_1.useFnfJobs; } });
Object.defineProperty(exports, "useFnfMediaClient", { enumerable: true, get: function () { return provider_1.useFnfMediaClient; } });
Object.defineProperty(exports, "useFnfObservability", { enumerable: true, get: function () { return provider_1.useFnfObservability; } });
Object.defineProperty(exports, "useFnfProfileClient", { enumerable: true, get: function () { return provider_1.useFnfProfileClient; } });
Object.defineProperty(exports, "useFnfScopeKey", { enumerable: true, get: function () { return provider_1.useFnfScopeKey; } });
var realtime_1 = require("./realtime");
Object.defineProperty(exports, "Realtime", { enumerable: true, get: function () { return realtime_1.Realtime; } });
var wire_preview_1 = require("./wire-preview");
Object.defineProperty(exports, "getWirePreview", { enumerable: true, get: function () { return wire_preview_1.getWirePreview; } });
Object.defineProperty(exports, "useFnfWirePreview", { enumerable: true, get: function () { return wire_preview_1.useFnfWirePreview; } });
var workspace_switch_1 = require("./workspace-switch");
Object.defineProperty(exports, "switchWorkspaceMutationOptions", { enumerable: true, get: function () { return workspace_switch_1.switchWorkspaceMutationOptions; } });
Object.defineProperty(exports, "useSwitchWorkspaceMutation", { enumerable: true, get: function () { return workspace_switch_1.useSwitchWorkspaceMutation; } });
//# sourceMappingURL=index.js.map