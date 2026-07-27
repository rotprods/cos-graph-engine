import type { ProfileClient, ProfileCredits, ProfileCreditsOptions, ProfileSnapshot, ProfileUser, ProfileWorkspace, ProfileWorkspaceWallet } from '@higgsfield/fnf/profile';
import type { QueryClient } from '@tanstack/react-query';
import type { FnfScopeOptions } from './keys';
export interface ProfileQueryClient {
    getUser: () => Promise<ProfileUser | null>;
    listWorkspaces: () => Promise<ProfileWorkspace[]>;
    getCurrentWorkspace: () => Promise<ProfileWorkspace | null>;
    getWallet: () => Promise<ProfileWorkspaceWallet | null>;
    getCredits: (options?: ProfileCreditsOptions) => Promise<ProfileCredits | null>;
    getSnapshot: (options?: ProfileCreditsOptions) => Promise<ProfileSnapshot>;
}
export type ProfileQueryOptions = FnfScopeOptions;
export type ProfileCreditsQueryOptions = ProfileCreditsOptions & FnfScopeOptions;
export declare function profileSnapshotQueryOptions(client: ProfileQueryClient, opts?: ProfileCreditsQueryOptions): any;
export declare function profileUserQueryOptions(client: Pick<ProfileQueryClient, 'getUser'>, opts?: ProfileQueryOptions): any;
export declare function profileWorkspacesQueryOptions(client: Pick<ProfileQueryClient, 'listWorkspaces'>, opts?: ProfileQueryOptions): any;
export declare function profileCurrentWorkspaceQueryOptions(client: Pick<ProfileQueryClient, 'getCurrentWorkspace'>, opts?: ProfileQueryOptions): any;
export declare function profileWalletQueryOptions(client: Pick<ProfileQueryClient, 'getWallet'>, opts?: ProfileQueryOptions): any;
export declare function profileCreditsQueryOptions(client: Pick<ProfileQueryClient, 'getCredits'>, opts?: ProfileCreditsQueryOptions): any;
export declare function setProfileSnapshot(queryClient: QueryClient, snapshot: ProfileSnapshot, opts?: FnfScopeOptions): void;
export type { ProfileClient };
//# sourceMappingURL=profile-query.d.ts.map