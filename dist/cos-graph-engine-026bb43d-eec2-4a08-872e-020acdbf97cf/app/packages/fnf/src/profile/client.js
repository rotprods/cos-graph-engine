"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfileClient = createProfileClient;
const context_1 = require("./context");
const get_1 = require("./get");
const switch_1 = require("./switch");
/** Compose profile operations into a client. */
function createProfileClient(config) {
    const ctx = (0, context_1.createProfileContext)(config);
    return {
        getUser: () => (0, get_1.getProfileUser)(ctx),
        listWorkspaces: () => (0, get_1.listProfileWorkspaces)(ctx),
        getCurrentWorkspace: () => (0, get_1.getCurrentProfileWorkspace)(ctx),
        getWallet: () => (0, get_1.getProfileWallet)(ctx),
        getCredits: options => (0, get_1.getProfileCredits)(ctx, options),
        getSnapshot: options => (0, get_1.getProfileSnapshot)(ctx, options),
        switchWorkspace: input => (0, switch_1.switchProfileWorkspace)(ctx, input),
    };
}
//# sourceMappingURL=client.js.map