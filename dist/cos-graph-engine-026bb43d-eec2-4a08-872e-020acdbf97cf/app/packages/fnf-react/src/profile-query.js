"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileSnapshotQueryOptions = profileSnapshotQueryOptions;
exports.profileUserQueryOptions = profileUserQueryOptions;
exports.profileWorkspacesQueryOptions = profileWorkspacesQueryOptions;
exports.profileCurrentWorkspaceQueryOptions = profileCurrentWorkspaceQueryOptions;
exports.profileWalletQueryOptions = profileWalletQueryOptions;
exports.profileCreditsQueryOptions = profileCreditsQueryOptions;
exports.setProfileSnapshot = setProfileSnapshot;
const react_query_1 = require("@tanstack/react-query");
const keys_1 = require("./keys");
function profileSnapshotQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileSnapshot(opts),
        queryFn: () => client.getSnapshot(opts),
    });
}
function profileUserQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileUser(opts),
        queryFn: () => client.getUser(),
    });
}
function profileWorkspacesQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileWorkspaces(opts),
        queryFn: () => client.listWorkspaces(),
    });
}
function profileCurrentWorkspaceQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileCurrentWorkspace(opts),
        queryFn: () => client.getCurrentWorkspace(),
    });
}
function profileWalletQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileWallet(opts),
        queryFn: () => client.getWallet(),
    });
}
function profileCreditsQueryOptions(client, opts) {
    return (0, react_query_1.queryOptions)({
        queryKey: keys_1.fnfKeys.profileCredits(opts),
        queryFn: () => client.getCredits(opts),
    });
}
function setProfileSnapshot(queryClient, snapshot, opts) {
    queryClient.setQueryData(keys_1.fnfKeys.profileSnapshot(opts), snapshot);
    queryClient.setQueryData(keys_1.fnfKeys.profileUser(opts), snapshot.user);
    queryClient.setQueryData(keys_1.fnfKeys.profileWorkspaces(opts), snapshot.workspaces);
    queryClient.setQueryData(keys_1.fnfKeys.profileCurrentWorkspace(opts), snapshot.currentWorkspace);
    queryClient.setQueryData(keys_1.fnfKeys.profileWallet(opts), snapshot.wallet);
    queryClient.setQueryData(keys_1.fnfKeys.profileCredits(opts), snapshot.credits);
}
//# sourceMappingURL=profile-query.js.map