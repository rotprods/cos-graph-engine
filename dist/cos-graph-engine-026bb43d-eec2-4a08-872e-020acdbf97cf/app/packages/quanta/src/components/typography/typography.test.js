"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Typography>', () => {
    (0, vitest_1.it)('defaults to a <p> with the body-md-regular composite utility', () => {
        (0, react_1.render)(<index_ts_1.Typography>Hello</index_ts_1.Typography>);
        const el = react_1.screen.getByText('Hello');
        (0, vitest_1.expect)(el.tagName).toBe('P');
        (0, vitest_1.expect)(el).toHaveClass('text-q-body-md-regular');
    });
    (0, vitest_1.it)('applies the matching text-q-* utility for a given variant', () => {
        (0, react_1.render)(<index_ts_1.Typography variant="headline-lg-semi-bold">Title</index_ts_1.Typography>);
        (0, vitest_1.expect)(react_1.screen.getByText('Title')).toHaveClass('text-q-headline-lg-semi-bold');
    });
    (0, vitest_1.it)('renders the element named by `as`', () => {
        (0, react_1.render)(<index_ts_1.Typography as="h1" variant="display-lg-bold">Big</index_ts_1.Typography>);
        const el = react_1.screen.getByText('Big');
        (0, vitest_1.expect)(el.tagName).toBe('H1');
        (0, vitest_1.expect)(el).toHaveClass('text-q-display-lg-bold');
    });
    (0, vitest_1.it)('maps color to the semantic text-q-text-* utility', () => {
        (0, react_1.render)(<index_ts_1.Typography color="secondary">Muted</index_ts_1.Typography>);
        (0, vitest_1.expect)(react_1.screen.getByText('Muted')).toHaveClass('text-q-text-secondary');
    });
    (0, vitest_1.it)('omits a colour class when color is not set (inherits)', () => {
        (0, react_1.render)(<index_ts_1.Typography>Inherit</index_ts_1.Typography>);
        const cls = react_1.screen.getByText('Inherit').className;
        (0, vitest_1.expect)(cls).not.toMatch(/text-q-text-/);
    });
    (0, vitest_1.it)('adds the truncate utility when truncate is set', () => {
        (0, react_1.render)(<index_ts_1.Typography truncate>Long text</index_ts_1.Typography>);
        (0, vitest_1.expect)(react_1.screen.getByText('Long text')).toHaveClass('truncate');
    });
    (0, vitest_1.it)('does not truncate by default', () => {
        (0, react_1.render)(<index_ts_1.Typography>Plain</index_ts_1.Typography>);
        (0, vitest_1.expect)(react_1.screen.getByText('Plain')).not.toHaveClass('truncate');
    });
    (0, vitest_1.it)('applies the caller className last so it wins ordering', () => {
        (0, react_1.render)(<index_ts_1.Typography className="is-custom">Custom</index_ts_1.Typography>);
        const el = react_1.screen.getByText('Custom');
        (0, vitest_1.expect)(el).toHaveClass('text-q-body-md-regular', 'is-custom');
        (0, vitest_1.expect)(el.className.trim().endsWith('is-custom')).toBe(true);
    });
    (0, vitest_1.it)('forwards native props to the rendered element', () => {
        (0, react_1.render)(<index_ts_1.Typography as="span" title="tip" data-testid="t">x</index_ts_1.Typography>);
        const el = react_1.screen.getByTestId('t');
        (0, vitest_1.expect)(el.tagName).toBe('SPAN');
        (0, vitest_1.expect)(el).toHaveAttribute('title', 'tip');
    });
    (0, vitest_1.describe)('typography() recipe', () => {
        (0, vitest_1.it)('returns the default body-md-regular class', () => {
            (0, vitest_1.expect)((0, index_ts_1.typography)()).toBe('text-q-body-md-regular');
        });
        (0, vitest_1.it)('composes variant + color + truncate + extra in order', () => {
            (0, vitest_1.expect)((0, index_ts_1.typography)({ variant: 'label-md-semi-bold', color: 'brand', truncate: true }, 'extra')).toBe('text-q-label-md-semi-bold text-q-text-brand truncate extra');
        });
    });
});
//# sourceMappingURL=typography.test.js.map