import type { Generation, ListOptions, ListResult } from '@higgsfield/fnf/client';
import type { InfiniteData } from '@tanstack/react-query';
import type { FnfScopeOptions, JobsQuery } from './keys';
/** What the feed query needs from a client — structural on purpose. */
export interface JobsFeedQueryClient {
    list: (opts?: ListOptions) => Promise<ListResult>;
}
/**
 * A cursor feed as an infinite query. The `query` (filters/size, forwarded to
 * `client.list` VERBATIM) is the cache identity; the cursor is the page param.
 *
 * The feed is door-driven, so pages are fresh forever by default
 * (`staleTime: Infinity`): live updates fold in through `applyGenerations`,
 * fresh submits enter through `prependGenerations`, and the explicit hard
 * refresh is `queryClient.invalidateQueries({ queryKey: fnfKeys.jobs(query) })`.
 * Mount/focus refetches would race those writes — spread your own `staleTime`
 * over the result if you want them back.
 *
 *   const feed = useInfiniteQuery({
 *     ...jobsFeedQueryOptions(client, { type: 'video' }),
 *     select: flattenFeedPages,
 *   })
 *   feed.data?.map(g => <Tile key={g.id} generation={g} />)
 */
export declare function jobsFeedQueryOptions(client: JobsFeedQueryClient, query?: JobsQuery, opts?: FnfScopeOptions): any;
/**
 * Pages → one deduplicated list (a `select` for the feed query). An id seen
 * on several pages keeps its FIRST position (head order — where the user
 * already saw it) with the LATEST-fetched value — the fnf-web `MapPool`
 * semantics.
 */
export declare function flattenFeedPages(data: InfiniteData<ListResult>): Generation[];
//# sourceMappingURL=jobs-feed-query.d.ts.map