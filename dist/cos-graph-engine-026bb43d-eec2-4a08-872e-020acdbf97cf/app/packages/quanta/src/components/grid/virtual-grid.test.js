"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
const ITEMS = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `item-${i}` }));
function renderCell(p) {
    return <span data-testid="cell">{p.label}</span>;
}
(0, vitest_1.describe)('<VirtualGrid>', () => {
    (0, vitest_1.it)('renders the viewport, the full-height sizer, and the grid track', () => {
        const { container } = (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS} cols={2} rowHeight={100} getKey={p => p.id} renderItem={renderCell}/>);
        (0, vitest_1.expect)(container.querySelector('.q-virtual-grid')).not.toBeNull();
        const sizer = container.querySelector('.q-virtual-grid-sizer');
        (0, vitest_1.expect)(sizer).not.toBeNull();
        // 100 items / 2 cols = 50 rows → the sizer reserves the full scroll height.
        (0, vitest_1.expect)(Number.parseInt(sizer.style.height, 10)).toBeGreaterThan(1000);
        (0, vitest_1.expect)(container.querySelector('.q-grid.q-virtual-grid-track')).not.toBeNull();
    });
    (0, vitest_1.it)('mounts only a windowed subset, not the whole list', () => {
        (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS} cols={2} rowHeight={100} getKey={p => p.id} renderItem={renderCell}/>);
        const cells = react_1.screen.getAllByTestId('cell');
        (0, vitest_1.expect)(cells.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(cells.length).toBeLessThan(ITEMS.length);
        (0, vitest_1.expect)(react_1.screen.getByText('item-0')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('item-99')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('pins the fixed column count and the uniform row height on the track', () => {
        const { container } = (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS} cols={3} rowHeight={120} renderItem={renderCell}/>);
        const track = container.querySelector('.q-virtual-grid-track');
        (0, vitest_1.expect)(track.style.getPropertyValue('--q-grid-cols')).toBe('3');
        (0, vitest_1.expect)(track.style.gridAutoRows).toBe('120px');
    });
    (0, vitest_1.it)('wraps each visible item in a q-grid-item and applies the gap class', () => {
        const { container } = (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS.slice(0, 6)} cols={2} rowHeight={100} gap={6} renderItem={renderCell}/>);
        (0, vitest_1.expect)(container.querySelectorAll('.q-grid-item').length).toBeGreaterThan(0);
        (0, vitest_1.expect)(container.querySelector('.q-virtual-grid-track')).toHaveClass('gap-6');
    });
    (0, vitest_1.it)('falls back to the index key without getKey', () => {
        (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS.slice(0, 3)} cols={1} rowHeight={80} renderItem={renderCell}/>);
        (0, vitest_1.expect)(react_1.screen.getByText('item-0')).toBeInTheDocument();
    });
    (0, vitest_1.it)('passes an isScrolling meta to renderItem (false at rest, so content loads)', () => {
        const seen = [];
        (0, react_1.render)(<index_ts_1.VirtualGrid items={ITEMS.slice(0, 4)} cols={2} rowHeight={100} renderItem={(p, _i, meta) => {
                seen.push(meta.isScrolling);
                return <span data-testid="cell">{p.label}</span>;
            }}/>);
        (0, vitest_1.expect)(seen.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(seen.every(v => v === false)).toBe(true);
    });
});
//# sourceMappingURL=virtual-grid.test.js.map