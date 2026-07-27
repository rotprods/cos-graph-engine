"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Textarea = Textarea;
const field_1 = require("@base-ui/react/field");
const cx_ts_1 = require("../utils/cx.ts");
function Textarea({ label, description, error, invalid: invalidProp, required = false, start, end, prefix, suffix, render, rows, className, controlClassName, inputClassName, fieldProps, ...controlProps }) {
    const invalid = invalidProp ?? error != null;
    // `start`/`end` are canonical; `prefix`/`suffix` are the back-compat aliases.
    const lead = start ?? prefix;
    const trail = end ?? suffix;
    return (<field_1.Field.Root className={(0, cx_ts_1.cx)('q-field q-field-multiline', className)} {...fieldProps}>
      {label != null
            ? (<field_1.Field.Label className={(0, cx_ts_1.cx)('q-field-label', invalid && 'q-field-label-invalid')}>
              {label}
              {required ? <span aria-hidden className="q-field-required">*</span> : null}
            </field_1.Field.Label>)
            : null}

      <div className={(0, cx_ts_1.cx)('q-field-control q-field-control-multiline', invalid && 'q-field-control-invalid', controlClassName)}>
        {lead != null ? <span className="q-field-affix">{lead}</span> : null}
        {/* `ref` rides in `...controlProps` and Base UI forwards it to the
            rendered <textarea> — the primary node — so it is never dropped.
            Field.Control is input-typed; the rendered <textarea> takes textarea
            attrs/handlers at runtime — the cast bridges the element-type variance. */}
        <field_1.Field.Control render={render ?? <textarea rows={rows}/>} className={(0, cx_ts_1.cx)('q-field-input q-field-input-multiline', inputClassName)} aria-invalid={invalid || undefined} {...controlProps}/>
        {trail != null ? <span className="q-field-affix">{trail}</span> : null}
      </div>

      {invalid && error != null
            ? <field_1.Field.Error match className="q-field-error">{error}</field_1.Field.Error>
            : description != null
                ? <field_1.Field.Description className="q-field-description">{description}</field_1.Field.Description>
                : null}
    </field_1.Field.Root>);
}
//# sourceMappingURL=textarea.js.map