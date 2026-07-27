"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Media = void 0;
exports.useMediaFallback = useMediaFallback;
const react_1 = require("react");
const use_in_view_ts_1 = require("../utils/use-in-view.ts");
const cx_ts_1 = require("../utils/cx.ts");
// Aspect-ratio presets → the `aspect-*` utility. `auto` opts out (intrinsic).
const RATIO_CLASS = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'q-media-portrait',
    wide: 'q-media-wide',
    auto: '',
};
const FIT_CLASS = {
    cover: 'object-cover',
    contain: 'object-contain',
};
// Corner radius → emitted radius utilities (the box clips, so children follow).
const ROUNDED_CLASS = {
    none: 'rounded-q-0',
    sm: 'rounded-q-150',
    md: 'rounded-q-300',
    lg: 'rounded-q-500',
    full: 'rounded-q-full',
};
const OVERLAY_PLACEMENT_CLASS = {
    fill: 'q-media-overlay-fill',
    top: 'q-media-overlay-top',
    bottom: 'q-media-overlay-bottom',
    center: 'q-media-overlay-center',
};
function Root({ ratio = 'video', rounded = 'md', className, style, children, ...props }) {
    const numeric = typeof ratio === 'number';
    return (<div className={(0, cx_ts_1.cx)('q-media', numeric ? undefined : RATIO_CLASS[ratio], ROUNDED_CLASS[rounded], className)} 
    // The custom-ratio var is the one dynamic value that cannot be a class.
    style={numeric ? { '--q-media-ratio': ratio, ...style } : style} {...props}>
      {children}
    </div>);
}
function Image({ fit = 'cover', loading = 'lazy', decoding = 'async', className, alt = '', ...props }) {
    return (<img alt={alt} loading={loading} decoding={decoding} className={(0, cx_ts_1.cx)('q-media-fill', FIT_CLASS[fit], className)} {...props}/>);
}
function Video({ fit = 'cover', autoPlayInView = false, inViewThreshold = 0.5, muted, playsInline, preload, className, ref: forwardedRef, ...props }) {
    const { ref: inViewRef, inView } = (0, use_in_view_ts_1.useInView)({ threshold: inViewThreshold });
    const videoRef = (0, react_1.useRef)(null);
    // Fan the node out to our play/pause ref, the in-view observer, and any
    // forwarded ref — only needed in the autoplay path.
    const setRef = (0, react_1.useCallback)((node) => {
        videoRef.current = node;
        inViewRef(node);
        if (typeof forwardedRef === 'function')
            forwardedRef(node);
        else if (forwardedRef != null)
            forwardedRef.current = node;
    }, [inViewRef, forwardedRef]);
    (0, react_1.useEffect)(() => {
        if (!autoPlayInView)
            return;
        const video = videoRef.current;
        if (video == null)
            return;
        if (inView) {
            // Autoplay can reject (no gesture / not muted) — swallow it, the poster shows.
            void video.play()?.catch(() => { });
        }
        else {
            video.pause();
        }
    }, [autoPlayInView, inView]);
    return (<video ref={autoPlayInView ? setRef : forwardedRef} className={(0, cx_ts_1.cx)('q-media-fill', FIT_CLASS[fit], className)} muted={autoPlayInView ? true : muted} playsInline={autoPlayInView ? true : playsInline} preload={preload ?? (autoPlayInView ? 'metadata' : undefined)} {...props}/>);
}
/** The empty / broken-source slot — a tinted box with centered content. */
function Fallback({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-media-fallback', className)} {...props}/>;
}
/** An absolutely-positioned layer — gradient scrim, play button, corner badge. */
function Overlay({ placement = 'fill', className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-media-overlay', OVERLAY_PLACEMENT_CLASS[placement], className)} {...props}/>;
}
/** A small label region. Compose Typography / Badge / text inside it. */
function Caption({ className, ...props }) {
    return <div className={(0, cx_ts_1.cx)('q-media-caption', className)} {...props}/>;
}
exports.Media = Object.assign(Root, {
    Root,
    Image,
    Video,
    Fallback,
    Overlay,
    Caption,
});
/**
 * Convenience hook for the broken-source pattern: wire `onError` to flip a flag,
 * then render `Media.Fallback` instead of `Media.Image`. Mirrors Avatar's
 * onError→fallback flow without forcing it on every consumer.
 *
 *   const { failed, onError } = useMediaFallback()
 *   {failed ? <Media.Fallback>…</Media.Fallback>
 *           : <Media.Image src={src} onError={onError} />}
 */
function useMediaFallback() {
    const [failed, setFailed] = (0, react_1.useState)(false);
    return { failed, onError: () => setFailed(true), reset: () => setFailed(false) };
}
//# sourceMappingURL=media.js.map