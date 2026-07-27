import type { MediaIssue } from '../groups/media';
import type { GenerationInput, MediaInput, MediaRef } from '../types';
export interface Size {
    width: number;
    height: number;
}
export declare function refsFor(media: MediaInput | undefined, role: string): MediaRef[];
export declare function firstMetaSize(media: MediaInput | undefined, roles: readonly string[]): Size | undefined;
export declare function firstMetaDuration(media: MediaInput | undefined, roles: readonly string[]): number | undefined;
export declare function integerRange(field: string, value: number | null | undefined, min: number, max: number): MediaIssue[];
export declare function requiredPromptOrRole(input: GenerationInput, role: string, message: string): MediaIssue[];
export declare function extractAngleRefIds(text: string): string[];
export declare function batch(settings: Record<string, unknown>, fallback?: number): number;
//# sourceMappingURL=video-helpers.d.ts.map