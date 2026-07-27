import type { Codec } from '../group';
import type { MediaFormat, MediaInput, MediaRef } from '../types';
/**
 * A cross-role rule: gets the per-role ref counts (absent role = 0) plus the
 * refs themselves (for rules over `MediaRef.meta`), and returns one or more
 * problem messages, or null when satisfied. Ship combinators cover the known
 * product rules — cardinality (`requiresOneOf`, `atLeastOneOf`, `maxTotal`)
 * and meta (`dimensionsWithin`, `durationsWithin`); a custom rule is just a
 * function with this signature.
 */
export type MediaRule<Roles extends string = string> = (counts: Record<Roles, number>, refs: Partial<Record<Roles, MediaRef[]>>) => string | string[] | null;
/** Pydantic-shaped issue — the same shape backend 422 details use. */
export interface MediaIssue {
    loc: string[];
    msg: string;
}
export interface MediaConfig {
    field: string;
    format: MediaFormat;
    roles: readonly string[];
    /** Per-role cardinality: `min >= 1` makes the role required; `max` caps it. */
    counts?: Partial<Record<string, {
        min?: number;
        max?: number;
    }>>;
    /** Cross-role rules, checked on submit after cardinality. */
    rules?: readonly MediaRule[];
}
/** Cross-role combinator: `role`, when present, needs at least one of `anyOf`. */
export declare function requiresOneOf<R extends string>(role: R, anyOf: readonly R[]): MediaRule<R>;
/** Cross-role combinator: at least one of `roles` must be present. */
export declare function atLeastOneOf<R extends string>(roles: readonly R[]): MediaRule<R>;
/** Cross-role combinator: the refs across `roles` may not exceed `max` in total. */
export declare function maxTotal<R extends string>(roles: readonly R[], max: number): MediaRule<R>;
export interface DimensionLimits {
    /** Both sides must be at least this many pixels. */
    minSide?: number;
    /** Neither side may exceed this many pixels. */
    maxSide?: number;
    /** Total pixel floor (width × height) — fnf applies it to video inputs. */
    minPixels?: number;
    /** Allowed width/height ratio window, e.g. [0.4, 2.5] (2:5 … 5:2). */
    ratio?: readonly [number, number];
}
/** Meta combinator: refs in `roles` whose known size violates `limits`. */
export declare function dimensionsWithin<R extends string>(roles: readonly R[], limits: DimensionLimits): MediaRule<R>;
/** Meta combinator: per-ref duration bounds and/or a combined budget across `roles`. */
export declare function durationsWithin<R extends string>(roles: readonly R[], bounds: {
    each?: readonly [number, number];
    total?: number;
}): MediaRule<R>;
/**
 * Validate cardinality + cross-role rules against a submit's media input.
 * Pure — returns ALL problems (not first-throw); the codec stays a dumb mapper.
 */
export declare function checkMedia(cfg: MediaConfig, media: MediaInput | undefined): MediaIssue[];
export declare function mediaCodec(cfg: MediaConfig): Codec<MediaInput>;
//# sourceMappingURL=media.d.ts.map