"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('badge() class-builder', () => {
    (0, vitest_1.it)('defaults to the blue skewed variant', () => {
        (0, vitest_1.expect)((0, index_ts_1.badge)()).toBe('q-badge q-badge-skew q-badge-blue');
    });
    (0, vitest_1.it)('applies compact variants and extra classes', () => {
        (0, vitest_1.expect)((0, index_ts_1.badge)({ variant: 'nBrand' }, 'is-custom', false)).toBe('q-badge q-badge-compact q-badge-n-brand is-custom');
    });
    (0, vitest_1.it)('applies the subtle lime skewed variant', () => {
        (0, vitest_1.expect)((0, index_ts_1.badge)({ variant: 'limeSubtle' })).toBe('q-badge q-badge-skew q-badge-lime-subtle');
    });
});
(0, vitest_1.describe)('<Badge>', () => {
    (0, vitest_1.it)('renders default text and classes', () => {
        (0, react_1.render)(<index_ts_1.Badge />);
        const badgeControl = react_1.screen.getByText('Tag').closest('.q-badge');
        (0, vitest_1.expect)(badgeControl).toHaveClass('q-badge', 'q-badge-skew', 'q-badge-blue');
        (0, vitest_1.expect)(react_1.screen.getByText('Tag').closest('.q-badge-frame')).toBeTruthy();
    });
    (0, vitest_1.it)('renders compact default text', () => {
        (0, react_1.render)(<index_ts_1.Badge variant="nBlue"/>);
        const badgeControl = react_1.screen.getByText('new').closest('.q-badge');
        (0, vitest_1.expect)(badgeControl).toHaveClass('q-badge-compact', 'q-badge-n-blue');
    });
    (0, vitest_1.it)('lets children override text and forwards native props', () => {
        (0, react_1.render)(<index_ts_1.Badge variant="purple" className="is-custom" title="Status">Exclusive</index_ts_1.Badge>);
        const badgeControl = react_1.screen.getByText('Exclusive').closest('.q-badge');
        (0, vitest_1.expect)(badgeControl).toHaveClass('q-badge-purple', 'is-custom');
        (0, vitest_1.expect)(badgeControl).toHaveAttribute('title', 'Status');
    });
});
//# sourceMappingURL=badge.test.js.map