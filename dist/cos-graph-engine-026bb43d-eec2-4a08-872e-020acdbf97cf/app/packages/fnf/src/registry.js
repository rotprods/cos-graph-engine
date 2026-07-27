"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRegistry = buildRegistry;
function buildRegistry(jobs) {
    const registry = new Map();
    for (const job of jobs) {
        // Last-write-wins here would silently serialize through the wrong codecs
        // while the type level still advertises both entries — fail loudly instead.
        if (registry.has(job.jobSetType))
            throw new Error(`buildRegistry: duplicate jobSetType '${job.jobSetType}' — register one entry per backend job type`);
        registry.set(job.jobSetType, job);
    }
    return registry;
}
//# sourceMappingURL=registry.js.map