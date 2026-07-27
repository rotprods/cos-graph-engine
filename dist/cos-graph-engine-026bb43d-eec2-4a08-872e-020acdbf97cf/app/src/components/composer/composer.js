"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composer = void 0;
const field_1 = require("@base-ui/react/field");
const button_1 = require("@higgsfield/quanta/button");
const utils_1 = require("@/lib/utils");
function Root({ label, actions, render, rows, className, inputClassName, fieldProps, ...controlProps }) {
    return (<field_1.Field.Root className={(0, utils_1.cn)('q-composer', className)} {...fieldProps}>
      <div className="q-composer-content">
        {label != null ? <field_1.Field.Label className="q-composer-label">{label}</field_1.Field.Label> : null}
        {/* `ref` rides in `...controlProps`; Base UI forwards it to the rendered
            <textarea> — the primary control node. Field.Control is input-typed;
            the cast bridges the element-type variance (Textarea precedent). */}
        <field_1.Field.Control render={render ?? <textarea rows={rows}/>} className={(0, utils_1.cn)('q-composer-input', inputClassName)} {...controlProps}/>
      </div>
      {actions != null ? <div className="q-composer-actions">{actions}</div> : null}
    </field_1.Field.Root>);
}
/** Footer pill — a quanta Button re-skinned to the composer's white-5% pill. */
function Action({ className, ...props }) {
    return (<button_1.Button variant="ghost" size="xs" className={(0, utils_1.cn)('q-composer-action', className)} {...props}/>);
}
exports.Composer = Object.assign(Root, { Action });
//# sourceMappingURL=composer.js.map