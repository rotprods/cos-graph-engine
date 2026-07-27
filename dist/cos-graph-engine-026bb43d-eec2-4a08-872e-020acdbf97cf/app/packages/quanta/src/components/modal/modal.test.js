"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('modal() class-builder', () => {
    (0, vitest_1.it)('defaults to the md size', () => {
        (0, vitest_1.expect)((0, index_ts_1.modal)()).toBe('q-modal q-modal-size-md');
    });
    (0, vitest_1.it)('applies size and extra classes', () => {
        (0, vitest_1.expect)((0, index_ts_1.modal)({ size: 'lg' }, 'custom')).toBe('q-modal q-modal-size-lg custom');
    });
    (0, vitest_1.it)('includes the compact Figma xs size', () => {
        (0, vitest_1.expect)((0, index_ts_1.modal)({ size: 'xs' })).toBe('q-modal q-modal-size-xs');
    });
});
(0, vitest_1.describe)('<Modal> composition', () => {
    (0, vitest_1.it)('renders the Base UI dialog with composed quanta parts', () => {
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content>
          <index_ts_1.Modal.Header>
            <index_ts_1.Modal.Title>Modal title</index_ts_1.Modal.Title>
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
          <index_ts_1.Modal.Body>Body content</index_ts_1.Modal.Body>
          <index_ts_1.Modal.Footer>
            <index_ts_1.Modal.FooterCaption>Footer caption</index_ts_1.Modal.FooterCaption>
            <index_ts_1.Modal.FooterActions><button type="button">Confirm</button></index_ts_1.Modal.FooterActions>
          </index_ts_1.Modal.Footer>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        const dialog = react_1.screen.getByRole('dialog', { name: 'Modal title' });
        (0, vitest_1.expect)(dialog).toHaveClass('q-modal', 'q-modal-size-md');
        (0, vitest_1.expect)(react_1.screen.getByText('Body content')).toHaveClass('q-modal-workspace', 'q-modal-workspace-padded');
        (0, vitest_1.expect)(react_1.screen.getByText('Footer caption')).toHaveClass('q-modal-caption');
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Confirm' }).closest('.q-modal-actions')).not.toBeNull();
        const closeButton = react_1.screen.getByRole('button', { name: 'Close' });
        (0, vitest_1.expect)(closeButton).toHaveClass('q-close');
        (0, vitest_1.expect)(closeButton.querySelector('.q-icon')).not.toBeNull();
    });
    (0, vitest_1.it)('composes the back / search / tabs header layouts', () => {
        const back = (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Back">
          <index_ts_1.Modal.Header>
            <index_ts_1.Modal.HeaderLead>
              <index_ts_1.Modal.BackButton />
              <index_ts_1.Modal.Title>Step 2</index_ts_1.Modal.Title>
            </index_ts_1.Modal.HeaderLead>
            <index_ts_1.Modal.Spacer />
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(back.container.ownerDocument.querySelector('.q-modal-header-lead')).not.toBeNull();
        const backButton = back.getByRole('button', { name: 'Back' });
        (0, vitest_1.expect)(backButton).toHaveClass('q-close');
        (0, vitest_1.expect)(backButton.querySelector('.q-icon')).not.toBeNull();
        back.unmount();
        const search = (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Search">
          <index_ts_1.Modal.Header flush>
            <index_ts_1.Modal.Search placeholder="Find…"/>
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(search.getByPlaceholderText('Find…')).toHaveClass('q-modal-search-input');
        (0, vitest_1.expect)(search.container.ownerDocument.querySelector('.q-modal-header-flush')).not.toBeNull();
        (0, vitest_1.expect)(search.container.ownerDocument.querySelector('.q-modal-search-icon .q-icon')).not.toBeNull();
        search.unmount();
        const tabs = (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Tabs">
          <index_ts_1.Modal.Header flush>
            <div data-testid="pill">tabs</div>
            <index_ts_1.Modal.Spacer />
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(tabs.getByTestId('pill')).toBeInTheDocument();
    });
    (0, vitest_1.it)('wraps plain body content in a single window, but keeps explicit Workspaces', () => {
        const single = (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Single"><index_ts_1.Modal.Body>Plain</index_ts_1.Modal.Body></index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(single.container.ownerDocument.querySelectorAll('.q-modal-workspace')).toHaveLength(1);
        (0, vitest_1.expect)(single.getByText('Plain')).toHaveClass('q-modal-workspace');
        single.unmount();
        const split = (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content size="xl" aria-label="Split">
          <index_ts_1.Modal.Body>
            <index_ts_1.Modal.Workspace className="w-40 flex-none">Nav</index_ts_1.Modal.Workspace>
            <index_ts_1.Modal.Workspace>Content</index_ts_1.Modal.Workspace>
          </index_ts_1.Modal.Body>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(split.container.ownerDocument.querySelectorAll('.q-modal-workspace')).toHaveLength(2);
        (0, vitest_1.expect)(split.getByText('Nav')).toHaveClass('q-modal-workspace');
        (0, vitest_1.expect)(split.getByText('Content')).toHaveClass('q-modal-workspace');
    });
    (0, vitest_1.it)('applies the size preset to the popup', () => {
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content size="lg" aria-label="Large modal"><index_ts_1.Modal.Body /></index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('dialog', { name: 'Large modal' })).toHaveClass('q-modal-size-lg');
    });
    (0, vitest_1.it)('stretches footer actions when full', () => {
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Full footer">
          <index_ts_1.Modal.Footer full>
            <index_ts_1.Modal.FooterActions full><button type="button">Done</button></index_ts_1.Modal.FooterActions>
          </index_ts_1.Modal.Footer>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(document.querySelector('.q-modal-footer-full')).not.toBeNull();
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Done' }).closest('.q-modal-actions-full')).not.toBeNull();
    });
    (0, vitest_1.it)('orders a trailing header control before the close button', () => {
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content>
          <index_ts_1.Modal.Header>
            <index_ts_1.Modal.Title>With actions</index_ts_1.Modal.Title>
            <button type="button">Settings</button>
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        const settings = react_1.screen.getByRole('button', { name: 'Settings' });
        const close = react_1.screen.getByRole('button', { name: 'Close' });
        (0, vitest_1.expect)(settings.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('renders a header with no close affordance (body-only sheet)', () => {
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content aria-label="Sheet">
          <index_ts_1.Modal.Header><index_ts_1.Modal.Title>No close</index_ts_1.Modal.Title></index_ts_1.Modal.Header>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(react_1.screen.getByText('No close')).toHaveClass('q-modal-title');
        (0, vitest_1.expect)(react_1.screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('closes when the close button is pressed', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Modal.Root defaultOpen>
        <index_ts_1.Modal.Content>
          <index_ts_1.Modal.Header>
            <index_ts_1.Modal.Title>Dismissable</index_ts_1.Modal.Title>
            <index_ts_1.Modal.CloseButton />
          </index_ts_1.Modal.Header>
          <index_ts_1.Modal.Body>Body</index_ts_1.Modal.Body>
        </index_ts_1.Modal.Content>
      </index_ts_1.Modal.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('dialog', { name: 'Dismissable' })).toBeInTheDocument();
        await user.click(react_1.screen.getByRole('button', { name: 'Close' }));
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.queryByRole('dialog', { name: 'Dismissable' })).not.toBeInTheDocument());
    });
});
//# sourceMappingURL=modal.test.js.map