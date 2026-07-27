export interface FieldDef {
    wire: string;
}
export declare function field(wire: string): FieldDef;
export interface Codec<T> {
    serialize: (value: T) => Record<string, unknown>;
    parse: (wire: Record<string, unknown>) => T;
    wireKeys: string[];
}
export declare function group<M extends Record<string, FieldDef>>(map: M): Codec<{
    [K in keyof M]?: unknown;
}>;
//# sourceMappingURL=group.d.ts.map