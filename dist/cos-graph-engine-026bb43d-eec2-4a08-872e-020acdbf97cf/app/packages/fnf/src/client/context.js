"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
exports.entryFor = entryFor;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const registry_1 = require("../registry");
const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 600_000;
/** Resolve user config into the shared context every operation consumes. */
function createContext(config) {
    return {
        adapter: config.adapter,
        registry: (0, registry_1.buildRegistry)(config.jobs),
        poll: {
            intervalMs: config.poll?.intervalMs ?? DEFAULT_INTERVAL_MS,
            timeoutMs: config.poll?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
        scheduler: {
            sleep: config.scheduler?.sleep ?? defaultSleep,
            isActive: config.scheduler?.isActive,
        },
        observability: (0, observability_1.createObservabilityContext)(config.observability),
    };
}
function entryFor(ctx, model) {
    const entry = ctx.registry.get(model);
    if (!entry)
        throw new errors_1.ApiJobError('unknown_model', `Unknown model: ${model}`);
    return entry;
}
function defaultSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=context.js.map