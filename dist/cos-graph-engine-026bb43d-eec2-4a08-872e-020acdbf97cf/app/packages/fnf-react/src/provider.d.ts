import type { BinaryUploader, FnfObservabilityOptions, GenerationBackend, JobClient, JobEntry, MediaBackend, MediaClient, ProfileBackend, ProfileClient, ResolveJobRef } from '@higgsfield/fnf';
import type { ReactNode } from 'react';
export interface FnfReactClientsConfig<Jobs extends readonly JobEntry[] = readonly JobEntry[]> {
    adapter: GenerationBackend;
    jobs: Jobs;
    mediaAdapter?: MediaBackend;
    profileAdapter?: ProfileBackend;
    blobUploader?: BinaryUploader;
    resolveJob?: ResolveJobRef;
    scopeKey?: string;
    observability?: FnfObservabilityOptions;
}
export interface FnfReactClients<Jobs extends readonly JobEntry[] = readonly JobEntry[]> {
    jobClient: JobClient<Jobs>;
    mediaClient: MediaClient;
    profileClient: ProfileClient;
    jobs: Jobs;
    scopeKey?: string;
    observability?: FnfObservabilityOptions;
}
export type FnfProviderProps<Jobs extends readonly JobEntry[] = readonly JobEntry[]> = FnfReactClientsConfig<Jobs> & {
    children: ReactNode;
};
export declare function createFnfReactClients<const Jobs extends readonly JobEntry[]>(config: FnfReactClientsConfig<Jobs>): FnfReactClients<Jobs>;
export declare function FnfProvider<const Jobs extends readonly JobEntry[]>(props: FnfProviderProps<Jobs>): any;
export declare function useFnf<Jobs extends readonly JobEntry[] = readonly JobEntry[]>(): FnfReactClients<Jobs>;
export declare function useFnfJobClient<Jobs extends readonly JobEntry[] = readonly JobEntry[]>(): JobClient<Jobs>;
export declare function useFnfMediaClient(): MediaClient;
export declare function useFnfProfileClient(): ProfileClient;
export declare function useFnfJobs<Jobs extends readonly JobEntry[] = readonly JobEntry[]>(): Jobs;
export declare function useFnfScopeKey(): string | undefined;
export declare function useFnfObservability(): FnfObservabilityOptions | undefined;
export declare function useOptionalFnfObservability(): FnfObservabilityOptions | undefined;
//# sourceMappingURL=provider.d.ts.map