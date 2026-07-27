"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Loader>', () => {
    (0, vitest_1.it)('renders a status role with the default label, variant and size', () => {
        (0, react_1.render)(<index_ts_1.Loader />);
        const el = react_1.screen.getByRole('status', { name: 'Loading' });
        (0, vitest_1.expect)(el).toHaveClass('q-loader', 'q-loader-circle', 'q-loader-md');
    });
    (0, vitest_1.it)('renders four dots for the dots variant', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Loader variant="dots"/>);
        (0, vitest_1.expect)(container.querySelectorAll('.q-loader-dot')).toHaveLength(4);
    });
    (0, vitest_1.it)('renders the spinner svg for the circle variant', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Loader variant="circle"/>);
        (0, vitest_1.expect)(container.querySelector('.q-loader-spinner')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders two sparkles for the stars variant', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Loader variant="stars"/>);
        (0, vitest_1.expect)(container.querySelectorAll('.q-loader-star')).toHaveLength(2);
    });
    (0, vitest_1.it)('applies the requested size and a custom label', () => {
        (0, react_1.render)(<index_ts_1.Loader variant="shine" size="lg" aria-label="Generating"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('status', { name: 'Generating' })).toHaveClass('q-loader-shine', 'q-loader-lg');
    });
    (0, vitest_1.it)('wires the slot color via inline custom properties', () => {
        (0, react_1.render)(<index_ts_1.Loader color="success"/>);
        const el = react_1.screen.getByRole('status');
        (0, vitest_1.expect)(el.style.getPropertyValue('--q-tint')).not.toBe('');
    });
    (0, vitest_1.it)('disables motion with animated={false}', () => {
        (0, react_1.render)(<index_ts_1.Loader />);
        const animated = react_1.screen.getByRole('status');
        (0, vitest_1.expect)(animated).not.toHaveAttribute('data-static');
        (0, react_1.render)(<index_ts_1.Loader animated={false} aria-label="Static"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('status', { name: 'Static' })).toHaveAttribute('data-static');
    });
    (0, vitest_1.it)('forwards className and native div props', () => {
        (0, react_1.render)(<index_ts_1.Loader className="is-custom" id="load"/>);
        const el = react_1.screen.getByRole('status');
        (0, vitest_1.expect)(el).toHaveClass('is-custom');
        (0, vitest_1.expect)(el).toHaveAttribute('id', 'load');
    });
});
//# sourceMappingURL=loader.test.js.map