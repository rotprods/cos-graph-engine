/**
 * The product's default Soul style (fnf-web defaultSoulStyleId, soul-values.tsx).
 * The app NEVER submits style_id null on this surface — it falls back to this id
 * even in image-reference mode (null style_id exists only in fashion-factory
 * flows, where fashion_factory_id is sent instead — via `extra` in the SDK).
 */
export declare const DEFAULT_SOUL_STYLE_ID = "464ea177-8d40-4940-8d9d-b438bab269c7";
/**
 * Soul text-to-image — the /ai/image product model. Grounded in fnf-web's
 * soul submit strategy (gen-panel-model-image-soul/submit-strategy.ts) and
 * getDefaultSoulExpandedForm: steps 50, sample_guide_scale 4, sample_shift
 * 3 (720p) / 4 (1080p), negative_prompt '' (via `prompt.negative`), and
 * width/height looked up in SOUL_RESOLUTION_MAP from quality × aspect ratio.
 * enhance_prompt mirrors resolveEnhancePrompt's production behavior: false
 * with an image reference, forced true for a non-default style, otherwise the
 * caller's choice (default true).
 */
export declare const textToImageSoul: import("..").JobEntry<"text2image_soul", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"image_reference", true>>;
//# sourceMappingURL=text2image-soul.d.ts.map