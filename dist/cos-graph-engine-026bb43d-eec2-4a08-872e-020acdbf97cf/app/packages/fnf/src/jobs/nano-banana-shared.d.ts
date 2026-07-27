import type { GenerationInput } from '../types';
export declare const NanoBananaAspectRatio: {
    readonly auto: "auto";
    readonly r1x1: "1:1";
    readonly r3x2: "3:2";
    readonly r2x3: "2:3";
    readonly r4x3: "4:3";
    readonly r3x4: "3:4";
    readonly r4x5: "4:5";
    readonly r5x4: "5:4";
    readonly r9x16: "9:16";
    readonly r16x9: "16:9";
    readonly r21x9: "21:9";
};
export type NanoBananaAspectRatioValue = typeof NanoBananaAspectRatio[keyof typeof NanoBananaAspectRatio];
export type NanoBananaConcreteRatio = Exclude<NanoBananaAspectRatioValue, 'auto'>;
export type NanoBananaResolution = '1k' | '2k' | '4k';
export declare const NANO_BANANA_ASPECT_RATIO_VALUES: readonly ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"];
export declare const NANO_BANANA_CONCRETE_RATIOS: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
export declare const NANO_BANANA_SIZE_MAP: Record<NanoBananaResolution, Record<NanoBananaConcreteRatio, [number, number]>>;
export declare function resolveNanoBananaRatio(input: GenerationInput, roles: readonly string[], ratio: NanoBananaAspectRatioValue): NanoBananaConcreteRatio;
export declare function getNanoBananaDimensions(resolution: NanoBananaResolution, ratio: NanoBananaConcreteRatio): {
    width: number;
    height: number;
};
//# sourceMappingURL=nano-banana-shared.d.ts.map