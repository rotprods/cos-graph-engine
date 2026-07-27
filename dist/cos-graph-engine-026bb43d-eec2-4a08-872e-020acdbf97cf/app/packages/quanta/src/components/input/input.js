"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Input = Input;
const field_1 = require("@base-ui/react/field");
const cx_ts_1 = require("../utils/cx.ts");
function Input({ label, description, error, invalid: invalidProp, required = false, start, end, prefix, suffix, render, className, controlClassName, inputClassName, fieldProps, ...controlProps }) {
    const invalid = invalidProp ?? error != null;
    // `start`/`end` are canonical; `prefix`/`suffix` are the back-compat aliases.
    const lead = start ?? prefix;
    const trail = end ?? suffix;
    return (<field_1.Field.Root className={(0, cx_ts_1.cx)('q-field', className)} {...fieldProps}>
      {label != null
            ? (<field_1.Field.Label className={(0, cx_ts_1.cx)('q-field-label', invalid && 'q-field-label-invalid')}>
              {label}
              {required ? <span aria-hidden className="q-field-required">*</span> : null}
            </field_1.Field.Label>)
            : null}

      <div className={(0, cx_ts_1.cx)('q-field-control', invalid && 'q-field-control-invalid', controlClassName)}>
        {lead != null ? <span className="q-field-affix">{lead}</span> : null}
        {/* `ref` rides in `...controlProps` and Base UI forwards it to the
            rendered <input> — the primary node — so it is never dropped. */}
        <field_1.Field.Control className={(0, cx_ts_1.cx)('q-field-input', inputClassName)} aria-invalid={invalid || undefined} render={render} {...controlProps}/>
        {trail != null ? <span className="q-field-affix">{trail}</span> : null}
      </div>

      {invalid && error != null
            ? <field_1.Field.Error match className="q-field-error">{error}</field_1.Field.Error>
            : description != null
                ? <field_1.Field.Description className="q-field-description">{description}</field_1.Field.Description>
                : null}
    </field_1.Field.Root>);
}
//# sourceMappingURL=input.js.map