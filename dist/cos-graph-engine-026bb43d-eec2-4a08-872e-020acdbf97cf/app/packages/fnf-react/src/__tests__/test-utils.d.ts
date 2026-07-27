import type { GenerationBackend, MediaBackend, ProfileBackend } from '@higgsfield/fnf';
import type { Generation } from '@higgsfield/fnf/client';
export declare function gen(id: string, status: Generation['status'], extra?: Partial<Generation>): Generation;
export declare function createMemoryBackend(options?: {
    cost?: number;
}): GenerationBackend;
export declare function createMemoryMediaAdapter(): MediaBackend;
export interface MemoryProfileAdapterOptions {
    user?: Record<string, unknown>;
    workspaces?: Record<string, unknown>[];
    wallet?: Record<string, unknown>;
    currentWorkspaceId?: string;
}
export declare function createMemoryProfileAdapter(options?: MemoryProfileAdapterOptions): ProfileBackend;
//# sourceMappingURL=test-utils.d.ts.map