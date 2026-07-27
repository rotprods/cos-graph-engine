"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Card>', () => {
    (0, vitest_1.it)('renders the glass surface by default', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Card>content</index_ts_1.Card>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('q-card');
        (0, vitest_1.expect)(root).not.toHaveClass('q-card-solid');
        (0, vitest_1.expect)(root).not.toHaveClass('q-card-raised');
    });
    (0, vitest_1.it)('applies surface + elevation variants', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Card surface="solid" elevation="raised">x</index_ts_1.Card>);
        (0, vitest_1.expect)(container.firstElementChild).toHaveClass('q-card', 'q-card-solid', 'q-card-raised');
    });
    (0, vitest_1.it)('composes Header (title/description/actions), Body and Footer', () => {
        (0, react_1.render)(<index_ts_1.Card>
        <index_ts_1.Card.Header title="Share" description="Anyone with the link" actions={<button>Done</button>}/>
        <index_ts_1.Card.Body>Body text</index_ts_1.Card.Body>
        <index_ts_1.Card.Footer>Footer text</index_ts_1.Card.Footer>
      </index_ts_1.Card>);
        // Title / Description render through Typography (composite + color) while
        // keeping their q-card-* class, on the original <div> tag.
        const title = react_1.screen.getByText('Share');
        (0, vitest_1.expect)(title.tagName).toBe('DIV');
        (0, vitest_1.expect)(title).toHaveClass('q-card-title', 'text-q-body-md-semi-bold', 'text-q-text-primary');
        const description = react_1.screen.getByText('Anyone with the link');
        (0, vitest_1.expect)(description).toHaveClass('q-card-description', 'text-q-body-sm-regular', 'text-q-text-secondary');
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Done' }).closest('.q-card-actions')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('Body text')).toHaveClass('q-card-body');
        (0, vitest_1.expect)(react_1.screen.getByText('Footer text')).toHaveClass('q-card-footer');
    });
    (0, vitest_1.it)('forwards className + native div props', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Card className="extra" data-testid="c" aria-label="panel">x</index_ts_1.Card>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('q-card', 'extra');
        (0, vitest_1.expect)(root).toHaveAttribute('aria-label', 'panel');
    });
    (0, vitest_1.it)('defaults the root to a <div> (back-compat)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Card>x</index_ts_1.Card>);
        (0, vitest_1.expect)(container.firstElementChild?.tagName).toBe('DIV');
    });
    (0, vitest_1.it)('forwards ref to the root surface element', () => {
        let node = null;
        const { container } = (0, react_1.render)(<index_ts_1.Card ref={(el) => { node = el; }}>x</index_ts_1.Card>);
        (0, vitest_1.expect)(node).toBe(container.firstElementChild);
        (0, vitest_1.expect)(node).toHaveClass('q-card');
    });
    (0, vitest_1.it)('forwards ref to the swapped `render` element', () => {
        let node = null;
        (0, react_1.render)(<index_ts_1.Card render={<a href="/p" ref={(el) => { node = el; }}/>}>Open</index_ts_1.Card>);
        (0, vitest_1.expect)(node).not.toBeNull();
        (0, vitest_1.expect)(node.tagName).toBe('A');
        (0, vitest_1.expect)(node).toHaveClass('q-card');
    });
    (0, vitest_1.it)('swaps the host element via `render`, keeping the surface class', () => {
        (0, react_1.render)(<index_ts_1.Card render={<a href="/p"/>}>Open</index_ts_1.Card>);
        const link = react_1.screen.getByRole('link', { name: 'Open' });
        (0, vitest_1.expect)(link.tagName).toBe('A');
        (0, vitest_1.expect)(link).toHaveClass('q-card');
        (0, vitest_1.expect)(link).toHaveAttribute('href', '/p');
    });
    (0, vitest_1.it)('`card()` builds the surface class string for any element', () => {
        (0, vitest_1.expect)((0, index_ts_1.card)()).toBe('q-card');
        (0, vitest_1.expect)((0, index_ts_1.card)({ surface: 'solid', elevation: 'raised' })).toBe('q-card q-card-solid q-card-raised');
        (0, vitest_1.expect)((0, index_ts_1.card)({}, 'mt-4')).toBe('q-card mt-4');
    });
});
//# sourceMappingURL=card.test.js.map