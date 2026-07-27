"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCard = void 0;
const use_render_1 = require("@base-ui/react/use-render");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const FRAME_CLASS = {
    none: '',
    thin: 'q-media-card-frame-thin',
    thick: 'q-media-card-frame-thick',
};
/** Caption modifier per title variant — `accent` covers get p-16 + uppercase. */
const TITLE_VARIANT_CLASS = {
    body: '',
    accent: 'q-media-card-caption-accent',
};
function Root({ src, alt = '', ratio = 'video', media, title, titleVariant = 'body', scrim = true, frame = 'thick', selected = false, action, children, className, render, ref, ...props }) {
    const content = (<>
      <media_1.Media ratio={ratio} rounded="none" className="q-media-card-media">
        {media ?? (src != null ? <media_1.Media.Image src={src} alt={alt}/> : <media_1.Media.Fallback />)}
      </media_1.Media>
      {title != null
            ? (<media_1.Media.Overlay placement="bottom" className={(0, utils_1.cn)('q-media-card-caption', !scrim && 'q-media-card-caption-bare', TITLE_VARIANT_CLASS[titleVariant])}>
              <typography_1.Typography as="span" variant={titleVariant === 'accent' ? 'accent-xs-bold' : 'body-lg-semi-bold'} color="primary" className="q-media-card-title">
                {title}
              </typography_1.Typography>
            </media_1.Media.Overlay>)
            : null}
      {action != null ? <span className="q-media-card-action-slot">{action}</span> : null}
      {children}
    </>);
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-media-card', FRAME_CLASS[frame], selected && 'ring-2 ring-q-brand-primary', className),
            children: content,
            ...props,
        },
    });
}
/**
 * The on-media glass chip (Figma "secondary - default - xs - r_sm",
 * 2950:66569): a 28px dark-glass pill pinned over imagery — "Change", "Edit".
 * A bespoke control: no Button variant covers the on-media dark glass look
 * (flagged in the variant registry). Compose the label with a trailing 16px
 * icon as children.
 */
function Action({ className, type, ...props }) {
    return (<button type={type ?? 'button'} className={(0, utils_1.cn)('q-media-card-action', className)} {...props}/>);
}
exports.MediaCard = Object.assign(Root, { Action });
//# sourceMappingURL=media-card.js.map