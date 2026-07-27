import type { ProfileContext, ProfileCredits, ProfileCreditsOptions, ProfileSnapshot, ProfileUser, ProfileWorkspace, ProfileWorkspaceWallet } from './types';
export declare function getProfileUser(ctx: ProfileContext): Promise<ProfileUser | null>;
export declare function listProfileWorkspaces(ctx: ProfileContext): Promise<ProfileWorkspace[]>;
export declare function getCurrentProfileWorkspace(ctx: ProfileContext): Promise<ProfileWorkspace | null>;
export declare function getProfileWallet(ctx: ProfileContext): Promise<ProfileWorkspaceWallet | null>;
export declare function getProfileCredits(ctx: ProfileContext, options?: ProfileCreditsOptions): Promise<ProfileCredits | null>;
export declare function getProfileSnapshot(ctx: ProfileContext, options?: ProfileCreditsOptions): Promise<ProfileSnapshot>;
//# sourceMappingURL=get.d.ts.map