"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Toggle>', () => {
    (0, vitest_1.it)('renders a pressable button, unpressed by default', () => {
        (0, react_1.render)(<index_ts_1.Toggle>Bold</index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: 'Bold' });
        (0, vitest_1.expect)(btn).toHaveAttribute('aria-pressed', 'false');
    });
    (0, vitest_1.it)('reflects defaultPressed (uncontrolled) via data-pressed', () => {
        (0, react_1.render)(<index_ts_1.Toggle defaultPressed>On</index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: 'On' });
        (0, vitest_1.expect)(btn).toHaveAttribute('aria-pressed', 'true');
        (0, vitest_1.expect)(btn).toHaveAttribute('data-pressed');
    });
    (0, vitest_1.it)('toggles on click and fires onPressedChange', async () => {
        const onPressedChange = vitest_1.vi.fn();
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Toggle onPressedChange={onPressedChange}>Tap</index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: 'Tap' });
        await user.click(btn);
        (0, vitest_1.expect)(onPressedChange).toHaveBeenCalledWith(true, vitest_1.expect.anything());
        (0, vitest_1.expect)(btn).toHaveAttribute('aria-pressed', 'true');
    });
    (0, vitest_1.it)('applies the md size classes by default', () => {
        (0, react_1.render)(<index_ts_1.Toggle>M</index_ts_1.Toggle>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'M' })).toHaveClass('q-toggle', 'q-toggle-md');
    });
    (0, vitest_1.it)('maps size to its token sizing classes', () => {
        const { rerender } = (0, react_1.render)(<index_ts_1.Toggle size="sm">S</index_ts_1.Toggle>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'S' })).toHaveClass('q-toggle-sm');
        rerender(<index_ts_1.Toggle size="lg">L</index_ts_1.Toggle>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'L' })).toHaveClass('q-toggle-lg');
    });
    (0, vitest_1.it)('wires the slot color custom properties from the color prop', () => {
        (0, react_1.render)(<index_ts_1.Toggle color="success">C</index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: 'C' });
        (0, vitest_1.expect)(btn.style.getPropertyValue('--q-tint')).not.toBe('');
    });
    (0, vitest_1.it)('forwards a string className alongside the base classes', () => {
        (0, react_1.render)(<index_ts_1.Toggle className="is-custom">X</index_ts_1.Toggle>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'X' })).toHaveClass('is-custom');
    });
    (0, vitest_1.it)('renders start before and end after the label', () => {
        (0, react_1.render)(<index_ts_1.Toggle start={<span data-testid="lead"/>} end={<span data-testid="trail"/>}>
        Label
      </index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: /Label/ });
        const lead = react_1.screen.getByTestId('lead');
        const trail = react_1.screen.getByTestId('trail');
        (0, vitest_1.expect)(btn).toContainElement(lead);
        (0, vitest_1.expect)(btn).toContainElement(trail);
        // DOM order: start → label → end
        (0, vitest_1.expect)(lead.compareDocumentPosition(trail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        (0, vitest_1.expect)(btn.textContent).toBe('Label');
    });
    (0, vitest_1.it)('renders children bare when no slot is passed (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Toggle>Plain</index_ts_1.Toggle>);
        const btn = react_1.screen.getByRole('button', { name: 'Plain' });
        // no slot wrappers added — the button contains only the text
        (0, vitest_1.expect)(btn.childElementCount).toBe(0);
        (0, vitest_1.expect)(btn).toHaveTextContent('Plain');
    });
});
//# sourceMappingURL=toggle.test.js.map