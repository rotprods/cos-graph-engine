export type Normalize = {
    kind: 'aspectRatio';
    options: readonly string[];
} | {
    kind: 'duration';
    values?: readonly number[];
    min?: number;
    max?: number;
};
export declare function getNormalize(schema: unknown): Normalize | undefined;
export declare function getWireName(schema: unknown): string | undefined;
/** Tag a settings schema with an explicit wire field name (typed identity). */
export declare function wire<T extends object>(name: string, schema: T): T;
/**
 * Phantom marker that carries the *static* input type of a normalized field —
 * the literal union of allowed values — separate from the runtime schema, which
 * stays permissive so normalization can run. Never present at runtime; read by
 * `SettingsInput` to type the field. See `FieldInput` in define-job.ts.
 */
export declare const NORMALIZE_TYPE: unique symbol;
export interface NormalizeType<T> {
    readonly [NORMALIZE_TYPE]: T;
}
export declare function aspectRatio<const O extends readonly string[]>(options: O): any & NormalizeType<O[number]>;
export declare function duration<const V extends readonly number[] = never>(opts: {
    values?: V;
    min?: number;
    max?: number;
}): any & NormalizeType<[V] extends [never] ? number : V[number]>;
export declare const z: any;
//# sourceMappingURL=z.d.ts.map