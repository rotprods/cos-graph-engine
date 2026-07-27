"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowPlatformAdapter = exports.normalizeProductJob = exports.normalizeJobSetBody = exports.normalizeJobListBody = exports.normalizeJobLike = exports.createFetchTransport = void 0;
/**
 * The ONE adapter implementation bundled with the SDK: the Workflow Platform
 * adapter for `https://fnf.internal` (generated apps / Supercomputer flows),
 * plus the fetch transport and wire normalization it is built on. Bundled so
 * a host that vendors only `@higgsfield/fnf` is self-sufficient for generated
 * apps. Every other adapter (fnf-web, dev, apps-marketplace, memory) lives in
 * `@higgsfield/fnf-adapters`.
 */
var fetch_transport_1 = require("./fetch-transport");
Object.defineProperty(exports, "createFetchTransport", { enumerable: true, get: function () { return fetch_transport_1.createFetchTransport; } });
// Shared product-wire normalization — also consumed by the HTTP adapters in
// @higgsfield/fnf-adapters, so the two packages normalize identically.
var job_response_normalize_1 = require("./job-response-normalize");
Object.defineProperty(exports, "normalizeJobLike", { enumerable: true, get: function () { return job_response_normalize_1.normalizeJobLike; } });
Object.defineProperty(exports, "normalizeJobListBody", { enumerable: true, get: function () { return job_response_normalize_1.normalizeJobListBody; } });
Object.defineProperty(exports, "normalizeJobSetBody", { enumerable: true, get: function () { return job_response_normalize_1.normalizeJobSetBody; } });
Object.defineProperty(exports, "normalizeProductJob", { enumerable: true, get: function () { return job_response_normalize_1.normalizeProductJob; } });
var workflow_platform_adapter_1 = require("./workflow-platform-adapter");
Object.defineProperty(exports, "createWorkflowPlatformAdapter", { enumerable: true, get: function () { return workflow_platform_adapter_1.createWorkflowPlatformAdapter; } });
//# sourceMappingURL=index.js.map