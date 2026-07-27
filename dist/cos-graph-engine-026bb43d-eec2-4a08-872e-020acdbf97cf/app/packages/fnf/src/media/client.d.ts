import type { MediaClient, MediaClientConfig } from './types';
/**
 * Compose the media operations into a client. Sugar over the free functions —
 * every method binds the shared media context. Build a context and call the
 * operations directly if you only need one:
 *
 *   const ctx = createMediaContext(config)
 *   await getMedia(ctx, id, 'image')
 */
export declare function createMediaClient(config: MediaClientConfig): MediaClient;
//# sourceMappingURL=client.d.ts.map