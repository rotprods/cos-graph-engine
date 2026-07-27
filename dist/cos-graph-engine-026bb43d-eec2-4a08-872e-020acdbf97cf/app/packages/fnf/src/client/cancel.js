"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelGeneration = cancelGeneration;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
/**
 * Cancel a running job SERVER-SIDE. This is the counterpart to the client-side
 * `signal` on poll/wait: aborting only stops polling — the backend job keeps
 * running (and burning credits) until cancelled here.
 *
 * Requires the adapter to implement the optional `cancelJob` port method;
 * otherwise throws the typed `cancel_not_supported` error.
 */
async function cancelGeneration(ctx, id) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.job.cancel', { generation_id: id }, async () => {
        if (!ctx.adapter.cancelJob)
            throw new errors_1.ApiJobError('cancel_not_supported', 'This backend adapter does not support job cancellation');
        await ctx.adapter.cancelJob(id);
    });
}
//# sourceMappingURL=cancel.js.map