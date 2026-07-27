"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytedanceVideoUpscale = exports.soraEnhanceVideo = exports.higgsfieldVideoUpscale = exports.topazVideoUpscale = exports.BytedanceVideoUpscalePreset = exports.BytedanceVideoUpscaleResolution = exports.TopazVideoResolution = exports.TopazVideoParameters = exports.TopazVideoFocusFix = exports.TopazVideoEnhancementModel = exports.TopazVideoModel = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const upscale_helpers_1 = require("./upscale-helpers");
const video_helpers_1 = require("./video-helpers");
exports.TopazVideoModel = {
    proteus: 'prob-4',
    starlightCreative: 'slc-1',
    starlightFast: 'slf-1',
    starlightPrecise: 'slp-2.5',
};
exports.TopazVideoEnhancementModel = {
    proteus: 'prob-4',
    artemis: 'ahq-12',
    iris: 'iris-3',
    rhea: 'rhea-1',
    gaia: 'ghq-5',
    theia: 'thd-3',
    starlightCreative: 'slc-1',
    starlightFast: 'slf-1',
    starlightPrecise: 'slp-2.5',
};
exports.TopazVideoFocusFix = {
    normal: 'Normal',
    strong: 'Strong',
};
exports.TopazVideoParameters = {
    auto: 'auto',
    manual: 'manual',
};
exports.TopazVideoResolution = {
    r1080: '1080p',
    r2160: '2160p',
};
exports.BytedanceVideoUpscaleResolution = {
    r1080: '1080p',
    r2k: '2k',
    r4k: '4k',
};
exports.BytedanceVideoUpscalePreset = {
    common: 'common',
    aigc: 'aigc',
    shortSeries: 'short_series',
    ugc: 'ugc',
    oldFilm: 'old_film',
};
const TOPAZ_MODELS = Object.values(exports.TopazVideoModel);
const TOPAZ_ENHANCEMENT_MODELS = Object.values(exports.TopazVideoEnhancementModel);
const FOCUS_FIXES = Object.values(exports.TopazVideoFocusFix);
const PARAMETER_MODES = Object.values(exports.TopazVideoParameters);
const TOPAZ_RESOLUTIONS = Object.values(exports.TopazVideoResolution);
const BYTEDANCE_RESOLUTIONS = Object.values(exports.BytedanceVideoUpscaleResolution);
const BYTEDANCE_PRESETS = Object.values(exports.BytedanceVideoUpscalePreset);
function videoSourceSize(input, roles = ['video']) {
    const meta = (0, video_helpers_1.firstMetaSize)(input.media, roles);
    if (meta)
        return meta;
    const settings = input.settings;
    return settings.sourceWidth != null && settings.sourceHeight != null
        ? { width: settings.sourceWidth, height: settings.sourceHeight }
        : undefined;
}
function videoSourceIssues(input) {
    const settings = input.settings;
    return [
        ...(0, upscale_helpers_1.requirePositiveSize)('sourceSize', videoSourceSize(input)),
        ...(0, upscale_helpers_1.range)('sourceWidth', settings.sourceWidth, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('sourceHeight', settings.sourceHeight, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('outputWidth', settings.outputWidth, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('outputHeight', settings.outputHeight, 1, Number.MAX_SAFE_INTEGER),
        ...(0, checks_1.oneOf)('scaleFactor', settings.scaleFactor, upscale_helpers_1.VIDEO_SCALE_FACTORS),
    ];
}
function resolveVideoOutput(wire, source) {
    if (wire.output_width != null && wire.output_height != null)
        return { width: wire.output_width, height: wire.output_height };
    const factor = wire.scaleFactor;
    if (factor && factor !== upscale_helpers_1.VideoScaleFactor.original)
        return (0, upscale_helpers_1.scaleVideoSize)(factor, source);
    const resolution = wire.resolution;
    if (resolution)
        return (0, upscale_helpers_1.topazFixedVideoSize)(resolution);
    const model = wire.model;
    if (model === 'slc-1' || model === 'slf-1' || model === 'slp-2.5')
        return (0, upscale_helpers_1.topazFixedVideoSize)('2160p');
    return source;
}
function topazVideoSettings() {
    return {
        sourceWidth: z_1.z.wire('width', z_1.z.optional(z_1.z.number())),
        sourceHeight: z_1.z.wire('height', z_1.z.optional(z_1.z.number())),
        outputWidth: z_1.z.wire('output_width', z_1.z.optional(z_1.z.number())),
        outputHeight: z_1.z.wire('output_height', z_1.z.optional(z_1.z.number())),
        scaleFactor: z_1.z._default(z_1.z.enum(upscale_helpers_1.VIDEO_SCALE_FACTORS), upscale_helpers_1.VideoScaleFactor.original),
        resolution: z_1.z.optional(z_1.z.enum(TOPAZ_RESOLUTIONS)),
        model: z_1.z._default(z_1.z.enum(TOPAZ_MODELS), exports.TopazVideoModel.starlightPrecise),
        enhancement: z_1.z._default(z_1.z.boolean(), true),
        enhancementModel: z_1.z._default(z_1.z.enum(TOPAZ_ENHANCEMENT_MODELS), exports.TopazVideoEnhancementModel.starlightPrecise),
        focusFix: z_1.z.wire('focus_fix_level', z_1.z._default(z_1.z.enum(FOCUS_FIXES), exports.TopazVideoFocusFix.normal)),
        parameters: z_1.z._default(z_1.z.enum(PARAMETER_MODES), exports.TopazVideoParameters.auto),
        compression: z_1.z.optional(z_1.z.number()),
        details: z_1.z.optional(z_1.z.number()),
        preblur: z_1.z.optional(z_1.z.number()),
        blur: z_1.z.optional(z_1.z.number()),
        noise: z_1.z.optional(z_1.z.number()),
        halo: z_1.z.optional(z_1.z.number()),
        grainEnabled: z_1.z._default(z_1.z.boolean(), false),
        grainStrength: z_1.z._default(z_1.z.number(), 0.04),
        grainSize: z_1.z._default(z_1.z.number(), 0.02),
        frameInterpolation: z_1.z._default(z_1.z.boolean(), false),
        frameInterpolationFps: z_1.z._default(z_1.z.number(), 24),
        slowMotion: z_1.z._default(z_1.z.number(), 1),
    };
}
function stripTopazControlFields(wire) {
    const rest = { ...wire };
    for (const key of [
        'scaleFactor',
        'resolution',
        'enhancement',
        'enhancementModel',
        'focus_fix_level',
        'parameters',
        'compression',
        'details',
        'preblur',
        'blur',
        'noise',
        'halo',
        'grainEnabled',
        'grainStrength',
        'grainSize',
        'frameInterpolation',
        'frameInterpolationFps',
        'slowMotion',
    ])
        delete rest[key];
    return rest;
}
function manualParams(wire) {
    if (wire.parameters !== exports.TopazVideoParameters.manual)
        return null;
    return {
        compression: wire.compression ?? -0.6,
        details: wire.details ?? -0.4,
        preblur: wire.preblur ?? -1,
        blur: wire.blur ?? -0.8,
        noise: wire.noise ?? -0.7,
        halo: wire.halo ?? -1,
        grain: wire.grainEnabled === true
            ? {
                strength: wire.grainStrength ?? 0.04,
                size: wire.grainSize ?? 0.02,
            }
            : null,
    };
}
exports.topazVideoUpscale = (0, define_job_1.defineJob)({
    jobSetType: 'topaz_video',
    outputType: 'video',
    params: {
        media: {
            field: 'input_video',
            format: 'single',
            roles: ['video'],
            counts: { video: { min: 1, max: 1 } },
        },
        settings: topazVideoSettings(),
    },
    validate: (input) => {
        const settings = input.settings;
        return [
            ...videoSourceIssues(input),
            ...(0, checks_1.oneOf)('model', settings.model, TOPAZ_MODELS),
            ...(0, checks_1.oneOf)('enhancementModel', settings.enhancementModel, TOPAZ_ENHANCEMENT_MODELS),
            ...(0, checks_1.oneOf)('focusFix', settings.focusFix, FOCUS_FIXES),
            ...(0, checks_1.oneOf)('parameters', settings.parameters, PARAMETER_MODES),
            ...(0, checks_1.oneOf)('resolution', settings.resolution, TOPAZ_RESOLUTIONS),
            ...(0, upscale_helpers_1.range)('compression', settings.compression, -1, 1),
            ...(0, upscale_helpers_1.range)('details', settings.details, -1, 1),
            ...(0, upscale_helpers_1.range)('preblur', settings.preblur, -1, 1),
            ...(0, upscale_helpers_1.range)('blur', settings.blur, -1, 1),
            ...(0, upscale_helpers_1.range)('noise', settings.noise, -1, 1),
            ...(0, upscale_helpers_1.range)('halo', settings.halo, -1, 1),
            ...(0, upscale_helpers_1.range)('grainStrength', settings.grainStrength, 0, 0.1),
            ...(0, upscale_helpers_1.range)('grainSize', settings.grainSize, 0, 0.1),
            ...(settings.frameInterpolation === true
                ? [
                    ...(0, checks_1.intRange)('frameInterpolationFps', settings.frameInterpolationFps, 15, 240),
                    ...(0, video_helpers_1.integerRange)('frameInterpolationFps', settings.frameInterpolationFps, 15, 240),
                    ...(0, checks_1.intRange)('slowMotion', settings.slowMotion, 1, 16),
                    ...(0, video_helpers_1.integerRange)('slowMotion', settings.slowMotion, 1, 16),
                ]
                : []),
        ];
    },
    finalize: (wire, input) => {
        const source = videoSourceSize(input);
        const output = resolveVideoOutput(wire, source);
        const rest = stripTopazControlFields(wire);
        return (0, upscale_helpers_1.stripUndefined)({
            ...rest,
            width: source.width,
            height: source.height,
            output_width: output.width,
            output_height: output.height,
            model: (wire.model ?? exports.TopazVideoModel.starlightPrecise),
            enhancement: wire.enhancement === false
                ? null
                : {
                    model: (wire.enhancementModel ?? exports.TopazVideoEnhancementModel.starlightPrecise),
                    focus_fix_level: wire.focus_fix_level ?? exports.TopazVideoFocusFix.normal,
                    params: manualParams(wire),
                },
            frame_interpolation: wire.frameInterpolation === true
                ? { model: 'apo-8', fps: wire.frameInterpolationFps ?? 24, slowmo: wire.slowMotion ?? 1 }
                : null,
        });
    },
});
function simpleVideoUpscale(jobSetType) {
    return (0, define_job_1.defineJob)({
        jobSetType,
        outputType: 'video',
        params: {
            media: {
                field: 'input_video',
                format: 'single',
                roles: ['video'],
                counts: { video: { min: 1, max: 1 } },
            },
            settings: {
                sourceWidth: z_1.z.wire('width', z_1.z.optional(z_1.z.number())),
                sourceHeight: z_1.z.wire('height', z_1.z.optional(z_1.z.number())),
                outputWidth: z_1.z.wire('output_width', z_1.z.optional(z_1.z.number())),
                outputHeight: z_1.z.wire('output_height', z_1.z.optional(z_1.z.number())),
                scaleFactor: z_1.z._default(z_1.z.enum(upscale_helpers_1.VIDEO_SCALE_FACTORS), upscale_helpers_1.VideoScaleFactor.original),
            },
        },
        credits: () => 2,
        validate: videoSourceIssues,
        finalize: (wire, input) => {
            const source = videoSourceSize(input);
            const output = wire.output_width != null && wire.output_height != null
                ? { width: wire.output_width, height: wire.output_height }
                : (0, upscale_helpers_1.scaleVideoSize)((wire.scaleFactor ?? upscale_helpers_1.VideoScaleFactor.original), source);
            const rest = { ...wire };
            delete rest.scaleFactor;
            return (0, upscale_helpers_1.stripUndefined)({
                ...rest,
                width: source.width,
                height: source.height,
                output_width: output.width,
                output_height: output.height,
            });
        },
    });
}
exports.higgsfieldVideoUpscale = simpleVideoUpscale('video_upscale');
exports.soraEnhanceVideo = simpleVideoUpscale('video_deflicker');
exports.bytedanceVideoUpscale = (0, define_job_1.defineJob)({
    jobSetType: 'bytedance_video_upscale',
    outputType: 'video',
    params: {
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['video'],
            counts: { video: { min: 1, max: 1 } },
        },
        settings: {
            sourceWidth: z_1.z.wire('width', z_1.z.optional(z_1.z.number())),
            sourceHeight: z_1.z.wire('height', z_1.z.optional(z_1.z.number())),
            resolution: z_1.z._default(z_1.z.enum(BYTEDANCE_RESOLUTIONS), exports.BytedanceVideoUpscaleResolution.r2k),
            preset: z_1.z._default(z_1.z.enum(BYTEDANCE_PRESETS), exports.BytedanceVideoUpscalePreset.common),
            fps: z_1.z._default(z_1.z.number(), 24),
        },
    },
    credits: ({ settings, media }) => (0, upscale_helpers_1.localBytedanceVideoCredits)(settings.resolution ?? '2k', (0, upscale_helpers_1.firstDuration)(media, ['video']), settings.fps ?? 24),
    validate: (input) => {
        const settings = input.settings;
        return [
            ...videoSourceIssues(input),
            ...(0, checks_1.oneOf)('resolution', settings.resolution, BYTEDANCE_RESOLUTIONS),
            ...(0, checks_1.oneOf)('preset', settings.preset, BYTEDANCE_PRESETS),
            ...(0, checks_1.intRange)('fps', settings.fps, 1, 240),
            ...(0, video_helpers_1.integerRange)('fps', settings.fps, 1, 240),
        ];
    },
    finalize: (wire, input) => {
        const source = videoSourceSize(input);
        return (0, upscale_helpers_1.stripUndefined)({
            ...wire,
            width: source.width,
            height: source.height,
        });
    },
});
//# sourceMappingURL=video-upscale.js.map