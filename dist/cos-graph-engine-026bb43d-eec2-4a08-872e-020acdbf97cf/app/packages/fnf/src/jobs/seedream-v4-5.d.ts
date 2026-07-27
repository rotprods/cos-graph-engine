export declare const SeedreamV4_5AspectRatio: {
    readonly r1x1: "1:1";
    readonly r4x3: "4:3";
    readonly r16x9: "16:9";
    readonly r3x2: "3:2";
    readonly r21x9: "21:9";
    readonly r3x4: "3:4";
    readonly r9x16: "9:16";
    readonly r2x3: "2:3";
};
type Quality = 'basic' | 'high';
/**
 * Seedream 4.5. Grounded in fnf-web's `job-image-seedream-v4-5` module.
 * The app derives width/height from the first input image when present,
 * otherwise it submits a 1024x1024 default.
 */
export declare const seedreamV4_5: import("..").JobEntry<"seedream_v4_5", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"image", true>>;
export type SeedreamV4_5Quality = Quality;
export {};
//# sourceMappingURL=seedream-v4-5.d.ts.map