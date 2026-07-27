import type { Generation } from '@higgsfield/fnf/client';
/**
 * The connection port — inject whatever the app has. fnf-web today: SSE per
 * job set (`GET /sse/{type}?job_set_id=` — wrap `createSseConnection` /
 * the app's `Realtime.pool` here in a few lines); tomorrow: a websocket.
 * Return the close function, or `undefined` when this generation has NO
 * realtime channel (not every job type has an SSE route) — the caller falls
 * back to polling for those.
 *
 * Event payloads deliberately stop at this boundary: an event means
 * "something changed", and the fresh state is re-read through the client —
 * no wire shapes leak up.
 */
export type RealtimeTransport = (generation: Generation, emit: () => void) => (() => void) | undefined;
/**
 * Live updates over refcounted channels — the fnf-web `Realtime` +
 * `RefCountClassPool` shape, transport-agnostic. One connection per job set
 * no matter how many subscribers (a feed, a tile, a toast); the last
 * unsubscribe closes it after `freeGraceMs`, so quick re-subscribes (a feed
 * effect re-running) reuse the live connection instead of reconnecting.
 */
export declare class Realtime {
    private readonly channels;
    constructor(transport: RealtimeTransport, options?: {
        freeGraceMs?: number;
    });
    /**
     * Listen for this generation's channel events. Returns the unsubscribe
     * (idempotent — extra calls are a no-op, they can't close a channel under
     * another subscriber), or `undefined` when the transport has no channel
     * for it (poll instead).
     */
    subscribe(generation: Generation, listener: () => void): (() => void) | undefined;
}
//# sourceMappingURL=realtime.d.ts.map