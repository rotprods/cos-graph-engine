"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const IconCircleOutlined_1 = require("@higgsfield-ai/icons/IconCircleOutlined");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('chip() class-builder', () => {
    (0, vitest_1.it)('defaults to brand + sm', () => {
        (0, vitest_1.expect)((0, index_ts_1.chip)()).toBe('q-chip q-chip-brand q-chip-sm');
    });
    (0, vitest_1.it)('applies color + size + selected', () => {
        (0, vitest_1.expect)((0, index_ts_1.chip)({ color: 'success', size: 'md', selected: true })).toBe('q-chip q-chip-success q-chip-md q-chip-selected');
    });
    (0, vitest_1.it)('merges extra classes and drops falsy values', () => {
        (0, vitest_1.expect)((0, index_ts_1.chip)({ color: 'error' }, 'is-custom', false)).toBe('q-chip q-chip-error q-chip-sm is-custom');
    });
});
(0, vitest_1.describe)('<Chip>', () => {
    (0, vitest_1.it)('renders a button with default type and classes', () => {
        (0, react_1.render)(<index_ts_1.Chip>Filter</index_ts_1.Chip>);
        const chipControl = react_1.screen.getByRole('button', { name: 'Filter' });
        (0, vitest_1.expect)(chipControl).toHaveAttribute('type', 'button');
        (0, vitest_1.expect)(chipControl).toHaveAttribute('aria-pressed', 'false');
        (0, vitest_1.expect)(chipControl).toHaveClass('q-chip', 'q-chip-brand', 'q-chip-sm');
    });
    (0, vitest_1.it)('renders selected state', () => {
        (0, react_1.render)(<index_ts_1.Chip color="neutral" size="md" selected>Filter</index_ts_1.Chip>);
        const chipControl = react_1.screen.getByRole('button', { name: 'Filter' });
        (0, vitest_1.expect)(chipControl).toHaveAttribute('aria-pressed', 'true');
        (0, vitest_1.expect)(chipControl).toHaveAttribute('data-selected');
        (0, vitest_1.expect)(chipControl).toHaveClass('q-chip-neutral', 'q-chip-md', 'q-chip-selected');
    });
    (0, vitest_1.it)('forwards native props and caller classes', () => {
        (0, react_1.render)(<index_ts_1.Chip className="is-custom" disabled type="submit">Filter</index_ts_1.Chip>);
        const chipControl = react_1.screen.getByRole('button', { name: 'Filter' });
        (0, vitest_1.expect)(chipControl).toHaveClass('q-chip', 'is-custom');
        (0, vitest_1.expect)(chipControl).toBeDisabled();
        (0, vitest_1.expect)(chipControl).toHaveAttribute('type', 'submit');
    });
    (0, vitest_1.it)('composes start / end slots around the label', () => {
        (0, react_1.render)(<index_ts_1.Chip start={<IconCircleOutlined_1.IconCircleOutlined data-testid="lead"/>} end={<span data-testid="count">3</span>}>Tags</index_ts_1.Chip>);
        const chipControl = react_1.screen.getByRole('button', { name: /tags/i });
        (0, vitest_1.expect)(chipControl).toHaveTextContent('Tags');
        (0, vitest_1.expect)(react_1.screen.getByTestId('lead')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('count')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders bare children when no slot is passed (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Chip><IconCircleOutlined_1.IconCircleOutlined data-testid="icon"/>Label</index_ts_1.Chip>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('icon')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('button')).toHaveTextContent('Label');
    });
});
//# sourceMappingURL=chip.test.js.map