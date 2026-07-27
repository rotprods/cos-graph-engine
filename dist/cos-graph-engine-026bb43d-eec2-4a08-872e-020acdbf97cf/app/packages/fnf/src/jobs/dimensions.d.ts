import type { MediaInput } from '../types';
export interface AspectRatioDimensions {
    width: number;
    height: number;
    /** The parsed `w:h`, or the 16:9 fallback when the input is malformed. */
    normalized: string;
}
/**
 * Dimensions with a fixed short side, snapped to even numbers — the derivation
 * fnf-web's submit strategies (soul/kling/seedance/nano) all hand-roll. Meant
 * for a job's `finalize` hook: `{ ...wire, ...aspectRatioDimensions(ratio, 1080) }`.
 */
export declare function aspectRatioDimensions(aspectRatio: string | undefined, shortSide: number): AspectRatioDimensions;
/**
 * Guarded lookup into a `resolution × ratio → [width, height]` size table —
 * the shape every table-based model (nano-banana-2, seedance, soul, and most
 * of the fnf-web catalog) carries. The settings schemas are deliberately
 * permissive at runtime (see z.aspectRatio), so an unknown ratio/resolution
 * from a JS caller must surface as the typed ValidationError, not as a
 * `undefined is not iterable` TypeError from a bare destructure.
 */
export declare function lookupSize<Res extends string, Ratio extends string>(map: Record<Res, Partial<Record<Ratio, readonly [number, number]>>>, resolution: Res, ratio: string): {
    width: number;
    height: number;
};
/**
 * The closest allowed ratio for an intrinsic size, by LINEAR distance on w/h —
 * the exact rule fnf-web's `getSeedance2_0ClosestAspectRatio` /
 * `getNanoBanana2ClosestAspectRatio` use to resolve 'auto' from the first
 * attached image. (Not log-distance: `adjust()`'s closestAspectRatio snaps
 * user-typed ratios, this mirrors the product's auto-resolution.)
 */
export declare function closestRatioBySize<R extends string>(ratios: readonly R[], size: {
    width: number;
    height: number;
}): R;
/**
 * The first ref across `roles` (in order) whose meta carries a known size —
 * the product resolves 'auto' from the FIRST attached image. Populate meta
 * from app data or `resolveMediaMeta`; undefined means no local knowledge.
 */
export declare function firstSizeMeta(media: MediaInput | undefined, roles: readonly string[]): {
    width: number;
    height: number;
} | undefined;
/** Reduce a pixel size to its smallest integer `w:h` (720×1280 → '9:16'). */
export declare function simplifyRatio(width: number, height: number): string;
//# sourceMappingURL=dimensions.d.ts.map