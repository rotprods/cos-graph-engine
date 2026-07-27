"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const profile_1 = require("@higgsfield/fnf/profile");
const react_query_1 = require("@tanstack/react-query");
const vitest_1 = require("vitest");
const keys_1 = require("../keys");
const profile_query_1 = require("../profile-query");
const workspace_switch_1 = require("../workspace-switch");
const test_utils_1 = require("./test-utils");
(0, vitest_1.describe)('profile query options', () => {
    (0, vitest_1.it)('fetches profile pieces through the SDK profile client into scoped keys', async () => {
        const client = (0, profile_1.createProfileClient)({
            profileAdapter: (0, test_utils_1.createMemoryProfileAdapter)({
                user: { id: 'u1', workspace_id: 'w1', workspace_type: 'private', workspace_role: 'owner' },
                workspaces: [{ id: 'w1', name: 'Personal', type: 'private', user_role: 'owner' }],
                wallet: { subscription_balance: 500, total_credits: 1000, credits_balance: 200 },
            }),
        });
        const qc = new react_query_1.QueryClient();
        const scope = { scopeKey: 'u1:w1' };
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileUserQueryOptions)(client, scope))).resolves.toMatchObject({ id: 'u1', workspaceId: 'w1' });
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileWorkspacesQueryOptions)(client, scope))).resolves.toHaveLength(1);
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileCurrentWorkspaceQueryOptions)(client, scope))).resolves.toMatchObject({ id: 'w1' });
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileWalletQueryOptions)(client, scope))).resolves.toMatchObject({ subscriptionBalance: 500 });
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileCreditsQueryOptions)(client, scope))).resolves.toMatchObject({ totalAvailableCredits: 7 });
        await (0, vitest_1.expect)(qc.fetchQuery((0, profile_query_1.profileSnapshotQueryOptions)(client, scope))).resolves.toMatchObject({ user: { id: 'u1' }, wallet: { id: 'w1' } });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileUser(scope))).toMatchObject({ id: 'u1' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileUser())).toBeUndefined();
        (0, vitest_1.expect)(keys_1.fnfKeys.profileCredits({ ...scope, includeOnDemand: false })).toEqual(['fnf', 'scope', 'u1:w1', 'profile', 'credits', { includeOnDemand: false }]);
        (0, vitest_1.expect)(keys_1.fnfKeys.profileSnapshot({ ...scope, includeOnDemand: false })).toEqual(['fnf', 'scope', 'u1:w1', 'profile', 'snapshot', { includeOnDemand: false }]);
    });
    (0, vitest_1.it)('writes a composed snapshot into every profile cache leaf', () => {
        const qc = new react_query_1.QueryClient();
        const snapshot = {
            user: { id: 'u1' },
            workspaces: [{ id: 'w1' }],
            currentWorkspace: { id: 'w1' },
            wallet: { id: 'w1' },
            credits: { totalAvailableCredits: 12 },
        };
        (0, profile_query_1.setProfileSnapshot)(qc, snapshot, { scopeKey: 'u1:w1' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileSnapshot({ scopeKey: 'u1:w1' }))).toBe(snapshot);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileUser({ scopeKey: 'u1:w1' }))).toEqual({ id: 'u1' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileWorkspaces({ scopeKey: 'u1:w1' }))).toEqual([{ id: 'w1' }]);
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileCurrentWorkspace({ scopeKey: 'u1:w1' }))).toEqual({ id: 'w1' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileWallet({ scopeKey: 'u1:w1' }))).toEqual({ id: 'w1' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileCredits({ scopeKey: 'u1:w1' }))).toEqual({ totalAvailableCredits: 12 });
    });
});
(0, vitest_1.describe)('workspace switch mutation options', () => {
    (0, vitest_1.it)('switches context, clears old scoped generation caches, writes next profile snapshot, and notifies the host', async () => {
        const qc = new react_query_1.QueryClient();
        qc.setQueryData(keys_1.fnfKeys.job('old', { scopeKey: 'u:w1' }), (0, test_utils_1.gen)('old', 'queued'));
        qc.setQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'u:w1' }), { pages: [{ items: [(0, test_utils_1.gen)('old', 'queued')] }], pageParams: [undefined] });
        qc.setQueryData(keys_1.fnfKeys.job('new', { scopeKey: 'u:w2' }), (0, test_utils_1.gen)('new', 'queued'));
        const onWorkspaceChanged = vitest_1.vi.fn();
        const snapshot = {
            user: { id: 'u', workspaceId: 'w2' },
            workspaces: [],
            currentWorkspace: { id: 'w2' },
            wallet: null,
            credits: null,
        };
        const client = {
            switchWorkspace: vitest_1.vi.fn(async () => snapshot),
        };
        const mutation = (0, workspace_switch_1.switchWorkspaceMutationOptions)(client, qc, {
            scopeKey: 'u:w1',
            nextScopeKey: snap => `u:${snap.currentWorkspace?.id ?? 'none'}`,
            onWorkspaceChanged,
        });
        const result = await mutation.mutationFn({ workspaceId: 'w2' });
        await mutation.onSuccess(result);
        (0, vitest_1.expect)(client.switchWorkspace).toHaveBeenCalledWith({ workspaceId: 'w2' });
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('old', { scopeKey: 'u:w1' }))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.jobs({}, { scopeKey: 'u:w1' }))).toBeUndefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.job('new', { scopeKey: 'u:w2' }))).toBeDefined();
        (0, vitest_1.expect)(qc.getQueryData(keys_1.fnfKeys.profileSnapshot({ scopeKey: 'u:w2' }))).toBe(snapshot);
        (0, vitest_1.expect)(onWorkspaceChanged).toHaveBeenCalledWith(snapshot);
    });
});
//# sourceMappingURL=profile-query.test.js.map