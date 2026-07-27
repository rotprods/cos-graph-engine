import type { Generation } from '@higgsfield/fnf/client';
/**
 * The single write rule for folding a fresh generation snapshot over a cached
 * one — every cache write in this package (`applyGenerations`) goes through
 * it, so poll ticks, set reads and run progress all obey the same two domain
 * guards no matter which source raced which:
 *
 * - **terminal anti-regress**: a stale read (an out-of-order response, a
 *   lagging endpoint) can never roll a settled generation back to pending —
 *   the guard fnf-web hand-rolls as `effectiveStatus` in its job polling.
 * - **identity stability**: when nothing observable changed, the PREVIOUS
 *   object is returned, so reference-equality memoization downstream
 *   (`React.memo` tiles, selectors) survives polling.
 *
 * Pure and tanstack-free on purpose — usable by any cache, not just ours.
 */
export declare function foldGeneration(prev: Generation | undefined, next: Generation): Generation;
//# sourceMappingURL=generation-fold.d.ts.map