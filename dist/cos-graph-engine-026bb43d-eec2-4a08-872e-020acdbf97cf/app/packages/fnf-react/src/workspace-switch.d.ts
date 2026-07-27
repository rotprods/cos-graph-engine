import type { ProfileSnapshot, SwitchWorkspaceInput } from '@higgsfield/fnf/profile';
import type { QueryClient } from '@tanstack/react-query';
import type { FnfScopeOptions } from './keys';
export interface SwitchWorkspaceClient {
    switchWorkspace: (input: SwitchWorkspaceInput) => Promise<ProfileSnapshot>;
}
export interface SwitchWorkspaceMutationConfig extends FnfScopeOptions {
    nextScopeKey?: (snapshot: ProfileSnapshot) => string | undefined;
    onWorkspaceChanged?: (snapshot: ProfileSnapshot) => void | Promise<void>;
}
export declare function switchWorkspaceMutationOptions(client: SwitchWorkspaceClient, queryClient: QueryClient, opts?: SwitchWorkspaceMutationConfig): {
    mutationFn: (input: SwitchWorkspaceInput) => Promise<ProfileSnapshot>;
    onSuccess: (snapshot: ProfileSnapshot) => Promise<void>;
};
export declare function useSwitchWorkspaceMutation(opts?: SwitchWorkspaceMutationConfig): any;
//# sourceMappingURL=workspace-switch.d.ts.map