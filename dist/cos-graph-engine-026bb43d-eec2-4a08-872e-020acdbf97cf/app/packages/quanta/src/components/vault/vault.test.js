"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
function open(side) {
    return (0, react_1.render)(<index_ts_1.Vault.Root defaultOpen side={side}>
      <index_ts_1.Vault.Content>
        <index_ts_1.Vault.Header title="Filters"/>
        <index_ts_1.Vault.Body>Body content</index_ts_1.Vault.Body>
        <index_ts_1.Vault.Footer caption="2 selected"/>
      </index_ts_1.Vault.Content>
    </index_ts_1.Vault.Root>);
}
(0, vitest_1.describe)('<Vault>', () => {
    (0, vitest_1.it)('renders the docked sheet with title, body and footer', () => {
        open();
        (0, vitest_1.expect)(react_1.screen.getByText('Filters')).toHaveClass('q-vault-title');
        (0, vitest_1.expect)(react_1.screen.getByText('Body content')).toHaveClass('q-vault-body');
        (0, vitest_1.expect)(react_1.screen.getByText('2 selected')).toHaveClass('q-vault-caption');
    });
    (0, vitest_1.it)('defaults to the bottom side and shows a handle', () => {
        open();
        const popup = react_1.screen.getByText('Filters').closest('.q-vault');
        (0, vitest_1.expect)(popup).toHaveClass('q-vault-bottom');
        (0, vitest_1.expect)(popup?.querySelector('.q-vault-handle')).toBeInTheDocument();
    });
    (0, vitest_1.it)('docks to the requested side (no handle off-bottom)', () => {
        open('right');
        const popup = react_1.screen.getByText('Filters').closest('.q-vault');
        (0, vitest_1.expect)(popup).toHaveClass('q-vault-right');
        (0, vitest_1.expect)(popup?.querySelector('.q-vault-handle')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('renders a default close button in the header with an Icon glyph', () => {
        open();
        const close = react_1.screen.getByRole('button', { name: 'Close' });
        (0, vitest_1.expect)(close).toHaveClass('q-close');
        // Icon is node-only: the glyph svg itself carries the q-icon sizing class.
        const glyph = close.querySelector('svg.q-icon.q-icon-md');
        (0, vitest_1.expect)(glyph).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders header start / end flank slots before the close button', () => {
        (0, react_1.render)(<index_ts_1.Vault.Root defaultOpen>
        <index_ts_1.Vault.Content>
          <index_ts_1.Vault.Header title="Filters" start={<button type="button">Back</button>} end={<span data-testid="end"/>}/>
        </index_ts_1.Vault.Content>
      </index_ts_1.Vault.Root>);
        const lead = document.querySelector('.q-vault-header-lead');
        (0, vitest_1.expect)(lead).toBeInTheDocument();
        const back = react_1.screen.getByRole('button', { name: 'Back' });
        const close = react_1.screen.getByRole('button', { name: 'Close' });
        (0, vitest_1.expect)(lead).toContainElement(back);
        (0, vitest_1.expect)(lead).toContainElement(react_1.screen.getByText('Filters'));
        (0, vitest_1.expect)(lead).toContainElement(react_1.screen.getByTestId('end'));
        // close stays after the lead group
        (0, vitest_1.expect)(back.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('keeps the title-only header bare (no lead wrapper) — back-compat', () => {
        open();
        (0, vitest_1.expect)(document.querySelector('.q-vault-header-lead')).toBeNull();
        (0, vitest_1.expect)(react_1.screen.getByText('Filters')).toHaveClass('q-vault-title');
    });
    (0, vitest_1.it)('stretches actions with the full footer prop', () => {
        (0, react_1.render)(<index_ts_1.Vault.Root defaultOpen>
        <index_ts_1.Vault.Content>
          <index_ts_1.Vault.Header title="x"/>
          <index_ts_1.Vault.Footer full actions={<button type="button">Apply</button>}/>
        </index_ts_1.Vault.Content>
      </index_ts_1.Vault.Root>);
        const actions = react_1.screen.getByRole('button', { name: 'Apply' }).closest('.q-vault-actions');
        (0, vitest_1.expect)(actions).toHaveClass('q-vault-actions-full');
    });
    (0, vitest_1.it)('does not add the full class by default — back-compat', () => {
        (0, react_1.render)(<index_ts_1.Vault.Root defaultOpen>
        <index_ts_1.Vault.Content>
          <index_ts_1.Vault.Header title="x"/>
          <index_ts_1.Vault.Footer actions={<button type="button">Done</button>}/>
        </index_ts_1.Vault.Content>
      </index_ts_1.Vault.Root>);
        const actions = react_1.screen.getByRole('button', { name: 'Done' }).closest('.q-vault-actions');
        (0, vitest_1.expect)(actions).not.toHaveClass('q-vault-actions-full');
    });
});
//# sourceMappingURL=vault.test.js.map