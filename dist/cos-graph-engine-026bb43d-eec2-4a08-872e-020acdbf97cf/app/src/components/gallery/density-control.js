"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DensityControl = DensityControl;
const density_large_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/density_large.svg?react"));
const density_small_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/density_small.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const slider_1 = require("@higgsfield/quanta/slider");
const typography_1 = require("@higgsfield/quanta/typography");
const use_justified_gallery_ts_1 = require("./use-justified-gallery.ts");
function DensityControl({ value, onChange }) {
    const steps = use_justified_gallery_ts_1.DENSITY_ROW_HEIGHTS.length;
    return (<div className="flex items-center gap-2">
      <typography_1.Typography as="span" variant="caption-sm-medium" color="tertiary" className="hidden sm:inline">
        Density
      </typography_1.Typography>
      <icon_1.Icon as={density_large_svg_react_1.default} size="sm" color="tertiary" aria-hidden="true"/>
      <slider_1.Slider aria-label="Tile density" steps={steps} value={value} onChange={onChange} className="w-32"/>
      <icon_1.Icon as={density_small_svg_react_1.default} size="sm" color="tertiary" aria-hidden="true"/>
    </div>);
}
//# sourceMappingURL=density-control.js.map