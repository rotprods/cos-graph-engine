export declare const GptImage2AspectRatio: {
    readonly auto: "auto";
    readonly r1x1: "1:1";
    readonly r3x2: "3:2";
    readonly r2x3: "2:3";
    readonly r16x9: "16:9";
    readonly r9x16: "9:16";
    readonly r4x3: "4:3";
    readonly r3x4: "3:4";
    readonly r21x9: "21:9";
};
export type GptImage2AspectRatioValue = typeof GptImage2AspectRatio[keyof typeof GptImage2AspectRatio];
export declare const gptImage2: import("..").JobEntry<"gpt_image_2", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"image", true>>;
//# sourceMappingURL=gpt-image-2.d.ts.map