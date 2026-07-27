import type { Generation } from '@higgsfield/fnf/client';
import type { QueryClient } from '@tanstack/react-query';
import type { FnfScopeOptions, JobsQuery } from './keys';
/**
 * The single write door over the QueryClient: fold fresh generation snapshots
 * into EVERY fnf-owned cache entry that holds them — per-job entries, job-set
 * entries, and all feed page lists — in one call. Poll ticks, realtime
 * re-reads and run progress all enter here, so no source can race another
 * past `foldGeneration`'s guards.
 *
 * The door UPDATES, it never seeds: ids no cache holds are ignored (feed
 * membership belongs to fetches and `prependGenerations`), and absent keys
 * are not created. Writes that change nothing bail out, keeping every
 * untouched reference stable.
 *
 * This is the lesson of fnf-web's `AssetCache` made structural: TanStack is a
 * non-normalizing document cache, so one entity lives as copies under many
 * keys — the difference is that here ALL the keys belong to the package and
 * all the surgery lives behind one tested function.
 */
export declare function applyGenerations(queryClient: QueryClient, generations: Generation[], opts?: FnfScopeOptions): void;
/**
 * Optimistic head insert after a submit — into the ONE feed the caller names.
 * Which feeds should show a fresh submit is product policy, so the fan-out
 * stays an explicit app decision (call it once per feed); ids the feed
 * already holds are skipped. A feed that was never fetched is left alone —
 * its first fetch will include the new jobs anyway.
 */
export declare function prependGenerations(queryClient: QueryClient, query: JobsQuery, generations: Generation[], opts?: FnfScopeOptions): void;
export declare function removeGenerationQueries(queryClient: QueryClient, opts?: FnfScopeOptions): void;
//# sourceMappingURL=generation-cache.d.ts.map