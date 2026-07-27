"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Progress> bar', () => {
    (0, vitest_1.it)('exposes progressbar a11y and reflects value as fill width', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress value={40} aria-label="Upload"/>);
        const bar = react_1.screen.getByRole('progressbar', { name: 'Upload' });
        (0, vitest_1.expect)(bar).toHaveAttribute('aria-valuenow', '40');
        (0, vitest_1.expect)(bar).toHaveAttribute('aria-valuemin', '0');
        (0, vitest_1.expect)(bar).toHaveAttribute('aria-valuemax', '100');
        (0, vitest_1.expect)(container.querySelector('.q-progress-fill')).toHaveStyle({ width: '40%' });
    });
    (0, vitest_1.it)('is indeterminate (no valuenow, sliding fill) when value is omitted', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress aria-label="Loading"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
        (0, vitest_1.expect)(container.querySelector('.q-progress-indeterminate')).toBeInTheDocument();
    });
    (0, vitest_1.it)('honors max', () => {
        (0, react_1.render)(<index_ts_1.Progress value={3} max={5} aria-label="Steps"/>);
        const bar = react_1.screen.getByRole('progressbar');
        (0, vitest_1.expect)(bar).toHaveAttribute('aria-valuenow', '3');
        (0, vitest_1.expect)(bar).toHaveAttribute('aria-valuemax', '5');
    });
    (0, vitest_1.it)('applies the slot color via --q-tint', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress value={50} color="success" aria-label="x"/>);
        (0, vitest_1.expect)(container.firstChild.style.getPropertyValue('--q-tint')).not.toBe('');
    });
    (0, vitest_1.it)('disables motion with animated={false}', () => {
        (0, react_1.render)(<index_ts_1.Progress value={50} animated={false} aria-label="x"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('progressbar')).toHaveAttribute('data-static', '');
    });
});
(0, vitest_1.describe)('<Progress> line', () => {
    (0, vitest_1.it)('renders N segments and fills them sequentially', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress variant="line" steps={4} value={60} aria-label="Steps"/>);
        const segs = container.querySelectorAll('.q-progress-segment');
        (0, vitest_1.expect)(segs).toHaveLength(4);
        // p=0.6, n=4 → fills: 100, 100, 40, 0
        (0, vitest_1.expect)(segs[0]).toHaveAttribute('data-state', 'complete');
        (0, vitest_1.expect)(segs[1]).toHaveAttribute('data-state', 'complete');
        (0, vitest_1.expect)(segs[2]).toHaveAttribute('data-state', 'active');
        (0, vitest_1.expect)(segs[3]).toHaveAttribute('data-state', 'pending');
    });
});
(0, vitest_1.describe)('<Progress> dots', () => {
    (0, vitest_1.it)('renders a row of N dots (no connectors) with the first round(p·n) filled', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress variant="dots" steps={10} value={50} aria-label="Steps"/>);
        const dots = container.querySelectorAll('.q-progress-dot');
        (0, vitest_1.expect)(dots).toHaveLength(10);
        (0, vitest_1.expect)(container.querySelectorAll('.q-progress-connector')).toHaveLength(0);
        const complete = [...dots].filter(d => d.getAttribute('data-state') === 'complete');
        (0, vitest_1.expect)(complete).toHaveLength(5); // round(0.5 * 10)
        (0, vitest_1.expect)(dots[4]).toHaveAttribute('data-state', 'complete');
        (0, vitest_1.expect)(dots[5]).toHaveAttribute('data-state', 'pending');
    });
    (0, vitest_1.it)('marks all dots complete at 100%', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress variant="dots" steps={3} value={100} aria-label="Done"/>);
        container.querySelectorAll('.q-progress-dot').forEach(d => (0, vitest_1.expect)(d).toHaveAttribute('data-state', 'complete'));
    });
});
(0, vitest_1.describe)('<Progress> circular', () => {
    (0, vitest_1.it)('renders a ring (track + accent arc) for circular bar with a11y', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress shape="circular" value={50} aria-label="Ring"/>);
        const root = react_1.screen.getByRole('progressbar', { name: 'Ring' });
        (0, vitest_1.expect)(root).toHaveClass('q-progress-circular');
        (0, vitest_1.expect)(root).toHaveAttribute('aria-valuenow', '50');
        (0, vitest_1.expect)(container.querySelector('.q-progress-ring-track')).toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-progress-ring-arc')).toBeInTheDocument();
    });
    (0, vitest_1.it)('spins an indeterminate ring when value is omitted', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress shape="circular" aria-label="Loading"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
        (0, vitest_1.expect)(container.querySelector('.q-progress-ring-indeterminate')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders N arc segments, the first round(p·n) complete', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress shape="circular" variant="line" steps={4} value={50} aria-label="Segs"/>);
        const segs = container.querySelectorAll('.q-progress-ring-seg');
        (0, vitest_1.expect)(segs).toHaveLength(4);
        (0, vitest_1.expect)([...segs].filter(s => s.getAttribute('data-state') === 'complete')).toHaveLength(2);
    });
    (0, vitest_1.it)('renders N dots around the ring, the first round(p·n) complete', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Progress shape="circular" variant="dots" steps={8} value={50} aria-label="Dots"/>);
        const dots = container.querySelectorAll('.q-progress-ring-dot');
        (0, vitest_1.expect)(dots).toHaveLength(8);
        (0, vitest_1.expect)([...dots].filter(d => d.getAttribute('data-state') === 'complete')).toHaveLength(4);
    });
    (0, vitest_1.it)('renders a center label from children', () => {
        (0, react_1.render)(<index_ts_1.Progress shape="circular" value={62} aria-label="x">62%</index_ts_1.Progress>);
        (0, vitest_1.expect)(react_1.screen.getByText('62%')).toHaveClass('q-progress-center');
    });
    (0, vitest_1.it)('applies the requested size class (xxs … lg)', () => {
        (0, react_1.render)(<index_ts_1.Progress shape="circular" size="xxs" value={10} aria-label="tiny"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('progressbar')).toHaveClass('q-progress-xxs');
    });
});
//# sourceMappingURL=progress.test.js.map