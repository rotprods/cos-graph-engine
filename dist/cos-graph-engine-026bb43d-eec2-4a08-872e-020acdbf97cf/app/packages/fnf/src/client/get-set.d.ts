import type { Generation } from '../types';
import type { GenerationContext } from './context';
/**
 * Fetch ALL jobs of one job set in a single request — the one-shot read
 * counterpart of `pollJobSetGroup`'s tick (same adapter route, same gate
 * semantics, no loop). For callers that schedule reads themselves — a query
 * cache's `refetchInterval`, a realtime-triggered re-read — instead of
 * holding the SDK's poll loop open.
 *
 * Requires an adapter with `getJobSet`; throws the typed `not_supported`
 * otherwise (same contract as `pollJobSetGroup`).
 */
export declare function getJobSetGenerations(ctx: GenerationContext, jobSetId: string): Promise<Generation[]>;
//# sourceMappingURL=get-set.d.ts.map