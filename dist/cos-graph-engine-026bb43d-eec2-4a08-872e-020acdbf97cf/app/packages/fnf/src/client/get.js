"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneration = getGeneration;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const spec_1 = require("../spec");
async function getGeneration(ctx, id, fallbackEntry) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.get', { generation_id: id }, async () => {
        const body = await ctx.adapter.getJob(id);
        const entry = (body.job_set_type ? ctx.registry.get(body.job_set_type) : undefined) ?? fallbackEntry;
        if (!entry)
            throw new errors_1.ApiJobError('unknown_model', `Cannot resolve job type for job ${id}`);
        return (0, spec_1.parseGeneration)(body, entry);
    }, {
        successAttributes: generation => ({ model: generation.model, status: generation.status }),
    });
}
//# sourceMappingURL=get.js.map