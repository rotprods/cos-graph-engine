"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Tag>', () => {
    (0, vitest_1.it)('renders its children inside a non-interactive span with the slot tint', () => {
        (0, react_1.render)(<index_ts_1.Tag>Beta</index_ts_1.Tag>);
        const label = react_1.screen.getByText('Beta');
        // The label sits in a truncating inner span; the container carries the slot bg.
        const container = label.closest('span.q-slot-bg-10');
        (0, vitest_1.expect)(container).toBeInTheDocument();
        (0, vitest_1.expect)(container).toHaveClass('q-slot-text', 'text-q-caption-sm-medium');
    });
    (0, vitest_1.it)('defaults to the neutral slot color (sets the --q-tint custom properties)', () => {
        (0, react_1.render)(<index_ts_1.Tag>X</index_ts_1.Tag>);
        const container = react_1.screen.getByText('X').closest('span.q-slot-bg-10');
        // slotStyle('neutral') wires the private slot vars inline.
        (0, vitest_1.expect)(container.style.getPropertyValue('--q-tint-fg')).not.toBe('');
    });
    (0, vitest_1.it)('renders a trailing remove button only when onRemove is provided', () => {
        const { rerender } = (0, react_1.render)(<index_ts_1.Tag>Closable</index_ts_1.Tag>);
        (0, vitest_1.expect)(react_1.screen.queryByRole('button')).not.toBeInTheDocument();
        rerender(<index_ts_1.Tag onRemove={() => { }}>Closable</index_ts_1.Tag>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders the remove glyph as a node-only Icon (decorative, xs-sized svg)', () => {
        (0, react_1.render)(<index_ts_1.Tag onRemove={() => { }}>Closable</index_ts_1.Tag>);
        const button = react_1.screen.getByRole('button', { name: 'Remove' });
        // Icon is node-only: q-icon/q-icon-xs and aria-hidden land directly on the svg.
        const glyph = button.querySelector('svg.q-icon.q-icon-xs');
        (0, vitest_1.expect)(glyph).toBeInTheDocument();
        (0, vitest_1.expect)(glyph).toHaveAttribute('aria-hidden', 'true');
    });
    (0, vitest_1.it)('invokes onRemove when the remove button is clicked', async () => {
        const onRemove = vitest_1.vi.fn();
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Tag onRemove={onRemove}>Closable</index_ts_1.Tag>);
        await user.click(react_1.screen.getByRole('button', { name: 'Remove' }));
        (0, vitest_1.expect)(onRemove).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('supports a custom remove label', () => {
        (0, react_1.render)(<index_ts_1.Tag onRemove={() => { }} removeLabel="Dismiss tag">Closable</index_ts_1.Tag>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Dismiss tag' })).toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards className and native span props', () => {
        (0, react_1.render)(<index_ts_1.Tag className="is-custom" id="t1">Y</index_ts_1.Tag>);
        const container = react_1.screen.getByText('Y').closest('span.q-slot-bg-10');
        (0, vitest_1.expect)(container).toHaveClass('is-custom');
        (0, vitest_1.expect)(container).toHaveAttribute('id', 't1');
    });
    (0, vitest_1.it)('renders start before the label and end after it (before remove)', async () => {
        const onRemove = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Tag start={<span data-testid="lead"/>} end={<span data-testid="trail"/>} onRemove={onRemove}>
        Label
      </index_ts_1.Tag>);
        const lead = react_1.screen.getByTestId('lead');
        const label = react_1.screen.getByText('Label');
        const trail = react_1.screen.getByTestId('trail');
        const remove = react_1.screen.getByRole('button', { name: 'Remove' });
        // DOM order: start → label → end → remove
        (0, vitest_1.expect)(lead.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        (0, vitest_1.expect)(label.compareDocumentPosition(trail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        (0, vitest_1.expect)(trail.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    (0, vitest_1.it)('renders no slot wrappers when start/end are omitted (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Tag>Plain</index_ts_1.Tag>);
        const container = react_1.screen.getByText('Plain').closest('span.q-slot-bg-10');
        // only the truncating label span (no flanking slot spans, no remove button)
        (0, vitest_1.expect)(container.querySelectorAll(':scope > span')).toHaveLength(1);
        (0, vitest_1.expect)(container.querySelector('button')).toBeNull();
    });
});
//# sourceMappingURL=tag.test.js.map