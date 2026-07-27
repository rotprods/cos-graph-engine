"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kling3MotionControl = exports.Kling3MotionControlOrientation = exports.Kling3MotionControlMode = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const video_helpers_1 = require("./video-helpers");
exports.Kling3MotionControlMode = {
    std: 'std',
    pro: 'pro',
};
exports.Kling3MotionControlOrientation = {
    image: 'image',
    video: 'video',
};
const MODES = Object.values(exports.Kling3MotionControlMode);
const ORIENTATIONS = Object.values(exports.Kling3MotionControlOrientation);
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
exports.kling3MotionControl = (0, define_job_1.defineJob)({
    jobSetType: 'kling3_0_motion_control',
    outputType: 'video',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['image', 'video'],
            counts: { image: { min: 1, max: 4 }, video: { min: 1, max: 1 } },
            rules: [
                (0, media_1.dimensionsWithin)(['image'], { minSide: 300, ratio: [0.4, 2.5] }),
                (0, media_1.dimensionsWithin)(['video'], { minSide: 340, maxSide: 3850, ratio: [1 / 3, 3] }),
                (0, media_1.durationsWithin)(['video'], { each: [3, 30] }),
            ],
        },
        settings: {
            mode: z_1.z._default(z_1.z.enum(MODES), 'std'),
            characterOrientation: z_1.z.wire('character_orientation', z_1.z._default(z_1.z.enum(ORIENTATIONS), 'image')),
            duration: z_1.z.optional(z_1.z.duration({ min: 3, max: 30 })),
            seed: z_1.z.optional(z_1.z.number()),
            isChain: z_1.z._default(z_1.z.boolean(), false),
            backgroundSource: z_1.z.wire('background_source', z_1.z.optional(z_1.z.string())),
        },
    },
    credits: ({ settings, media }) => {
        const duration = settings.duration ?? (0, video_helpers_1.firstMetaDuration)(media, ['video']);
        if (duration == null)
            return null;
        const perSecond = settings.mode === 'pro' ? 2.5 : 1.5;
        return Math.ceil(perSecond * duration + (settings.isChain ? 2 : 0));
    },
    validate: ({ prompt, media, settings }) => {
        const issues = [...(0, checks_1.promptMax)(prompt, 2500)];
        if ((0, checks_1.countRefs)(media, 'video') === 0)
            issues.push({ loc: ['media', 'video'], msg: 'Input Video Required' });
        if ((0, checks_1.countRefs)(media, 'image') === 0)
            issues.push({ loc: ['media', 'image'], msg: 'Input Image Required' });
        const duration = settings.duration ?? (0, video_helpers_1.firstMetaDuration)(media, ['video']);
        if (duration != null)
            issues.push(...(0, video_helpers_1.integerRange)('duration', duration, 3, 30));
        return issues;
    },
    finalize: (wire, input) => {
        const size = (0, video_helpers_1.firstMetaSize)(input.media, ['video', 'image']);
        const duration = wire.duration ?? (0, video_helpers_1.firstMetaDuration)(input.media, ['video']);
        return {
            ...wire,
            prompt: wire.prompt ?? '',
            width: typeof wire.width === 'number' ? wire.width : size?.width ?? DEFAULT_WIDTH,
            height: typeof wire.height === 'number' ? wire.height : size?.height ?? DEFAULT_HEIGHT,
            ...(duration != null ? { duration } : {}),
        };
    },
});
//# sourceMappingURL=kling-3-motion-control.js.map