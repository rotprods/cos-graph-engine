import type { GenerationInput, JobEntry } from '@higgsfield/fnf';
export type WirePreviewResult = {
    ok: true;
    jobSetType: string;
    outputType: JobEntry['outputType'];
    params: Record<string, unknown>;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
        status?: number;
        data?: unknown;
    };
};
export declare function getWirePreview(input: GenerationInput, jobs: readonly JobEntry[]): WirePreviewResult;
export declare function useFnfWirePreview(input: GenerationInput): WirePreviewResult;
//# sourceMappingURL=wire-preview.d.ts.map