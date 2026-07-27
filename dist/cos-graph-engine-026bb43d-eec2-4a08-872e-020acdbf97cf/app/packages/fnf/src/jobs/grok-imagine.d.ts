export declare const GrokImagineAspectRatio: {
    readonly auto: "auto";
    readonly r16x9: "16:9";
    readonly r9x16: "9:16";
    readonly r4x3: "4:3";
    readonly r3x4: "3:4";
    readonly r3x2: "3:2";
    readonly r2x3: "2:3";
    readonly r1x1: "1:1";
};
export declare const GrokImagineResolution: {
    readonly r480: "480p";
    readonly r720: "720p";
};
export declare const grokImagine: import("..").JobEntry<"grok_video", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"start_image", true>>;
export declare const grokImagineV15: import("..").JobEntry<"grok_video_v15", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"start_image", true>>;
//# sourceMappingURL=grok-imagine.d.ts.map