"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const react_2 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
/**
 * A minimal stand-in glyph that mirrors how @higgsfield-ai/icons render: it
 * spreads incoming props onto the <svg> last. Unlike the real package glyphs it
 * also forwards `ref` to the svg, so the ref-forwarding test exercises a glyph
 * that is capable of receiving it.
 */
function Glyph({ ref, ...props }) {
    return (<svg ref={ref} viewBox="0 0 24 24" width={24} height={24} {...props}>
      <path stroke="currentColor" d="M5 13.875 9.2 18 19 7"/>
    </svg>);
}
(0, vitest_1.describe)('<Icon>', () => {
    (0, vitest_1.it)('renders the glyph itself as the single element (no wrapper) — default md, decorative', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon as={Glyph}/>);
        const svg = container.querySelector('svg');
        // the svg IS the root: no wrapping span around it
        (0, vitest_1.expect)(container.firstElementChild).toBe(svg);
        (0, vitest_1.expect)(svg).toHaveClass('q-icon', 'q-icon-md');
        (0, vitest_1.expect)(svg).toHaveAttribute('aria-hidden', 'true');
    });
    (0, vitest_1.it)('renders the glyph passed as children, painting q-icon onto its svg', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon><Glyph /></index_ts_1.Icon>);
        const svg = container.querySelector('svg');
        (0, vitest_1.expect)(container.firstElementChild).toBe(svg);
        (0, vitest_1.expect)(svg).toHaveClass('q-icon', 'q-icon-md');
    });
    (0, vitest_1.it)('maps each size to its token utility class on the svg', () => {
        const cases = [
            ['xs', 'q-icon-xs'],
            ['sm', 'q-icon-sm'],
            ['md', 'q-icon-md'],
            ['lg', 'q-icon-lg'],
            ['xl', 'q-icon-xl'],
        ];
        for (const [size, cls] of cases) {
            const { container, unmount } = (0, react_2.render)(<index_ts_1.Icon as={Glyph} size={size}/>);
            (0, vitest_1.expect)(container.querySelector('svg')).toHaveClass('q-icon', cls);
            unmount();
        }
    });
    (0, vitest_1.it)('inherits currentColor by default (no color utility)', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon as={Glyph}/>);
        (0, vitest_1.expect)(container.querySelector('svg')?.getAttribute('class')).not.toMatch(/text-q-icon-/);
    });
    (0, vitest_1.it)('applies a quanta icon color token when color is set', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon as={Glyph} color="brand"/>);
        (0, vitest_1.expect)(container.querySelector('svg')).toHaveClass('text-q-icon-brand');
    });
    (0, vitest_1.it)('exposes an accessible image when a label is given', () => {
        (0, react_2.render)(<index_ts_1.Icon as={Glyph} label="Search"/>);
        const img = react_2.screen.getByRole('img', { name: 'Search' });
        (0, vitest_1.expect)(img.tagName.toLowerCase()).toBe('svg');
        (0, vitest_1.expect)(img).toHaveClass('q-icon');
        (0, vitest_1.expect)(img).not.toHaveAttribute('aria-hidden');
    });
    (0, vitest_1.it)('is hidden from assistive tech when unlabelled', () => {
        (0, react_2.render)(<index_ts_1.Icon as={Glyph}/>);
        (0, vitest_1.expect)(react_2.screen.queryByRole('img')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards ref to the glyph svg', () => {
        const ref = (0, react_1.createRef)();
        (0, react_2.render)(<index_ts_1.Icon as={Glyph} ref={ref}/>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(SVGSVGElement);
        (0, vitest_1.expect)(ref.current).toHaveClass('q-icon');
    });
    (0, vitest_1.it)('forwards className last (caller wins ordering) onto the svg', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon as={Glyph} className="is-custom"/>);
        const svg = container.querySelector('svg');
        (0, vitest_1.expect)(svg).toHaveClass('q-icon', 'q-icon-md', 'is-custom');
        (0, vitest_1.expect)(svg?.getAttribute('class')?.trim().endsWith('is-custom')).toBe(true);
    });
    (0, vitest_1.it)('`as` wins when both `as` and `children` are supplied', () => {
        const { container } = (0, react_2.render)(<index_ts_1.Icon as={Glyph}><svg data-testid="child-svg"/></index_ts_1.Icon>);
        (0, vitest_1.expect)(container.querySelectorAll('svg')).toHaveLength(1);
        (0, vitest_1.expect)(container.querySelector('[data-testid="child-svg"]')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('recipe `icon()` returns the composite class string', () => {
        (0, vitest_1.expect)((0, index_ts_1.icon)()).toBe('q-icon q-icon-md');
        (0, vitest_1.expect)((0, index_ts_1.icon)({ size: 'lg', color: 'success' })).toBe('q-icon q-icon-lg text-q-icon-success');
        (0, vitest_1.expect)((0, index_ts_1.icon)({ size: 'xs' }, 'extra')).toBe('q-icon q-icon-xs extra');
    });
});
//# sourceMappingURL=icon.test.js.map