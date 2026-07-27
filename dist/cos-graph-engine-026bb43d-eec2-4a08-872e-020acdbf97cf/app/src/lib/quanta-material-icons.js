"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconChevronBottomOutlined = exports.IconChevronDownMediumOutlined = exports.IconChevronGrabberVerticalOutlined = exports.IconChevronLeftMediumOutlined = exports.IconChevronRightMediumOutlined = exports.IconCircleCheckOutlined = exports.IconCircleInfoOutlined = exports.IconCircleOutlined = exports.IconCircleXOutlined = exports.IconCrossMediumOutlined = exports.IconExclamationTriangleOutlined = exports.IconPinFilledThin = exports.IconPlusMediumOutlined = exports.IconCheckmark2MediumOutlined = exports.IconFolder1Outlined = exports.IconMagnifyingGlassOutlined = exports.IconMagnifyingGlass2Outlined = void 0;
const add_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/add.svg?react"));
const cancel_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/cancel.svg?react"));
const check_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/check.svg?react"));
const check_circle_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/check_circle.svg?react"));
const chevron_left_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_left.svg?react"));
const chevron_right_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_right.svg?react"));
const circle_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/circle.svg?react"));
const close_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/close.svg?react"));
const folder_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/folder.svg?react"));
const info_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/info.svg?react"));
const keep_fill_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keep-fill.svg?react"));
const keyboard_arrow_down_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?react"));
const search_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/search.svg?react"));
const unfold_more_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/unfold_more.svg?react"));
const warning_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/warning.svg?react"));
// TYPE BRIDGE, not a runtime change: svgr components are typed against the
// app's @types/react while quanta types glyphs against its own vendored copy
// (`IconGlyph`). Runtime is unaffected — the glyphs just spread props onto
// the <svg> — so re-export each icon cast to quanta's IconGlyph.
const glyph = (icon) => icon;
exports.IconMagnifyingGlass2Outlined = glyph(search_svg_react_1.default);
exports.IconMagnifyingGlassOutlined = glyph(search_svg_react_1.default);
exports.IconFolder1Outlined = glyph(folder_svg_react_1.default);
exports.IconCheckmark2MediumOutlined = glyph(check_svg_react_1.default);
exports.IconPlusMediumOutlined = glyph(add_svg_react_1.default);
exports.IconPinFilledThin = glyph(keep_fill_svg_react_1.default);
exports.IconExclamationTriangleOutlined = glyph(warning_svg_react_1.default);
exports.IconCrossMediumOutlined = glyph(close_svg_react_1.default);
exports.IconCircleXOutlined = glyph(cancel_svg_react_1.default);
exports.IconCircleOutlined = glyph(circle_svg_react_1.default);
exports.IconCircleInfoOutlined = glyph(info_svg_react_1.default);
exports.IconCircleCheckOutlined = glyph(check_circle_svg_react_1.default);
exports.IconChevronRightMediumOutlined = glyph(chevron_right_svg_react_1.default);
exports.IconChevronLeftMediumOutlined = glyph(chevron_left_svg_react_1.default);
exports.IconChevronGrabberVerticalOutlined = glyph(unfold_more_svg_react_1.default);
exports.IconChevronDownMediumOutlined = glyph(keyboard_arrow_down_svg_react_1.default);
exports.IconChevronBottomOutlined = glyph(keyboard_arrow_down_svg_react_1.default);
//# sourceMappingURL=quanta-material-icons.js.map