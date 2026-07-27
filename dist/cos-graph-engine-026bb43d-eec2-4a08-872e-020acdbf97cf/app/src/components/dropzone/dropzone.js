"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dropzone = Dropzone;
const use_render_1 = require("@base-ui/react/use-render");
const icon_1 = require("@higgsfield/quanta/icon");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const BORDER_CLASS = {
    dashed: 'border-dashed',
    solid: 'border-solid',
};
function Dropzone({ icon, title, subtitle, border = 'dashed', preview, className, render, ref, ...props }) {
    const interactive = render != null;
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'div',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('flex min-h-40 flex-1 flex-col items-center justify-center gap-3 rounded-q-400 border border-q-border-subtle p-3 text-center transition-colors', BORDER_CLASS[border], interactive && 'cursor-pointer hover:border-q-border-strong hover:bg-q-transparent-light-05 focus-visible:outline-2 focus-visible:outline-q-border-focus', className),
            children: preview != null
                ? preview
                : (<>
              {icon != null ? <icon_1.Icon as={icon} size="md" color="secondary"/> : null}
              <div className="flex flex-col items-center gap-1">
                {title != null
                        ? (<typography_1.Typography as="span" variant="body-md-semi-bold" color="primary">
                        {title}
                      </typography_1.Typography>)
                        : null}
                {subtitle != null
                        ? (<typography_1.Typography as="span" variant="caption-xs-regular" color="secondary">
                        {subtitle}
                      </typography_1.Typography>)
                        : null}
              </div>
            </>),
            ...props,
        },
    });
}
//# sourceMappingURL=dropzone.js.map