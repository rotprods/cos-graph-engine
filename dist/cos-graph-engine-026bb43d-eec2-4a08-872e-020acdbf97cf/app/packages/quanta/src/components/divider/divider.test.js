"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Divider>', () => {
    (0, vitest_1.it)('defaults to a semantic <hr> with the etched horizontal styling', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Divider data-testid="d"/>);
        const hr = container.querySelector('hr');
        (0, vitest_1.expect)(hr).toBeInTheDocument();
        (0, vitest_1.expect)(hr).toHaveClass('q-divider', 'block', 'w-full');
    });
    (0, vitest_1.it)('renders vertical orientation as an <hr> that stretches in a flex row', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Divider orientation="vertical"/>);
        const hr = container.querySelector('hr');
        (0, vitest_1.expect)(hr).toHaveAttribute('aria-orientation', 'vertical');
        (0, vitest_1.expect)(hr).toHaveClass('q-divider-vertical', 'self-stretch');
    });
    (0, vitest_1.it)('switches to role=separator with flanking etched rules when labelled', () => {
        (0, react_1.render)(<index_ts_1.Divider>or</index_ts_1.Divider>);
        const sep = react_1.screen.getByRole('separator');
        (0, vitest_1.expect)(sep.tagName).toBe('DIV');
        (0, vitest_1.expect)(sep).toHaveAttribute('aria-orientation', 'horizontal');
        const label = react_1.screen.getByText('or');
        (0, vitest_1.expect)(label.tagName).toBe('SPAN');
        (0, vitest_1.expect)(label).toHaveClass('text-q-text-tertiary', 'text-q-caption-sm-medium');
        const rules = sep.querySelectorAll('[aria-hidden="true"]');
        (0, vitest_1.expect)(rules).toHaveLength(2);
        rules.forEach(rule => (0, vitest_1.expect)(rule).toHaveClass('q-divider'));
    });
    (0, vitest_1.it)('forwards className and native hr props on the unlabelled variant', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Divider className="is-custom" id="sep"/>);
        const hr = container.querySelector('hr');
        (0, vitest_1.expect)(hr).toHaveClass('is-custom');
        (0, vitest_1.expect)(hr).toHaveAttribute('id', 'sep');
    });
});
//# sourceMappingURL=divider.test.js.map