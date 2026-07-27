import { NanoBananaAspectRatio } from './nano-banana-shared';
export { NanoBananaAspectRatio as NanoBanana2AspectRatio };
/**
 * Nano Banana Pro. Grounded in fnf-web's `job-image-nano-banana-2` module.
 * The app submits `/jobs/nano-banana-2` with `input_images` kept as a bare
 * array. Public settings carry ONLY user generation input — the product's
 * surface/billing markers (application_slug, is_draw/is_ugc/…, use_unlim,
 * use_seedream_bonus) are not part of the SDK surface; deliberate raw wire
 * fields belong in `extra`.
 */
export declare const nanoBanana2: import("..").JobEntry<"nano_banana_2", {
    [x: string]: any;
} & {
    [x: string]: any;
}, import(".").Envelope<"image", true>>;
//# sourceMappingURL=nano-banana-2.d.ts.map