import type { MediaRef } from '../types';
export interface WireMediaData {
    id: string;
    type: string;
    url?: string;
}
export declare const mediaRefSchema: any;
export declare function isMediaRef(value: unknown): value is MediaRef;
export declare function toWireMediaData(value: unknown): WireMediaData | undefined;
export declare function dimensionsFromRatios<Ratio extends string>(ratios: Record<Ratio, readonly [number, number]>, aspectRatio: Ratio, base: number): {
    width: number;
    height: number;
};
//# sourceMappingURL=image-helpers.d.ts.map