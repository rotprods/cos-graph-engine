"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("./lib/error-capture");
const error_capture_1 = require("./lib/error-capture");
const error_page_1 = require("./lib/error-page");
let serverEntryPromise;
async function getServerEntry() {
    if (!serverEntryPromise) {
        serverEntryPromise = Promise.resolve().then(() => __importStar(require("@tanstack/react-start/server-entry"))).then((m) => (m.default ?? m));
    }
    return serverEntryPromise;
}
// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response) {
    if (response.status < 500)
        return response;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json"))
        return response;
    const body = await response.clone().text();
    if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
        return response;
    }
    console.error((0, error_capture_1.consumeLastCapturedError)() ?? new Error(`h3 swallowed SSR error: ${body}`));
    return new Response((0, error_page_1.renderErrorPage)(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}
exports.default = {
    async fetch(request, env, ctx) {
        try {
            const handler = await getServerEntry();
            const response = await handler.fetch(request, env, ctx);
            return await normalizeCatastrophicSsrResponse(response);
        }
        catch (error) {
            console.error(error);
            return new Response((0, error_page_1.renderErrorPage)(), {
                status: 500,
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        }
    },
};
//# sourceMappingURL=server.js.map