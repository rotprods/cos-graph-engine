"use strict";
/**
 * The transport-agnostic ports the client cores depend on. Operations are
 * expressed as intent ("create these jobs", "get this media") — NOT as HTTP
 * requests. An HTTP/REST adapter (`createDevFnfWebAdapter`)
 * is one implementation; a websocket, a different service, or in-process code
 * can implement the same port without the core knowing or caring.
 *
 * There are two independent ports so the two halves of the SDK bundle
 * independently: jobs (`GenerationBackend`) and media (`MediaBackend`).
 *
 * Each method resolves the raw response payload, or throws an `ApiJobError`
 * (the adapter maps its own failures — HTTP status codes via `errorFromResponse`,
 * socket errors, etc. — onto the typed error catalog).
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=backend.js.map