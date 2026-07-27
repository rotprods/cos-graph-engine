import type { MediaMetaResolver } from '../media-meta';
/**
 * Browser-backed `MediaMetaResolver`: measures images via `Image` and
 * video/audio via detached media elements — the same technique fnf-web's
 * `getImageSize`/`getMediaMetaVideo` use. Outside a DOM (Node, workers) every
 * ref resolves to undefined, so callers can wire it unconditionally. A failed
 * measurement (decode error, unsupported codec) resolves undefined too — the
 * `MediaMetaResolver` contract — and is NOT cached, so a retry of the same
 * url re-measures instead of replaying the failure. Successes are cached per
 * url for the resolver's lifetime.
 *
 * The package core compiles without `lib: dom`, so the handful of DOM shapes
 * used here are declared structurally instead of imported.
 */
export declare function createDomMediaMetaResolver(): MediaMetaResolver;
//# sourceMappingURL=dom-meta-resolver.d.ts.map