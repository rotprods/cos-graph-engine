"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Realtime = void 0;
const pool_1 = require("./pool");
/** One live channel (a job set): a single connection, N listeners. */
class RealtimeChannel {
    listeners = new Set();
    close;
    /** Whether the transport actually opened a connection for this channel. */
    connected = false;
    open(transport, generation) {
        // A throwing transport means "no channel", not a crash in the caller's
        // React effect — errors are state here too; the caller polls instead.
        try {
            this.close = transport(generation, () => {
                for (const listener of this.listeners)
                    listener();
            });
        }
        catch {
            this.close = undefined;
        }
        this.connected = this.close !== undefined;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    free() {
        this.close?.();
        this.close = undefined;
        this.listeners.clear();
    }
}
/**
 * Live updates over refcounted channels — the fnf-web `Realtime` +
 * `RefCountClassPool` shape, transport-agnostic. One connection per job set
 * no matter how many subscribers (a feed, a tile, a toast); the last
 * unsubscribe closes it after `freeGraceMs`, so quick re-subscribes (a feed
 * effect re-running) reuse the live connection instead of reconnecting.
 */
class Realtime {
    channels;
    constructor(transport, options) {
        this.channels = new pool_1.RefCountPool(generation => generation.jobSetId ?? generation.id, (generation) => {
            const channel = new RealtimeChannel();
            channel.open(transport, generation);
            return channel;
        }, { freeGraceMs: options?.freeGraceMs ?? 1000 });
    }
    /**
     * Listen for this generation's channel events. Returns the unsubscribe
     * (idempotent — extra calls are a no-op, they can't close a channel under
     * another subscriber), or `undefined` when the transport has no channel
     * for it (poll instead).
     */
    subscribe(generation, listener) {
        const channel = this.channels.allocate(generation);
        if (!channel.connected) {
            this.channels.free(generation);
            return undefined;
        }
        const unsubscribe = channel.subscribe(listener);
        let done = false;
        return () => {
            if (done)
                return;
            done = true;
            unsubscribe();
            this.channels.free(generation);
        };
    }
}
exports.Realtime = Realtime;
//# sourceMappingURL=realtime.js.map