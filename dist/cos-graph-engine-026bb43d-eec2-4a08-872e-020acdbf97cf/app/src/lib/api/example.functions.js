"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGreeting = void 0;
const react_start_1 = require("@tanstack/react-start");
const zod_1 = require("zod");
const bindings_server_1 = require("../bindings.server");
// Example server function that touches the app's D1 binding (server-only).
exports.getGreeting = (0, react_start_1.createServerFn)({ method: "POST" })
    .inputValidator(zod_1.z.object({ name: zod_1.z.string().min(1) }))
    .handler(async ({ data }) => {
    const { DB, HF_ENV } = (0, bindings_server_1.bindings)();
    let count = 0;
    if (DB) {
        const row = await DB.prepare("SELECT 1 AS n").first();
        count = row?.n ?? 0;
    }
    return { greeting: `Hello, ${data.name}!`, env: HF_ENV ?? "unknown", count };
});
//# sourceMappingURL=example.functions.js.map