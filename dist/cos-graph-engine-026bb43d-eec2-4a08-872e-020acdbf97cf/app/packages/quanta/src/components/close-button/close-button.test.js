"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<CloseButton>', () => {
    (0, vitest_1.it)('renders a button with the default cross glyph (painted by <Icon>) and accessible name', () => {
        (0, react_1.render)(<index_ts_1.CloseButton />);
        const btn = react_1.screen.getByRole('button', { name: 'Close' });
        (0, vitest_1.expect)(btn).toHaveClass('q-close', 'q-close-md');
        // Icon is node-only: q-icon lands directly on the glyph <svg>, sized to the md disc.
        const glyph = btn.querySelector('svg.q-icon');
        (0, vitest_1.expect)(glyph).toHaveClass('q-icon-md');
        (0, vitest_1.expect)(btn).toHaveAttribute('type', 'button');
    });
    (0, vitest_1.it)('applies the requested size class and matching icon size', () => {
        (0, react_1.render)(<index_ts_1.CloseButton size="xl"/>);
        const btn = react_1.screen.getByRole('button');
        (0, vitest_1.expect)(btn).toHaveClass('q-close-xl');
        // xl disc uses the 24px (lg) glyph.
        (0, vitest_1.expect)(btn.querySelector('svg.q-icon')).toHaveClass('q-icon-lg');
    });
    (0, vitest_1.it)('allows overriding the accessible label and children', () => {
        (0, react_1.render)(<index_ts_1.CloseButton aria-label="Dismiss"><span data-testid="custom">x</span></index_ts_1.CloseButton>);
        const btn = react_1.screen.getByRole('button', { name: 'Dismiss' });
        (0, vitest_1.expect)(react_1.screen.getByTestId('custom')).toBeInTheDocument();
        (0, vitest_1.expect)(btn.querySelector('svg')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards className and native button props', () => {
        (0, react_1.render)(<index_ts_1.CloseButton className="is-custom" disabled/>);
        const btn = react_1.screen.getByRole('button');
        (0, vitest_1.expect)(btn).toHaveClass('is-custom');
        (0, vitest_1.expect)(btn).toBeDisabled();
    });
    (0, vitest_1.it)('closeButton() recipe builds the q-close class string for non-button elements', () => {
        (0, vitest_1.expect)((0, index_ts_1.closeButton)()).toBe('q-close q-close-md');
        (0, vitest_1.expect)((0, index_ts_1.closeButton)({ size: 'sm' }, 'extra')).toBe('q-close q-close-sm extra');
    });
});
//# sourceMappingURL=close-button.test.js.map