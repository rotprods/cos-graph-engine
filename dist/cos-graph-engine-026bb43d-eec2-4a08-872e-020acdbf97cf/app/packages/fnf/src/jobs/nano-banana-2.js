"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoBanana2 = exports.NanoBanana2AspectRatio = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const nano_banana_shared_1 = require("./nano-banana-shared");
Object.defineProperty(exports, "NanoBanana2AspectRatio", { enumerable: true, get: function () { return nano_banana_shared_1.NanoBananaAspectRatio; } });
const MAX_PROMPT_CHARACTERS = 15_000;
const CREDITS_PER_IMAGE = {
    '1k': 2,
    '2k': 2,
    '4k': 4,
};
/**
 * Nano Banana Pro. Grounded in fnf-web's `job-image-nano-banana-2` module.
 * The app submits `/jobs/nano-banana-2` with `input_images` kept as a bare
 * array. Public settings carry ONLY user generation input — the product's
 * surface/billing markers (application_slug, is_draw/is_ugc/…, use_unlim,
 * use_seedream_bonus) are not part of the SDK surface; deliberate raw wire
 * fields belong in `extra`.
 */
exports.nanoBanana2 = (0, define_job_1.defineJob)({
    jobSetType: 'nano_banana_2',
    outputType: 'image',
    params: {
        prompt: true,
        media: {
            field: 'input_images',
            format: 'unwrapped',
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
            input_images: wire.input_images ?? [],
        };
    },
});
//# sourceMappingURL=nano-banana-2.js.map