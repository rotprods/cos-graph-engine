"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('checkbox() class-builder', () => {
    (0, vitest_1.it)('defaults to brand + md', () => {
        (0, vitest_1.expect)((0, index_ts_1.checkbox)()).toBe('q-checkbox q-checkbox-brand q-checkbox-md');
    });
    (0, vitest_1.it)('applies color + size', () => {
        (0, vitest_1.expect)((0, index_ts_1.checkbox)({ color: 'white', size: 'lg' })).toBe('q-checkbox q-checkbox-white q-checkbox-lg');
    });
    (0, vitest_1.it)('merges extra classes and ignores falsy values', () => {
        (0, vitest_1.expect)((0, index_ts_1.checkbox)({ color: 'white', size: 'sm' }, 'is-custom', false)).toBe('q-checkbox q-checkbox-white q-checkbox-sm is-custom');
    });
});
(0, vitest_1.describe)('<Checkbox>', () => {
    (0, vitest_1.it)('renders a Base UI checkbox with Figma classes', () => {
        (0, react_1.render)(<index_ts_1.Checkbox aria-label="Accept" defaultChecked color="white" size="sm"/>);
        const control = react_1.screen.getByRole('checkbox', { name: 'Accept' });
        (0, vitest_1.expect)(control).toHaveAttribute('aria-checked', 'true');
        (0, vitest_1.expect)(control).toHaveClass('q-checkbox', 'q-checkbox-white', 'q-checkbox-sm');
    });
    (0, vitest_1.it)('renders an indeterminate state', () => {
        (0, react_1.render)(<index_ts_1.Checkbox aria-label="Partially selected" indeterminate/>);
        const control = react_1.screen.getByRole('checkbox', { name: 'Partially selected' });
        (0, vitest_1.expect)(control).toHaveAttribute('aria-checked', 'mixed');
        (0, vitest_1.expect)(control).toHaveAttribute('data-indeterminate');
    });
    (0, vitest_1.it)('merges caller classes', () => {
        (0, react_1.render)(<index_ts_1.Checkbox aria-label="Custom" className="is-custom"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('checkbox', { name: 'Custom' })).toHaveClass('q-checkbox', 'is-custom');
    });
});
(0, vitest_1.describe)('<CheckboxLabel>', () => {
    (0, vitest_1.it)('renders the label, description, and checkbox via Typography', () => {
        (0, react_1.render)(<index_ts_1.CheckboxLabel label="Use feature" description="Description"/>);
        // Title: Typography(label-sm-medium / primary) keeps the q-checkbox-label-title hook.
        const title = react_1.screen.getByText('Use feature');
        (0, vitest_1.expect)(title).toHaveClass('q-checkbox-label-title', 'text-q-label-sm-medium', 'text-q-text-primary');
        // Description: Typography(label-sm-regular / tertiary) keeps its class hook.
        const description = react_1.screen.getByText('Description');
        (0, vitest_1.expect)(description).toHaveClass('q-checkbox-label-description', 'text-q-label-sm-regular', 'text-q-text-tertiary');
        (0, vitest_1.expect)(react_1.screen.getByRole('checkbox', { name: /Use feature/ })).toHaveClass('q-checkbox');
    });
    (0, vitest_1.it)('supports right-aligned checkbox and medium label typography', () => {
        (0, react_1.render)(<index_ts_1.CheckboxLabel direction="right" size="md" label="Use feature"/>);
        const title = react_1.screen.getByText('Use feature');
        // md title switches the Typography variant.
        (0, vitest_1.expect)(title).toHaveClass('q-checkbox-label-title', 'text-q-label-md-medium');
        (0, vitest_1.expect)(title.closest('.q-checkbox-label')).toHaveClass('q-checkbox-label-right', 'q-checkbox-label-md');
    });
});
//# sourceMappingURL=checkbox.test.js.map