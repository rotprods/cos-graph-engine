"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobSetQueryOptions = jobSetQueryOptions;
const client_1 = require("@higgsfield/fnf/client");
const react_query_1 = require("@tanstack/react-query");
const generation_query_1 = require("./generation-query");
const keys_1 = require("./keys");
/**
 * One job set (a batch), live until EVERY member settles — one request per
 * tick for the whole batch (`client.getSet`), the same economy `wait`'s
 * set-aware polling has, expressed as a query. Realtime glue is one line:
 * an event for the set is `queryClient.invalidateQueries({ queryKey:
 * fnfKeys.jobSet(id) })` — TanStack dedupes and cancels racing refetches.
 * Defaults are overridable by spreading over the result.
 */
function jobSetQueryOptions(client, jobSetId, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.jobSet(jobSetId, opts),
        queryFn: () => client.getSet(jobSetId),
        refetchInterval: (query) => {
            if (opts?.intervalMs === false)
                return false;
            const members = query.state.data;
            return members !== undefined && members.every(g => (0, client_1.isTerminalJobStatus)(g.status))
                ? false
                : opts?.intervalMs ?? generation_query_1.DEFAULT_POLL_INTERVAL_MS;
        },
        refetchIntervalInBackground: true,
        staleTime: (query) => {
            const members = query.state.data;
            return members !== undefined && members.every(g => (0, client_1.isTerminalJobStatus)(g.status)) ? Number.POSITIVE_INFINITY : 0;
        },
    });
}
//# sourceMappingURL=job-set-query.js.map