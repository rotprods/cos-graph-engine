"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.afterEach)(() => {
    (0, react_1.act)(() => index_ts_1.toast.dismiss());
});
(0, vitest_1.describe)('toast imperative API', () => {
    (0, vitest_1.it)('exposes the sonner-shaped surface', () => {
        (0, vitest_1.expect)(typeof index_ts_1.toast).toBe('function');
        for (const m of ['success', 'error', 'warning', 'info', 'loading', 'message', 'dismiss', 'promise'])
            (0, vitest_1.expect)(typeof index_ts_1.toast[m]).toBe('function');
    });
});
(0, vitest_1.describe)('<Toaster>', () => {
    (0, vitest_1.it)('renders a fired toast with its title + description', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => { index_ts_1.toast.success('Saved', { description: 'All good' }); });
        (0, vitest_1.expect)(await react_1.screen.findByText('Saved')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('All good')).toBeInTheDocument();
    });
    (0, vitest_1.it)('applies the variant class', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => { index_ts_1.toast.error('Boom'); });
        const title = await react_1.screen.findByText('Boom');
        (0, vitest_1.expect)(title.closest('.q-sonner')).toHaveClass('q-sonner-error');
    });
    (0, vitest_1.it)('renders the variant glyph through <Icon>', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => { index_ts_1.toast.success('Saved'); });
        const card = (await react_1.screen.findByText('Saved')).closest('.q-sonner');
        // the status glyph is an <Icon>: q-icon is painted on the glyph svg inside the icon slot
        (0, vitest_1.expect)(card?.querySelector('.q-sonner-icon .q-icon')).toBeInTheDocument();
    });
    (0, vitest_1.it)('dismiss() removes toasts', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => { (0, index_ts_1.toast)('Temporary'); });
        (0, vitest_1.expect)(await react_1.screen.findByText('Temporary')).toBeInTheDocument();
        (0, react_1.act)(() => { index_ts_1.toast.dismiss(); });
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.queryByText('Temporary')).not.toBeInTheDocument());
    });
    (0, vitest_1.it)('renders a simple { label, onClick } action via the built-in button (back-compat)', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => { (0, index_ts_1.toast)('Message sent', { action: { label: 'Undo' } }); });
        const action = await react_1.screen.findByText('Undo');
        // built-in action keeps the q-sonner-action button styling
        (0, vitest_1.expect)(action).toHaveClass('q-sonner-action');
    });
    (0, vitest_1.it)('renders a custom ReactNode action in the action slot', async () => {
        (0, react_1.render)(<index_ts_1.Toaster />);
        (0, react_1.act)(() => {
            (0, index_ts_1.toast)('Saved', { action: <button type="button" data-testid="custom-action">Open</button> });
        });
        const custom = await react_1.screen.findByTestId('custom-action');
        (0, vitest_1.expect)(custom.closest('.q-sonner-action-slot')).toBeInTheDocument();
        // the custom node is NOT wrapped in the built-in action button
        (0, vitest_1.expect)(custom).not.toHaveClass('q-sonner-action');
    });
});
//# sourceMappingURL=sonner.test.js.map