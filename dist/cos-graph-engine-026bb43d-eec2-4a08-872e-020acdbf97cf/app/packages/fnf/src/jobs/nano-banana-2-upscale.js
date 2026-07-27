"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoBanana2Upscale = exports.NanoBanana2UpscaleAspectRatio = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const nano_banana_shared_1 = require("./nano-banana-shared");
Object.defineProperty(exports, "NanoBanana2UpscaleAspectRatio", { enumerable: true, get: function () { return nano_banana_shared_1.NanoBananaAspectRatio; } });
const RESOLUTIONS = ['2k', '4k'];
const CREDITS = {
    '2k': 2,
    '4k': 4,
};
exports.nanoBanana2Upscale = (0, define_job_1.defineJob)({
    jobSetType: 'nano_banana_2_upscale',
    outputType: 'image',
    params: {
        media: {
            field: 'input_images',
            format: 'unwrapped',
            roles: ['image'],
            counts: { image: { min: 1 } },
            rules: [(0, media_1.atLeastOneOf)(['image'])],
        },
        settings: {
            resolution: z_1.z._default(z_1.z.enum(RESOLUTIONS), '4k'),
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(nano_banana_shared_1.NANO_BANANA_ASPECT_RATIO_VALUES), nano_banana_shared_1.NanoBananaAspectRatio.auto)),
        },
    },
    credits: ({ settings }) => CREDITS[settings.resolution ?? '4k'],
    validate: ({ settings }) => [
        ...(0, checks_1.oneOf)('resolution', settings.resolution, RESOLUTIONS),
        ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, nano_banana_shared_1.NANO_BANANA_ASPECT_RATIO_VALUES),
    ],
    finalize: (wire, input) => {
        const ratio = (0, nano_banana_shared_1.resolveNanoBananaRatio)(input, ['image'], wire.aspect_ratio);
        const { width, height } = (0, nano_banana_shared_1.getNanoBananaDimensions)(wire.resolution, ratio);
        return {
            ...wire,
            aspect_ratio: ratio,
            width,
            height,
        };
    },
});
//# sourceMappingURL=nano-banana-2-upscale.js.map