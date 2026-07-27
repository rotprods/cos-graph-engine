"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseIcon = void 0;
exports.closeButton = closeButton;
exports.CloseButton = CloseButton;
const IconCrossMediumOutlined_1 = require("@higgsfield-ai/icons/IconCrossMediumOutlined");
Object.defineProperty(exports, "CloseIcon", { enumerable: true, get: function () { return IconCrossMediumOutlined_1.IconCrossMediumOutlined; } });
const cx_ts_1 = require("../utils/cx.ts");
const index_ts_1 = require("../icon/index.ts");
const SIZE_CLASS = {
    sm: 'q-close-sm',
    md: 'q-close-md',
    lg: 'q-close-lg',
    xl: 'q-close-xl',
};
// Disc size → cross-glyph Icon size, matching the Figma 16/20/24/24 glyphs that
// the `--q-close-icon` CSS var previously drove (now owned by <Icon>).
const ICON_SIZE = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'lg',
};
/**
 * Build the close-button class string. Use this to apply the styling to a
 * non-`<button>` close element, e.g. a Base UI `Dialog.Close` / `Toast.Close`.
 */
function closeButton({ size = 'md' } = {}, ...extra) {
    return (0, cx_ts_1.cx)('q-close', SIZE_CLASS[size], ...extra);
}
function CloseButton({ size = 'md', className, type, children, 'aria-label': ariaLabel, ...props }) {
    return (<button type={type ?? 'button'} aria-label={ariaLabel ?? 'Close'} className={closeButton({ size }, className)} {...props}>
      {children ?? <index_ts_1.Icon as={IconCrossMediumOutlined_1.IconCrossMediumOutlined} size={ICON_SIZE[size]}/>}
    </button>);
}
//# sourceMappingURL=close-button.js.map