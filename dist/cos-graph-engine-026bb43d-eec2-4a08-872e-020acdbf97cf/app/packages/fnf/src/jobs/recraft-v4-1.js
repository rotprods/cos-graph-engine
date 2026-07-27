"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recraftV41Image = exports.RecraftV41AspectRatio = exports.RecraftV41ModelType = exports.RecraftV41Model = void 0;
const define_job_1 = require("../define-job");
const z_1 = require("../z");
const checks_1 = require("./checks");
const image_helpers_1 = require("./image-helpers");
exports.RecraftV41Model = {
    standard: 'recraft-v4-1',
    vector: 'recraft-v4-1-vector',
    utility: 'recraft-v4-1-utility',
    utilityVector: 'recraft-v4-1-utility-vector',
};
exports.RecraftV41ModelType = {
    standard: 'standard',
    vector: 'vector',
    utility: 'utility',
    utilityVector: 'utility_vector',
};
exports.RecraftV41AspectRatio = {
    r1x1: '1:1',
    r3x4: '3:4',
    r4x3: '4:3',
    r4x5: '4:5',
    r5x4: '5:4',
    r3x2: '3:2',
    r2x3: '2:3',
    r16x9: '16:9',
    r9x16: '9:16',
};
const MODEL_TO_TYPE = {
    'recraft-v4-1': 'standard',
    'recraft-v4-1-vector': 'vector',
    'recraft-v4-1-utility': 'utility',
    'recraft-v4-1-utility-vector': 'utility_vector',
};
const TYPE_TO_MODEL = {
    standard: 'recraft-v4-1',
    vector: 'recraft-v4-1-vector',
    utility: 'recraft-v4-1-utility',
    utility_vector: 'recraft-v4-1-utility-vector',
};
const ASPECT_RATIOS = {
    '1:1': [1, 1],
    '3:4': [3, 4],
    '4:3': [4, 3],
    '4:5': [4, 5],
    '5:4': [5, 4],
    '3:2': [3, 2],
    '2:3': [2, 3],
    '16:9': [16, 9],
    '9:16': [9, 16],
};
const BASE_SIZE = {
    '1k': 1024,
    '2k': 2048,
};
const CREDITS_PER_IMAGE = {
    standard: { '1k': 1.25, '2k': 8 },
    utility: { '1k': 1.25, '2k': 8 },
    vector: { '1k': 2.5, '2k': 10 },
    utility_vector: { '1k': 2.5, '2k': 10 },
};
const MAX_PROMPT_CHARACTERS = 3_000;
const MAX_PALETTE_COLORS = 10;
function modelTypeFor(model, explicit) {
    return explicit ?? MODEL_TO_TYPE[model];
}
exports.recraftV41Image = (0, define_job_1.defineJob)({
    jobSetType: 'recraft_v4_1',
    outputType: 'image',
    params: {
        prompt: true,
        settings: {
            model: z_1.z._default(z_1.z.enum(Object.values(exports.RecraftV41Model)), 'recraft-v4-1'),
            modelType: z_1.z.wire('model_type', z_1.z.optional(z_1.z.enum(Object.values(exports.RecraftV41ModelType)))),
            aspectRatio: z_1.z.wire('aspect_ratio', z_1.z._default(z_1.z.aspectRatio(Object.values(exports.RecraftV41AspectRatio)), '1:1')),
            resolution: z_1.z._default(z_1.z.enum(['1k', '2k']), '1k'),
            batchSize: z_1.z.wire('batch_size', z_1.z._default(z_1.z.number(), 1)),
            colors: z_1.z.optional(z_1.z.array(z_1.z.string())),
            backgroundColor: z_1.z.wire('background_color', z_1.z.optional(z_1.z.nullable(z_1.z.string()))),
        },
    },
    credits: ({ settings }) => {
        const model = settings.model ?? 'recraft-v4-1';
        const modelType = modelTypeFor(model, settings.modelType);
        const resolution = settings.resolution ?? '1k';
        return (settings.batchSize ?? 1) * CREDITS_PER_IMAGE[modelType][resolution];
    },
    validate: ({ prompt, settings }) => {
        const model = settings.model ?? 'recraft-v4-1';
        const modelType = modelTypeFor(model, settings.modelType);
        const resolution = settings.resolution ?? '1k';
        const issues = [
            ...(0, checks_1.promptRequired)(prompt),
            ...(0, checks_1.promptMax)(prompt, MAX_PROMPT_CHARACTERS),
            ...(0, checks_1.intRange)('batchSize', settings.batchSize, 1, 4),
            ...(0, checks_1.oneOf)('aspectRatio', settings.aspectRatio, Object.values(exports.RecraftV41AspectRatio)),
        ];
        if (settings.modelType && settings.modelType !== MODEL_TO_TYPE[model]) {
            issues.push({
                loc: ['settings', 'modelType'],
                msg: `modelType '${settings.modelType}' does not match model '${model}'`,
            });
        }
        if ((settings.colors?.length ?? 0) > MAX_PALETTE_COLORS) {
            issues.push({
                loc: ['settings', 'colors'],
                msg: `Color palette can include up to ${MAX_PALETTE_COLORS} colors`,
            });
        }
        if (!CREDITS_PER_IMAGE[modelType]?.[resolution]) {
            issues.push({
                loc: ['settings', 'modelType'],
                msg: `modelType '${modelType}' is not supported`,
            });
        }
        return issues;
    },
    finalize: (wire) => {
        const model = (wire.model ?? 'recraft-v4-1');
        const modelType = modelTypeFor(model, wire.model_type);
        const aspectRatio = (wire.aspect_ratio ?? '1:1');
        const resolution = (wire.resolution ?? '1k');
        const { width, height } = (0, image_helpers_1.dimensionsFromRatios)(ASPECT_RATIOS, aspectRatio, BASE_SIZE[resolution]);
        const rest = { ...wire };
        delete rest.model;
        return {
            ...rest,
            model_type: modelType,
            width,
            height,
        };
    },
    restore: (wire) => {
        const modelType = typeof wire.model_type === 'string' ? wire.model_type : undefined;
        return modelType && TYPE_TO_MODEL[modelType]
            ? { model: TYPE_TO_MODEL[modelType] }
            : {};
    },
});
//# sourceMappingURL=recraft-v4-1.js.map