import type { MediaIssue } from '../groups/media';
import type { GenerationInput, MediaInput } from '../types';
import { type Size } from './video-helpers';
export declare const UpscaleImageFactor: {
    readonly x1: "x1";
    readonly x2: "x2";
    readonly x4: "x4";
    readonly x8: "x8";
    readonly x16: "x16";
};
export declare const UPSCALE_IMAGE_FACTORS: ("x1" | "x2" | "x4" | "x8" | "x16")[];
export type UpscaleImageFactorValue = typeof UPSCALE_IMAGE_FACTORS[number];
export declare const TopazImageModel: {
    readonly standardV2: "Standard V2";
    readonly lowResolutionV2: "Low Resolution V2";
    readonly cgi: "CGI";
    readonly highFidelityV2: "High Fidelity V2";
    readonly textRefine: "Text Refine";
};
export declare const TOPAZ_IMAGE_MODELS: ("Standard V2" | "Low Resolution V2" | "CGI" | "High Fidelity V2" | "Text Refine")[];
export type TopazImageModelValue = typeof TOPAZ_IMAGE_MODELS[number];
type UpscaleQuality = 'largest' | '8K' | '4K' | '2K' | '1080p' | '720p' | '500p';
export declare function imageQuality(size: Size): UpscaleQuality;
export declare function availableImageFactors(size: Size): UpscaleImageFactorValue[];
export declare function scaleImageSize(size: Size, factor: UpscaleImageFactorValue): Size;
export declare function firstMediaSizeOrSettings(input: GenerationInput, roles: readonly string[], wire: Record<string, unknown>): Size | undefined;
export declare function requirePositiveSize(field: string, size: Size | undefined): MediaIssue[];
export declare function range(field: string, value: number | null | undefined, min: number, max: number): MediaIssue[];
export declare function oneOfString(field: string, value: unknown, options: readonly string[]): MediaIssue[];
export declare function imageFactorIssues(media: MediaInput | undefined, factor: string | undefined): MediaIssue[];
export declare const VideoScaleFactor: {
    readonly original: "Original";
    readonly fullHd: "FULL_HD";
    readonly r2k: "2k";
    readonly r4k: "4k";
};
export declare const VIDEO_SCALE_FACTORS: ("2k" | "4k" | "Original" | "FULL_HD")[];
export type VideoScaleFactorValue = typeof VIDEO_SCALE_FACTORS[number];
export declare function scaleVideoSize(factor: VideoScaleFactorValue, inputSize: Size): Size;
export declare function topazFixedVideoSize(resolution: '1080p' | '2160p'): Size;
export declare function firstDuration(media: MediaInput | undefined, roles: readonly string[]): number | undefined;
export declare function localBytedanceVideoCredits(resolution: '1080p' | '2k' | '4k', duration: number | undefined, fps: number): number | null;
export declare function stripUndefined<T extends Record<string, unknown>>(value: T): T;
export {};
//# sourceMappingURL=upscale-helpers.d.ts.map