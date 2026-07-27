"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchProfileWorkspace = switchProfileWorkspace;
const errors_1 = require("../errors");
const observability_1 = require("../observability");
const get_1 = require("./get");
async function switchProfileWorkspace(ctx, input) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.switch_workspace', { workspace_id: input.workspaceId }, async () => {
        const workspaceId = input.workspaceId.trim();
        if (!workspaceId)
            throw new errors_1.ValidationError('switchWorkspace requires a non-empty workspaceId');
        await ctx.profileAdapter.switchWorkspace({ workspaceId });
        return (0, get_1.getProfileSnapshot)(ctx);
    }, {
        successAttributes: snapshot => ({
            has_current_workspace: snapshot.currentWorkspace !== null,
            ...(snapshot.currentWorkspace?.id ? { current_workspace_id: snapshot.currentWorkspace.id } : {}),
        }),
    });
}
//# sourceMappingURL=switch.js.map