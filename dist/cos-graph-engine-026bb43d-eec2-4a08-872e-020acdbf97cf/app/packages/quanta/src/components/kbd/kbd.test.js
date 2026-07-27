"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Kbd>', () => {
    (0, vitest_1.it)('renders a semantic <kbd> as the Figma _Shortcut pill (single size, token styles)', () => {
        (0, react_1.render)(<index_ts_1.Kbd>K</index_ts_1.Kbd>);
        const key = react_1.screen.getByText('K');
        (0, vitest_1.expect)(key.tagName).toBe('KBD');
        (0, vitest_1.expect)(key).toHaveClass('inline-flex', 'h-5', 'gap-0.5', 'rounded-q-100', 'px-1', 'border-q-hairline', 'border-q-border-subtle', 'bg-q-overlay-hover', 'text-q-text-primary', 'text-q-caption-sm-medium');
    });
    (0, vitest_1.it)('forwards className and native kbd props', () => {
        (0, react_1.render)(<index_ts_1.Kbd className="is-custom" title="Command">⌘</index_ts_1.Kbd>);
        const key = react_1.screen.getByText('⌘');
        (0, vitest_1.expect)(key).toHaveClass('is-custom');
        (0, vitest_1.expect)(key).toHaveAttribute('title', 'Command');
    });
});
(0, vitest_1.describe)('<KbdSequence>', () => {
    (0, vitest_1.it)('wraps string keys in <Kbd> and renders separators between them', () => {
        const { container } = (0, react_1.render)(<index_ts_1.KbdSequence keys={['⌘', 'K']}/>);
        const kbds = container.querySelectorAll('kbd');
        (0, vitest_1.expect)(kbds).toHaveLength(2);
        (0, vitest_1.expect)(kbds[0]).toHaveTextContent('⌘');
        (0, vitest_1.expect)(kbds[1]).toHaveTextContent('K');
        const separators = container.querySelectorAll('[aria-hidden="true"]');
        // one separator between the two keys, styled via Typography
        (0, vitest_1.expect)(separators).toHaveLength(1);
        (0, vitest_1.expect)(separators[0]).toHaveTextContent('+');
        (0, vitest_1.expect)(separators[0]).toHaveClass('text-q-caption-sm-regular', 'text-q-text-tertiary');
    });
    (0, vitest_1.it)('omits the separator when set to null', () => {
        const { container } = (0, react_1.render)(<index_ts_1.KbdSequence keys={['⇧', 'A']} separator={null}/>);
        (0, vitest_1.expect)(container.querySelector('[aria-hidden="true"]')).toBeNull();
    });
    (0, vitest_1.it)('accepts a custom separator and Kbd children', () => {
        const { container } = (0, react_1.render)(<index_ts_1.KbdSequence separator="then">
        <index_ts_1.Kbd>G</index_ts_1.Kbd>
        <index_ts_1.Kbd>I</index_ts_1.Kbd>
      </index_ts_1.KbdSequence>);
        (0, vitest_1.expect)(container.querySelectorAll('kbd')).toHaveLength(2);
        (0, vitest_1.expect)(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('then');
    });
});
//# sourceMappingURL=kbd.test.js.map