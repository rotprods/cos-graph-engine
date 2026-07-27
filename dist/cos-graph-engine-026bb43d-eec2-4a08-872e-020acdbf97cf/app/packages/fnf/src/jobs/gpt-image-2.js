"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gptImage2 = exports.GptImage2AspectRatio = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
const image_helpers_1 = require("./image-helpers");
exports.GptImage2AspectRatio = {
    auto: 'auto',
    r1x1: '1:1',
    r3x2: '3:2',
    r2x3: '2:3',
    r16x9: '16:9',
    r9x16: '9:16',
    r4x3: '4:3',
    r3x4: '3:4',
    r21x9: '21:9',
};
const CONCRETE_RATIOS = {
    '1:1': [1, 1],
    '3:2': [3, 2],
    '2:3': [2, 3],
    '16:9': [16, 9],
    '9:16': [9, 16],
    '4:3': [4, 3],
    '3:4': [3, 4],
    '21:9': [21, 9],
};
const BASE_SIZE = {
    '1k': 1024,
    '2k': 2048,
    '4k': 4096,
};
const CREDITS_PER_IMAGE = {
    low: { '1k': 0.5, '2k': 0.75, '4k': 1 },
    medium: { '1k': 2, '2k': 3, '4k': 6 },
    high: { '1k': 4, '2k': 7, '4k': 12 },
};
const SUB_MODELS = ['videotape-alpha', 'cassettetape-alpha', 'electricaltape-alpha', 'tidepool-alpha'];
function dimensionsFor(aspectRatio, resolution) {
    const base = BASE_SIZE[resolution];
    if (aspectRatio === 'auto')
        return { width: base, height: base };
    return (0, image_helpers_1.dimensionsFromRatios)(CONCRETE_RATIOS, aspectRatio, base);
}
exports.gptImage2 = (0, define_job_1.defineJob)({
    jobSetType: 'gpt_image_2',
    outputType: 'image',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['image'],
            counts: { image: { max: 16 } },
            rules: [(0, media_1.dimensionsWithin)(['image'], { minSide: 300, ratio: [0.4, 2.5] })],
        },
        settings: {
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(Object.values(exports.GptImage2AspectRatio)), 'auto')),
            quality: z_1.z._default(z_1.z.enum(['low', 'medium', 'high']), 'high'),
            resolution: z_1.z._default(z_1.z.enum(['1k', '2k', '4k']), '2k'),
            subModel: z_1.z.wire('sub_model', z_1.z._default(z_1.z.enum(SUB_MODELS), 'videotape-alpha')),
            batchSize: z_1.z.wire('batch_size', z_1.z._default(z_1.z.number(), 1)),
        },
    },
    credits: ({ settings }) => {
        const quality = settings.quality ?? 'high';
        const resolution = settings.resolution ?? '2k';
        return (settings.batchSize ?? 1) * CREDITS_PER_IMAGE[quality][resolution];
    },
    validate: ({ prompt, settings }) => [
        ...(0, checks_1.promptRequired)(prompt),
        ...(0, checks_1.intRange)('batchSize', settings.batchSize, 1, 4),
        ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, Object.values(exports.GptImage2AspectRatio)),
    ],
    finalize: (wire, input) => {
        const aspectRatio = wire.aspect_ratio;
        const resolution = (wire.resolution ?? '2k');
        const size = aspectRatio === 'auto'
            ? (0, dimensions_1.firstSizeMeta)(input.media, ['image']) ?? dimensionsFor(aspectRatio, resolution)
            : dimensionsFor(aspectRatio, resolution);
        return {
            ...wire,
            model: 'gpt_image_2',
            width: size.width,
            height: size.height,
        };
    },
});
//# sourceMappingURL=gpt-image-2.js.map