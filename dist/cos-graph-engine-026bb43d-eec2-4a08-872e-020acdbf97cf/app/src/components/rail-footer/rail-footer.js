"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.RailFooter = RailFooter;
const utils_1 = require("@/lib/utils");
function RailFooter({ children, className, ...props }) {
    return (<div className={(0, utils_1.cn)(
        // Pinned to the bottom of the scrolling rail; `mt-auto` drops it to the
        // bottom when content is short. The gradient scrim (rail surface →
        // transparent) fades the scrolling fields under the CTA.
        'sticky bottom-0 z-10 mt-auto flex flex-col bg-gradient-to-t from-q-background-secondary from-70% to-transparent pt-8 pb-2', className)} {...props}>
      {children}
    </div>);
}
//# sourceMappingURL=rail-footer.js.map