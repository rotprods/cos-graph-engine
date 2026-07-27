"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Dot>', () => {
    (0, vitest_1.it)('defaults to a green medium dot with a thick glass ring', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Dot />);
        const dot = container.querySelector('span');
        (0, vitest_1.expect)(dot).toHaveClass('rounded-q-full', 'box-content', 'size-q-200', 'border-q-thick', 'bg-q-palette-mint-bg', 'border-q-background-glass', 'q-dot');
    });
    (0, vitest_1.it)('maps the Figma size ramp to fill box + outer stroke width', () => {
        const xs = (0, react_1.render)(<index_ts_1.Dot size="xs"/>);
        (0, vitest_1.expect)(xs.container.querySelector('span')).toHaveClass('size-q-100', 'border-q-medium', 'border-q-transparent-light-05');
        xs.unmount();
        const sm = (0, react_1.render)(<index_ts_1.Dot size="sm"/>);
        (0, vitest_1.expect)(sm.container.querySelector('span')).toHaveClass('size-q-150', 'border-q-medium', 'border-q-background-glass');
        sm.unmount();
        const md = (0, react_1.render)(<index_ts_1.Dot size="md"/>);
        (0, vitest_1.expect)(md.container.querySelector('span')).toHaveClass('size-q-200', 'border-q-thick', 'border-q-background-glass');
    });
    (0, vitest_1.it)('uses the exact Figma border color for every color and size variant', () => {
        const colors = ['green', 'yellow', 'red', 'grey'];
        const sizes = ['md', 'sm', 'xs'];
        for (const color of colors) {
            for (const size of sizes) {
                const { container, unmount } = (0, react_1.render)(<index_ts_1.Dot color={color} size={size}/>);
                const expected = color === 'green' && size === 'xs'
                    ? 'border-q-transparent-light-05'
                    : 'border-q-background-glass';
                (0, vitest_1.expect)(container.querySelector('span')).toHaveClass(expected);
                unmount();
            }
        }
    });
    (0, vitest_1.it)('paints each presence colour with its Figma palette token', () => {
        const cases = [
            ['green', 'bg-q-palette-mint-bg'],
            ['yellow', 'bg-q-brand-yellow'],
            ['red', 'bg-q-palette-pink-bg'],
            ['grey', 'bg-q-icon-secondary'],
        ];
        for (const [color, fill] of cases) {
            const { container, unmount } = (0, react_1.render)(<index_ts_1.Dot color={color}/>);
            (0, vitest_1.expect)(container.querySelector('span')).toHaveClass(fill);
            unmount();
        }
    });
    (0, vitest_1.it)('exposes an accessible image when a label is given', () => {
        (0, react_1.render)(<index_ts_1.Dot color="red" size="sm" label="busy"/>);
        const dot = react_1.screen.getByRole('img', { name: 'busy' });
        (0, vitest_1.expect)(dot).toHaveClass('size-q-150', 'border-q-medium', 'bg-q-palette-pink-bg');
    });
    (0, vitest_1.it)('is hidden from assistive tech when unlabelled', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Dot />);
        const dot = container.querySelector('span');
        (0, vitest_1.expect)(dot).toHaveAttribute('aria-hidden', 'true');
        (0, vitest_1.expect)(react_1.screen.queryByRole('img')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards className and native span props', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Dot className="is-custom" title="Presence"/>);
        const dot = container.querySelector('span');
        (0, vitest_1.expect)(dot).toHaveClass('is-custom', 'rounded-q-full');
        (0, vitest_1.expect)(dot).toHaveAttribute('title', 'Presence');
    });
    (0, vitest_1.it)('is static (no animation classes) by default', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Dot />);
        const dot = container.querySelector('span');
        (0, vitest_1.expect)(dot).not.toHaveClass('q-dot-pulse', 'q-dot-glow');
        // no ink (currentColor) class when not animating
        (0, vitest_1.expect)(dot).not.toHaveClass('text-q-palette-mint-bg');
    });
    (0, vitest_1.it)('opts into pulse / glow and inherits the fill colour for the effect', () => {
        const pulse = (0, react_1.render)(<index_ts_1.Dot animation="pulse"/>);
        // green default → fill + matching ink so the rings/halo use currentColor
        (0, vitest_1.expect)(pulse.container.querySelector('span')).toHaveClass('q-dot-pulse', 'text-q-palette-mint-bg');
        pulse.unmount();
        const glow = (0, react_1.render)(<index_ts_1.Dot color="red" animation="glow"/>);
        (0, vitest_1.expect)(glow.container.querySelector('span')).toHaveClass('q-dot-glow', 'text-q-palette-pink-bg');
    });
});
//# sourceMappingURL=dot.test.js.map