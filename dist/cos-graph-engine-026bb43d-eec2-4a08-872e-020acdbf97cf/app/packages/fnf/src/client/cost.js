"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateCost = estimateCost;
const observability_1 = require("../observability");
const spec_1 = require("../spec");
const context_1 = require("./context");
async function estimateCost(ctx, input) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.cost', { model: input.model }, async () => {
        const entry = (0, context_1.entryFor)(ctx, input.model);
        // Local per-model calculator first (the fnf-web pattern) — instant price for
        // UI previews; the backend is only asked when the model can't price locally.
        // Settings are parsed first so the calculator prices what would actually be
        // submitted (defaults applied, garbage rejected) — same input the backend
        // path prices via buildWireParams.
        if (entry.credits) {
            const local = entry.credits({ ...input, settings: (0, spec_1.parseSettings)(input, entry) });
            if (typeof local === 'number')
                return { credits: local };
        }
        const params = (0, spec_1.buildWireParams)(input, entry);
        const body = (await ctx.adapter.estimateCost({ jobSetType: entry.jobSetType, params }) ?? {});
        return { credits: body.credits ?? body.credits_exact ?? 0 };
    }, {
        successAttributes: estimate => ({ credits: estimate.credits }),
    });
}
//# sourceMappingURL=cost.js.map