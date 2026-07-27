"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropzonePreview = DropzonePreview;
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
function DropzonePreview({ src, alt, label, icon, className }) {
    const captioned = label != null;
    const altText = alt ?? (typeof label === 'string' ? label : '');
    return (<div className={(0, utils_1.cn)('overflow-hidden border-2 border-white', captioned
            ? 'size-22 -rotate-4 rounded-q-400'
            : 'size-25 rounded-q-500 shadow-q-raised', className)}>
      <media_1.Media ratio="square" rounded="none" className="size-full">
        <media_1.Media.Image src={src} alt={altText}/>
        {captioned
            ? (<media_1.Media.Overlay placement="center" className="flex-col gap-1.5 bg-q-transparent-dark-40 px-3 py-2 backdrop-blur-md">
                {icon != null ? <icon_1.Icon as={icon} size="sm" color="primary"/> : null}
                <typography_1.Typography as="span" variant="caption-xs-medium" color="primary" className="text-center">
                  {label}
                </typography_1.Typography>
              </media_1.Media.Overlay>)
            : null}
      </media_1.Media>
    </div>);
}
//# sourceMappingURL=dropzone-preview.js.map