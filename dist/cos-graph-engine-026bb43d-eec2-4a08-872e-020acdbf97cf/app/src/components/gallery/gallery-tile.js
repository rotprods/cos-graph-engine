"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryTile = GalleryTile;
const react_1 = require("react");
const play_arrow_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/play_arrow.svg?react"));
const videocam_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/videocam.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const generation_card_1 = require("@/components/generation-card");
const generation_detail_1 = require("@/components/generation-detail");
function rectStyle(rect, top, tint) {
    return {
        left: rect.x,
        top,
        width: rect.width,
        height: rect.height,
        // Consumed by the .qg-placeholder / .qg-tile background.
        ['--qg-tint']: tint,
    };
}
/** A cheap solid placeholder — shown during fast flings and before media loads. */
function Placeholder({ shimmer }) {
    return <span className="qg-placeholder" data-shimmer={shimmer ? 'true' : 'false'} aria-hidden="true"/>;
}
/** Still image with a placeholder→full fade and tier-driven load priority. */
function StillMedia({ item, tier, fastScroll }) {
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    return (<>
      <Placeholder shimmer={fastScroll}/>
      {!fastScroll && (<img className="qg-media absolute inset-0 size-full object-cover" data-loaded={loaded ? 'true' : 'false'} src={item.src} alt={item.alt} loading={tier === 'full' ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(true)}/>)}
    </>);
}
/**
 * Hover-to-play video: poster still by default, plays (muted / looped /
 * playsInline) on hover & focus, pauses and resets on leave. Respects reduced
 * motion — when set, the poster stays put and the clip never autoplays on hover.
 */
function HoverVideo({ item, tier, fastScroll, playing, reducedMotion, }) {
    const ref = (0, react_1.useRef)(null);
    const [posterLoaded, setPosterLoaded] = (0, react_1.useState)(false);
    const active = playing && !reducedMotion;
    (0, react_1.useEffect)(() => {
        const v = ref.current;
        if (v == null)
            return;
        if (active) {
            void v.play()?.catch(() => { });
        }
        else {
            v.pause();
            try {
                v.currentTime = 0;
            }
            catch { }
        }
    }, [active]);
    return (<>
      <Placeholder shimmer={fastScroll}/>
      {!fastScroll && (<img className="qg-media absolute inset-0 size-full object-cover" data-loaded={posterLoaded ? 'true' : 'false'} src={item.src} alt={item.alt} loading={tier === 'full' ? 'eager' : 'lazy'} decoding="async" onLoad={() => setPosterLoaded(true)} style={{ opacity: active ? 0 : undefined }}/>)}
      {!fastScroll && (<video ref={ref} className="absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out" muted loop playsInline preload="none" poster={item.src} style={{ opacity: active ? 1 : 0 }}>
          <source src={item.videoSrc} type="video/mp4"/>
        </video>)}
      {/* Video affordance — a glass chip: a videocam glyph at rest, a play
            triangle on hover, so the tile always reads as a hover-to-play clip. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 flex size-7 items-center justify-center rounded-q-full bg-q-overlay-hover text-q-icon-primary backdrop-blur-md">
        <icon_1.Icon as={playing ? play_arrow_svg_react_1.default : videocam_svg_react_1.default} size="sm"/>
      </span>
    </>);
}
function GalleryTile({ item, rect, top, tier, fastScroll, reducedMotion }) {
    const [hovered, setHovered] = (0, react_1.useState)(false);
    if (item.status === 'generating') {
        return (<generation_card_1.GenerationCard state="generating" ratio="auto" className="qg-tile" style={rectStyle(rect, top, item.tint)}/>);
    }
    const isVideo = item.kind === 'video';
    const media = isVideo
        ? (<HoverVideo item={item} tier={tier} fastScroll={fastScroll} playing={hovered} reducedMotion={reducedMotion}/>)
        : (<StillMedia item={item} tier={tier} fastScroll={fastScroll}/>);
    return (<generation_detail_1.GenerationDetailModal generation={{
            src: isVideo ? (item.videoSrc ?? item.src) : item.src,
            poster: isVideo ? item.src : undefined,
            mediaType: isVideo ? 'video' : 'image',
            aspectRatio: item.width / item.height,
            prompt: item.prompt,
        }} trigger={(<generation_card_1.GenerationCard render={<button type="button"/>} ratio="auto" className="qg-tile group" style={rectStyle(rect, top, item.tint)} media={media} aria-label={`Open generation: ${item.prompt}`} onMouseEnter={isVideo ? () => setHovered(true) : undefined} onMouseLeave={isVideo ? () => setHovered(false) : undefined} onFocus={isVideo ? () => setHovered(true) : undefined} onBlur={isVideo ? () => setHovered(false) : undefined}/>)}/>);
}
//# sourceMappingURL=gallery-tile.js.map