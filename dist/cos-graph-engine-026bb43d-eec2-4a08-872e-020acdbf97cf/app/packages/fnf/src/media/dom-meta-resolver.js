"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDomMediaMetaResolver = createDomMediaMetaResolver;
const selectors_1 = require("../selectors");
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
function createDomMediaMetaResolver() {
    const cache = new Map();
    return async (ref) => {
        if (!dom() || !ref.url)
            return undefined;
        const url = ref.url;
        let pending = cache.get(url);
        if (!pending) {
            const kind = ref.type === 'image' || ref.type === 'video' || ref.type === 'audio' ? ref.type : undefined;
            pending = measure(url, kind).catch(() => {
                cache.delete(url); // don't poison future retries of this url
                return undefined;
            });
            cache.set(url, pending);
        }
        return pending;
    };
}
function dom() {
    const candidate = globalThis;
    return candidate.document && candidate.Image ? candidate : null;
}
// `getMediaType` covers the image/video output kinds; audio inputs are its
// blind spot, so sniff those extensions here.
const AUDIO_URL = /\.(?:mp3|wav|m4a|aac|ogg|flac)(?:[?#]|$)/i;
async function measure(url, kind) {
    // A blob/object URL carries no extension — callers that know the kind
    // (e.g. from File.type) pass it as the ref's literal type.
    if (kind === 'audio' || AUDIO_URL.test(url))
        return measureElement('audio', url);
    if (kind === 'video')
        return measureElement('video', url);
    if (kind === 'image')
        return measureImage(url);
    switch ((0, selectors_1.getMediaType)(url)) {
        case 'image':
            return measureImage(url);
        case 'video':
            return measureElement('video', url);
        default:
            // Unknown extension: an <img> probe is cheap and covers extensionless
            // CDN urls, which are images in this product far more often than not.
            return measureImage(url).catch(() => undefined);
    }
}
function measureImage(url) {
    return new Promise((resolve, reject) => {
        const image = new (dom().Image)();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        image.src = url;
    });
}
function measureElement(tag, url) {
    return new Promise((resolve, reject) => {
        const element = dom().document.createElement(tag);
        element.preload = 'metadata';
        element.onloadedmetadata = () => {
            const meta = { durationSec: element.duration };
            if (tag === 'video') {
                meta.width = element.videoWidth;
                meta.height = element.videoHeight;
            }
            element.src = ''; // release the network connection
            resolve(meta);
        };
        element.onerror = () => reject(new Error(`Failed to load ${tag} metadata: ${url}`));
        element.src = url;
    });
}
//# sourceMappingURL=dom-meta-resolver.js.map