"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.veo3_1Lite = exports.Veo31LiteResolution = exports.Veo31LiteAspectRatio = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
const video_helpers_1 = require("./video-helpers");
exports.Veo31LiteAspectRatio = {
    auto: 'auto',
    r16x9: '16:9',
    r9x16: '9:16',
};
exports.Veo31LiteResolution = {
    r720: '720p',
    r1080: '1080p',
};
const ASPECT_RATIOS = Object.values(exports.Veo31LiteAspectRatio);
const RESOLUTIONS = Object.values(exports.Veo31LiteResolution);
const SIZE_MAP = {
    '720p': { '16:9': [1280, 720], '9:16': [720, 1280] },
    '1080p': { '16:9': [1920, 1080], '9:16': [1080, 1920] },
};
const AUTO_FALLBACK = { width: 1920, height: 1080 };
exports.veo3_1Lite = (0, define_job_1.defineJob)({
    jobSetType: 'veo3_1_lite',
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
            duration: z_1.z._default(z_1.z.duration({ values: [4, 6, 8] }), 8),
            resolution: z_1.z._default(z_1.z.enum(RESOLUTIONS), '720p'),
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(ASPECT_RATIOS), 'auto')),
            generateAudio: z_1.z.wire('generate_audio', z_1.z._default(z_1.z.boolean(), true)),
            seed: z_1.z.optional(z_1.z.number()),
        },
    },
    credits: ({ settings }) => {
        const perSecond = settings.resolution === '1080p'
            ? (settings.generateAudio ? 2 : 1.5)
            : (settings.generateAudio ? 1.5 : 1);
        return Math.ceil((settings.duration ?? 8) * perSecond);
    },
    validate: ({ prompt, media, settings }) => {
        const issues = [
            ...(0, checks_1.promptRequired)(prompt),
            ...(0, checks_1.promptMax)(prompt, 4000),
            ...(0, checks_1.oneOf)('duration', settings.duration, [4, 6, 8]),
            ...(0, checks_1.oneOf)('resolution', settings.resolution, RESOLUTIONS),
            ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, ASPECT_RATIOS),
        ];
        const hasFLF = (0, checks_1.countRefs)(media, 'start_image') > 0 && (0, checks_1.countRefs)(media, 'end_image') > 0;
        if (hasFLF && settings.duration !== 8)
            issues.push({ loc: ['settings', 'duration'], msg: 'Duration must be 8 seconds when both first and last frames are provided' });
        if (settings.resolution === '1080p' && settings.duration !== 8)
            issues.push({ loc: ['settings', 'duration'], msg: 'Duration must be 8 seconds for 1080p resolution' });
        return issues;
    },
    finalize: (wire, input) => {
        const measured = (0, video_helpers_1.firstMetaSize)(input.media, ['start_image']);
        const table = wire.aspect_ratio === 'auto'
            ? AUTO_FALLBACK
            : (0, dimensions_1.lookupSize)(SIZE_MAP, wire.resolution, wire.aspect_ratio);
        return {
            ...wire,
            seed: wire.seed ?? (0, checks_1.randomSeed)(),
            width: measured?.width ?? table.width,
            height: measured?.height ?? table.height,
            medias: wire.medias ?? [],
        };
    },
});
//# sourceMappingURL=veo-3-1-lite.js.map