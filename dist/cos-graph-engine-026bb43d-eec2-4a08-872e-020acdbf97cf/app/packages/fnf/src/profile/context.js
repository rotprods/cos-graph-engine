"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfileContext = createProfileContext;
const observability_1 = require("../observability");
/** Resolve profile config into the shared context every profile operation consumes. */
function createProfileContext(config) {
    return {
        profileAdapter: config.profileAdapter,
        observability: (0, observability_1.createObservabilityContext)(config.observability),
    };
}
//# sourceMappingURL=context.js.map