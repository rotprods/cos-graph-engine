"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POLL_INTERVAL_MS = void 0;
exports.generationQueryOptions = generationQueryOptions;
const client_1 = require("@higgsfield/fnf/client");
const react_query_1 = require("@tanstack/react-query");
const keys_1 = require("./keys");
/**
 * The product's job-polling cadence (fnf-web `use-job-status-polling`:
 * react-query `refetchInterval: 5000`, in background too).
 */
exports.DEFAULT_POLL_INTERVAL_MS = 5000;
/**
 * One generation, live until it settles: polls at `intervalMs` while the
 * status is non-terminal (in background too — uploads/long videos outlive a
 * focused tab), then stops and becomes immutable (`staleTime: Infinity` once
 * terminal). Every default is overridable by spreading over the result:
 *
 *   useQuery(generationQueryOptions(client, id))
 *   useSuspenseQuery({ ...generationQueryOptions(client, id), refetchInterval: false })
 */
function generationQueryOptions(client, id, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.job(id, opts),
        queryFn: () => client.get(id),
        refetchInterval: (query) => {
            if (opts?.intervalMs === false)
                return false;
            const generation = query.state.data;
            return generation !== undefined && (0, client_1.isTerminalJobStatus)(generation.status)
                ? false
                : opts?.intervalMs ?? exports.DEFAULT_POLL_INTERVAL_MS;
        },
        refetchIntervalInBackground: true,
        staleTime: (query) => {
            const generation = query.state.data;
            return generation !== undefined && (0, client_1.isTerminalJobStatus)(generation.status) ? Number.POSITIVE_INFINITY : 0;
        },
    });
}
//# sourceMappingURL=generation-query.js.map