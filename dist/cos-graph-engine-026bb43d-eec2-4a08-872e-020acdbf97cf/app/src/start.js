"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInstance = void 0;
const react_start_1 = require("@tanstack/react-start");
const error_page_1 = require("./lib/error-page");
const errorMiddleware = (0, react_start_1.createMiddleware)().server(async ({ next }) => {
    try {
        return await next();
    }
    catch (error) {
        if (error != null && typeof error === "object" && "statusCode" in error) {
            throw error;
        }
        console.error(error);
        return new Response((0, error_page_1.renderErrorPage)(), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    }
});
exports.startInstance = (0, react_start_1.createStart)(() => ({
    requestMiddleware: [errorMiddleware],
}));
//# sourceMappingURL=start.js.map