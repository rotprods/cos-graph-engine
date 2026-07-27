"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wan27 = exports.Wan27Quality = exports.Wan27AspectRatio = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
const video_helpers_1 = require("./video-helpers");
exports.Wan27AspectRatio = {
    r16x9: '16:9',
    r9x16: '9:16',
    r4x3: '4:3',
    r3x4: '3:4',
    r1x1: '1:1',
};
exports.Wan27Quality = {
    r720: '720p',
    r1080: '1080p',
};
const ASPECT_RATIOS = Object.values(exports.Wan27AspectRatio);
const QUALITIES = Object.values(exports.Wan27Quality);
const SIZE_MAP = {
    '720p': { '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [960, 720], '3:4': [720, 960], '1:1': [720, 720] },
    '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920], '4:3': [1440, 1080], '3:4': [1080, 1440], '1:1': [1080, 1080] },
};
exports.wan27 = (0, define_job_1.defineJob)({
    jobSetType: 'wan2_7',
    outputType: 'video',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['start_image', 'end_image'],
            counts: { start_image: { max: 1 }, end_image: { max: 1 } },
        },
        settings: {
            seed: z_1.z.optional(z_1.z.number()),
            quality: z_1.z._default(z_1.z.enum(QUALITIES), '720p'),
            duration: z_1.z._default(z_1.z.duration({ min: 2, max: 15 }), 5),
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(ASPECT_RATIOS), '16:9')),
        },
    },
    credits: ({ settings }) => Math.ceil((settings.duration ?? 5) * (settings.quality === '1080p' ? 2.5 : 1.5)),
    validate: ({ prompt, settings }) => [
        ...(0, checks_1.promptRequired)(prompt),
        ...(0, checks_1.oneOf)('quality', settings.quality, QUALITIES),
        ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, ASPECT_RATIOS),
        ...(0, checks_1.intRange)('duration', settings.duration, 2, 15),
        ...(0, video_helpers_1.integerRange)('duration', settings.duration, 2, 15),
        ...(0, checks_1.intRange)('seed', settings.seed, 1, 2_147_483_646),
        ...(0, video_helpers_1.integerRange)('seed', settings.seed, 1, 2_147_483_646),
    ],
    finalize: (wire) => {
        const quality = wire.quality;
        const { width, height } = (0, dimensions_1.lookupSize)(SIZE_MAP, quality, wire.aspect_ratio);
        return {
            ...wire,
            seed: wire.seed ?? (0, checks_1.randomSeed)(),
            width,
            height,
            input_images: [],
            resolution: quality,
            medias: wire.medias ?? [],
        };
    },
    restore: wire => ({
        ...(typeof wire.resolution === 'string' && wire.quality == null ? { quality: wire.resolution } : {}),
    }),
});
//# sourceMappingURL=wan-2-7.js.map