"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouter = void 0;
const react_query_1 = require("@tanstack/react-query");
const react_router_1 = require("@tanstack/react-router");
const routeTree_gen_1 = require("./routeTree.gen");
const getRouter = () => {
    const queryClient = new react_query_1.QueryClient();
    const router = (0, react_router_1.createRouter)({
        routeTree: routeTree_gen_1.routeTree,
        context: { queryClient },
        scrollRestoration: true,
        defaultPreloadStaleTime: 0,
    });
    return router;
};
exports.getRouter = getRouter;
//# sourceMappingURL=router.js.map