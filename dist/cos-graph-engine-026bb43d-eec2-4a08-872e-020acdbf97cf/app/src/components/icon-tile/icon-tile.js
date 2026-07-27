"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ICON_TILE_GRADIENT = void 0;
exports.IconTile = IconTile;
const icon_1 = require("@higgsfield/quanta/icon");
const utils_1 = require("@/lib/utils");
/**
 * Brand gradient presets for the colored tile. The stops are bespoke branded
 * fills (no Quanta gradient token exists), kept here so every surface that uses
 * a colored icon tile shares the exact same fills.
 */
exports.ICON_TILE_GRADIENT = {
    blue: 'linear-gradient(135deg, rgb(65, 136, 190) 0%, rgb(14, 39, 114) 100%)',
    teal: 'linear-gradient(135deg, rgb(81, 226, 224) 3.8675%, rgb(18, 92, 141) 93.451%)',
};
function IconTile({ as, gradient, className, style, ...props }) {
    const isGradient = gradient != null;
    const backgroundImage = isGradient
        ? (exports.ICON_TILE_GRADIENT[gradient] ?? gradient)
        : undefined;
    return (<span className={(0, utils_1.cn)('q-icon-tile', isGradient ? 'q-icon-tile-gradient' : 'q-icon-tile-neutral', className)} style={isGradient ? { backgroundImage, ...style } : style} {...props}>
      <icon_1.Icon as={as} size="sm" color={isGradient ? undefined : 'secondary'} className="q-icon-tile-glyph"/>
    </span>);
}
//# sourceMappingURL=icon-tile.js.map