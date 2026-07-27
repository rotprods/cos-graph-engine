"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResizableHandle = exports.ResizablePanel = exports.ResizablePanelGroup = void 0;
const drag_indicator_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/drag_indicator.svg?react"));
const react_resizable_panels_1 = require("react-resizable-panels");
const utils_1 = require("@/lib/utils");
const ResizablePanelGroup = ({ className, ...props }) => (<react_resizable_panels_1.Group className={(0, utils_1.cn)("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)} {...props}/>);
exports.ResizablePanelGroup = ResizablePanelGroup;
const ResizablePanel = react_resizable_panels_1.Panel;
exports.ResizablePanel = ResizablePanel;
const ResizableHandle = ({ withHandle, className, ...props }) => (<react_resizable_panels_1.Separator className={(0, utils_1.cn)("relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90", className)} {...props}>
    {withHandle && (<div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <drag_indicator_svg_react_1.default className="h-2.5 w-2.5"/>
      </div>)}
  </react_resizable_panels_1.Separator>);
exports.ResizableHandle = ResizableHandle;
//# sourceMappingURL=resizable.js.map