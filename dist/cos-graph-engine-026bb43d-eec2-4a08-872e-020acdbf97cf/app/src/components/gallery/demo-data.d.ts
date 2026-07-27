import type { GalleryItem } from './types.ts';
/**
 * A dated batch definition: the label plus how many items land in it. Later
 * batches are appended lazily by `makeBatch` to simulate infinite history.
 */
export declare const GROUPS: readonly [{
    readonly id: "today";
    readonly label: "Today";
    readonly count: 34;
}, {
    readonly id: "yesterday";
    readonly label: "Yesterday";
    readonly count: 42;
}, {
    readonly id: "this-week";
    readonly label: "Earlier this week";
    readonly count: 56;
}, {
    readonly id: "last-week";
    readonly label: "Last week";
    readonly count: 60;
}];
/**
 * Build one dated batch of items. Roughly every 5th item is a video so the
 * feed reliably shows hover-to-play tiles. When `withGenerating` is set the
 * batch leads with a single `generating` placeholder tile (the pulsing card).
 */
export declare function makeBatch(groupId: string, groupLabel: string, count: number, seed: number, withGenerating?: boolean): GalleryItem[];
/** The initial dataset — the four seeded batches, a generating tile up top. */
export declare function makeInitialItems(): GalleryItem[];
/**
 * Lazily-appended "older" batch, used by the infinite-scroll loader. Each call
 * yields a fresh dated group ("Earlier · N") so appending never reflows the
 * batches already on screen above.
 */
export declare function makeOlderBatch(page: number): GalleryItem[];
//# sourceMappingURL=demo-data.d.ts.map