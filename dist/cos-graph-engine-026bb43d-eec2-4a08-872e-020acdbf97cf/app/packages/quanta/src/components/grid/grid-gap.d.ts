/**
 * Shared grid gap scale — the native Tailwind spacing steps quanta exposes for
 * grids, as literal class maps (so Tailwind's scanner sees every class that can
 * render) plus a px map for the virtualizer's row math. Used by both `Grid` and
 * `VirtualGrid`.
 */
/** 1..24 — the native Tailwind gap scale steps quanta exposes. */
export type GridGap = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 14 | 16 | 20 | 24;
export declare const GAP_CLASS: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    10: string;
    12: string;
    14: string;
    16: string;
    20: string;
    24: string;
};
export declare const GAP_X_CLASS: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    10: string;
    12: string;
    14: string;
    16: string;
    20: string;
    24: string;
};
export declare const GAP_Y_CLASS: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    10: string;
    12: string;
    14: string;
    16: string;
    20: string;
    24: string;
};
export declare const GAP_PX: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
    6: number;
    7: number;
    8: number;
    10: number;
    12: number;
    14: number;
    16: number;
    20: number;
    24: number;
};
//# sourceMappingURL=grid-gap.d.ts.map