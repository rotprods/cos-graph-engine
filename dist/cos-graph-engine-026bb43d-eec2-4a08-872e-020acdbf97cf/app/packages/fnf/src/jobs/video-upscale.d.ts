export declare const TopazVideoModel: {
    readonly proteus: "prob-4";
    readonly starlightCreative: "slc-1";
    readonly starlightFast: "slf-1";
    readonly starlightPrecise: "slp-2.5";
};
export declare const TopazVideoEnhancementModel: {
    readonly proteus: "prob-4";
    readonly artemis: "ahq-12";
    readonly iris: "iris-3";
    readonly rhea: "rhea-1";
    readonly gaia: "ghq-5";
    readonly theia: "thd-3";
    readonly starlightCreative: "slc-1";
    readonly starlightFast: "slf-1";
    readonly starlightPrecise: "slp-2.5";
};
export declare const TopazVideoFocusFix: {
    readonly normal: "Normal";
    readonly strong: "Strong";
};
export declare const TopazVideoParameters: {
    readonly auto: "auto";
    readonly manual: "manual";
};
export declare const TopazVideoResolution: {
    readonly r1080: "1080p";
    readonly r2160: "2160p";
};
export declare const BytedanceVideoUpscaleResolution: {
    readonly r1080: "1080p";
    readonly r2k: "2k";
    readonly r4k: "4k";
};
export declare const BytedanceVideoUpscalePreset: {
    readonly common: "common";
    readonly aigc: "aigc";
    readonly shortSeries: "short_series";
    readonly ugc: "ugc";
    readonly oldFilm: "old_film";
};
export declare const topazVideoUpscale: import("..").JobEntry<"topaz_video", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"video", false>>;
export declare const higgsfieldVideoUpscale: import("..").JobEntry<"video_upscale" | "video_deflicker", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"video", false>>;
export declare const soraEnhanceVideo: import("..").JobEntry<"video_upscale" | "video_deflicker", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"video", false>>;
export declare const bytedanceVideoUpscale: import("..").JobEntry<"bytedance_video_upscale", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"video", false>>;
//# sourceMappingURL=video-upscale.d.ts.map