"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedreamV4_5 = exports.SeedreamV4_5AspectRatio = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
exports.SeedreamV4_5AspectRatio = {
    r1x1: '1:1',
    r4x3: '4:3',
    r16x9: '16:9',
    r3x2: '3:2',
    r21x9: '21:9',
    r3x4: '3:4',
    r9x16: '9:16',
    r2x3: '2:3',
};
const MAX_PROMPT_CHARACTERS = 3_000;
/**
 * Seedream 4.5. Grounded in fnf-web's `job-image-seedream-v4-5` module.
 * The app derives width/height from the first input image when present,
 * otherwise it submits a 1024x1024 default.
 */
exports.seedreamV4_5 = (0, define_job_1.defineJob)({
    jobSetType: 'seedream_v4_5',
    outputType: 'image',
    params: {
        prompt: true,
        media: {
            field: 'input_images',
            format: 'unwrapped',
            roles: ['image'],
            counts: { image: { max: 14 } },
        },
        settings: {
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(Object.values(exports.SeedreamV4_5AspectRatio)), '3:4')),
            quality: z_1.z._default(z_1.z.enum(['basic', 'high']), 'basic'),
            batchSize: z_1.z.wire('batch_size', z_1.z._default(z_1.z.number(), 1)),
            // The backend requires params.seed (422 'Field required' without it) —
            // default a random one like the product form does.
            seed: z_1.z._default(z_1.z.number(), checks_1.randomSeed),
        },
    },
    credits: ({ settings }) => settings.batchSize ?? 1,
    validate: ({ prompt, settings }) => [
        ...(0, checks_1.promptRequired)(prompt),
        ...(0, checks_1.promptMax)(prompt, MAX_PROMPT_CHARACTERS),
        ...(0, checks_1.intRange)('batchSize', settings.batchSize, 1, 4),
        ...(0, checks_1.intRange)('seed', settings.seed, 1, 1_000_000),
        ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, Object.values(exports.SeedreamV4_5AspectRatio)),
    ],
    finalize: (wire, input) => {
        const size = (0, dimensions_1.firstSizeMeta)(input.media, ['image']) ?? { width: 1024, height: 1024 };
        return {
            ...wire,
            model: 'seedream_v4_5',
            width: size.width,
            height: size.height,
            input_images: wire.input_images ?? [],
        };
    },
});
//# sourceMappingURL=seedream-v4-5.js.map