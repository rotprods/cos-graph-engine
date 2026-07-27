"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Grid>', () => {
    (0, vitest_1.it)('renders the grid track with the base utility class', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid>cells</index_ts_1.Grid>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('q-grid');
        (0, vitest_1.expect)(root.tagName).toBe('DIV');
    });
    (0, vitest_1.it)('wires a fixed column count through the --q-grid-cols var (no autofit)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid cols={3}>x</index_ts_1.Grid>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root.style.getPropertyValue('--q-grid-cols')).toBe('3');
        (0, vitest_1.expect)(root).not.toHaveClass('q-grid-autofit');
        (0, vitest_1.expect)(root).not.toHaveClass('q-grid-autofill');
    });
    (0, vitest_1.it)('switches to an auto-fit track and sets --q-grid-min', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid cols="auto-fit" minColWidth="16rem">x</index_ts_1.Grid>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('q-grid-autofit');
        (0, vitest_1.expect)(root.style.getPropertyValue('--q-grid-min')).toBe('16rem');
        // auto tracks do not pin a fixed column count
        (0, vitest_1.expect)(root.style.getPropertyValue('--q-grid-cols')).toBe('');
    });
    (0, vitest_1.it)('uses auto-fill when requested', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid cols="auto-fill">x</index_ts_1.Grid>);
        (0, vitest_1.expect)(container.firstElementChild).toHaveClass('q-grid-autofill');
    });
    (0, vitest_1.it)('maps gap / flow / align / justify to native tailwind classes', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid gap={4} flow="dense" align="center" justify="stretch">x</index_ts_1.Grid>);
        (0, vitest_1.expect)(container.firstElementChild).toHaveClass('gap-4', 'grid-flow-row-dense', 'items-center', 'justify-items-stretch');
    });
    (0, vitest_1.it)('lets per-axis gap override the shared gap', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid gap={4} gapX={2}>x</index_ts_1.Grid>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('gap-x-2', 'gap-y-4');
        (0, vitest_1.expect)(root).not.toHaveClass('gap-4');
    });
    (0, vitest_1.it)('forwards className (caller wins / last) and native props', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Grid className="extra" data-testid="g" aria-label="gallery">x</index_ts_1.Grid>);
        const root = container.firstElementChild;
        (0, vitest_1.expect)(root).toHaveClass('q-grid', 'extra');
        (0, vitest_1.expect)(root).toHaveAttribute('aria-label', 'gallery');
        (0, vitest_1.expect)(root).toHaveAttribute('data-testid', 'g');
    });
    (0, vitest_1.it)('forwards ref to the root grid element', () => {
        let node = null;
        const { container } = (0, react_1.render)(<index_ts_1.Grid ref={(el) => { node = el; }}>x</index_ts_1.Grid>);
        (0, vitest_1.expect)(node).toBe(container.firstElementChild);
        (0, vitest_1.expect)(node).toHaveClass('q-grid');
    });
    (0, vitest_1.describe)('<Grid.Item>', () => {
        (0, vitest_1.it)('renders the cell hook class', () => {
            (0, react_1.render)(<index_ts_1.Grid.Item>cell</index_ts_1.Grid.Item>);
            (0, vitest_1.expect)(react_1.screen.getByText('cell')).toHaveClass('q-grid-item');
        });
        (0, vitest_1.it)('applies colSpan / rowSpan / colStart as inline grid placement', () => {
            (0, react_1.render)(<index_ts_1.Grid.Item colSpan={2} rowSpan={3} colStart={1}>cell</index_ts_1.Grid.Item>);
            const cell = react_1.screen.getByText('cell');
            (0, vitest_1.expect)(cell.style.gridColumn).toBe('span 2 / span 2');
            (0, vitest_1.expect)(cell.style.gridRow).toBe('span 3 / span 3');
            (0, vitest_1.expect)(cell.style.gridColumnStart).toBe('1');
        });
        (0, vitest_1.it)('omits placement styles when spans are unset', () => {
            (0, react_1.render)(<index_ts_1.Grid.Item>cell</index_ts_1.Grid.Item>);
            const cell = react_1.screen.getByText('cell');
            (0, vitest_1.expect)(cell.style.gridColumn).toBe('');
            (0, vitest_1.expect)(cell.style.gridRow).toBe('');
        });
        (0, vitest_1.it)('forwards ref + className on the item', () => {
            let node = null;
            (0, react_1.render)(<index_ts_1.Grid.Item className="tile" ref={(el) => { node = el; }}>cell</index_ts_1.Grid.Item>);
            (0, vitest_1.expect)(node).not.toBeNull();
            (0, vitest_1.expect)(node).toHaveClass('q-grid-item', 'tile');
        });
        (0, vitest_1.it)('exposes flipKey as data-flip-key (and omits it when unset)', () => {
            const { rerender } = (0, react_1.render)(<index_ts_1.Grid.Item flipKey="abc">cell</index_ts_1.Grid.Item>);
            (0, vitest_1.expect)(react_1.screen.getByText('cell')).toHaveAttribute('data-flip-key', 'abc');
            rerender(<index_ts_1.Grid.Item>cell</index_ts_1.Grid.Item>);
            (0, vitest_1.expect)(react_1.screen.getByText('cell')).not.toHaveAttribute('data-flip-key');
        });
    });
    (0, vitest_1.describe)('animate (FLIP)', () => {
        (0, vitest_1.it)('renders children and survives a reorder (FLIP no-ops without WAAPI in the test DOM)', () => {
            const { rerender } = (0, react_1.render)(<index_ts_1.Grid cols={3} animate data-testid="g">
          <index_ts_1.Grid.Item flipKey="a">A</index_ts_1.Grid.Item>
          <index_ts_1.Grid.Item flipKey="b">B</index_ts_1.Grid.Item>
        </index_ts_1.Grid>);
            (0, vitest_1.expect)(react_1.screen.getByText('A')).toHaveAttribute('data-flip-key', 'a');
            rerender(<index_ts_1.Grid cols={3} animate data-testid="g">
          <index_ts_1.Grid.Item flipKey="b">B</index_ts_1.Grid.Item>
          <index_ts_1.Grid.Item flipKey="a">A</index_ts_1.Grid.Item>
        </index_ts_1.Grid>);
            (0, vitest_1.expect)(react_1.screen.getByTestId('g')).toHaveClass('q-grid');
            (0, vitest_1.expect)(react_1.screen.getByText('A')).toBeInTheDocument();
            (0, vitest_1.expect)(react_1.screen.getByText('B')).toBeInTheDocument();
        });
    });
    (0, vitest_1.it)('composes into a real grid (track + spanning item)', () => {
        (0, react_1.render)(<index_ts_1.Grid cols={4} gap={3} data-testid="track">
        <index_ts_1.Grid.Item colSpan={2} data-testid="featured">featured</index_ts_1.Grid.Item>
        <index_ts_1.Grid.Item>a</index_ts_1.Grid.Item>
        <index_ts_1.Grid.Item>b</index_ts_1.Grid.Item>
      </index_ts_1.Grid>);
        const track = react_1.screen.getByTestId('track');
        (0, vitest_1.expect)(track).toHaveClass('q-grid', 'gap-3');
        (0, vitest_1.expect)(track.style.getPropertyValue('--q-grid-cols')).toBe('4');
        (0, vitest_1.expect)(react_1.screen.getByTestId('featured').style.gridColumn).toBe('span 2 / span 2');
    });
});
//# sourceMappingURL=grid.test.js.map