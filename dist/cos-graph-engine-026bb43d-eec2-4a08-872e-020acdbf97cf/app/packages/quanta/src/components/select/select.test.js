"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const react_2 = require("react");
const IconFolder1Outlined_1 = require("@higgsfield-ai/icons/IconFolder1Outlined");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
/** A title-only option (the common composition). */
function Option({ value, label }) {
    return (<index_ts_1.Select.Item value={value}>
      <index_ts_1.Select.ItemText>{label}</index_ts_1.Select.ItemText>
      <index_ts_1.Select.ItemIndicator />
    </index_ts_1.Select.Item>);
}
// Base UI resolves the trigger Value label from `items` when the popup is closed.
const MODEL_ITEMS = { soul: 'Soul 2.0', gpt: 'GPT Image 2', kling: 'Kling 3.0' };
function Basic({ defaultOpen = false, ...rootProps }) {
    return (<index_ts_1.Select.Root defaultOpen={defaultOpen} items={MODEL_ITEMS} {...rootProps}>
      <index_ts_1.Select.Trigger>
        <index_ts_1.Select.Value placeholder="Choose a model"/>
        <index_ts_1.Select.Icon />
      </index_ts_1.Select.Trigger>
      <index_ts_1.Select.Content>
        <index_ts_1.Select.Group>
          <index_ts_1.Select.GroupLabel>Models</index_ts_1.Select.GroupLabel>
          <Option value="soul" label="Soul 2.0"/>
          <Option value="gpt" label="GPT Image 2"/>
          <Option value="kling" label="Kling 3.0"/>
        </index_ts_1.Select.Group>
      </index_ts_1.Select.Content>
    </index_ts_1.Select.Root>);
}
(0, vitest_1.describe)('Select trigger', () => {
    (0, vitest_1.it)('renders a combobox trigger that looks like a field', () => {
        (0, react_1.render)(<Basic />);
        const trigger = react_1.screen.getByRole('combobox');
        (0, vitest_1.expect)(trigger).toHaveClass('q-field-control', 'q-select-trigger');
    });
    (0, vitest_1.it)('shows the placeholder when no value is selected', () => {
        (0, react_1.render)(<Basic />);
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toHaveTextContent('Choose a model');
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toHaveAttribute('data-placeholder');
    });
    (0, vitest_1.it)('applies the size preset to the trigger', () => {
        (0, react_1.render)(<index_ts_1.Select.Root>
        <index_ts_1.Select.Trigger size="lg"><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content><Option value="a" label="A"/></index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toHaveClass('q-select-trigger-lg');
    });
    (0, vitest_1.it)('paints the invalid ring when invalid', () => {
        (0, react_1.render)(<index_ts_1.Select.Root>
        <index_ts_1.Select.Trigger invalid><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content><Option value="a" label="A"/></index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        const trigger = react_1.screen.getByRole('combobox');
        (0, vitest_1.expect)(trigger).toHaveClass('q-field-control-invalid');
        (0, vitest_1.expect)(trigger).toHaveAttribute('data-invalid');
    });
    (0, vitest_1.it)('disables the trigger when the root is disabled', () => {
        (0, react_1.render)(<index_ts_1.Select.Root disabled>
        <index_ts_1.Select.Trigger><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content><Option value="a" label="A"/></index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toBeDisabled();
    });
    (0, vitest_1.it)('forwards a ref to the trigger button', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Select.Root>
        <index_ts_1.Select.Trigger ref={ref}><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content><Option value="a" label="A"/></index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        (0, vitest_1.expect)(ref.current).toBe(react_1.screen.getByRole('combobox'));
    });
});
(0, vitest_1.describe)('Select popup', () => {
    (0, vitest_1.it)('renders the dropdown glass surface (defaultOpen)', () => {
        (0, react_1.render)(<Basic defaultOpen/>);
        // The glass surface is the popup; role=listbox is on the inner scroll list.
        (0, vitest_1.expect)(react_1.screen.getByRole('listbox').closest('.q-select-content')).toHaveClass('q-dropdown-content', 'q-select-content');
    });
    (0, vitest_1.it)('applies the solid surface preset', () => {
        (0, react_1.render)(<index_ts_1.Select.Root defaultOpen>
        <index_ts_1.Select.Trigger><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content surface="solid"><Option value="a" label="A"/></index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('listbox').closest('.q-select-content')).toHaveClass('q-dropdown-content-solid');
    });
    (0, vitest_1.it)('renders a group label and option rows', () => {
        (0, react_1.render)(<Basic defaultOpen/>);
        (0, vitest_1.expect)(react_1.screen.getByText('Models')).toHaveClass('q-menu-group-label');
        (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'Soul 2.0' })).toHaveClass('q-menu-item', 'q-select-item');
    });
    (0, vitest_1.it)('renders an option with a leading icon (composition)', () => {
        (0, react_1.render)(<index_ts_1.Select.Root defaultOpen>
        <index_ts_1.Select.Trigger><index_ts_1.Select.Value placeholder="x"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content>
          <index_ts_1.Select.Item value="folder">
            <index_ts_1.Select.ItemIcon><IconFolder1Outlined_1.IconFolder1Outlined /></index_ts_1.Select.ItemIcon>
            <index_ts_1.Select.ItemText>Folder</index_ts_1.Select.ItemText>
            <index_ts_1.Select.ItemIndicator />
          </index_ts_1.Select.Item>
        </index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        const option = react_1.screen.getByRole('option', { name: 'Folder' });
        (0, vitest_1.expect)(option.querySelector('.q-menu-item-icon')).toBeInTheDocument();
    });
});
(0, vitest_1.describe)('Select selection', () => {
    (0, vitest_1.it)('seeds the trigger value from defaultValue', () => {
        (0, react_1.render)(<Basic defaultValue="gpt"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toHaveTextContent('GPT Image 2');
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).not.toHaveAttribute('data-placeholder');
    });
    (0, vitest_1.it)('selects an option on click and echoes it into the trigger', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        await user.click(react_1.screen.getByRole('combobox'));
        await user.click(await react_1.screen.findByRole('option', { name: 'Kling 3.0' }));
        (0, vitest_1.expect)(react_1.screen.getByRole('combobox')).toHaveTextContent('Kling 3.0');
    });
    (0, vitest_1.it)('fires onValueChange with the chosen value', async () => {
        const user = user_event_1.default.setup();
        const onValueChange = vitest_1.vi.fn();
        (0, react_1.render)(<Basic onValueChange={onValueChange}/>);
        await user.click(react_1.screen.getByRole('combobox'));
        await user.click(await react_1.screen.findByRole('option', { name: 'Soul 2.0' }));
        (0, vitest_1.expect)(onValueChange).toHaveBeenCalledWith('soul', vitest_1.expect.anything());
    });
    (0, vitest_1.it)('marks the selected option with data-selected', () => {
        (0, react_1.render)(<Basic defaultOpen defaultValue="soul"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'Soul 2.0' })).toHaveAttribute('data-selected');
        (0, vitest_1.expect)(react_1.screen.getByRole('option', { name: 'GPT Image 2' })).not.toHaveAttribute('data-selected');
    });
    (0, vitest_1.it)('supports multiple selection (value is an array)', async () => {
        const user = user_event_1.default.setup();
        const onValueChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Select.Root multiple onValueChange={onValueChange}>
        <index_ts_1.Select.Trigger><index_ts_1.Select.Value placeholder="Pick"/><index_ts_1.Select.Icon /></index_ts_1.Select.Trigger>
        <index_ts_1.Select.Content>
          <Option value="a" label="Alpha"/>
          <Option value="b" label="Beta"/>
        </index_ts_1.Select.Content>
      </index_ts_1.Select.Root>);
        await user.click(react_1.screen.getByRole('combobox'));
        await user.click(await react_1.screen.findByRole('option', { name: 'Alpha' }));
        (0, vitest_1.expect)(onValueChange).toHaveBeenLastCalledWith(['a'], vitest_1.expect.anything());
        await user.click(react_1.screen.getByRole('option', { name: 'Beta' }));
        (0, vitest_1.expect)(onValueChange).toHaveBeenLastCalledWith(['a', 'b'], vitest_1.expect.anything());
    });
});
//# sourceMappingURL=select.test.js.map