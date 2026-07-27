"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Tabs>', () => {
    (0, vitest_1.it)('marks the active tab and renders the animated indicator', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a">A</index_ts_1.Tabs.Tab>
          <index_ts_1.Tabs.Tab value="b">B</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
        <index_ts_1.Tabs.Panel value="a">Panel A</index_ts_1.Tabs.Panel>
        <index_ts_1.Tabs.Panel value="b">Panel B</index_ts_1.Tabs.Panel>
      </index_ts_1.Tabs.Root>);
        const active = react_1.screen.getByRole('tab', { name: 'A' });
        const inactive = react_1.screen.getByRole('tab', { name: 'B' });
        (0, vitest_1.expect)(active).toHaveAttribute('data-active');
        (0, vitest_1.expect)(inactive).not.toHaveAttribute('data-active');
        (0, vitest_1.expect)(active.className).toContain('q-tabs-tab');
        (0, vitest_1.expect)(react_1.screen.getByRole('tablist').querySelector('.q-tabs-indicator')).toBeInTheDocument();
    });
    (0, vitest_1.it)('applies segmented, surface, and pill variant classes from the root options', () => {
        const { rerender } = (0, react_1.render)(<index_ts_1.Tabs.Root variant="segmented" shape="pill" surface="flat" tone="brandSoft" defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a">A</index_ts_1.Tabs.Tab>
          <index_ts_1.Tabs.Tab value="b">B</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        const root = react_1.screen.getByRole('tablist').parentElement;
        (0, vitest_1.expect)(root).toHaveClass('q-tabs-segmented');
        (0, vitest_1.expect)(root).toHaveClass('q-tabs-shape-pill');
        (0, vitest_1.expect)(root).toHaveClass('q-tabs-surface-flat');
        (0, vitest_1.expect)(root).toHaveClass('q-tabs-tone-brand-soft');
        rerender(<index_ts_1.Tabs.Root variant="pill" defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a">A</index_ts_1.Tabs.Tab>
          <index_ts_1.Tabs.Tab value="b">B</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('tablist').parentElement).toHaveClass('q-tabs-pill');
    });
    (0, vitest_1.it)('applies the full-width fill class when fullWidth is set', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List fullWidth aria-label="Full width tabs">
          <index_ts_1.Tabs.Tab value="a">A</index_ts_1.Tabs.Tab>
          <index_ts_1.Tabs.Tab value="b">B</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('tablist', { name: 'Full width tabs' })).toHaveClass('q-tabs-list-fill');
    });
    (0, vitest_1.it)('renders canonical start / subtitle / end slots into the tab', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a" start={<span data-testid="lead"/>} subtitle={<span data-testid="sub"/>} end={<span data-testid="trail"/>}>
            Label
          </index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('lead').closest('.q-tabs-tab-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('sub').closest('.q-tabs-tab-secondary')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('trail').closest('.q-tabs-tab-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('Label').closest('.q-tabs-tab-label')).toBeInTheDocument();
    });
    (0, vitest_1.it)('keeps the legacy icon / iconEnd / secondaryText aliases (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a" icon={<span data-testid="legacy-lead"/>} secondaryText={<span data-testid="legacy-sub"/>} iconEnd={<span data-testid="legacy-trail"/>}>
            Label
          </index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('legacy-lead').closest('.q-tabs-tab-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('legacy-sub').closest('.q-tabs-tab-secondary')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('legacy-trail').closest('.q-tabs-tab-icon')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders children bare (no slot wrappers) when no slot is passed (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a">Plain</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
      </index_ts_1.Tabs.Root>);
        const tab = react_1.screen.getByRole('tab', { name: 'Plain' });
        (0, vitest_1.expect)(tab.querySelector('.q-tabs-tab-label')).toBeNull();
        (0, vitest_1.expect)(tab.querySelector('.q-tabs-tab-content')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders data-driven tabs from the items prop (value wiring, label, slots)', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="b">
        <index_ts_1.Tabs.List aria-label="Data tabs" items={[
                { value: 'a', label: 'Alpha', start: <span data-testid="ia"/> },
                { value: 'b', label: 'Beta' },
            ]}/>
        <index_ts_1.Tabs.Panel value="a">Panel A</index_ts_1.Tabs.Panel>
        <index_ts_1.Tabs.Panel value="b">Panel B</index_ts_1.Tabs.Panel>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByRole('tab', { name: /Alpha/ })).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('ia').closest('.q-tabs-tab-icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('data-active');
        (0, vitest_1.expect)(react_1.screen.getByText('Panel B')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('Panel A')).toBeNull();
    });
    (0, vitest_1.it)('shows only the active panel', () => {
        (0, react_1.render)(<index_ts_1.Tabs.Root defaultValue="a">
        <index_ts_1.Tabs.List>
          <index_ts_1.Tabs.Tab value="a">A</index_ts_1.Tabs.Tab>
          <index_ts_1.Tabs.Tab value="b">B</index_ts_1.Tabs.Tab>
        </index_ts_1.Tabs.List>
        <index_ts_1.Tabs.Panel value="a">Panel A</index_ts_1.Tabs.Panel>
        <index_ts_1.Tabs.Panel value="b">Panel B</index_ts_1.Tabs.Panel>
      </index_ts_1.Tabs.Root>);
        (0, vitest_1.expect)(react_1.screen.getByText('Panel A')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('Panel B')).toBeNull();
    });
});
//# sourceMappingURL=tabs.test.js.map