"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileUser = getProfileUser;
exports.listProfileWorkspaces = listProfileWorkspaces;
exports.getCurrentProfileWorkspace = getCurrentProfileWorkspace;
exports.getProfileWallet = getProfileWallet;
exports.getProfileCredits = getProfileCredits;
exports.getProfileSnapshot = getProfileSnapshot;
const observability_1 = require("../observability");
const credits_1 = require("./credits");
const mappers_1 = require("./mappers");
async function getProfileUser(ctx) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.get_user', {}, async () => (0, mappers_1.mapProfileUser)(await ctx.profileAdapter.getUser()), {
        successAttributes: user => ({ has_user: user !== null, ...(user?.id ? { user_id: user.id } : {}) }),
    });
}
async function listProfileWorkspaces(ctx) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.list_workspaces', {}, async () => (0, mappers_1.mapProfileWorkspaces)(await ctx.profileAdapter.listWorkspaces()), {
        successAttributes: workspaces => ({ workspace_count: workspaces.length }),
    });
}
async function getCurrentProfileWorkspace(ctx) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.get_current_workspace', {}, async () => (0, mappers_1.mapProfileWorkspace)(await ctx.profileAdapter.getCurrentWorkspace()), {
        successAttributes: workspace => ({ has_workspace: workspace !== null, ...(workspace?.id ? { workspace_id: workspace.id } : {}) }),
    });
}
async function getProfileWallet(ctx) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.get_wallet', {}, async () => (0, mappers_1.mapProfileWallet)(await ctx.profileAdapter.getWorkspaceWallet()), {
        successAttributes: wallet => ({ has_wallet: wallet !== null }),
    });
}
async function getProfileCredits(ctx, options) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.get_credits', { include_on_demand: options?.includeOnDemand !== false }, async () => {
        const wallet = await getProfileWallet(ctx);
        return wallet ? (0, credits_1.calculateProfileCredits)(wallet, options) : null;
    }, {
        successAttributes: credits => ({ has_credits: credits !== null }),
    });
}
async function getProfileSnapshot(ctx, options) {
    return (0, observability_1.observeAsync)(ctx.observability, 'fnf.profile.get_snapshot', { include_on_demand: options?.includeOnDemand !== false }, async () => {
        const [user, workspaces, currentWorkspace, wallet] = await Promise.all([
            getProfileUser(ctx),
            listProfileWorkspaces(ctx),
            getCurrentProfileWorkspace(ctx),
            getProfileWallet(ctx),
        ]);
        return {
            user,
            workspaces,
            currentWorkspace,
            wallet,
            credits: wallet ? (0, credits_1.calculateProfileCredits)(wallet, options) : null,
        };
    }, {
        successAttributes: snapshot => ({
            has_user: snapshot.user !== null,
            workspace_count: snapshot.workspaces.length,
            has_current_workspace: snapshot.currentWorkspace !== null,
            has_wallet: snapshot.wallet !== null,
            has_credits: snapshot.credits !== null,
        }),
    });
}
//# sourceMappingURL=get.js.map