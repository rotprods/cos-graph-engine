"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIDEO_SCALE_FACTORS = exports.VideoScaleFactor = exports.TOPAZ_IMAGE_MODELS = exports.TopazImageModel = exports.UPSCALE_IMAGE_FACTORS = exports.UpscaleImageFactor = void 0;
exports.imageQuality = imageQuality;
exports.availableImageFactors = availableImageFactors;
exports.scaleImageSize = scaleImageSize;
exports.firstMediaSizeOrSettings = firstMediaSizeOrSettings;
exports.requirePositiveSize = requirePositiveSize;
exports.range = range;
exports.oneOfString = oneOfString;
exports.imageFactorIssues = imageFactorIssues;
exports.scaleVideoSize = scaleVideoSize;
exports.topazFixedVideoSize = topazFixedVideoSize;
exports.firstDuration = firstDuration;
exports.localBytedanceVideoCredits = localBytedanceVideoCredits;
exports.stripUndefined = stripUndefined;
const video_helpers_1 = require("./video-helpers");
exports.UpscaleImageFactor = {
    x1: 'x1',
    x2: 'x2',
    x4: 'x4',
    x8: 'x8',
    x16: 'x16',
};
exports.UPSCALE_IMAGE_FACTORS = Object.values(exports.UpscaleImageFactor);
exports.TopazImageModel = {
    standardV2: 'Standard V2',
    lowResolutionV2: 'Low Resolution V2',
    cgi: 'CGI',
    highFidelityV2: 'High Fidelity V2',
    textRefine: 'Text Refine',
};
exports.TOPAZ_IMAGE_MODELS = Object.values(exports.TopazImageModel);
const SCALES_BY_IMAGE_QUALITY = {
    'largest': [],
    '8K': ['x1'],
    '4K': ['x1', 'x2'],
    '2K': ['x1', 'x2', 'x4'],
    '1080p': ['x1', 'x2', 'x4', 'x8'],
    '720p': ['x1', 'x2', 'x4', 'x8'],
    '500p': ['x1', 'x2', 'x4', 'x8', 'x16'],
};
function imageQuality(size) {
    const longest = Math.max(size.width, size.height);
    if (longest >= 9000)
        return 'largest';
    if (longest >= 7680)
        return '8K';
    if (longest >= 3840)
        return '4K';
    if (longest >= 2048)
        return '2K';
    if (longest >= 1920)
        return '1080p';
    if (longest >= 1280)
        return '720p';
    return '500p';
}
function availableImageFactors(size) {
    return SCALES_BY_IMAGE_QUALITY[imageQuality(size)];
}
function scaleImageSize(size, factor) {
    const n = Number(factor.replace('x', ''));
    return { width: size.width * n, height: size.height * n };
}
function firstMediaSizeOrSettings(input, roles, wire) {
    const meta = (0, video_helpers_1.firstMetaSize)(input.media, roles);
    if (meta)
        return meta;
    const width = typeof wire.width === 'number' ? wire.width : undefined;
    const height = typeof wire.height === 'number' ? wire.height : undefined;
    return width != null && height != null ? { width, height } : undefined;
}
function requirePositiveSize(field, size) {
    if (size && size.width > 0 && size.height > 0)
        return [];
    return [{ loc: ['settings', field], msg: `${field} requires positive width and height` }];
}
function range(field, value, min, max) {
    if (value == null || (value >= min && value <= max))
        return [];
    return [{ loc: ['settings', field], msg: `${field} must be between ${min} and ${max}` }];
}
function oneOfString(field, value, options) {
    if (typeof value !== 'string' || options.includes(value))
        return [];
    return [{ loc: ['settings', field], msg: `${field} must be one of: ${options.join(', ')}` }];
}
function imageFactorIssues(media, factor) {
    const size = (0, video_helpers_1.firstMetaSize)(media, ['image']);
    if (!size || !factor)
        return [];
    const available = availableImageFactors(size);
    return available.includes(factor)
        ? []
        : [{ loc: ['settings', 'factor'], msg: `factor must be one of: ${available.join(', ') || 'none'} for this image size` }];
}
exports.VideoScaleFactor = {
    original: 'Original',
    fullHd: 'FULL_HD',
    r2k: '2k',
    r4k: '4k',
};
exports.VIDEO_SCALE_FACTORS = Object.values(exports.VideoScaleFactor);
const VIDEO_RESOLUTIONS = {
    'FULL_HD': { width: 1920, height: 1080 },
    '2k': { width: 2048, height: 1080 },
    '4k': { width: 3840, height: 2160 },
};
function scaleVideoSize(factor, inputSize) {
    if (factor === 'Original' || inputSize.width <= 0 || inputSize.height <= 0)
        return inputSize;
    const target = VIDEO_RESOLUTIONS[factor];
    const targetLongestSide = Math.max(target.width, target.height);
    const aspect = inputSize.width / inputSize.height;
    if (inputSize.width >= inputSize.height) {
        const width = targetLongestSide;
        return { width, height: Math.round(width / aspect) };
    }
    const height = targetLongestSide;
    return { width: Math.round(height * aspect), height };
}
function topazFixedVideoSize(resolution) {
    return resolution === '2160p' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };
}
function firstDuration(media, roles) {
    for (const role of roles) {
        for (const ref of (0, video_helpers_1.refsFor)(media, role)) {
            const duration = ref.meta?.durationSec;
            if (duration != null)
                return duration;
        }
    }
    return undefined;
}
function localBytedanceVideoCredits(resolution, duration, fps) {
    if (duration == null)
        return null;
    const rates = fps > 30
        ? { '1080p': 0.04, '2k': 0.08, '4k': 0.16 }
        : { '1080p': 0.02, '2k': 0.04, '4k': 0.08 };
    return Math.ceil(duration * rates[resolution]);
}
function stripUndefined(value) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        if (item !== undefined)
            out[key] = item;
    }
    return out;
}
//# sourceMappingURL=upscale-helpers.js.map