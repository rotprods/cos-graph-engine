"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindings = bindings;
// Server-only access to this app's Cloudflare bindings. Each is present ONLY if
// opted into via app.manifest.json (D1 `DB`, R2 `STORAGE`, KV `KV`, and the
// container `CONTAINER`) — so the accessors are optional; guard before use.
// `cloudflare:workers` is the Workers-runtime module that exposes the Worker
// env (bindings) — usable inside any server-side code (server functions,
// server routes). It is NOT bundled; the runtime provides it.
const cloudflare_workers_1 = require("cloudflare:workers");
function bindings() {
    return cloudflare_workers_1.env;
}
//# sourceMappingURL=bindings.server.js.map