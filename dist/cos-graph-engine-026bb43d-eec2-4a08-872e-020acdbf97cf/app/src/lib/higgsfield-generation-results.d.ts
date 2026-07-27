import type { Generation, JobPhase, OutputType } from "@higgsfield/fnf/client";
export type GenerationMediaPreview = {
    kind: "image";
    phase: JobPhase;
    previewUrl: string;
    rawUrl: string;
} | {
    kind: "video";
    phase: JobPhase;
    rawUrl: string;
    posterUrl?: string;
    previewUrl?: string;
} | {
    kind: "empty";
    phase: JobPhase;
    outputType: OutputType;
    terminal: boolean;
    reason: "pending" | "preview_unavailable" | "failed";
};
export declare function selectGenerationMedia(generation: Generation): GenerationMediaPreview;
export declare function getGenerationPrompt(generation: Generation): string | undefined;
export declare function getGenerationStatusLabel(generation: Generation): string;
export declare function getGenerationCreatedLabel(generation: Generation): string | undefined;
export declare function getGenerationFailureLabel(generation: Generation): string | undefined;
//# sourceMappingURL=higgsfield-generation-results.d.ts.map