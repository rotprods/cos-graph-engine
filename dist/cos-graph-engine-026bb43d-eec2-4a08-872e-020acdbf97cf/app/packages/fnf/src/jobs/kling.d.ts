/** Kling model versions as a named, refactorable object enum (erased at runtime). */
export declare const KlingModel: {
    readonly v2_1: "kling-v2-1";
    readonly v2_1Master: "kling-v2-1-master";
    readonly v2_5Turbo: "kling-v2-5-turbo";
};
/**
 * The product's "no motion preset" sentinel (fnf-web defaultKlingPresetId):
 * the form always puts a motion_id on the wire, and THIS id means "none" —
 * KlingVideoJob.submit forces enhance_prompt only for ids different from it.
 */
export declare const KLING_DEFAULT_MOTION_ID = "7077cde8-7947-46d6-aea2-dbf2ff9d441c";
/**
 * Kling video — the /ai/video product model. Grounded in fnf-web's
 * VideoKlingSubmitParams + KlingVideoJob.submit (entities/job/model/submit/
 * kling.ts) and mapKlingParams: prompt is OPTIONAL (< 2000 chars when present —
 * motion presets run promptless), `mode` is NOT an input (derived from
 * model/resolution), enhance_prompt is forced on for any real motion preset
 * (motion_id !== the default sentinel). I2V via `input_image`; left optional
 * because the surfaces disagree — the /ai/video form hard-requires a start
 * frame ('Start frame required') but the app-viewer host advertises text-only
 * kling and the wire contract admits input_image: null. `input_image_end` is
 * not a declared role yet — but when a caller passes it via `extra`, finalize
 * still applies the product's enhance rule (an end frame forces it off).
 * NOTE: `parentId` is NOT honored by POST /jobs/kling — the backend's
 * CreateKlingJobSchema has no parent_id field, so it is silently dropped.
 */
export declare const klingVideo: import("..").JobEntry<"kling", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"input_image", true>>;
//# sourceMappingURL=kling.d.ts.map