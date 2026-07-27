"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const react_2 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
/** Compose a simple panel row (title-only). */
function Row({ title, ...props }) {
    return (<index_ts_1.NavigationMenu.MenuItem {...props}>
      <index_ts_1.NavigationMenu.MenuItemContent>
        <index_ts_1.NavigationMenu.MenuItemTitleRow>
          <index_ts_1.NavigationMenu.MenuItemTitle>{title}</index_ts_1.NavigationMenu.MenuItemTitle>
        </index_ts_1.NavigationMenu.MenuItemTitleRow>
      </index_ts_1.NavigationMenu.MenuItemContent>
    </index_ts_1.NavigationMenu.MenuItem>);
}
/** Compose a rich (large) panel row with a media tile. */
function MediaRow({ title, subtitle, media, ...props }) {
    return (<index_ts_1.NavigationMenu.MenuItem {...props}>
      <index_ts_1.NavigationMenu.MenuMedia data-testid="media">{media ?? <span />}</index_ts_1.NavigationMenu.MenuMedia>
      <index_ts_1.NavigationMenu.MenuItemContent>
        <index_ts_1.NavigationMenu.MenuItemTitleRow>
          <index_ts_1.NavigationMenu.MenuItemTitle>{title}</index_ts_1.NavigationMenu.MenuItemTitle>
        </index_ts_1.NavigationMenu.MenuItemTitleRow>
        {subtitle ? <index_ts_1.NavigationMenu.MenuItemDescription>{subtitle}</index_ts_1.NavigationMenu.MenuItemDescription> : null}
      </index_ts_1.NavigationMenu.MenuItemContent>
    </index_ts_1.NavigationMenu.MenuItem>);
}
function setup() {
    (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
      <index_ts_1.NavigationMenu.List>
        <index_ts_1.NavigationMenu.Item>
          <index_ts_1.NavigationMenu.Trigger>Products</index_ts_1.NavigationMenu.Trigger>
          <index_ts_1.NavigationMenu.Content>
            <index_ts_1.NavigationMenu.Menu rows={3}>
              <index_ts_1.NavigationMenu.Group>
                <index_ts_1.NavigationMenu.GroupLabel>Create</index_ts_1.NavigationMenu.GroupLabel>
                <Row title="Image" href="/image"/>
                <Row title="Video" href="/video"/>
              </index_ts_1.NavigationMenu.Group>
              <Row title="Pricing" href="/pricing"/>
            </index_ts_1.NavigationMenu.Menu>
          </index_ts_1.NavigationMenu.Content>
        </index_ts_1.NavigationMenu.Item>
        <index_ts_1.NavigationMenu.Item>
          <index_ts_1.NavigationMenu.Link href="/docs">Docs</index_ts_1.NavigationMenu.Link>
        </index_ts_1.NavigationMenu.Item>
      </index_ts_1.NavigationMenu.List>
    </index_ts_1.NavigationMenu.Root>);
}
(0, vitest_1.describe)('<NavigationMenu>', () => {
    (0, vitest_1.it)('renders bar triggers and plain links', () => {
        setup();
        (0, vitest_1.expect)(react_2.screen.getByRole('button', { name: /products/i })).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
    });
    (0, vitest_1.it)('opens the panel and reveals its (grouped + ungrouped) rows', async () => {
        const user = user_event_1.default.setup();
        setup();
        await user.click(react_2.screen.getByRole('button', { name: /products/i }));
        await (0, react_2.waitFor)(() => (0, vitest_1.expect)(react_2.screen.getByText('Image')).toBeInTheDocument());
        (0, vitest_1.expect)(react_2.screen.getByText('Video')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByText('Pricing')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByText('Create')).toHaveClass('q-nav-group-label');
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: /image/i })).toHaveAttribute('href', '/image');
    });
    (0, vitest_1.it)('applies the requested row count to the grid', async () => {
        const user = user_event_1.default.setup();
        setup();
        await user.click(react_2.screen.getByRole('button', { name: /products/i }));
        await (0, react_2.waitFor)(() => (0, vitest_1.expect)(document.querySelector('.q-nav-menu-grid')).toBeInTheDocument());
        (0, vitest_1.expect)(document.querySelector('.q-nav-menu-grid')).toHaveClass('q-nav-rows-3');
    });
    (0, vitest_1.it)('renders Figma-sized column menus with large media rows', async () => {
        const user = user_event_1.default.setup();
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.List>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Trigger>Image</index_ts_1.NavigationMenu.Trigger>
            <index_ts_1.NavigationMenu.Content>
              <index_ts_1.NavigationMenu.Menu size="image" layout="columns">
                <index_ts_1.NavigationMenu.Group>
                  <index_ts_1.NavigationMenu.GroupLabel>Features</index_ts_1.NavigationMenu.GroupLabel>
                  <MediaRow title="Create Image" subtitle="AI image generation" href="/image"/>
                </index_ts_1.NavigationMenu.Group>
              </index_ts_1.NavigationMenu.Menu>
            </index_ts_1.NavigationMenu.Content>
          </index_ts_1.NavigationMenu.Item>
        </index_ts_1.NavigationMenu.List>
      </index_ts_1.NavigationMenu.Root>);
        await user.click(react_2.screen.getByRole('button', { name: /image/i }));
        await (0, react_2.waitFor)(() => (0, vitest_1.expect)(document.querySelector('.q-nav-menu-size-image')).toBeInTheDocument());
        (0, vitest_1.expect)(document.querySelector('.q-nav-menu-columns')).toHaveClass('q-nav-rows-2');
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: /create image/i })).toHaveClass('q-nav-menu-item');
        (0, vitest_1.expect)(react_2.screen.getByTestId('media')).toHaveClass('q-nav-menu-media');
    });
    (0, vitest_1.it)('renders custom menu content without the grid wrapper', async () => {
        const user = user_event_1.default.setup();
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.List>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Trigger>Custom</index_ts_1.NavigationMenu.Trigger>
            <index_ts_1.NavigationMenu.Content>
              <index_ts_1.NavigationMenu.Menu layout="custom">
                <div data-testid="custom-content">Custom content</div>
                <index_ts_1.NavigationMenu.MenuSeparator data-testid="custom-separator"/>
              </index_ts_1.NavigationMenu.Menu>
            </index_ts_1.NavigationMenu.Content>
          </index_ts_1.NavigationMenu.Item>
        </index_ts_1.NavigationMenu.List>
      </index_ts_1.NavigationMenu.Root>);
        await user.click(react_2.screen.getByRole('button', { name: /custom/i }));
        await (0, react_2.waitFor)(() => (0, vitest_1.expect)(react_2.screen.getByTestId('custom-content')).toBeInTheDocument());
        (0, vitest_1.expect)(document.querySelector('.q-nav-menu-layout-custom')).toBeInTheDocument();
        (0, vitest_1.expect)(document.querySelector('.q-nav-menu-layout-custom .q-nav-menu-grid')).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByTestId('custom-separator')).toHaveClass('q-nav-menu-separator');
    });
    (0, vitest_1.it)('can render menu content statically outside a root', () => {
        (0, react_2.render)(<index_ts_1.NavigationMenu.Menu standalone size="plugins" layout="columns">
        <index_ts_1.NavigationMenu.Group>
          <index_ts_1.NavigationMenu.GroupLabel>Adobe Plugins</index_ts_1.NavigationMenu.GroupLabel>
          <MediaRow title="Premiere Pro" subtitle="Higgsfield inside Premiere" href="/premiere" interactive={false}/>
        </index_ts_1.NavigationMenu.Group>
      </index_ts_1.NavigationMenu.Menu>);
        (0, vitest_1.expect)(react_2.screen.getByText('Adobe Plugins')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: /premiere pro/i })).toHaveAttribute('href', '/premiere');
        (0, vitest_1.expect)(react_2.screen.getByTestId('media')).toHaveClass('q-nav-menu-media');
        (0, vitest_1.expect)(document.querySelector('.q-nav-menu')).toHaveClass('q-nav-menu-static');
    });
    (0, vitest_1.it)('renders logo, an accent link with composed icon/badge, and the actions cluster', () => {
        const { container } = (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.Logo><span data-testid="logo"/></index_ts_1.NavigationMenu.Logo>
        <index_ts_1.NavigationMenu.List>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Link href="/sc" accent>
              <index_ts_1.NavigationMenu.ItemIcon><span data-testid="lead"/></index_ts_1.NavigationMenu.ItemIcon>
              Supercomputer
              <span data-testid="badge"/>
            </index_ts_1.NavigationMenu.Link>
          </index_ts_1.NavigationMenu.Item>
        </index_ts_1.NavigationMenu.List>
        <index_ts_1.NavigationMenu.Actions>
          <index_ts_1.NavigationMenu.Action iconOnly aria-label="Search"><span /></index_ts_1.NavigationMenu.Action>
          <index_ts_1.NavigationMenu.Action href="/pricing">Pricing</index_ts_1.NavigationMenu.Action>
        </index_ts_1.NavigationMenu.Actions>
      </index_ts_1.NavigationMenu.Root>);
        (0, vitest_1.expect)(react_2.screen.getByTestId('logo').closest('.q-nav-logo')).toBeInTheDocument();
        const sc = react_2.screen.getByRole('link', { name: /supercomputer/i });
        (0, vitest_1.expect)(sc).toHaveClass('q-nav-item', 'q-nav-item-accent');
        (0, vitest_1.expect)(react_2.screen.getByTestId('lead').closest('.q-nav-item-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByTestId('badge')).toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-nav-actions')).toBeInTheDocument();
        (0, vitest_1.expect)(react_2.screen.getByRole('button', { name: 'Search' })).toHaveClass('q-nav-action', 'q-nav-action-icon');
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    });
    (0, vitest_1.it)('Action defaults to a <button> and renders an <a> from href', () => {
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.Actions>
          <index_ts_1.NavigationMenu.Action>Plain</index_ts_1.NavigationMenu.Action>
          <index_ts_1.NavigationMenu.Action href="/go">Linked</index_ts_1.NavigationMenu.Action>
        </index_ts_1.NavigationMenu.Actions>
      </index_ts_1.NavigationMenu.Root>);
        const plain = react_2.screen.getByRole('button', { name: 'Plain' });
        (0, vitest_1.expect)(plain.tagName).toBe('BUTTON');
        (0, vitest_1.expect)(plain).toHaveAttribute('type', 'button');
        (0, vitest_1.expect)(plain).toHaveClass('q-nav-action');
        const linked = react_2.screen.getByRole('link', { name: 'Linked' });
        (0, vitest_1.expect)(linked.tagName).toBe('A');
        (0, vitest_1.expect)(linked).toHaveAttribute('href', '/go');
        (0, vitest_1.expect)(linked).not.toHaveAttribute('type');
    });
    (0, vitest_1.it)('forwards refs to the trigger button and the plain link', () => {
        const triggerRef = (0, react_1.createRef)();
        const linkRef = (0, react_1.createRef)();
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.List>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Trigger ref={triggerRef}>Products</index_ts_1.NavigationMenu.Trigger>
            <index_ts_1.NavigationMenu.Content>
              <index_ts_1.NavigationMenu.Menu><Row title="Image" href="/image"/></index_ts_1.NavigationMenu.Menu>
            </index_ts_1.NavigationMenu.Content>
          </index_ts_1.NavigationMenu.Item>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Link href="/docs" ref={linkRef}>Docs</index_ts_1.NavigationMenu.Link>
          </index_ts_1.NavigationMenu.Item>
        </index_ts_1.NavigationMenu.List>
      </index_ts_1.NavigationMenu.Root>);
        (0, vitest_1.expect)(triggerRef.current?.tagName).toBe('BUTTON');
        (0, vitest_1.expect)(linkRef.current?.tagName).toBe('A');
        (0, vitest_1.expect)(linkRef.current).toHaveAttribute('href', '/docs');
    });
    (0, vitest_1.it)('marks the current section with active (aria-current=page) on a link and a trigger', () => {
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.List>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Link href="/image" active>Image</index_ts_1.NavigationMenu.Link>
          </index_ts_1.NavigationMenu.Item>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Trigger active>Video</index_ts_1.NavigationMenu.Trigger>
            <index_ts_1.NavigationMenu.Content><index_ts_1.NavigationMenu.Menu><Row title="Create" href="/v"/></index_ts_1.NavigationMenu.Menu></index_ts_1.NavigationMenu.Content>
          </index_ts_1.NavigationMenu.Item>
          <index_ts_1.NavigationMenu.Item>
            <index_ts_1.NavigationMenu.Link href="/docs">Docs</index_ts_1.NavigationMenu.Link>
          </index_ts_1.NavigationMenu.Item>
        </index_ts_1.NavigationMenu.List>
      </index_ts_1.NavigationMenu.Root>);
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: 'Image' })).toHaveAttribute('aria-current', 'page');
        (0, vitest_1.expect)(react_2.screen.getByRole('button', { name: /video/i })).toHaveAttribute('aria-current', 'page');
        (0, vitest_1.expect)(react_2.screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('aria-current');
    });
    (0, vitest_1.it)('Action swaps its element via render, keeping the pill styling', () => {
        (0, react_2.render)(<index_ts_1.NavigationMenu.Root>
        <index_ts_1.NavigationMenu.Actions>
          <index_ts_1.NavigationMenu.Action render={<a href="/custom" data-testid="custom"/>}>Custom</index_ts_1.NavigationMenu.Action>
        </index_ts_1.NavigationMenu.Actions>
      </index_ts_1.NavigationMenu.Root>);
        const custom = react_2.screen.getByTestId('custom');
        (0, vitest_1.expect)(custom.tagName).toBe('A');
        (0, vitest_1.expect)(custom).toHaveAttribute('href', '/custom');
        (0, vitest_1.expect)(custom).toHaveClass('q-nav-action');
        (0, vitest_1.expect)(custom).not.toHaveAttribute('type');
    });
});
//# sourceMappingURL=navigation-menu.test.js.map