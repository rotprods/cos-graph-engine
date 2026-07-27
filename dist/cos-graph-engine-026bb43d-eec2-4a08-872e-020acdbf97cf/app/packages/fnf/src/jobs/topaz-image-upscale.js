"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topazImageGenerativeUpscale = exports.topazImageUpscale = exports.TopazImageUpscaleFactor = exports.TopazImageModel = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const upscale_helpers_1 = require("./upscale-helpers");
Object.defineProperty(exports, "TopazImageModel", { enumerable: true, get: function () { return upscale_helpers_1.TopazImageModel; } });
Object.defineProperty(exports, "TopazImageUpscaleFactor", { enumerable: true, get: function () { return upscale_helpers_1.UpscaleImageFactor; } });
const video_helpers_1 = require("./video-helpers");
function sourceSize(input) {
    const meta = (0, video_helpers_1.firstMetaSize)(input.media, ['image']);
    if (meta)
        return meta;
    const settings = input.settings;
    return settings.sourceWidth != null && settings.sourceHeight != null
        ? { width: settings.sourceWidth, height: settings.sourceHeight }
        : undefined;
}
function finalizeTopazImage(wire, input, model) {
    const size = sourceSize(input);
    const factor = (wire.factor ?? 'x1');
    const output = wire.output_width != null && wire.output_height != null
        ? { width: wire.output_width, height: wire.output_height }
        : size
            ? (0, upscale_helpers_1.scaleImageSize)(size, factor)
            : undefined;
    const rest = { ...wire };
    delete rest.factor;
    return (0, upscale_helpers_1.stripUndefined)({
        ...rest,
        model,
        width: size?.width,
        height: size?.height,
        output_width: output?.width,
        output_height: output?.height,
    });
}
function baseValidate(input) {
    const settings = input.settings;
    const size = sourceSize(input);
    return [
        ...(0, upscale_helpers_1.requirePositiveSize)('sourceSize', size),
        ...(0, checks_1.oneOf)('factor', settings.factor, upscale_helpers_1.UPSCALE_IMAGE_FACTORS),
        ...(0, upscale_helpers_1.imageFactorIssues)(input.media, settings.factor),
        ...(0, upscale_helpers_1.range)('sourceWidth', settings.sourceWidth, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('sourceHeight', settings.sourceHeight, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('outputWidth', settings.outputWidth, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('outputHeight', settings.outputHeight, 1, Number.MAX_SAFE_INTEGER),
        ...(0, upscale_helpers_1.range)('denoise', settings.denoise, 0, 1),
        ...(0, upscale_helpers_1.range)('sharpen', settings.sharpen, 0, 1),
        ...(0, upscale_helpers_1.range)('faceEnhancementCreativity', settings.faceEnhancementCreativity, 0, 1),
        ...(0, upscale_helpers_1.range)('faceEnhancementStrength', settings.faceEnhancementStrength, 0, 1),
    ];
}
const baseSettings = {
    sourceWidth: z_1.z.wire('width', z_1.z.optional(z_1.z.number())),
    sourceHeight: z_1.z.wire('height', z_1.z.optional(z_1.z.number())),
    outputWidth: z_1.z.wire('output_width', z_1.z.optional(z_1.z.number())),
    outputHeight: z_1.z.wire('output_height', z_1.z.optional(z_1.z.number())),
    factor: z_1.z._default(z_1.z.enum(upscale_helpers_1.UPSCALE_IMAGE_FACTORS), upscale_helpers_1.UpscaleImageFactor.x1),
    denoise: z_1.z._default(z_1.z.number(), 0.2),
    sharpen: z_1.z._default(z_1.z.number(), 0.3),
    faceEnhancement: z_1.z.wire('face_enhancement', z_1.z._default(z_1.z.boolean(), false)),
    faceEnhancementCreativity: z_1.z.wire('face_enhancement_creativity', z_1.z._default(z_1.z.number(), 0)),
    faceEnhancementStrength: z_1.z.wire('face_enhancement_strength', z_1.z._default(z_1.z.number(), 0.8)),
};
exports.topazImageUpscale = (0, define_job_1.defineJob)({
    jobSetType: 'topaz_image',
    outputType: 'image',
    params: {
        media: {
            field: 'input_image',
            format: 'single',
            roles: ['image'],
            counts: { image: { min: 1, max: 1 } },
        },
        settings: {
            ...baseSettings,
            model: z_1.z._default(z_1.z.enum(upscale_helpers_1.TOPAZ_IMAGE_MODELS), upscale_helpers_1.TopazImageModel.standardV2),
        },
    },
    validate: input => [
        ...baseValidate(input),
        ...(0, checks_1.oneOf)('model', input.settings.model, upscale_helpers_1.TOPAZ_IMAGE_MODELS),
    ],
    finalize: (wire, input) => finalizeTopazImage(wire, input, (wire.model ?? upscale_helpers_1.TopazImageModel.standardV2)),
});
exports.topazImageGenerativeUpscale = (0, define_job_1.defineJob)({
    jobSetType: 'topaz_image_generative',
    outputType: 'image',
    params: {
        prompt: true,
        media: {
            field: 'input_image',
            format: 'single',
            roles: ['image'],
            counts: { image: { min: 1, max: 1 } },
        },
        settings: {
            ...baseSettings,
            detail: z_1.z._default(z_1.z.number(), 1),
            texture: z_1.z._default(z_1.z.number(), 1),
            creativity: z_1.z._default(z_1.z.number(), 1),
            autoprompt: z_1.z._default(z_1.z.boolean(), true),
        },
    },
    validate: input => [
        ...baseValidate(input),
        ...(0, upscale_helpers_1.range)('detail', input.settings.detail, 0, 1),
        ...(0, checks_1.intRange)('texture', input.settings.texture, 1, 5),
        ...(0, checks_1.intRange)('creativity', input.settings.creativity, 1, 6),
    ],
    finalize: (wire, input) => finalizeTopazImage(wire, input, 'Redefine'),
});
//# sourceMappingURL=topaz-image-upscale.js.map