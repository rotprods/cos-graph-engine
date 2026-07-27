"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<NotFound>', () => {
    (0, vitest_1.it)('renders icon, title and subtitle slots through Typography (md composite + color)', () => {
        (0, react_1.render)(<index_ts_1.NotFound icon={<span data-testid="icon">x</span>} title="No matches" subtitle="Refine your query"/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('icon')).toBeInTheDocument();
        // title → caption-sm-medium / secondary, subtitle → caption-sm-regular / tertiary (md)
        (0, vitest_1.expect)(react_1.screen.getByText('No matches')).toHaveClass('text-q-caption-sm-medium', 'text-q-text-secondary');
        (0, vitest_1.expect)(react_1.screen.getByText('Refine your query')).toHaveClass('text-q-caption-sm-regular', 'text-q-text-tertiary');
    });
    (0, vitest_1.it)('steps the title / subtitle composite by size (lg → body-sm)', () => {
        (0, react_1.render)(<index_ts_1.NotFound size="lg" title="Big title" subtitle="Big subtitle"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('Big title')).toHaveClass('text-q-body-sm-medium', 'text-q-text-secondary');
        (0, vitest_1.expect)(react_1.screen.getByText('Big subtitle')).toHaveClass('text-q-body-sm-regular', 'text-q-text-tertiary');
    });
    (0, vitest_1.it)('wraps the icon in the glass tile', () => {
        (0, react_1.render)(<index_ts_1.NotFound icon={<span data-testid="i">i</span>} title="T"/>);
        const tile = react_1.screen.getByTestId('i').closest('.q-not-found-icon');
        (0, vitest_1.expect)(tile).toBeInTheDocument();
    });
    (0, vitest_1.it)('omits the text column entirely when neither title nor subtitle is given', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound icon={<span>i</span>}/>);
        (0, vitest_1.expect)(container.querySelector('.q-not-found-text')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('omits the icon tile when no icon is given', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound title="Only title"/>);
        (0, vitest_1.expect)(container.querySelector('.q-not-found-icon')).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('Only title')).toBeInTheDocument();
    });
    (0, vitest_1.it)('accepts ReactNode title / subtitle (not just strings)', () => {
        (0, react_1.render)(<index_ts_1.NotFound title={<strong data-testid="rich-title">Rich</strong>} subtitle={<em data-testid="rich-sub">sub</em>}/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('rich-title')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('rich-sub')).toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards className and native div props onto the root', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound className="is-custom" id="empty" title="T"/>);
        const root = container.querySelector('.q-not-found');
        (0, vitest_1.expect)(root).toHaveClass('is-custom');
        (0, vitest_1.expect)(root).toHaveAttribute('id', 'empty');
    });
    (0, vitest_1.it)('defaults to the md size and plain variant', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound title="T"/>);
        const root = container.querySelector('.q-not-found');
        (0, vitest_1.expect)(root).toHaveClass('q-not-found-md', 'q-not-found-plain');
    });
    (0, vitest_1.it)('applies the requested size and variant classes', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound title="T" size="lg" variant="card"/>);
        const root = container.querySelector('.q-not-found');
        (0, vitest_1.expect)(root).toHaveClass('q-not-found-lg', 'q-not-found-card');
        (0, vitest_1.expect)(root).not.toHaveClass('q-not-found-md', 'q-not-found-plain');
    });
    (0, vitest_1.it)('renders the actions slot in its own row', () => {
        (0, react_1.render)(<index_ts_1.NotFound title="T" actions={<button type="button">Clear filters</button>}/>);
        const cta = react_1.screen.getByRole('button', { name: 'Clear filters' });
        (0, vitest_1.expect)(cta.closest('.q-not-found-actions')).toBeInTheDocument();
    });
    (0, vitest_1.it)('omits the actions row when no actions are given (back-compat)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.NotFound icon={<span>i</span>} title="T" subtitle="S"/>);
        (0, vitest_1.expect)(container.querySelector('.q-not-found-actions')).not.toBeInTheDocument();
        // default host element is still a <div>, byte-for-byte with the old markup
        (0, vitest_1.expect)(container.querySelector('.q-not-found').tagName).toBe('DIV');
    });
    (0, vitest_1.it)('forwards ref to the root DOM node', () => {
        let node = null;
        (0, react_1.render)(<index_ts_1.NotFound ref={el => { node = el; }} title="T"/>);
        (0, vitest_1.expect)(node).not.toBeNull();
        (0, vitest_1.expect)(node).toHaveClass('q-not-found');
    });
    (0, vitest_1.it)('forwards ref to the swapped host element via render', () => {
        let node = null;
        (0, react_1.render)(<index_ts_1.NotFound ref={el => { node = el; }} render={<button type="button"/>} title="T"/>);
        (0, vitest_1.expect)(node).not.toBeNull();
        (0, vitest_1.expect)(node.tagName).toBe('BUTTON');
        (0, vitest_1.expect)(node).toHaveClass('q-not-found');
    });
    (0, vitest_1.it)('swaps the host element via render, keeping the surface classes', () => {
        (0, react_1.render)(<index_ts_1.NotFound render={<button type="button" data-testid="dz"/>} variant="outline" title="Drop files"/>);
        const dz = react_1.screen.getByTestId('dz');
        (0, vitest_1.expect)(dz.tagName).toBe('BUTTON');
        (0, vitest_1.expect)(dz).toHaveClass('q-not-found', 'q-not-found-outline');
        (0, vitest_1.expect)(react_1.screen.getByText('Drop files')).toHaveClass('text-q-caption-sm-medium');
    });
});
//# sourceMappingURL=not-found.test.js.map