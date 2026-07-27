"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.costQueryOptions = costQueryOptions;
const react_query_1 = require("@tanstack/react-query");
const keys_1 = require("./keys");
function costQueryOptions(client, input, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.cost(input, opts),
        queryFn: () => client.cost(input),
        enabled: opts?.enabled,
    });
}
//# sourceMappingURL=cost-query.js.map