"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsFeedQueryOptions = jobsFeedQueryOptions;
exports.flattenFeedPages = flattenFeedPages;
const react_query_1 = require("@tanstack/react-query");
const keys_1 = require("./keys");
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
function jobsFeedQueryOptions(client, query = {}, opts) {
    return (0, react_query_1.infiniteQueryOptions)({
        queryKey: keys_1.fnfKeys.jobs(query, opts),
        queryFn: ({ pageParam }) => client.list({ ...query, ...(pageParam !== undefined ? { cursor: pageParam } : {}) }),
        initialPageParam: undefined,
        getNextPageParam: lastPage => lastPage.cursor ?? undefined,
        staleTime: Number.POSITIVE_INFINITY,
    });
}
/**
 * Pages → one deduplicated list (a `select` for the feed query). An id seen
 * on several pages keeps its FIRST position (head order — where the user
 * already saw it) with the LATEST-fetched value — the fnf-web `MapPool`
 * semantics.
 */
function flattenFeedPages(data) {
    const seen = new Map();
    for (const page of data.pages) {
        for (const item of page.items)
            seen.set(item.id, item);
    }
    return [...seen.values()];
}
//# sourceMappingURL=jobs-feed-query.js.map