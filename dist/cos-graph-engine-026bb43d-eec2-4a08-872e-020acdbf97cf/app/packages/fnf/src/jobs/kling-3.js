"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kling3_0 = exports.Kling3Sound = exports.Kling3Mode = exports.Kling3AspectRatio = void 0;
const define_job_1 = require("../define-job");
const media_1 = require("../groups/media");
const z_1 = require("../z");
const checks_1 = require("./checks");
const dimensions_1 = require("./dimensions");
const video_helpers_1 = require("./video-helpers");
exports.Kling3AspectRatio = {
    r16x9: '16:9',
    r9x16: '9:16',
    r1x1: '1:1',
};
exports.Kling3Mode = {
    std: 'std',
    pro: 'pro',
    k4: '4k',
};
exports.Kling3Sound = {
    on: 'on',
    off: 'off',
};
const ASPECT_RATIOS = Object.values(exports.Kling3AspectRatio);
const MODES = Object.values(exports.Kling3Mode);
const SOUNDS = Object.values(exports.Kling3Sound);
const SHOT_PROMPT_MAX = 512;
const NORMAL_PROMPT_MAX = 2500;
const MAX_SHOTS = 6;
const MAX_ELEMENTS = 3;
const MIN_SHOT_DURATION = 1;
const MIN_TOTAL_DURATION = 3;
const SIZE_MAP = {
    'std': { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720] },
    'pro': { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] },
    '4k': { '16:9': [3840, 2160], '9:16': [2160, 3840], '1:1': [2160, 2160] },
};
const multiPromptSchema = z_1.z.array(z_1.z.object({
    prompt: z_1.z.string(),
    duration: z_1.z.number(),
}));
exports.kling3_0 = (0, define_job_1.defineJob)({
    jobSetType: 'kling3_0',
    outputType: 'video',
    params: {
        prompt: true,
        media: {
            field: 'medias',
            format: 'wrapped',
            roles: ['start_image', 'end_image'],
            counts: { start_image: { max: 1 }, end_image: { max: 1 } },
            rules: [(0, media_1.dimensionsWithin)(['start_image', 'end_image'], { minSide: 300, ratio: [0.4, 2.5] })],
        },
        settings: {
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(ASPECT_RATIOS), '16:9')),
            mode: z_1.z._default(z_1.z.enum(MODES), 'std'),
            sound: z_1.z._default(z_1.z.enum(SOUNDS), 'off'),
            duration: z_1.z.duration({ min: 3, max: 15 }),
            multiShots: z_1.z.wire('multi_shots', z_1.z._default(z_1.z.boolean(), false)),
            multiShotMode: z_1.z.wire('multi_shot_mode', z_1.z._default(z_1.z.enum(['auto', 'custom']), 'auto')),
            multiPrompt: z_1.z.wire('multi_prompt', z_1.z.optional(multiPromptSchema)),
            klingElementIds: z_1.z.wire('kling_element_ids', z_1.z.optional(z_1.z.array(z_1.z.string()))),
        },
    },
    credits: ({ settings }) => {
        if (settings.mode !== '4k')
            return null;
        const duration = settings.multiShots && settings.multiShotMode === 'custom' && settings.multiPrompt?.length
            ? settings.multiPrompt.reduce((sum, shot) => sum + (shot.duration || 0), 0)
            : settings.duration;
        return Math.ceil(duration * 6);
    },
    validate: ({ prompt, media, settings }) => {
        const issues = [
            ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, ASPECT_RATIOS),
            ...(0, checks_1.oneOf)('mode', settings.mode, MODES),
            ...(0, checks_1.oneOf)('sound', settings.sound, SOUNDS),
            ...(0, checks_1.intRange)('duration', settings.duration, 3, 15),
            ...(0, video_helpers_1.integerRange)('duration', settings.duration, 3, 15),
            ...(0, checks_1.promptMax)(prompt, NORMAL_PROMPT_MAX),
        ];
        const text = prompt?.instruction ?? '';
        const hasStart = (0, checks_1.countRefs)(media, 'start_image') > 0;
        const hasEnd = (0, checks_1.countRefs)(media, 'end_image') > 0;
        const multiShots = settings.multiShots ?? false;
        const multiPrompt = settings.multiPrompt ?? [];
        const elementIds = settings.klingElementIds ?? [];
        const canSkipPrompt = (prompt?.enhance ?? true) && hasStart && !multiShots;
        const promptRequired = !multiShots || settings.multiShotMode === 'auto';
        if (/<<<[^>]+>>>/.test(text) && !hasStart)
            issues.push({ loc: ['media', 'start_image'], msg: 'Start frame is required when prompt contains element references' });
        if (hasEnd && !hasStart)
            issues.push({ loc: ['media', 'start_image'], msg: 'Start frame is required when end frame is provided' });
        if (hasStart && hasEnd && multiShots)
            issues.push({ loc: ['media', 'end_image'], msg: 'End frame cannot be used with multi-shots' });
        if (elementIds.length > 0 && !hasStart)
            issues.push({ loc: ['media', 'start_image'], msg: 'Start frame is required for elements' });
        if (promptRequired && !canSkipPrompt && text.length === 0)
            issues.push({ loc: ['prompt'], msg: 'Prompt is required' });
        if (multiShots && settings.multiShotMode === 'custom') {
            if (multiPrompt.length === 0)
                issues.push({ loc: ['settings', 'multiPrompt'], msg: 'Multi-shot prompt is required when multi-shot mode is custom' });
            if (multiPrompt.length > MAX_SHOTS)
                issues.push({ loc: ['settings', 'multiPrompt'], msg: `Multi-shot supports up to ${MAX_SHOTS} shots` });
            let totalDuration = 0;
            for (const shot of multiPrompt) {
                const shotPrompt = shot.prompt ?? '';
                totalDuration += shot.duration || 0;
                if (shotPrompt.length === 0)
                    issues.push({ loc: ['settings', 'multiPrompt'], msg: 'Each shot must have a prompt' });
                if (shotPrompt.length > SHOT_PROMPT_MAX)
                    issues.push({ loc: ['settings', 'multiPrompt'], msg: `Shot prompt is too long (max ${SHOT_PROMPT_MAX})` });
                if (!shot.duration || shot.duration < MIN_SHOT_DURATION)
                    issues.push({ loc: ['settings', 'multiPrompt'], msg: `Each shot must have at least ${MIN_SHOT_DURATION}s duration` });
            }
            if (multiPrompt.length > 0 && totalDuration < MIN_TOTAL_DURATION)
                issues.push({ loc: ['settings', 'multiPrompt'], msg: `Total duration must be at least ${MIN_TOTAL_DURATION}s` });
            if (totalDuration > 15)
                issues.push({ loc: ['settings', 'multiPrompt'], msg: 'Total duration must be at most 15s' });
            if (!hasStart && multiPrompt.some(shot => /<<<[^>]+>>>/.test(shot.prompt || '')))
                issues.push({ loc: ['media', 'start_image'], msg: 'Start frame is required when prompt contains element references' });
        }
        const refs = multiShots && multiPrompt.length
            ? multiPrompt.flatMap(shot => (0, video_helpers_1.extractAngleRefIds)(shot.prompt || ''))
            : (0, video_helpers_1.extractAngleRefIds)(text);
        if (new Set(refs).size > MAX_ELEMENTS || elementIds.length > MAX_ELEMENTS)
            issues.push({ loc: ['settings', 'klingElementIds'], msg: `Too many elements (max ${MAX_ELEMENTS}). Please remove some elements from your prompt.` });
        return issues;
    },
    finalize: (wire, input) => {
        const measured = (0, video_helpers_1.firstMetaSize)(input.media, ['start_image']);
        const ratio = measured ? (0, dimensions_1.closestRatioBySize)(ASPECT_RATIOS, measured) : wire.aspect_ratio;
        const { width, height } = (0, dimensions_1.lookupSize)(SIZE_MAP, wire.mode, ratio);
        return {
            ...wire,
            prompt: wire.multi_shots && wire.multi_shot_mode === 'custom' ? '' : wire.prompt ?? '',
            aspect_ratio: ratio,
            width,
            height,
            enhance_prompt: wire.multi_shots ? false : wire.enhance_prompt,
            kling_element_ids: wire.kling_element_ids ?? [],
            duration: wire.multi_shots && wire.multi_shot_mode === 'custom' && Array.isArray(wire.multi_prompt) && wire.multi_prompt.length > 0
                ? wire.multi_prompt.reduce((sum, shot) => sum + ((shot.duration) || 0), 0)
                : wire.duration,
        };
    },
});
//# sourceMappingURL=kling-3.js.map