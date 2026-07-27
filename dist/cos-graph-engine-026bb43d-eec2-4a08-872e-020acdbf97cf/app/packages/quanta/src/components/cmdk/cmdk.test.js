"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const react_2 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("../modal/index.ts");
const index_ts_2 = require("./index.ts");
function setup(onSelect = vitest_1.vi.fn()) {
    (0, react_2.render)(<index_ts_2.Command label="Test menu">
      <index_ts_2.Command.Input placeholder="Search"/>
      <index_ts_2.Command.List>
        <index_ts_2.Command.Empty>Nothing found.</index_ts_2.Command.Empty>
        <index_ts_2.Command.Group heading="Files">
          <index_ts_2.Command.Item onSelect={() => onSelect('new')}>
            <index_ts_2.Command.ItemContent>
              <index_ts_2.Command.ItemTitle>New File</index_ts_2.Command.ItemTitle>
              <index_ts_2.Command.ItemDescription>Create a blank file</index_ts_2.Command.ItemDescription>
            </index_ts_2.Command.ItemContent>
          </index_ts_2.Command.Item>
          <index_ts_2.Command.Item onSelect={() => onSelect('open')}><index_ts_2.Command.ItemTitle>Open File</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.Group>
        <index_ts_2.Command.Group heading="Settings">
          <index_ts_2.Command.Item onSelect={() => onSelect('theme')}>
            <index_ts_2.Command.ItemTitle>Toggle Theme</index_ts_2.Command.ItemTitle>
            <index_ts_2.Command.ItemTrailing>⌘T</index_ts_2.Command.ItemTrailing>
          </index_ts_2.Command.Item>
        </index_ts_2.Command.Group>
      </index_ts_2.Command.List>
    </index_ts_2.Command>);
    return { onSelect };
}
const item = (label) => react_2.screen.getByText(label).closest('[data-command-item]');
(0, vitest_1.describe)('<Command>', () => {
    (0, vitest_1.it)('renders a combobox and every item', () => {
        setup();
        (0, vitest_1.expect)(react_2.screen.getByRole('combobox')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByText('New File')).toBeVisible();
        (0, vitest_1.expect)(react_2.screen.getByText('Toggle Theme')).toBeVisible();
    });
    (0, vitest_1.it)('Command.Input composes the shared Input component', () => {
        setup();
        const input = react_2.screen.getByRole('combobox');
        (0, vitest_1.expect)(input).toHaveClass('q-field-input');
        (0, vitest_1.expect)(input.closest('.q-field')).toBeInTheDocument();
        (0, vitest_1.expect)(input.closest('.q-field-control')).toBeInTheDocument();
        (0, vitest_1.expect)(document.querySelector('.q-command-input')).toBeNull();
    });
    (0, vitest_1.it)('Command.Input renders its default search glyph via the Icon component', () => {
        setup();
        const input = react_2.screen.getByRole('combobox');
        // The default leading glyph is wrapped in <Icon size="md"> (q-icon-md = 20px),
        // and sits in the Input affix slot.
        const affix = input.closest('.q-field-control').querySelector('.q-field-affix');
        const glyph = affix.querySelector('.q-icon');
        (0, vitest_1.expect)(glyph).toHaveClass('q-icon', 'q-icon-md');
        // NODE-ONLY: the .q-icon class is painted directly on the glyph <svg> — no wrapper.
        (0, vitest_1.expect)(glyph.tagName.toLowerCase()).toBe('svg');
    });
    (0, vitest_1.it)('forwards a caller ref to the listbox node without dropping the internal ref', () => {
        const ref = (0, react_1.createRef)();
        (0, react_2.render)(<index_ts_2.Command label="Ref">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List ref={ref}>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>One</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
      </index_ts_2.Command>);
        // Caller ref lands on the listbox root, and internal nav still works
        // (the internal listRef is merged, not overwritten).
        (0, vitest_1.expect)(ref.current).toBe(react_2.screen.getByRole('listbox'));
        (0, vitest_1.expect)(ref.current).toHaveClass('q-command-list');
    });
    (0, vitest_1.it)('fuzzy-filters items and hides groups with no matches', async () => {
        const user = user_event_1.default.setup();
        setup();
        await user.type(react_2.screen.getByRole('combobox'), 'theme');
        (0, vitest_1.expect)(react_2.screen.getByText('Toggle Theme')).toBeVisible();
        (0, vitest_1.expect)(item('New File')).not.toBeVisible();
        (0, vitest_1.expect)(react_2.screen.getByText('Files').closest('[role="group"]')).not.toBeVisible();
    });
    (0, vitest_1.it)('shows the empty state when nothing matches', async () => {
        const user = user_event_1.default.setup();
        setup();
        await user.type(react_2.screen.getByRole('combobox'), 'zzzzz');
        (0, vitest_1.expect)(react_2.screen.getByText('Nothing found.')).toBeInTheDocument();
    });
    (0, vitest_1.it)('suppresses the empty state while loading', () => {
        const Palette = ({ loading }) => (<index_ts_2.Command label="L" loading={loading} defaultValue="zzz">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Empty>Nothing found.</index_ts_2.Command.Empty>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Alpha</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
      </index_ts_2.Command>);
        const { rerender } = (0, react_2.render)(<Palette loading/>);
        (0, vitest_1.expect)(react_2.screen.queryByText('Nothing found.')).not.toBeInTheDocument();
        rerender(<Palette loading={false}/>);
        (0, vitest_1.expect)(react_2.screen.getByText('Nothing found.')).toBeInTheDocument();
    });
    (0, vitest_1.it)('uses a custom filter when provided', async () => {
        const user = user_event_1.default.setup();
        // Prefix match — stricter than the default fuzzy/substring scorer.
        const filter = (value, search) => (value.toLowerCase().startsWith(search.toLowerCase()) ? 1 : 0);
        (0, react_2.render)(<index_ts_2.Command label="F" filter={filter}>
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Apple</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Grape</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
      </index_ts_2.Command>);
        await user.type(react_2.screen.getByRole('combobox'), 'ap');
        (0, vitest_1.expect)(react_2.screen.getByText('Apple')).toBeVisible(); // starts with "ap"
        (0, vitest_1.expect)(item('Grape')).not.toBeVisible(); // default fuzzy matches "ap" in "grApe"; prefix filter does not
    });
    (0, vitest_1.it)('highlights the first item and moves with ArrowDown', async () => {
        const user = user_event_1.default.setup();
        setup();
        (0, vitest_1.expect)(item('New File')).toHaveAttribute('data-active');
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{ArrowDown}');
        (0, vitest_1.expect)(item('Open File')).toHaveAttribute('data-active');
        (0, vitest_1.expect)(item('New File')).not.toHaveAttribute('data-active');
    });
    (0, vitest_1.it)('navigates with Ctrl+n / Ctrl+p (vim bindings)', async () => {
        const user = user_event_1.default.setup();
        setup();
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{Control>}n{/Control}');
        (0, vitest_1.expect)(item('Open File')).toHaveAttribute('data-active');
        await user.keyboard('{Control>}p{/Control}');
        (0, vitest_1.expect)(item('New File')).toHaveAttribute('data-active');
    });
    (0, vitest_1.it)('wraps with loop (default) and stops at the ends when loop is false', async () => {
        const user = user_event_1.default.setup();
        const Palette = ({ loop }) => (<index_ts_2.Command label="Loop" loop={loop}>
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>One</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Two</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
      </index_ts_2.Command>);
        const { rerender } = (0, react_2.render)(<Palette />);
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{ArrowUp}'); // from first → wraps to last
        (0, vitest_1.expect)(item('Two')).toHaveAttribute('data-active');
        rerender(<Palette loop={false}/>);
        await user.keyboard('{ArrowDown}'); // at last, no loop → stays
        (0, vitest_1.expect)(item('Two')).toHaveAttribute('data-active');
    });
    (0, vitest_1.it)('composes items from icon / content / title / description / trailing parts', () => {
        (0, react_2.render)(<index_ts_2.Command label="Slots">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Item>
            <index_ts_2.Command.ItemIcon><span data-testid="ico"/></index_ts_2.Command.ItemIcon>
            <index_ts_2.Command.ItemContent>
              <index_ts_2.Command.ItemTitle>Deploy</index_ts_2.Command.ItemTitle>
              <index_ts_2.Command.ItemDescription>ship it</index_ts_2.Command.ItemDescription>
            </index_ts_2.Command.ItemContent>
            <index_ts_2.Command.ItemTrailing>⌘D</index_ts_2.Command.ItemTrailing>
          </index_ts_2.Command.Item>
        </index_ts_2.Command.List>
      </index_ts_2.Command>);
        const row = react_2.screen.getByText('Deploy').closest('[data-command-item]');
        (0, vitest_1.expect)(react_2.screen.getByText('Deploy')).toHaveClass('q-command-item-title');
        (0, vitest_1.expect)(react_2.screen.getByText('ship it')).toHaveClass('q-command-item-description');
        (0, vitest_1.expect)(react_2.screen.getByText('⌘D')).toHaveClass('q-command-item-trailing');
        (0, vitest_1.expect)(row.querySelector('.q-command-item-icon')).toContainElement(react_2.screen.getByTestId('ico'));
        (0, vitest_1.expect)(row.querySelector('.q-command-item-content')).toContainElement(react_2.screen.getByText('Deploy'));
    });
    (0, vitest_1.it)('detail pane reflects the active item and updates on navigation', async () => {
        const user = user_event_1.default.setup();
        (0, react_2.render)(<index_ts_2.Command label="Detail">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.Body>
          <index_ts_2.Command.List>
            <index_ts_2.Command.Item detail={<p>Alpha details</p>}><index_ts_2.Command.ItemTitle>Alpha</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
            <index_ts_2.Command.Item detail={<p>Beta details</p>}><index_ts_2.Command.ItemTitle>Beta</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
          </index_ts_2.Command.List>
          <index_ts_2.Command.Detail />
        </index_ts_2.Command.Body>
      </index_ts_2.Command>);
        (0, vitest_1.expect)(await react_2.screen.findByText('Alpha details')).toBeInTheDocument();
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{ArrowDown}');
        (0, vitest_1.expect)(await react_2.screen.findByText('Beta details')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.queryByText('Alpha details')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('renders the two-pane layout: a Workspace list + the self-wrapping Detail pane', async () => {
        (0, react_2.render)(<index_ts_2.Command label="Workspace detail">
        <index_ts_2.Command.Body>
          <index_ts_1.Modal.Workspace padded={false}>
            <index_ts_2.Command.Input />
            <index_ts_2.Command.List>
              <index_ts_2.Command.Item detail={<p>Alpha details</p>}><index_ts_2.Command.ItemTitle>Alpha</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
              <index_ts_2.Command.Item detail={<p>Beta details</p>}><index_ts_2.Command.ItemTitle>Beta</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
            </index_ts_2.Command.List>
          </index_ts_1.Modal.Workspace>
          {/* Command.Detail self-wraps in a Modal.Workspace — no manual wrapper. */}
          <index_ts_2.Command.Detail />
        </index_ts_2.Command.Body>
      </index_ts_2.Command>);
        // The list Workspace + the Detail's own Workspace = two frosted panes.
        (0, vitest_1.expect)(document.querySelectorAll('.q-modal-workspace')).toHaveLength(2);
        (0, vitest_1.expect)(react_2.screen.getByText('Alpha details').closest('.q-command-detail')).toHaveClass('q-modal-workspace');
        (0, vitest_1.expect)(await react_2.screen.findByText('Alpha details')).toBeInTheDocument();
    });
    (0, vitest_1.it)('hides the detail pane when the active item has no detail', async () => {
        const user = user_event_1.default.setup();
        const { container } = (0, react_2.render)(<index_ts_2.Command label="Mixed">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.Body>
          <index_ts_2.Command.List>
            <index_ts_2.Command.Item detail={<p>Has detail</p>}><index_ts_2.Command.ItemTitle>WithDetail</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
            <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Plain</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
          </index_ts_2.Command.List>
          <index_ts_2.Command.Detail />
        </index_ts_2.Command.Body>
      </index_ts_2.Command>);
        (0, vitest_1.expect)(await react_2.screen.findByText('Has detail')).toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-command-detail')).toBeInTheDocument();
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{ArrowDown}'); // → "Plain" (no detail)
        await (0, react_2.waitFor)(() => (0, vitest_1.expect)(container.querySelector('.q-command-detail')).not.toBeInTheDocument());
    });
    (0, vitest_1.it)('footer action label tracks the active item', async () => {
        const user = user_event_1.default.setup();
        (0, react_2.render)(<index_ts_2.Command label="Footer label">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Item action="Run one"><index_ts_2.Command.ItemTitle>One</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
          <index_ts_2.Command.Item action="Run two"><index_ts_2.Command.ItemTitle>Two</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
        <index_ts_2.Command.Footer><index_ts_2.Command.Action fallback="Pick"><span data-testid="kbd">↵</span></index_ts_2.Command.Action></index_ts_2.Command.Footer>
      </index_ts_2.Command>);
        (0, vitest_1.expect)(await react_2.screen.findByText('Run one')).toBeInTheDocument();
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{ArrowDown}');
        (0, vitest_1.expect)(await react_2.screen.findByText('Run two')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.queryByText('Run one')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('footer action runs the active item', async () => {
        const onSelect = vitest_1.vi.fn();
        const user = user_event_1.default.setup();
        (0, react_2.render)(<index_ts_2.Command label="Footer">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List><index_ts_2.Command.Item onSelect={onSelect}><index_ts_2.Command.ItemTitle>Run</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item></index_ts_2.Command.List>
        <index_ts_2.Command.Footer><index_ts_2.Command.Action>Go</index_ts_2.Command.Action></index_ts_2.Command.Footer>
      </index_ts_2.Command>);
        await user.click(react_2.screen.getByRole('button', { name: 'Go' }));
        (0, vitest_1.expect)(onSelect).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('selects via Enter (active item) and via click', async () => {
        const user = user_event_1.default.setup();
        const { onSelect } = setup();
        react_2.screen.getByRole('combobox').focus();
        await user.keyboard('{Enter}');
        (0, vitest_1.expect)(onSelect).toHaveBeenCalledWith('new');
        await user.click(react_2.screen.getByText('Toggle Theme'));
        (0, vitest_1.expect)(onSelect).toHaveBeenCalledWith('theme');
    });
    (0, vitest_1.it)('Command.Shortcut composes the canonical Kbd (renders a <kbd> pill)', () => {
        (0, react_2.render)(<index_ts_2.Command.Shortcut>⌘K</index_ts_2.Command.Shortcut>);
        const k = react_2.screen.getByText('⌘K');
        (0, vitest_1.expect)(k.tagName).toBe('KBD');
        // the Kbd pill styling (Figma _Shortcut), not the old q-command-shortcut
        (0, vitest_1.expect)(k).toHaveClass('rounded-q-100', 'bg-q-overlay-hover', 'text-q-caption-sm-medium');
    });
    (0, vitest_1.it)('Command.Dialog composes the shared Modal shell and size presets', () => {
        (0, react_2.render)(<index_ts_2.Command.Dialog defaultOpen size="lg" label="Command menu">
        <index_ts_2.Command.Input />
        <index_ts_2.Command.List>
          <index_ts_2.Command.Item><index_ts_2.Command.ItemTitle>Open dashboard</index_ts_2.Command.ItemTitle></index_ts_2.Command.Item>
        </index_ts_2.Command.List>
        <index_ts_2.Command.Footer caption="Footer label" actions={<index_ts_2.Command.Action fallback="Select"><span>↵</span></index_ts_2.Command.Action>}/>
      </index_ts_2.Command.Dialog>);
        const dialog = react_2.screen.getByRole('dialog', { name: 'Command menu' });
        const input = react_2.screen.getByRole('combobox');
        const footerAction = react_2.screen.getByRole('button', { name: /select/i });
        (0, vitest_1.expect)(dialog).toHaveClass('q-modal', 'q-modal-size-lg');
        (0, vitest_1.expect)(document.querySelector('.q-modal-body')).toBeInTheDocument();
        (0, vitest_1.expect)(document.querySelector('.q-modal-workspace')).toBeInTheDocument();
        (0, vitest_1.expect)(input.closest('.q-modal-header')).toBeInTheDocument();
        (0, vitest_1.expect)(input.closest('.q-modal-workspace')).toBeNull();
        (0, vitest_1.expect)(react_2.screen.getByRole('listbox').closest('.q-modal-workspace')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByText('Footer label')).toHaveClass('q-modal-caption');
        (0, vitest_1.expect)(footerAction.closest('.q-modal-footer')).toBeInTheDocument();
        (0, vitest_1.expect)(footerAction.closest('.q-modal-workspace')).toBeNull();
    });
});
//# sourceMappingURL=cmdk.test.js.map