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
const index_ts_1 = require("../not-found/index.ts");
const index_ts_2 = require("./index.ts");
/** Compose a simple title-only row (the pure-composition primitives). */
function Row({ title, indicator, ...props }) {
    return (<index_ts_2.Dropdown.Item {...props}>
      <index_ts_2.Dropdown.ItemContent>
        <index_ts_2.Dropdown.ItemTitleRow>
          <index_ts_2.Dropdown.ItemTitle>{title}</index_ts_2.Dropdown.ItemTitle>
        </index_ts_2.Dropdown.ItemTitleRow>
      </index_ts_2.Dropdown.ItemContent>
      {props.selectable
            ? <index_ts_2.Dropdown.ItemTrailing><index_ts_2.Dropdown.ItemIndicator indicator={indicator}/></index_ts_2.Dropdown.ItemTrailing>
            : null}
    </index_ts_2.Dropdown.Item>);
}
function Basic() {
    return (<index_ts_2.Dropdown.Root defaultOpen>
      <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
      <index_ts_2.Dropdown.Content>
        <index_ts_2.Dropdown.Group>
          <index_ts_2.Dropdown.Label>Section</index_ts_2.Dropdown.Label>
          <Row title="Plain"/>
        </index_ts_2.Dropdown.Group>
        <index_ts_2.Dropdown.Separator />
      </index_ts_2.Dropdown.Content>
    </index_ts_2.Dropdown.Root>);
}
(0, vitest_1.describe)('Dropdown containers', () => {
    (0, vitest_1.it)('marks the root trigger so open menus can keep the trigger hover treatment', () => {
        (0, react_1.render)(<Basic />);
        const trigger = react_1.screen.getByRole('button', { name: 'Open' });
        (0, vitest_1.expect)(trigger).toHaveClass('q-dropdown-trigger');
        (0, vitest_1.expect)(trigger).toHaveAttribute('data-open');
        (0, vitest_1.expect)(trigger).toHaveAttribute('data-popup-open');
    });
    (0, vitest_1.it)('keeps hover-open opt-in so default dropdowns still require click', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row title="Action"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const trigger = react_1.screen.getByRole('button', { name: 'Open' });
        await user.hover(trigger);
        (0, vitest_1.expect)(react_1.screen.queryByRole('menuitem', { name: 'Action' })).not.toBeInTheDocument();
        await user.click(trigger);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitem', { name: 'Action' })).toBeInTheDocument();
    });
    (0, vitest_1.it)('opens from trigger hover when openOnHover is enabled', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root openOnHover>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row title="Action"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const trigger = react_1.screen.getByRole('button', { name: 'Open' });
        await user.hover(trigger);
        await react_1.screen.findByRole('menuitem', { name: 'Action' });
        (0, vitest_1.expect)(trigger).toHaveAttribute('data-open');
    });
    (0, vitest_1.it)('renders content (defaultOpen) with the dropdown-content class', () => {
        (0, react_1.render)(<Basic />);
        (0, vitest_1.expect)(react_1.screen.getByRole('menu')).toHaveClass('q-dropdown-content');
    });
    (0, vitest_1.it)('renders a standalone section label', () => {
        (0, react_1.render)(<Basic />);
        (0, vitest_1.expect)(react_1.screen.getByText('Section')).toHaveClass('q-menu-group-label');
    });
    (0, vitest_1.it)('applies the size preset to the popup', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content size="large"><Row title="X"/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menu')).toHaveClass('q-dropdown-content-large');
    });
    (0, vitest_1.it)('applies surface and shape presets to the popup', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content surface="solid" shape="panel"><Row title="X"/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menu')).toHaveClass('q-dropdown-content-solid', 'q-dropdown-content-panel');
    });
});
(0, vitest_1.describe)('Dropdown.Item composition', () => {
    (0, vitest_1.it)('is a styled row that renders arbitrary children verbatim', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item value="folder">
            <index_ts_2.Dropdown.ItemIcon><IconFolder1Outlined_1.IconFolder1Outlined /></index_ts_2.Dropdown.ItemIcon>
            <index_ts_2.Dropdown.ItemContent>
              <index_ts_2.Dropdown.ItemTitleRow>
                <index_ts_2.Dropdown.ItemTitle>Folder</index_ts_2.Dropdown.ItemTitle>
                <index_ts_2.Dropdown.ItemMeta>18</index_ts_2.Dropdown.ItemMeta>
              </index_ts_2.Dropdown.ItemTitleRow>
              <index_ts_2.Dropdown.ItemDescription>12 items</index_ts_2.Dropdown.ItemDescription>
            </index_ts_2.Dropdown.ItemContent>
            <index_ts_2.Dropdown.ItemTrailing>meta</index_ts_2.Dropdown.ItemTrailing>
          </index_ts_2.Dropdown.Item>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitem', { name: /Folder/ });
        (0, vitest_1.expect)(item).toHaveClass('q-menu-item');
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-label')).toBeInTheDocument();
        (0, vitest_1.expect)(item.querySelector('.q-dropdown-item-meta')).toHaveTextContent('18');
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-description')).toHaveTextContent('12 items');
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-trailing')).toHaveTextContent('meta');
    });
    (0, vitest_1.it)('renders a rich media row (large variant via composed media tile)', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item value="model">
            <index_ts_2.Dropdown.ItemMedia><IconFolder1Outlined_1.IconFolder1Outlined /></index_ts_2.Dropdown.ItemMedia>
            <index_ts_2.Dropdown.ItemContent>
              <index_ts_2.Dropdown.ItemTitleRow><index_ts_2.Dropdown.ItemTitle>Model row</index_ts_2.Dropdown.ItemTitle></index_ts_2.Dropdown.ItemTitleRow>
              <index_ts_2.Dropdown.ItemDescription>Rich subtitle</index_ts_2.Dropdown.ItemDescription>
            </index_ts_2.Dropdown.ItemContent>
          </index_ts_2.Dropdown.Item>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitem', { name: /Model row/ });
        (0, vitest_1.expect)(item.querySelector('.q-dropdown-item-media')).toBeInTheDocument();
    });
    (0, vitest_1.it)('closes the menu when a non-selectable item is clicked', async () => {
        const user = user_event_1.default.setup();
        function Controlled() {
            const [open, setOpen] = (0, react_2.useState)(true);
            return (<index_ts_2.Dropdown.Root open={open} onOpenChange={setOpen}>
          <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
          <index_ts_2.Dropdown.Content><Row title="Action"/></index_ts_2.Dropdown.Content>
        </index_ts_2.Dropdown.Root>);
        }
        (0, react_1.render)(<Controlled />);
        await user.click(react_1.screen.getByRole('menuitem', { name: 'Action' }));
        (0, vitest_1.expect)(react_1.screen.queryByRole('menuitem', { name: 'Action' })).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('fires onSelect for a non-selectable action item', async () => {
        const user = user_event_1.default.setup();
        const onSelect = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content><Row title="Action" onSelect={onSelect}/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.click(react_1.screen.getByRole('menuitem', { name: 'Action' }));
        (0, vitest_1.expect)(onSelect).toHaveBeenCalled();
    });
    (0, vitest_1.it)('marks a disabled item', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content><Row title="Nope" disabled/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitem', { name: 'Nope' })).toHaveAttribute('data-disabled');
    });
});
(0, vitest_1.describe)('Dropdown.Item slot props (ergonomic API)', () => {
    (0, vitest_1.it)('builds the row anatomy from start / title / subtitle / end slots', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item start={<IconFolder1Outlined_1.IconFolder1Outlined />} title="Soul 2.0" subtitle="Ultra-real" end="2,482"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitem', { name: /Soul 2\.0/ });
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-title')).toHaveTextContent('Soul 2.0');
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-description')).toHaveTextContent('Ultra-real');
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-trailing')).toHaveTextContent('2,482');
    });
    (0, vitest_1.it)('uses the media tile slot for rich rows', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content><index_ts_2.Dropdown.Item media={<IconFolder1Outlined_1.IconFolder1Outlined />} title="Model"/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitem', { name: /Model/ }).querySelector('.q-dropdown-item-media')).toBeInTheDocument();
    });
    (0, vitest_1.it)('auto-renders the indicator for a selectable slot row', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item title="On" selectable checked/>
          <index_ts_2.Dropdown.Item title="Off" selectable checked={false}/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /On/ }).querySelector('.q-menu-item-trailing svg')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Off/ }).querySelector('.q-menu-item-trailing svg')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('renders children verbatim (no slot wrapping) when no slot prop is passed', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item><span data-testid="raw">raw child</span></index_ts_2.Dropdown.Item>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitem', { name: /raw child/ });
        (0, vitest_1.expect)(item.querySelector('[data-testid="raw"]')).toBeInTheDocument();
        (0, vitest_1.expect)(item.querySelector('.q-menu-item-label')).not.toBeInTheDocument();
    });
});
(0, vitest_1.describe)('Dropdown.Item selectable handles its own state', () => {
    (0, vitest_1.it)('toggles internally with NO value and NO handlers (keyed by title)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content><index_ts_2.Dropdown.Item title="Toggle me" selectable/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitemcheckbox', { name: /Toggle me/ });
        (0, vitest_1.expect)(item).toHaveAttribute('aria-checked', 'false');
        await user.click(item);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Toggle me/ })).toHaveAttribute('aria-checked', 'true');
    });
    (0, vitest_1.it)('notifies via onCheckedChange even without a value', async () => {
        const user = user_event_1.default.setup();
        const onCheckedChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content><index_ts_2.Dropdown.Item title="Notify" selectable onCheckedChange={onCheckedChange}/></index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Notify/ }));
        (0, vitest_1.expect)(onCheckedChange).toHaveBeenLastCalledWith(true, vitest_1.expect.anything());
    });
    (0, vitest_1.it)('keys Root selection off the title when no value is given', async () => {
        const user = user_event_1.default.setup();
        const onSelected = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen selectionMode="single" onSelected={onSelected}>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Item title="Alpha" selectable/>
          <index_ts_2.Dropdown.Item title="Beta" selectable/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ }));
        (0, vitest_1.expect)(onSelected).toHaveBeenLastCalledWith(['Beta']);
    });
});
(0, vitest_1.describe)('Dropdown.Item selection', () => {
    (0, vitest_1.it)('selectable + ItemIndicator="checkbox" uses the real Checkbox and stays open on toggle', async () => {
        const user = user_event_1.default.setup();
        function Controlled() {
            const [checked, setChecked] = (0, react_2.useState)(false);
            return (<index_ts_2.Dropdown.Root defaultOpen>
          <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
          <index_ts_2.Dropdown.Content>
            <Row title="Toggle" selectable indicator="checkbox" checked={checked} onCheckedChange={setChecked}/>
          </index_ts_2.Dropdown.Content>
        </index_ts_2.Dropdown.Root>);
        }
        (0, react_1.render)(<Controlled />);
        const item = react_1.screen.getByRole('menuitemcheckbox', { name: /Toggle/ });
        (0, vitest_1.expect)(item.querySelector('.q-checkbox')).toBeInTheDocument();
        await user.click(item);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Toggle/ })).toHaveAttribute('aria-checked', 'true');
    });
    (0, vitest_1.it)('selectable + ItemIndicator="switch" uses the real Switch', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row title="Switch" selectable indicator="switch" checked/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Switch/ }).querySelector('.q-switch')).toBeInTheDocument();
    });
    (0, vitest_1.it)('default ItemIndicator (check) shows a trailing check only when checked', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row title="Sel" selectable checked/>
          <Row title="Unsel" selectable checked={false}/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Sel/ }).querySelector('.q-menu-item-trailing svg')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Unsel/ }).querySelector('.q-menu-item-trailing svg')).not.toBeInTheDocument();
    });
});
(0, vitest_1.describe)('Dropdown Root selection state', () => {
    (0, vitest_1.it)('manages selection internally via item value (no per-item state needed)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row value="a" title="Alpha" selectable indicator="checkbox"/>
          <Row value="b" title="Beta" selectable indicator="checkbox"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const alpha = react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ });
        (0, vitest_1.expect)(alpha).toHaveAttribute('aria-checked', 'false');
        await user.click(alpha);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ })).toHaveAttribute('aria-checked', 'true');
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ })).toHaveAttribute('aria-checked', 'false');
    });
    (0, vitest_1.it)('seeds from defaultSelected', () => {
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen defaultSelected={['b']}>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row value="a" title="Alpha" selectable/>
          <Row value="b" title="Beta" selectable/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ })).toHaveAttribute('aria-checked', 'false');
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ })).toHaveAttribute('aria-checked', 'true');
    });
    (0, vitest_1.it)('fires onSelected with the next array on change (subscription)', async () => {
        const user = user_event_1.default.setup();
        const onSelected = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen onSelected={onSelected}>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row value="a" title="Alpha" selectable/>
          <Row value="b" title="Beta" selectable/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ }));
        (0, vitest_1.expect)(onSelected).toHaveBeenLastCalledWith(['a']);
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ }));
        (0, vitest_1.expect)(onSelected).toHaveBeenLastCalledWith(['a', 'b']);
    });
    (0, vitest_1.it)('single selectionMode keeps only one selected', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen selectionMode="single">
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row value="a" title="Alpha" selectable/>
          <Row value="b" title="Beta" selectable/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ }));
        await user.click(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ }));
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Alpha/ })).toHaveAttribute('aria-checked', 'false');
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitemcheckbox', { name: /Beta/ })).toHaveAttribute('aria-checked', 'true');
    });
    (0, vitest_1.it)('per-item checked overrides Root state', async () => {
        const user = user_event_1.default.setup();
        const onSelected = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen onSelected={onSelected}>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <Row value="a" title="Manual" selectable checked onCheckedChange={() => { }}/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const item = react_1.screen.getByRole('menuitemcheckbox', { name: /Manual/ });
        (0, vitest_1.expect)(item).toHaveAttribute('aria-checked', 'true');
        await user.click(item);
        (0, vitest_1.expect)(onSelected).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)('Dropdown submenu (Sub / SubTrigger / SubContent)', () => {
    function WithSub({ triggerRef }) {
        return (<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Sub>
            <index_ts_2.Dropdown.SubTrigger ref={triggerRef}>
              <index_ts_2.Dropdown.ItemContent>
                <index_ts_2.Dropdown.ItemTitleRow><index_ts_2.Dropdown.ItemTitle>More</index_ts_2.Dropdown.ItemTitle></index_ts_2.Dropdown.ItemTitleRow>
              </index_ts_2.Dropdown.ItemContent>
              <index_ts_2.Dropdown.ItemTrailing><index_ts_2.Dropdown.ItemSubChevron /></index_ts_2.Dropdown.ItemTrailing>
            </index_ts_2.Dropdown.SubTrigger>
            <index_ts_2.Dropdown.SubContent>
              <Row title="Nested"/>
            </index_ts_2.Dropdown.SubContent>
          </index_ts_2.Dropdown.Sub>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
    }
    (0, vitest_1.it)('renders a submenu trigger with a chevron', () => {
        (0, react_1.render)(<WithSub />);
        const trigger = react_1.screen.getByRole('menuitem', { name: /More/ });
        (0, vitest_1.expect)(trigger).toHaveClass('q-menu-item', 'q-dropdown-submenu-trigger');
        (0, vitest_1.expect)(trigger.querySelector('.q-menu-item-trailing svg')).toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards a ref to the submenu trigger', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<WithSub triggerRef={ref}/>);
        (0, vitest_1.expect)(ref.current).toBe(react_1.screen.getByRole('menuitem', { name: /More/ }));
    });
    (0, vitest_1.it)('opens the submenu from a click', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<WithSub />);
        const trigger = react_1.screen.getByRole('menuitem', { name: /More/ });
        await user.click(trigger);
        (0, vitest_1.expect)(await react_1.screen.findByRole('menuitem', { name: /Nested/ })).toBeInTheDocument();
    });
    (0, vitest_1.it)('builds a submenu trigger from slot props (start / title + auto chevron)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content>
          <index_ts_2.Dropdown.Sub>
            <index_ts_2.Dropdown.SubTrigger start={<IconFolder1Outlined_1.IconFolder1Outlined />} title="Move to"/>
            <index_ts_2.Dropdown.SubContent><Row title="Inbox"/></index_ts_2.Dropdown.SubContent>
          </index_ts_2.Dropdown.Sub>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const trigger = react_1.screen.getByRole('menuitem', { name: /Move to/ });
        (0, vitest_1.expect)(trigger.querySelector('.q-menu-item-title')).toHaveTextContent('Move to');
        (0, vitest_1.expect)(trigger.querySelector('.q-menu-item-trailing svg')).toBeInTheDocument();
        await user.click(trigger);
        (0, vitest_1.expect)(await react_1.screen.findByRole('menuitem', { name: /Inbox/ })).toBeInTheDocument();
    });
});
(0, vitest_1.describe)('Dropdown search (withSearch)', () => {
    (0, vitest_1.it)('renders a search box and filters items live', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content withSearch>
          <Row title="Apple"/>
          <Row title="Banana"/>
          <Row title="Cherry"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        const input = react_1.screen.getByPlaceholderText('Search');
        await user.type(input, 'ban');
        (0, vitest_1.expect)(react_1.screen.getByRole('menuitem', { name: 'Banana' })).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByRole('menuitem', { name: 'Apple' })).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByRole('menuitem', { name: 'Cherry' })).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('hides a group whose items all filter out', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content withSearch>
          <index_ts_2.Dropdown.Group>
            <index_ts_2.Dropdown.Label>Fruit</index_ts_2.Dropdown.Label>
            <Row title="Apple"/>
          </index_ts_2.Dropdown.Group>
          <index_ts_2.Dropdown.Group>
            <index_ts_2.Dropdown.Label>Veg</index_ts_2.Dropdown.Label>
            <Row title="Carrot"/>
          </index_ts_2.Dropdown.Group>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.type(react_1.screen.getByPlaceholderText('Search'), 'carrot');
        (0, vitest_1.expect)(react_1.screen.getByText('Veg')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('Fruit')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('filters rich items via the explicit value prop', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content withSearch>
          <index_ts_2.Dropdown.Item value="seedance">
            <index_ts_2.Dropdown.ItemContent><index_ts_2.Dropdown.ItemTitleRow><index_ts_2.Dropdown.ItemTitle>Seedance 2.0</index_ts_2.Dropdown.ItemTitle></index_ts_2.Dropdown.ItemTitleRow></index_ts_2.Dropdown.ItemContent>
          </index_ts_2.Dropdown.Item>
          <index_ts_2.Dropdown.Item value="kling">
            <index_ts_2.Dropdown.ItemContent><index_ts_2.Dropdown.ItemTitleRow><index_ts_2.Dropdown.ItemTitle>Kling 3.0</index_ts_2.Dropdown.ItemTitle></index_ts_2.Dropdown.ItemTitleRow></index_ts_2.Dropdown.ItemContent>
          </index_ts_2.Dropdown.Item>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.type(react_1.screen.getByPlaceholderText('Search'), 'kling');
        (0, vitest_1.expect)(react_1.screen.getByText('Kling 3.0')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('Seedance 2.0')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('shows the default NotFound when a search matches nothing', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content withSearch>
          <Row title="Apple"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.type(react_1.screen.getByPlaceholderText('Search'), 'zzz');
        (0, vitest_1.expect)(react_1.screen.queryByRole('menuitem', { name: 'Apple' })).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('No results found')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders a custom notFound node when provided', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_2.Dropdown.Root defaultOpen>
        <index_ts_2.Dropdown.Trigger>Open</index_ts_2.Dropdown.Trigger>
        <index_ts_2.Dropdown.Content withSearch notFound={<index_ts_1.NotFound title="Nothing here" subtitle="Add a model first"/>}>
          <Row title="Apple"/>
        </index_ts_2.Dropdown.Content>
      </index_ts_2.Dropdown.Root>);
        await user.type(react_1.screen.getByPlaceholderText('Search'), 'zzz');
        (0, vitest_1.expect)(react_1.screen.getByText('Nothing here')).toBeInTheDocument();
    });
});
//# sourceMappingURL=dropdown.test.js.map