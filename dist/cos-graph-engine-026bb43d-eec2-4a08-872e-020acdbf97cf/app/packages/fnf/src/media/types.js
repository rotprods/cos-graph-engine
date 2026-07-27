"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REF_TYPE_BY_UPLOAD = void 0;
/**
 * fnf-web's input-media discriminator per plane (input-media-model.ts) — the
 * `MediaRef.type` that goes on the job wire verbatim (e.g. seedance
 * medias[].data.type). Backends may return a more specific type (a job type
 * like `nano_banana_job` on fetched media) — preserve those; this is the
 * fallback vocabulary.
 */
exports.REF_TYPE_BY_UPLOAD = {
    image: 'media_input',
    video: 'video_input',
    audio: 'audio_input',
};
//# sourceMappingURL=types.js.map