"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const react_2 = require("react");
const IconPlusMediumOutlined_1 = require("@higgsfield-ai/icons/IconPlusMediumOutlined");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('button() class-builder', () => {
    (0, vitest_1.it)('defaults to primary + sm', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)()).toBe('q-button q-button-primary q-button-sm');
    });
    (0, vitest_1.it)('applies variant + size', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'danger', size: 'lg' })).toBe('q-button q-button-danger q-button-lg');
    });
    (0, vitest_1.it)('adds icon-only and extra classes, dropping falsy', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ iconOnly: true }, 'w-full', false)).toBe('q-button q-button-primary q-button-sm q-button-icon-only w-full');
    });
    (0, vitest_1.it)('kebab-cases camelCase variants (dangerSoft → danger-soft)', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'dangerSoft' })).toBe('q-button q-button-danger-soft q-button-sm');
    });
    (0, vitest_1.it)('includes marketing variants and the lg size', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'marketingPrimary', size: 'lg' })).toBe('q-button q-button-marketing-primary q-button-lg');
    });
    (0, vitest_1.it)('clamps marketing primary/secondary xxs up to xs', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'marketingPrimary', size: 'xxs' })).toBe('q-button q-button-marketing-primary q-button-xs');
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'marketingSecondary', size: 'xxs' })).toBe('q-button q-button-marketing-secondary q-button-xs');
    });
    (0, vitest_1.it)('keeps xxs for default and marketing glass variants', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'primary', size: 'xxs' })).toBe('q-button q-button-primary q-button-xxs');
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'marketingTertiary', size: 'xxs' })).toBe('q-button q-button-marketing-tertiary q-button-xxs');
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'marketingGhost', size: 'xxs' })).toBe('q-button q-button-marketing-ghost q-button-xxs');
    });
    (0, vitest_1.it)('includes special variants', () => {
        (0, vitest_1.expect)((0, index_ts_1.button)({ variant: 'specialPink' })).toBe('q-button q-button-special-pink q-button-sm');
    });
});
(0, vitest_1.describe)('<Button>', () => {
    (0, vitest_1.it)('renders a <button type="button"> with the classes', () => {
        (0, react_1.render)(<index_ts_1.Button variant="secondary" size="sm">Go</index_ts_1.Button>);
        const btn = react_1.screen.getByRole('button', { name: 'Go' });
        (0, vitest_1.expect)(btn.tagName).toBe('BUTTON');
        (0, vitest_1.expect)(btn).toHaveAttribute('type', 'button');
        (0, vitest_1.expect)(btn).toHaveClass('q-button', 'q-button-secondary', 'q-button-sm');
    });
    (0, vitest_1.it)('merges caller className and forwards native props', () => {
        (0, react_1.render)(<index_ts_1.Button className="w-full" disabled>Go</index_ts_1.Button>);
        const btn = react_1.screen.getByRole('button', { name: 'Go' });
        (0, vitest_1.expect)(btn).toHaveClass('q-button', 'w-full');
        (0, vitest_1.expect)(btn).toBeDisabled();
    });
    (0, vitest_1.it)('renders as a link via `as` (no type attribute)', () => {
        (0, react_1.render)(<index_ts_1.Button as="a" href="/go" variant="ghost">Go</index_ts_1.Button>);
        const link = react_1.screen.getByRole('link', { name: 'Go' });
        (0, vitest_1.expect)(link.tagName).toBe('A');
        (0, vitest_1.expect)(link).toHaveAttribute('href', '/go');
        (0, vitest_1.expect)(link).not.toHaveAttribute('type');
        (0, vitest_1.expect)(link).toHaveClass('q-button', 'q-button-ghost');
    });
    (0, vitest_1.it)('applies icon-only', () => {
        (0, react_1.render)(<index_ts_1.Button iconOnly aria-label="Add"><IconPlusMediumOutlined_1.IconPlusMediumOutlined /></index_ts_1.Button>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Add' })).toHaveClass('q-button-icon-only');
    });
    (0, vitest_1.it)('renders marketing variants', () => {
        (0, react_1.render)(<index_ts_1.Button variant="marketingTertiary" size="lg">Go</index_ts_1.Button>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Go' })).toHaveClass('q-button', 'q-button-marketing-tertiary', 'q-button-lg');
    });
    (0, vitest_1.it)('renders special variants', () => {
        (0, react_1.render)(<index_ts_1.Button variant="specialBrand">Generate</index_ts_1.Button>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Generate' })).toHaveClass('q-button', 'q-button-special-brand', 'q-button-sm');
    });
    (0, vitest_1.it)('composes start / end slots around the label, in order', () => {
        (0, react_1.render)(<index_ts_1.Button start={<IconPlusMediumOutlined_1.IconPlusMediumOutlined data-testid="lead"/>} end={<span data-testid="trail">⌘K</span>}>
        Search
      </index_ts_1.Button>);
        const btn = react_1.screen.getByRole('button', { name: /search/i });
        (0, vitest_1.expect)(btn).toHaveTextContent('Search');
        (0, vitest_1.expect)(react_1.screen.getByTestId('lead')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('trail')).toBeInTheDocument();
        (0, vitest_1.expect)(btn.querySelector('.q-button-label-frame')).toHaveTextContent('Search');
        // start precedes the label which precedes end
        const order = btn.textContent ?? '';
        (0, vitest_1.expect)(btn.querySelector('[data-testid="trail"]')).toBeInTheDocument();
        (0, vitest_1.expect)(order.indexOf('Search')).toBeGreaterThanOrEqual(0);
    });
    (0, vitest_1.it)('renders only the label when no slots are passed (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Button>Save</index_ts_1.Button>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Save' })).toHaveTextContent('Save');
    });
    (0, vitest_1.it)('lets the caller override the default type', () => {
        (0, react_1.render)(<index_ts_1.Button type="submit">Go</index_ts_1.Button>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'submit');
    });
    (0, vitest_1.it)('forwards a ref to the underlying button', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Button ref={ref}>Go</index_ts_1.Button>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
    (0, vitest_1.it)('forwards a ref to the polymorphic element', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Button as="a" href="/go" ref={ref}>Go</index_ts_1.Button>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLAnchorElement);
    });
});
(0, vitest_1.describe)('<Button asChild>', () => {
    (0, vitest_1.it)('merges styling onto the child without adding a wrapper', () => {
        (0, react_1.render)(<index_ts_1.Button asChild variant="ghost" size="sm">
        <a href="/go">Go</a>
      </index_ts_1.Button>);
        const link = react_1.screen.getByRole('link', { name: 'Go' });
        (0, vitest_1.expect)(link.tagName).toBe('A');
        (0, vitest_1.expect)(link).toHaveAttribute('href', '/go');
        (0, vitest_1.expect)(link).toHaveClass('q-button', 'q-button-ghost', 'q-button-sm');
        // no implicit type="button" leaks onto a non-button child
        (0, vitest_1.expect)(link).not.toHaveAttribute('type');
        // Slot renders the child in place — no surrounding <button>
        (0, vitest_1.expect)(react_1.screen.queryByRole('button')).toBeNull();
    });
    (0, vitest_1.it)('forwards a ref through the slot to the child', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Button asChild ref={ref}>
        <index_ts_1.button>Go</index_ts_1.button>
      </index_ts_1.Button>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
});
//# sourceMappingURL=button.test.js.map