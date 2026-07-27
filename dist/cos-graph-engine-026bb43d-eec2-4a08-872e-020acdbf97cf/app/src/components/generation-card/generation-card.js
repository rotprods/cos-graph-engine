"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationCard = GenerationCard;
const use_render_1 = require("@base-ui/react/use-render");
const loader_1 = require("@higgsfield/quanta/loader");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
/** The pulsing top glow + "Generating" status pill (Cinema-Studio-V4 20037:25838). */
function GeneratingOverlay({ label }) {
    return (<span className="q-generation-card-generating">
      <span className="q-generation-card-glow" aria-hidden="true"/>
      <span className="q-generation-card-status">
        {/* Loader owns role="status" + aria-label; the label text is its visible echo. */}
        <loader_1.Loader variant="circle" size="xs" color="brand" aria-label={typeof label === 'string' ? label : 'Generating'}/>
        <typography_1.Typography as="span" variant="body-sm-medium" color="brand" aria-hidden="true">
          {label}
        </typography_1.Typography>
      </span>
    </span>);
}
function GenerationCard({ state = 'ready', src, alt = '', ratio = 'video', media, title, generatingLabel = 'Generating', className, children, render, ref, ...props }) {
    const generating = state === 'generating';
    const content = (<>
      <media_1.Media ratio={ratio} rounded="md" className="q-generation-card-media">
        {generating
            ? (media ?? <media_1.Media.Fallback className="q-generation-card-canvas"/>)
            : (media ?? (src != null ? <media_1.Media.Image src={src} alt={alt}/> : <media_1.Media.Fallback />))}
      </media_1.Media>
      {!generating && title != null
            ? (<media_1.Media.Overlay placement="bottom" className="q-generation-card-caption">
              <typography_1.Typography as="span" variant="body-sm-semi-bold" color="primary" className="q-generation-card-title">
                {title}
              </typography_1.Typography>
            </media_1.Media.Overlay>)
            : null}
      {generating ? <GeneratingOverlay label={generatingLabel}/> : null}
      {children}
    </>);
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-generation-card', className),
            'data-state': state,
            children: content,
            ...props,
        },
    });
}
//# sourceMappingURL=generation-card.js.map