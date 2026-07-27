import type { MediaRef } from '../types';
import type { MediaContext, MediaGetOptions } from './types';
/**
 * Get a single media item by id. The backend route is per-type (image/video/
 * audio), so the type must be supplied — the adapter routes on it. Normalizes
 * the raw payload to a `MediaRef` usable as a job input: the backend's own
 * discriminator wins (fetched media can carry a job type like
 * `nano_banana_job`, valid on the wire), else the plane's input type — the
 * same vocabulary upload produces, so get-then-submit matches upload-then-submit.
 */
export declare function getMedia(ctx: MediaContext, id: string, type: MediaGetOptions['type']): Promise<MediaRef>;
//# sourceMappingURL=get.d.ts.map