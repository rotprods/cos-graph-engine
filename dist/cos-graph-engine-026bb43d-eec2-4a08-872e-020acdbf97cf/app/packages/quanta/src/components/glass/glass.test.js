"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const react_2 = require("react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('Glass', () => {
    (0, vitest_1.it)('renders children inside the glass surface', () => {
        (0, react_1.render)(<index_ts_1.Glass>Frosted</index_ts_1.Glass>);
        const surface = react_1.screen.getByText('Frosted');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass');
    });
    (0, vitest_1.it)('applies the default blur / elevation / rounded classes', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass', 'q-glass-blur-md', 'q-glass-rounded-600');
        (0, vitest_1.expect)(surface).not.toHaveClass('q-glass-raised');
    });
    (0, vitest_1.it)('maps blur / elevation / rounded props to their utility classes', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g" blur="lg" elevation="raised" rounded="300">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass-blur-lg', 'q-glass-raised', 'q-glass-rounded-300');
    });
    (0, vitest_1.it)('opts into the interactive treatment', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g" interactive>x</index_ts_1.Glass>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('g')).toHaveClass('q-glass-interactive');
    });
    (0, vitest_1.it)('applies a tint via the slot system (class + --q-tint var)', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g" tint="brand">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass-tinted');
        (0, vitest_1.expect)(surface.style.getPropertyValue('--q-tint')).not.toBe('');
    });
    (0, vitest_1.it)('does not set the tint class or var when no tint is given', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface).not.toHaveClass('q-glass-tinted');
        (0, vitest_1.expect)(surface.style.getPropertyValue('--q-tint')).toBe('');
    });
    (0, vitest_1.it)('keeps the caller className last and forwards arbitrary props', () => {
        (0, react_1.render)(<index_ts_1.Glass data-testid="g" className="custom" aria-label="panel">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass', 'custom');
        (0, vitest_1.expect)(surface).toHaveAttribute('aria-label', 'panel');
    });
    (0, vitest_1.it)('swaps the host element via render while keeping the surface', () => {
        (0, react_1.render)(<index_ts_1.Glass render={<article />} data-testid="g">x</index_ts_1.Glass>);
        const surface = react_1.screen.getByTestId('g');
        (0, vitest_1.expect)(surface.tagName).toBe('ARTICLE');
        (0, vitest_1.expect)(surface).toHaveClass('q-glass');
    });
    (0, vitest_1.it)('forwards a click on an interactive render host', async () => {
        const user = user_event_1.default.setup();
        const onClick = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Glass render={<button type="button"/>} interactive onClick={onClick}>Press</index_ts_1.Glass>);
        await user.click(react_1.screen.getByRole('button', { name: 'Press' }));
        (0, vitest_1.expect)(onClick).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('forwards a ref to the root element', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Glass ref={ref} data-testid="g">x</index_ts_1.Glass>);
        (0, vitest_1.expect)(ref.current).toBe(react_1.screen.getByTestId('g'));
    });
});
(0, vitest_1.describe)('glass() recipe', () => {
    (0, vitest_1.it)('builds the default class string', () => {
        (0, vitest_1.expect)((0, index_ts_1.glass)()).toBe('q-glass q-glass-blur-md q-glass-rounded-600');
    });
    (0, vitest_1.it)('reflects options and appends extra classes', () => {
        (0, vitest_1.expect)((0, index_ts_1.glass)({ blur: 'sm', elevation: 'raised', rounded: 'full', interactive: true }, 'extra')).toBe('q-glass q-glass-blur-sm q-glass-raised q-glass-rounded-full q-glass-interactive extra');
    });
});
//# sourceMappingURL=glass.test.js.map