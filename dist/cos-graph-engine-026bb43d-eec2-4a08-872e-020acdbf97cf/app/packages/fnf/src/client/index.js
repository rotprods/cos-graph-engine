"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitGenerations = exports.submit = exports.safeSubmit = exports.generationsFromBody = exports.pollJobSetGroup = exports.pollGeneration = exports.listGenerations = exports.getJobSetGenerations = exports.getGeneration = exports.estimateCost = exports.entryFor = exports.createContext = exports.cancelGeneration = exports.adjust = exports.isTerminalJobStatus = exports.isGenerating = exports.isFromJob = exports.isFailedJobStatus = exports.isFailed = exports.isCompleted = exports.hasResult = exports.getRawUrl = exports.getPreviewUrl = exports.getMediaType = exports.getJobPhase = void 0;
exports.createJobClient = createJobClient;
const adjust_1 = require("./adjust");
const cancel_1 = require("./cancel");
const context_1 = require("./context");
const cost_1 = require("./cost");
const get_1 = require("./get");
const get_set_1 = require("./get-set");
const list_1 = require("./list");
const poll_1 = require("./poll");
const submit_1 = require("./submit");
const wait_1 = require("./wait");
/**
 * Compose the job operations into a client. This is sugar over the free
 * functions — every method just binds the shared context. If you only need one
 * capability, build a context and call the operation directly:
 *
 *   const ctx = createContext(config)
 *   await submit(ctx, input)
 *
 * Media is a separate concern: use `createMediaClient` (it bundles
 * independently, so a jobs-only frontend never pulls the media code).
 */
function createJobClient(config) {
    const ctx = (0, context_1.createContext)(config);
    return {
        submit: input => (0, submit_1.submit)(ctx, input),
        safeSubmit: input => (0, submit_1.safeSubmit)(ctx, input),
        adjust: (input, kinds) => {
            const r = (0, adjust_1.adjust)(ctx, input, kinds);
            return { input: r.input, adjustments: r.adjustments };
        },
        get: id => (0, get_1.getGeneration)(ctx, id),
        getSet: jobSetId => (0, get_set_1.getJobSetGenerations)(ctx, jobSetId),
        poll: (id, opts) => (0, poll_1.pollGeneration)(ctx, id, opts),
        wait: (generations, opts) => (0, wait_1.waitGenerations)(ctx, generations, opts),
        cancel: id => (0, cancel_1.cancelGeneration)(ctx, id),
        list: opts => (0, list_1.listGenerations)(ctx, opts),
        cost: input => (0, cost_1.estimateCost)(ctx, input),
    };
}
// Read-model selectors — the derivations the production layer needs per render.
var selectors_1 = require("../selectors");
Object.defineProperty(exports, "getJobPhase", { enumerable: true, get: function () { return selectors_1.getJobPhase; } });
Object.defineProperty(exports, "getMediaType", { enumerable: true, get: function () { return selectors_1.getMediaType; } });
Object.defineProperty(exports, "getPreviewUrl", { enumerable: true, get: function () { return selectors_1.getPreviewUrl; } });
Object.defineProperty(exports, "getRawUrl", { enumerable: true, get: function () { return selectors_1.getRawUrl; } });
Object.defineProperty(exports, "hasResult", { enumerable: true, get: function () { return selectors_1.hasResult; } });
Object.defineProperty(exports, "isCompleted", { enumerable: true, get: function () { return selectors_1.isCompleted; } });
Object.defineProperty(exports, "isFailed", { enumerable: true, get: function () { return selectors_1.isFailed; } });
Object.defineProperty(exports, "isFailedJobStatus", { enumerable: true, get: function () { return selectors_1.isFailedJobStatus; } });
Object.defineProperty(exports, "isFromJob", { enumerable: true, get: function () { return selectors_1.isFromJob; } });
Object.defineProperty(exports, "isGenerating", { enumerable: true, get: function () { return selectors_1.isGenerating; } });
Object.defineProperty(exports, "isTerminalJobStatus", { enumerable: true, get: function () { return selectors_1.isTerminalJobStatus; } });
// Composable operations + context — usable on their own, no full client required.
var adjust_2 = require("./adjust");
Object.defineProperty(exports, "adjust", { enumerable: true, get: function () { return adjust_2.adjust; } });
var cancel_2 = require("./cancel");
Object.defineProperty(exports, "cancelGeneration", { enumerable: true, get: function () { return cancel_2.cancelGeneration; } });
var context_2 = require("./context");
Object.defineProperty(exports, "createContext", { enumerable: true, get: function () { return context_2.createContext; } });
Object.defineProperty(exports, "entryFor", { enumerable: true, get: function () { return context_2.entryFor; } });
var cost_2 = require("./cost");
Object.defineProperty(exports, "estimateCost", { enumerable: true, get: function () { return cost_2.estimateCost; } });
var get_2 = require("./get");
Object.defineProperty(exports, "getGeneration", { enumerable: true, get: function () { return get_2.getGeneration; } });
var get_set_2 = require("./get-set");
Object.defineProperty(exports, "getJobSetGenerations", { enumerable: true, get: function () { return get_set_2.getJobSetGenerations; } });
var list_2 = require("./list");
Object.defineProperty(exports, "listGenerations", { enumerable: true, get: function () { return list_2.listGenerations; } });
var poll_2 = require("./poll");
Object.defineProperty(exports, "pollGeneration", { enumerable: true, get: function () { return poll_2.pollGeneration; } });
Object.defineProperty(exports, "pollJobSetGroup", { enumerable: true, get: function () { return poll_2.pollJobSetGroup; } });
var submit_2 = require("./submit");
Object.defineProperty(exports, "generationsFromBody", { enumerable: true, get: function () { return submit_2.generationsFromBody; } });
Object.defineProperty(exports, "safeSubmit", { enumerable: true, get: function () { return submit_2.safeSubmit; } });
Object.defineProperty(exports, "submit", { enumerable: true, get: function () { return submit_2.submit; } });
var wait_2 = require("./wait");
Object.defineProperty(exports, "waitGenerations", { enumerable: true, get: function () { return wait_2.waitGenerations; } });
//# sourceMappingURL=index.js.map