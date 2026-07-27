"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateModal = TemplateModal;
const react_1 = require("react");
const media_1 = require("@higgsfield/quanta/media");
const modal_1 = require("@higgsfield/quanta/modal");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const COLUMN_CLASS = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
};
/** A single selectable preset tile — preview + label, lime-ringed when active. */
function OptionCard({ option, selected, closeOnSelect, onSelect }) {
    const className = (0, utils_1.cn)('group flex flex-col gap-2 rounded-q-600 text-left transition-transform', 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-border-focus');
    const children = (<>
      <media_1.Media ratio="auto" rounded="md" className={(0, utils_1.cn)('h-60 w-full border-2 bg-q-background-secondary transition-colors', selected
            ? 'border-q-brand-primary'
            : 'border-transparent group-hover:border-q-border-strong')}>
        <media_1.Media.Image src={option.image} alt={option.alt ?? option.label}/>
      </media_1.Media>
      <typography_1.Typography as="span" variant="body-md-semi-bold" color="primary" truncate className="px-0.5">
        {option.label}
      </typography_1.Typography>
    </>);
    const handleClick = () => onSelect(option);
    return closeOnSelect
        ? (<modal_1.Modal.Close className={className} onClick={handleClick} aria-pressed={selected}>
          {children}
        </modal_1.Modal.Close>)
        : (<button type="button" className={className} onClick={handleClick} aria-pressed={selected}>
          {children}
        </button>);
}
function TemplateModal({ trigger, options, title = 'All Presets', value, defaultValue, onSelect, columns = 4, closeOnSelect = true, defaultOpen, }) {
    const [internal, setInternal] = (0, react_1.useState)(defaultValue);
    const selectedId = value ?? internal;
    const handleSelect = (option) => {
        if (value === undefined)
            setInternal(option.id);
        onSelect?.(option);
    };
    return (<modal_1.Modal.Root defaultOpen={defaultOpen}>
      <modal_1.Modal.Trigger render={trigger}/>
      <modal_1.Modal.Content size="xl">
        <modal_1.Modal.Header>
          <modal_1.Modal.Title>{title}</modal_1.Modal.Title>
          <modal_1.Modal.CloseButton />
        </modal_1.Modal.Header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={(0, utils_1.cn)('grid gap-5 p-1', COLUMN_CLASS[columns])}>
            {options.map(option => (<OptionCard key={option.id} option={option} selected={option.id === selectedId} closeOnSelect={closeOnSelect} onSelect={handleSelect}/>))}
          </div>
        </div>
      </modal_1.Modal.Content>
    </modal_1.Modal.Root>);
}
//# sourceMappingURL=template-modal.js.map