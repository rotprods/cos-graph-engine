"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchWorkspaceMutationOptions = switchWorkspaceMutationOptions;
exports.useSwitchWorkspaceMutation = useSwitchWorkspaceMutation;
const react_query_1 = require("@tanstack/react-query");
const generation_cache_1 = require("./generation-cache");
const keys_1 = require("./keys");
const profile_query_1 = require("./profile-query");
const provider_1 = require("./provider");
function switchWorkspaceMutationOptions(client, queryClient, opts = {}) {
    return {
        mutationFn: (input) => client.switchWorkspace(input),
        onSuccess: async (snapshot) => {
            (0, generation_cache_1.removeGenerationQueries)(queryClient, opts);
            const nextScopeKey = opts.nextScopeKey?.(snapshot) ?? opts.scopeKey;
            if (opts.scopeKey && opts.scopeKey !== nextScopeKey)
                queryClient.removeQueries({ queryKey: keys_1.fnfKeys.profile({ scopeKey: opts.scopeKey }) });
            (0, profile_query_1.setProfileSnapshot)(queryClient, snapshot, nextScopeKey ? { scopeKey: nextScopeKey } : undefined);
            await opts.onWorkspaceChanged?.(snapshot);
        },
    };
}
function useSwitchWorkspaceMutation(opts = {}) {
    const client = (0, provider_1.useFnfProfileClient)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const providerScopeKey = (0, provider_1.useFnfScopeKey)();
    return (0, react_query_1.useMutation)(switchWorkspaceMutationOptions(client, queryClient, {
        ...opts,
        scopeKey: opts.scopeKey ?? providerScopeKey,
    }));
}
//# sourceMappingURL=workspace-switch.js.map