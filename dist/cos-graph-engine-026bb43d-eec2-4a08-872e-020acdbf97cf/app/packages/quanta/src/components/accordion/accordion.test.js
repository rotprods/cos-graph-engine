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
/** A minimal three-item accordion built from the public parts. */
function Basic(props = {}) {
    return (<index_ts_1.Accordion.Root {...props}>
      <index_ts_1.Accordion.Item value="a">
        <index_ts_1.Accordion.Trigger>First</index_ts_1.Accordion.Trigger>
        <index_ts_1.Accordion.Panel>Panel A</index_ts_1.Accordion.Panel>
      </index_ts_1.Accordion.Item>
      <index_ts_1.Accordion.Item value="b">
        <index_ts_1.Accordion.Trigger>Second</index_ts_1.Accordion.Trigger>
        <index_ts_1.Accordion.Panel>Panel B</index_ts_1.Accordion.Panel>
      </index_ts_1.Accordion.Item>
      <index_ts_1.Accordion.Item value="c" disabled>
        <index_ts_1.Accordion.Trigger>Third</index_ts_1.Accordion.Trigger>
        <index_ts_1.Accordion.Panel>Panel C</index_ts_1.Accordion.Panel>
      </index_ts_1.Accordion.Item>
    </index_ts_1.Accordion.Root>);
}
(0, vitest_1.describe)('<Accordion>', () => {
    (0, vitest_1.it)('renders triggers as buttons inside accessible headings', () => {
        (0, react_1.render)(<Basic />);
        const trigger = react_1.screen.getByRole('button', { name: 'First' });
        (0, vitest_1.expect)(trigger).toHaveClass('q-accordion-trigger');
        // Base UI wraps the trigger in an <h3> Header.
        (0, vitest_1.expect)(trigger.closest('.q-accordion-header')?.tagName).toBe('H3');
    });
    (0, vitest_1.it)('expands a panel when its trigger is pressed and toggles aria-expanded', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const trigger = react_1.screen.getByRole('button', { name: 'First' });
        (0, vitest_1.expect)(trigger).toHaveAttribute('aria-expanded', 'false');
        await user.click(trigger);
        (0, vitest_1.expect)(trigger).toHaveAttribute('aria-expanded', 'true');
        (0, vitest_1.expect)(trigger).toHaveAttribute('data-panel-open');
        (0, vitest_1.expect)(react_1.screen.getByText('Panel A')).toBeInTheDocument();
    });
    (0, vitest_1.it)('collapses the open item when a second is opened (single mode default)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const first = react_1.screen.getByRole('button', { name: 'First' });
        const second = react_1.screen.getByRole('button', { name: 'Second' });
        await user.click(first);
        (0, vitest_1.expect)(first).toHaveAttribute('aria-expanded', 'true');
        await user.click(second);
        (0, vitest_1.expect)(first).toHaveAttribute('aria-expanded', 'false');
        (0, vitest_1.expect)(second).toHaveAttribute('aria-expanded', 'true');
    });
    (0, vitest_1.it)('keeps multiple panels open when multiple is set', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic multiple/>);
        const first = react_1.screen.getByRole('button', { name: 'First' });
        const second = react_1.screen.getByRole('button', { name: 'Second' });
        await user.click(first);
        await user.click(second);
        (0, vitest_1.expect)(first).toHaveAttribute('aria-expanded', 'true');
        (0, vitest_1.expect)(second).toHaveAttribute('aria-expanded', 'true');
    });
    (0, vitest_1.it)('honours defaultValue to open an item initially', () => {
        (0, react_1.render)(<Basic defaultValue={['b']}/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-expanded', 'true');
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-expanded', 'false');
    });
    (0, vitest_1.it)('fires onValueChange with the new open set', async () => {
        const user = user_event_1.default.setup();
        const onValueChange = vitest_1.vi.fn();
        (0, react_1.render)(<Basic onValueChange={onValueChange}/>);
        await user.click(react_1.screen.getByRole('button', { name: 'First' }));
        (0, vitest_1.expect)(onValueChange).toHaveBeenCalled();
        (0, vitest_1.expect)(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
    });
    (0, vitest_1.it)('disables an item via the disabled prop', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        const disabled = react_1.screen.getByRole('button', { name: 'Third' });
        (0, vitest_1.expect)(disabled).toHaveAttribute('data-disabled');
        await user.click(disabled);
        (0, vitest_1.expect)(disabled).toHaveAttribute('aria-expanded', 'false');
    });
    (0, vitest_1.it)('applies the variant class to the root', () => {
        const { rerender } = (0, react_1.render)(<Basic variant="separated"/>);
        const root = react_1.screen.getByRole('button', { name: 'First' }).closest('.q-accordion');
        (0, vitest_1.expect)(root).toHaveClass('q-accordion-separated');
        rerender(<Basic variant="list"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'First' }).closest('.q-accordion')).toHaveClass('q-accordion-list');
    });
    (0, vitest_1.it)('renders start and end slots in the trigger', () => {
        (0, react_1.render)(<index_ts_1.Accordion.Root>
        <index_ts_1.Accordion.Item value="a">
          <index_ts_1.Accordion.Trigger start={<span data-testid="lead"/>} end={<span data-testid="trail"/>}>
            Labelled
          </index_ts_1.Accordion.Trigger>
          <index_ts_1.Accordion.Panel>Body</index_ts_1.Accordion.Panel>
        </index_ts_1.Accordion.Item>
      </index_ts_1.Accordion.Root>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('lead').closest('.q-accordion-trigger-start')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('trail').closest('.q-accordion-trigger-end')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByText('Labelled').closest('.q-accordion-trigger-label')).toBeInTheDocument();
    });
    (0, vitest_1.it)('forwards a ref to the root element', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_1.Accordion.Root ref={ref}>
        <index_ts_1.Accordion.Item value="a">
          <index_ts_1.Accordion.Trigger>First</index_ts_1.Accordion.Trigger>
          <index_ts_1.Accordion.Panel>Panel A</index_ts_1.Accordion.Panel>
        </index_ts_1.Accordion.Item>
      </index_ts_1.Accordion.Root>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLElement);
        (0, vitest_1.expect)(ref.current).toHaveClass('q-accordion');
    });
});
//# sourceMappingURL=accordion.test.js.map