"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
/** Compose a label-only row. */
function Row({ label, ...props }) {
    return (<index_ts_1.Sidebar.Item {...props}>
      <index_ts_1.Sidebar.ItemLabel>{label}</index_ts_1.Sidebar.ItemLabel>
    </index_ts_1.Sidebar.Item>);
}
(0, vitest_1.describe)('<Sidebar>', () => {
    (0, vitest_1.it)('renders the rail with header, body sections and footer', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root aria-label="Main">
        <index_ts_1.Sidebar.Header>
          <index_ts_1.Sidebar.Switcher>
            <index_ts_1.Sidebar.Title>Cinema Studio <index_ts_1.Sidebar.SwitcherChevron /></index_ts_1.Sidebar.Title>
          </index_ts_1.Sidebar.Switcher>
        </index_ts_1.Sidebar.Header>
        <index_ts_1.Sidebar.Body>
          <index_ts_1.Sidebar.Section>
            <index_ts_1.Sidebar.SectionItems>
              <Row label="Home" selected/>
            </index_ts_1.Sidebar.SectionItems>
          </index_ts_1.Sidebar.Section>
        </index_ts_1.Sidebar.Body>
        <index_ts_1.Sidebar.Footer>
          <index_ts_1.Sidebar.FooterItem variant="login"><index_ts_1.Sidebar.ItemLabel>Login</index_ts_1.Sidebar.ItemLabel></index_ts_1.Sidebar.FooterItem>
        </index_ts_1.Sidebar.Footer>
      </index_ts_1.Sidebar.Root>);
        (0, vitest_1.expect)(container.querySelector('.q-sidebar')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('Cinema Studio')).toHaveClass('q-sidebar-switcher-name');
        (0, vitest_1.expect)(container.querySelector('.q-sidebar-body')).toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-sidebar-footer')).toBeInTheDocument();
    });
    (0, vitest_1.it)('carries the composite type utilities on the row parts (token adoption)', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Section>
        <index_ts_1.Sidebar.SectionHeader><index_ts_1.Sidebar.SectionTitle>Projects</index_ts_1.Sidebar.SectionTitle></index_ts_1.Sidebar.SectionHeader>
        <index_ts_1.Sidebar.SectionItems>
          <index_ts_1.Sidebar.Item>
            <index_ts_1.Sidebar.ItemLabel>Blue Horizon</index_ts_1.Sidebar.ItemLabel>
            <index_ts_1.Sidebar.ItemMeta>484</index_ts_1.Sidebar.ItemMeta>
          </index_ts_1.Sidebar.Item>
        </index_ts_1.Sidebar.SectionItems>
      </index_ts_1.Sidebar.Section>);
        (0, vitest_1.expect)(react_1.screen.getByText('Projects')).toHaveClass('q-sidebar-section-title', 'text-q-label-xs-medium');
        (0, vitest_1.expect)(react_1.screen.getByText('Blue Horizon')).toHaveClass('q-sidebar-label', 'text-q-body-sm-medium');
        (0, vitest_1.expect)(react_1.screen.getByText('484')).toHaveClass('q-sidebar-meta', 'text-q-caption-sm-regular');
    });
    (0, vitest_1.it)('renders the switcher chevron through Icon (token-sized, decorative)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.SwitcherChevron />);
        const chevron = container.querySelector('.q-sidebar-switcher-chevron');
        (0, vitest_1.expect)(chevron).toHaveClass('q-icon', 'q-icon-sm');
        (0, vitest_1.expect)(chevron).toHaveAttribute('aria-hidden', 'true');
    });
    (0, vitest_1.it)('renders the default search glyph through Icon (token-sized)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Search />);
        (0, vitest_1.expect)(container.querySelector('.q-sidebar-search-icon')).toHaveClass('q-icon', 'q-icon-lg');
    });
    (0, vitest_1.it)('marks the selected item with the selected class + aria-current', () => {
        (0, react_1.render)(<Row label="Home" selected/>);
        const item = react_1.screen.getByRole('button', { name: 'Home' });
        (0, vitest_1.expect)(item).toHaveClass('q-sidebar-row', 'q-sidebar-item', 'q-sidebar-selected');
        (0, vitest_1.expect)(item).toHaveAttribute('aria-current', 'page');
    });
    (0, vitest_1.it)('renders an Item as a link when href is set', () => {
        (0, react_1.render)(<Row label="Home" href="/home"/>);
        const link = react_1.screen.getByRole('link', { name: 'Home' });
        (0, vitest_1.expect)(link).toHaveAttribute('href', '/home');
        (0, vitest_1.expect)(link).toHaveClass('q-sidebar-item');
    });
    (0, vitest_1.it)('applies the sm size class', () => {
        (0, react_1.render)(<Row label="Chat" size="sm"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button')).toHaveClass('q-sidebar-item-sm');
    });
    (0, vitest_1.it)('composes icon, label, meta and end in order, host swappable via render', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Item render={<a href="/x" data-testid="link"/>}>
        <index_ts_1.Sidebar.ItemIcon><span data-testid="s"/></index_ts_1.Sidebar.ItemIcon>
        <index_ts_1.Sidebar.ItemLabel>Item</index_ts_1.Sidebar.ItemLabel>
        <index_ts_1.Sidebar.ItemMeta>9</index_ts_1.Sidebar.ItemMeta>
        <index_ts_1.Sidebar.ItemEnd><span data-testid="e"/></index_ts_1.Sidebar.ItemEnd>
      </index_ts_1.Sidebar.Item>);
        const root = react_1.screen.getByTestId('link');
        (0, vitest_1.expect)(root.tagName).toBe('A');
        (0, vitest_1.expect)(root).toHaveClass('q-sidebar-item');
        (0, vitest_1.expect)(react_1.screen.getByTestId('s').closest('.q-sidebar-icon')).toBeInTheDocument();
        const s = react_1.screen.getByTestId('s');
        const e = react_1.screen.getByTestId('e');
        (0, vitest_1.expect)(s.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('renders no pin button without onPinChange', () => {
        (0, react_1.render)(<Row label="Plain"/>);
        (0, vitest_1.expect)(document.querySelector('.q-sidebar-pinrow')).toBeNull();
        (0, vitest_1.expect)(react_1.screen.queryByRole('button', { name: /pin/i })).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Plain' })).toHaveClass('q-sidebar-item');
    });
    (0, vitest_1.it)('renders a pin toggle as a sibling (not nested) and fires onPinChange', async () => {
        const user = user_event_1.default.setup();
        const onPinChange = vitest_1.vi.fn();
        (0, react_1.render)(<Row label="Project" onPinChange={onPinChange}/>);
        const row = react_1.screen.getByRole('button', { name: 'Project' });
        const pin = react_1.screen.getByRole('button', { name: 'Pin' });
        (0, vitest_1.expect)(row).not.toContainElement(pin);
        (0, vitest_1.expect)(pin).toHaveAttribute('aria-pressed', 'false');
        await user.click(pin);
        (0, vitest_1.expect)(onPinChange).toHaveBeenCalledWith(true);
    });
    (0, vitest_1.it)('renders a row action as a sibling overlay', () => {
        (0, react_1.render)(<Row label="Project" action={<button type="button">Actions</button>}/>);
        const row = react_1.screen.getByRole('button', { name: 'Project' });
        const action = react_1.screen.getByRole('button', { name: 'Actions' });
        (0, vitest_1.expect)(row).not.toContainElement(action);
        (0, vitest_1.expect)(action.closest('.q-sidebar-action')).toBeInTheDocument();
        (0, vitest_1.expect)(action.closest('.q-sidebar-actionrow')).toBeInTheDocument();
    });
    (0, vitest_1.it)('reflects the pinned state (filled, unpin label, aria-pressed)', () => {
        (0, react_1.render)(<Row label="Project" pinned onPinChange={vitest_1.vi.fn()}/>);
        const pin = react_1.screen.getByRole('button', { name: 'Unpin' });
        (0, vitest_1.expect)(pin).toHaveAttribute('aria-pressed', 'true');
        (0, vitest_1.expect)(pin).toHaveAttribute('data-pinned');
        (0, vitest_1.expect)(pin.closest('.q-sidebar-pinrow')).toHaveClass('q-sidebar-pinned');
    });
    (0, vitest_1.it)('applies footer variant classes (promo / login)', () => {
        const { rerender } = (0, react_1.render)(<index_ts_1.Sidebar.FooterItem variant="promo"><index_ts_1.Sidebar.ItemLabel>Pricing</index_ts_1.Sidebar.ItemLabel></index_ts_1.Sidebar.FooterItem>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button')).toHaveClass('q-sidebar-footeritem-promo');
        rerender(<index_ts_1.Sidebar.FooterItem variant="login"><index_ts_1.Sidebar.ItemLabel>Login</index_ts_1.Sidebar.ItemLabel></index_ts_1.Sidebar.FooterItem>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button')).toHaveClass('q-sidebar-footeritem-login');
    });
    (0, vitest_1.it)('renders a section header from SectionTitle + SectionActions', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Section>
        <index_ts_1.Sidebar.SectionHeader>
          <index_ts_1.Sidebar.SectionTitle>Projects</index_ts_1.Sidebar.SectionTitle>
          <index_ts_1.Sidebar.SectionActions><span data-testid="add"/></index_ts_1.Sidebar.SectionActions>
        </index_ts_1.Sidebar.SectionHeader>
        <index_ts_1.Sidebar.SectionItems><Row label="Alpha"/></index_ts_1.Sidebar.SectionItems>
      </index_ts_1.Sidebar.Section>);
        (0, vitest_1.expect)(react_1.screen.getByText('Projects')).toHaveClass('q-sidebar-section-title');
        (0, vitest_1.expect)(container.querySelector('.q-sidebar-section-actions')).toContainElement(react_1.screen.getByTestId('add'));
    });
    (0, vitest_1.it)('renders the header switcher + a trailing toggle', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Header>
        <index_ts_1.Sidebar.Switcher><index_ts_1.Sidebar.Title>WS</index_ts_1.Sidebar.Title></index_ts_1.Sidebar.Switcher>
        <index_ts_1.Sidebar.Toggle>Collapse</index_ts_1.Sidebar.Toggle>
      </index_ts_1.Sidebar.Header>);
        (0, vitest_1.expect)(react_1.screen.getByText('WS')).toHaveClass('q-sidebar-switcher-name');
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Collapse' })).toHaveClass('q-sidebar-toggle');
    });
    (0, vitest_1.it)('collapses to an icon strip', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root collapsed>
        <index_ts_1.Sidebar.Body><Row label="Home"/></index_ts_1.Sidebar.Body>
      </index_ts_1.Sidebar.Root>);
        const root = container.querySelector('.q-sidebar');
        (0, vitest_1.expect)(root).toHaveClass('q-sidebar-collapsed');
        (0, vitest_1.expect)(root).toHaveAttribute('data-collapsed', '');
    });
    (0, vitest_1.it)('uses defaultCollapsed for the initial uncontrolled state', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root defaultCollapsed aria-label="Main"><index_ts_1.Sidebar.Body /></index_ts_1.Sidebar.Root>);
        (0, vitest_1.expect)(container.querySelector('.q-sidebar')).toHaveClass('q-sidebar-collapsed');
    });
    (0, vitest_1.it)('Toggle flips the uncontrolled rail and reflects aria-expanded + default label', async () => {
        const user = user_event_1.default.setup();
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root aria-label="Main">
        <index_ts_1.Sidebar.Header><index_ts_1.Sidebar.Toggle><span data-testid="glyph"/></index_ts_1.Sidebar.Toggle></index_ts_1.Sidebar.Header>
      </index_ts_1.Sidebar.Root>);
        const root = container.querySelector('.q-sidebar');
        const toggle = react_1.screen.getByRole('button', { name: 'Collapse sidebar' });
        (0, vitest_1.expect)(root).not.toHaveClass('q-sidebar-collapsed');
        (0, vitest_1.expect)(toggle).toHaveAttribute('aria-expanded', 'true');
        await user.click(toggle);
        (0, vitest_1.expect)(root).toHaveClass('q-sidebar-collapsed');
        const expand = react_1.screen.getByRole('button', { name: 'Expand sidebar' });
        (0, vitest_1.expect)(expand).toHaveAttribute('aria-expanded', 'false');
    });
    (0, vitest_1.it)('fires onCollapsedChange and stays put while collapse is controlled', async () => {
        const user = user_event_1.default.setup();
        const onCollapsedChange = vitest_1.vi.fn();
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root collapsed onCollapsedChange={onCollapsedChange} aria-label="Main">
        <index_ts_1.Sidebar.Header><index_ts_1.Sidebar.Toggle><span /></index_ts_1.Sidebar.Toggle></index_ts_1.Sidebar.Header>
      </index_ts_1.Sidebar.Root>);
        const root = container.querySelector('.q-sidebar');
        await user.click(react_1.screen.getByRole('button', { name: 'Expand sidebar' }));
        (0, vitest_1.expect)(onCollapsedChange).toHaveBeenCalledWith(false);
        (0, vitest_1.expect)(root).toHaveClass('q-sidebar-collapsed'); // unchanged until the parent flips `collapsed`
    });
    (0, vitest_1.it)('lets a custom Toggle onClick suppress the collapse via preventDefault', async () => {
        const user = user_event_1.default.setup();
        const onClick = vitest_1.vi.fn((event) => event.preventDefault());
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root aria-label="Main">
        <index_ts_1.Sidebar.Toggle onClick={onClick}><span /></index_ts_1.Sidebar.Toggle>
      </index_ts_1.Sidebar.Root>);
        await user.click(react_1.screen.getByRole('button', { name: 'Collapse sidebar' }));
        (0, vitest_1.expect)(onClick).toHaveBeenCalled();
        (0, vitest_1.expect)(container.querySelector('.q-sidebar')).not.toHaveClass('q-sidebar-collapsed');
    });
    (0, vitest_1.it)('keeps a text-labelled Toggle name and no aria-expanded outside a Root', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Toggle>Collapse</index_ts_1.Sidebar.Toggle>);
        const toggle = react_1.screen.getByRole('button', { name: 'Collapse' });
        (0, vitest_1.expect)(toggle).not.toHaveAttribute('aria-expanded');
    });
    (0, vitest_1.it)('expands a collapsed rail when the switcher is clicked, but not when expanded', async () => {
        const user = user_event_1.default.setup();
        const onClick = vitest_1.vi.fn();
        const { container } = (0, react_1.render)(<index_ts_1.Sidebar.Root defaultCollapsed aria-label="Main">
        <index_ts_1.Sidebar.Header>
          <index_ts_1.Sidebar.Switcher onClick={onClick}><index_ts_1.Sidebar.Logo><span /></index_ts_1.Sidebar.Logo></index_ts_1.Sidebar.Switcher>
        </index_ts_1.Sidebar.Header>
      </index_ts_1.Sidebar.Root>);
        const root = container.querySelector('.q-sidebar');
        const switcher = container.querySelector('.q-sidebar-switcher');
        (0, vitest_1.expect)(root).toHaveClass('q-sidebar-collapsed');
        await user.click(switcher);
        (0, vitest_1.expect)(onClick).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(root).not.toHaveClass('q-sidebar-collapsed'); // expanded
        // Expanded: clicking the switcher does not collapse (workspace-switch role intact).
        await user.click(switcher);
        (0, vitest_1.expect)(root).not.toHaveClass('q-sidebar-collapsed');
    });
    (0, vitest_1.it)('builds an Item row from start / title / meta / end slots', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Item start={<span data-testid="i"/>} title="Home" meta="9" end={<span data-testid="e"/>}/>);
        const row = react_1.screen.getByRole('button', { name: /Home/ });
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-icon')).toContainElement(react_1.screen.getByTestId('i'));
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-label')).toHaveTextContent('Home');
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-meta')).toHaveTextContent('9');
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-end')).toContainElement(react_1.screen.getByTestId('e'));
    });
    (0, vitest_1.it)('builds a FooterItem from slots', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.FooterItem variant="promo" start={<span data-testid="d"/>} title="Pricing" end={<index_ts_1.Sidebar.PromoBadge />}/>);
        const row = react_1.screen.getByRole('button', { name: /Pricing/ });
        (0, vitest_1.expect)(row).toHaveClass('q-sidebar-footeritem-promo');
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-label')).toHaveTextContent('Pricing');
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-promo-badge')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders children verbatim when no slot prop is passed (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Sidebar.Item><span data-testid="raw">raw</span></index_ts_1.Sidebar.Item>);
        const row = react_1.screen.getByRole('button', { name: /raw/ });
        (0, vitest_1.expect)(row.querySelector('[data-testid="raw"]')).toBeInTheDocument();
        (0, vitest_1.expect)(row.querySelector('.q-sidebar-label')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('self-manages the pin when uncontrolled (onPinChange only)', async () => {
        const user = user_event_1.default.setup();
        const onPinChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Sidebar.Item title="Project" onPinChange={onPinChange}/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'false');
        await user.click(react_1.screen.getByRole('button', { name: 'Pin' }));
        (0, vitest_1.expect)(onPinChange).toHaveBeenLastCalledWith(true);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true');
    });
});
//# sourceMappingURL=sidebar.test.js.map