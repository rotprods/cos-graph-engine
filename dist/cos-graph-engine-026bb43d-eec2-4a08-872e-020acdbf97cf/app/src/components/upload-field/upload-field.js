"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadField = UploadField;
const use_render_1 = require("@base-ui/react/use-render");
const close_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/close.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const BORDER_CLASS = {
    dashed: 'border-dashed',
    solid: 'border-solid',
};
function UploadField({ icon, title, subtitle, border = 'dashed', preview, previewAlt = '', onRemove, className, render, ref, ...props }) {
    const interactive = render != null;
    const filled = preview != null;
    const previewNode = typeof preview === 'string'
        ? (<div className="overflow-hidden rounded-q-300 border-2 border-white shadow-q-raised">
          <media_1.Media ratio="video" rounded="none" className="w-44 max-w-full">
            <media_1.Media.Image src={preview} alt={previewAlt}/>
          </media_1.Media>
        </div>)
        : preview;
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: (0, utils_1.cn)(
            // Figma field 3313:51351: 1.5px white-10% outline, white-10% glass +
            // 12px backdrop blur, radius/400, drop shadow + inner sheen.
            'relative flex min-h-36 flex-1 flex-col items-center justify-center gap-3 rounded-q-400 border-[1.5px] border-q-border-default bg-q-transparent-light-10 px-4 pt-6 pb-5 text-center backdrop-blur-md transition-colors shadow-[0px_2px_4px_-0.5px_rgba(0,0,0,0.12),inset_0px_2px_3px_0px_rgba(255,255,255,0.05)]', BORDER_CLASS[border], interactive && 'cursor-pointer hover:border-q-border-strong hover:bg-q-transparent-light-15 focus-visible:outline-2 focus-visible:outline-q-border-focus', className),
            children: filled
                ? (<>
              {previewNode}
              {onRemove != null
                        ? (<button type="button" aria-label="Remove" onClick={onRemove} className="absolute top-2 right-2 flex items-center justify-center rounded-q-200 bg-q-transparent-dark-40 p-1.5 backdrop-blur-md transition-colors hover:bg-q-transparent-dark-60 focus-visible:outline-2 focus-visible:outline-q-border-focus">
                      <icon_1.Icon as={close_svg_react_1.default} size="sm" color="primary"/>
                    </button>)
                        : null}
            </>)
                : (<>
              {icon != null
                        ? (
                        // Figma icon chip 3313:51410: white-5% fill, #c5c5c5-30% ring,
                        // dual drop shadow + inner bottom glow, full-round.
                        <span className="flex items-center justify-center rounded-q-full border border-[#c5c5c54d] bg-q-transparent-light-05 p-2.5 shadow-[0px_20.533px_10.266px_0px_rgba(0,0,0,0.09),0px_5.059px_5.654px_0px_rgba(0,0,0,0.1),inset_0px_-0.298px_5.356px_0px_rgba(185,185,185,0.35)]">
                      <icon_1.Icon as={icon} size="md" color="primary"/>
                    </span>)
                        : null}
              <div className="flex flex-col items-center gap-1">
                {title != null
                        ? (<typography_1.Typography as="span" variant="body-md-medium" color="primary">
                        {title}
                      </typography_1.Typography>)
                        : null}
                {subtitle != null
                        ? (<typography_1.Typography as="span" variant="body-sm-medium" color="secondary">
                        {subtitle}
                      </typography_1.Typography>)
                        : null}
              </div>
            </>),
            ...props,
        },
    });
}
//# sourceMappingURL=upload-field.js.map