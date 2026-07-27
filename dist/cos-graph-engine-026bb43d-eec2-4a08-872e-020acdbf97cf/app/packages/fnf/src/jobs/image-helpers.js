"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRefSchema = void 0;
exports.isMediaRef = isMediaRef;
exports.toWireMediaData = toWireMediaData;
exports.dimensionsFromRatios = dimensionsFromRatios;
const errors_1 = require("../errors");
const z_1 = require("../z");
exports.mediaRefSchema = z_1.z.custom(isMediaRef);
function isMediaRef(value) {
    if (!value || typeof value !== 'object')
        return false;
    const ref = value;
    return typeof ref.id === 'string' && typeof ref.type === 'string';
}
function toWireMediaData(value) {
    if (!isMediaRef(value))
        return undefined;
    return {
        id: value.id,
        type: value.type,
        ...(value.url !== undefined ? { url: value.url } : {}),
    };
}
function dimensionsFromRatios(ratios, aspectRatio, base) {
    const ratio = ratios[aspectRatio];
    if (!ratio) {
        throw new errors_1.ValidationError(`aspect ratio '${aspectRatio}' is not supported (allowed: ${Object.keys(ratios).join(', ')})`, [
            { loc: ['settings', 'aspectRatio'], msg: `aspect ratio '${aspectRatio}' is not supported` },
        ]);
    }
    const [wRatio, hRatio] = ratio;
    const maxRatio = Math.max(wRatio, hRatio);
    return {
        width: Math.round(base * (wRatio / maxRatio)),
        height: Math.round(base * (hRatio / maxRatio)),
    };
}
//# sourceMappingURL=image-helpers.js.map