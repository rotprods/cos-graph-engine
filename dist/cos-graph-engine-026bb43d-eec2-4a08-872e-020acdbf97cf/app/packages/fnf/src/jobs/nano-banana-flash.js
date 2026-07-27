"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoBananaFlash = exports.NanoBananaFlashAspectRatio = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const nano_banana_shared_1 = require("./nano-banana-shared");
Object.defineProperty(exports, "NanoBananaFlashAspectRatio", { enumerable: true, get: function () { return nano_banana_shared_1.NanoBananaAspectRatio; } });
const MAX_PROMPT_CHARACTERS = 15_000;
const CREDITS_PER_IMAGE = {
    '1k': 1.5,
    '2k': 2,
    '4k': 3,
};
/**
 * Nano Banana 2. Grounded in fnf-web's `job-image-nano-banana-flash` module.
 * This is separate from Nano Banana Pro: it posts to `/jobs/v2/nano_banana_flash`
 * and uses wrapped `medias` rather than bare `input_images`.
 */
exports.nanoBananaFlash = (0, define_job_1.defineJob)({
    jobSetType: 'nano_banana_flash',
    outputType: 'image',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['image'],
            counts: { image: { max: 14 } },
            rules: [(0, media_1.dimensionsWithin)(['image'], { minSide: 128 })],
        },
        settings: {
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(nano_banana_shared_1.NANO_BANANA_ASPECT_RATIO_VALUES), '3:4')),
            resolution: z_1.z._default(z_1.z.enum(['1k', '2k', '4k']), '1k'),
            batchSize: z_1.z.wire('batch_size', z_1.z._default(z_1.z.number(), 1)),
        },
    },
    credits: ({ settings }) => (settings.batchSize ?? 1) * CREDITS_PER_IMAGE[settings.resolution ?? '1k'],
    validate: ({ prompt, settings }) => [
        ...(0, checks_1.promptRequired)(prompt, 2),
        ...(0, checks_1.promptMax)(prompt, MAX_PROMPT_CHARACTERS, { inclusive: true }),
        ...(0, checks_1.intRange)('batchSize', settings.batchSize, 1, 4),
        ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, nano_banana_shared_1.NANO_BANANA_ASPECT_RATIO_VALUES),
    ],
    finalize: (wire, input) => {
        const ratio = (0, nano_banana_shared_1.resolveNanoBananaRatio)(input, ['image'], wire.aspect_ratio);
        const { width, height } = (0, nano_banana_shared_1.getNanoBananaDimensions)((wire.resolution ?? '1k'), ratio);
        return {
            ...wire,
            aspect_ratio: ratio,
            width,
            height,
        };
    },
});
//# sourceMappingURL=nano-banana-flash.js.map