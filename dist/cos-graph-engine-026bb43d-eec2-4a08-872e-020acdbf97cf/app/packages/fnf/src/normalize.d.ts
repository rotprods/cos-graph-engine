import type { Normalize } from './z';
/** A settings value the SDK snapped during normalization (e.g. 16:10 → 16:9). */
export interface Adjustment {
    field: string;
    from: unknown;
    to: unknown;
}
/** Opt-in normalization kinds, requested per-submit via `adjust: [...]`. Off by default. */
export type AdjustKind = 'near-aspect-ratio' | 'near-duration';
export declare function closestAspectRatio(value: string, options: readonly string[]): string;
export declare function clampDuration(value: number, n: Extract<Normalize, {
    kind: 'duration';
}>): number;
export declare function normalizeSettings(settings: Record<string, unknown>, normalizers: Record<string, Normalize>, enabled: ReadonlySet<AdjustKind>): {
    settings: Record<string, unknown>;
    adjustments: Adjustment[];
};
//# sourceMappingURL=normalize.d.ts.map