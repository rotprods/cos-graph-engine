"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Accordion = void 0;
const accordion_1 = require("@base-ui/react/accordion");
const IconChevronDownMediumOutlined_1 = require("@higgsfield-ai/icons/IconChevronDownMediumOutlined");
const index_ts_1 = require("../icon/index.ts");
const cx_ts_1 = require("../utils/cx.ts");
const VARIANT_CLASS = {
    list: 'q-accordion-list',
    separated: 'q-accordion-separated',
};
// md is the default metrics baked into the base utilities; sm/lg scale the row
// padding, the trigger + card radius, and the typography down/up.
const SIZE_CLASS = {
    sm: 'q-accordion-sm',
    md: '',
    lg: 'q-accordion-lg',
};
function Root({ className, variant = 'list', size = 'md', ...props }) {
    return (<accordion_1.Accordion.Root className={(0, cx_ts_1.cx)('q-accordion', VARIANT_CLASS[variant], SIZE_CLASS[size], className)} {...props}/>);
}
function Item({ className, ...props }) {
    return (<accordion_1.Accordion.Item className={(0, cx_ts_1.cx)('q-accordion-item', className)} {...props}/>);
}
/**
 * Trigger renders inside the Base UI `Header` (an `<h3>`). The caller's label is
 * `children`; a chevron in the trailing slot rotates 180° on `[data-panel-open]`.
 */
function Trigger({ children, className, headerClassName, start, end, ...props }) {
    return (<accordion_1.Accordion.Header className={(0, cx_ts_1.cx)('q-accordion-header', headerClassName)}>
      <accordion_1.Accordion.Trigger className={(0, cx_ts_1.cx)('q-accordion-trigger', className)} {...props}>
        {start != null ? <span className="q-accordion-trigger-start">{start}</span> : null}
        <span className="q-accordion-trigger-label">{children}</span>
        <span className="q-accordion-trigger-end">
          {end ?? (<index_ts_1.Icon size="sm" className="q-accordion-chevron">
              <IconChevronDownMediumOutlined_1.IconChevronDownMediumOutlined />
            </index_ts_1.Icon>)}
        </span>
      </accordion_1.Accordion.Trigger>
    </accordion_1.Accordion.Header>);
}
/**
 * Panel animates height via the Base UI `--accordion-panel-height` var. The panel
 * itself is `overflow: hidden` and transitions `height`; an inner wrapper holds
 * the real padding so content doesn't reflow during the collapse.
 */
function Panel({ children, className, contentClassName, ...props }) {
    return (<accordion_1.Accordion.Panel className={(0, cx_ts_1.cx)('q-accordion-panel', className)} {...props}>
      <div className={(0, cx_ts_1.cx)('q-accordion-panel-content', contentClassName)}>{children}</div>
    </accordion_1.Accordion.Panel>);
}
exports.Accordion = { Root, Item, Trigger, Panel };
//# sourceMappingURL=accordion.js.map