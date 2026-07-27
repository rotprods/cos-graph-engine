import type { Generation } from '@higgsfield/fnf/client';
import type { LiveQueryOptions } from './generation-query';
/** What the job-set query needs from a client — structural on purpose. */
export interface JobSetQueryClient {
    getSet: (jobSetId: string) => Promise<Generation[]>;
}
/**
 * One job set (a batch), live until EVERY member settles — one request per
 * tick for the whole batch (`client.getSet`), the same economy `wait`'s
 * set-aware polling has, expressed as a query. Realtime glue is one line:
 * an event for the set is `queryClient.invalidateQueries({ queryKey:
 * fnfKeys.jobSet(id) })` — TanStack dedupes and cancels racing refetches.
 * Defaults are overridable by spreading over the result.
 */
export declare function jobSetQueryOptions(client: JobSetQueryClient, jobSetId: string, opts?: LiveQueryOptions): any;
//# sourceMappingURL=job-set-query.d.ts.map