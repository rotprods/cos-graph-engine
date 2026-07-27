"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.happyHorse = exports.HappyHorseResolution = exports.HappyHorseAspectRatio = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
const video_helpers_1 = require("./video-helpers");
exports.HappyHorseAspectRatio = {
    r16x9: '16:9',
    r9x16: '9:16',
    r1x1: '1:1',
    r4x3: '4:3',
    r3x4: '3:4',
};
exports.HappyHorseResolution = {
    r720: '720p',
    r1080: '1080p',
};
const ASPECT_RATIOS = Object.values(exports.HappyHorseAspectRatio);
const RESOLUTIONS = Object.values(exports.HappyHorseResolution);
const SIZE_MAP = {
    '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720], '4:3': [960, 720], '3:4': [720, 960] },
    '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:3': [1440, 1080], '3:4': [1080, 1440] },
};
exports.happyHorse = (0, define_job_1.defineJob)({
    jobSetType: 'happy_horse_video',
    outputType: 'video',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['start_image'],
            counts: { start_image: { max: 1 } },
        },
        settings: {
            resolution: z_1.z._default(z_1.z.enum(RESOLUTIONS), '720p'),
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(ASPECT_RATIOS), '16:9')),
            duration: z_1.z._default(z_1.z.duration({ min: 3, max: 15 }), 5),
            batchSize: z_1.z.wire('batch_size', z_1.z._default(z_1.z.number(), 1)),
            seed: z_1.z.optional(z_1.z.number()),
        },
    },
    validate: input => [
        ...(0, video_helpers_1.requiredPromptOrRole)(input, 'start_image', 'Prompt is required when no image is provided'),
        ...(0, checks_1.promptMax)(input.prompt, 4000),
        ...(0, checks_1.oneOf)('resolution', input.settings.resolution, RESOLUTIONS),
        ...(0, checks_1.oneOf)('aspectRatio', input.settings.aspectRatio, ASPECT_RATIOS),
        ...(0, checks_1.intRange)('duration', input.settings.duration, 3, 15),
        ...(0, video_helpers_1.integerRange)('duration', input.settings.duration, 3, 15),
        ...(0, checks_1.intRange)('batchSize', input.settings.batchSize, 1, 4),
        ...(0, video_helpers_1.integerRange)('batchSize', input.settings.batchSize, 1, 4),
    ],
    finalize: (wire, input) => {
        const measured = (0, video_helpers_1.firstMetaSize)(input.media, ['start_image']);
        const table = (0, dimensions_1.lookupSize)(SIZE_MAP, wire.resolution, wire.aspect_ratio);
        return {
            ...wire,
            prompt: wire.prompt ?? '',
            seed: wire.seed ?? (0, checks_1.randomSeed)(),
            width: measured?.width ?? table.width,
            height: measured?.height ?? table.height,
            medias: wire.medias ?? [],
        };
    },
});
//# sourceMappingURL=happy-horse.js.map