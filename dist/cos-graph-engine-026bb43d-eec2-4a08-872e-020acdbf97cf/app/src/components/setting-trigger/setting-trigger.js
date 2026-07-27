"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingTrigger = SettingTrigger;
const use_render_1 = require("@base-ui/react/use-render");
const chevron_right_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_right.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const utils_1 = require("@/lib/utils");
function SettingTrigger({ label, children, placeholder, start, end, render, className, ref, ...props }) {
    const isEmpty = children == null;
    const content = (<>
      {start != null ? <span className="q-setting-trigger-start">{start}</span> : null}
      <span className="q-setting-trigger-body">
        {label != null ? <span className="q-setting-trigger-label">{label}</span> : null}
        <span className={(0, utils_1.cn)('q-setting-trigger-value', isEmpty && 'q-setting-trigger-placeholder')}>
          {isEmpty ? placeholder : children}
        </span>
      </span>
      <span className="q-setting-trigger-end">
        {end ?? <icon_1.Icon size="sm" as={chevron_right_svg_react_1.default}/>}
      </span>
    </>);
    // Only the default host is a real <button> and gets the implicit type;
    // a `render` element owns its own semantics.
    return (0, use_render_1.useRender)({
        render,
        defaultTagName: 'button',
        ref: ref,
        props: {
            className: (0, utils_1.cn)('q-setting-trigger', className),
            ...(render == null ? { type: 'button' } : {}),
            children: content,
            ...props,
        },
    });
}
//# sourceMappingURL=setting-trigger.js.map