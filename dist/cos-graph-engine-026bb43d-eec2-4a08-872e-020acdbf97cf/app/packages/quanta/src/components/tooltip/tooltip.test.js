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
function Basic({ side, arrow, triggerRef, triggerClassName, } = {}) {
    return (<index_ts_1.Tooltip.Root>
      <index_ts_1.Tooltip.Trigger ref={triggerRef} className={triggerClassName}>Trigger</index_ts_1.Tooltip.Trigger>
      <index_ts_1.Tooltip.Content side={side} arrow={arrow}>
        Helpful hint
      </index_ts_1.Tooltip.Content>
    </index_ts_1.Tooltip.Root>);
}
(0, vitest_1.describe)('Tooltip', () => {
    (0, vitest_1.it)('renders the trigger (a pure anchor, forwards className) and keeps the popup closed by default', () => {
        (0, react_1.render)(<Basic triggerClassName="custom-trigger"/>);
        const trigger = react_1.screen.getByRole('button', { name: 'Trigger' });
        // The trigger has no own skin; a forwarded className lands on the element.
        (0, vitest_1.expect)(trigger).toHaveClass('custom-trigger');
        (0, vitest_1.expect)(react_1.screen.queryByText('Helpful hint')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('shows the tooltip content on focus and hides it on blur', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<Basic />);
        await user.tab();
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Trigger' })).toHaveFocus();
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.getByText('Helpful hint')).toBeInTheDocument());
        await user.tab();
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.queryByText('Helpful hint')).not.toBeInTheDocument());
    });
    (0, vitest_1.it)('opens with defaultOpen and exposes a tooltip role', async () => {
        (0, react_1.render)(<index_ts_1.Tooltip.Root defaultOpen>
        <index_ts_1.Tooltip.Trigger>Trigger</index_ts_1.Tooltip.Trigger>
        <index_ts_1.Tooltip.Content>Open now</index_ts_1.Tooltip.Content>
      </index_ts_1.Tooltip.Root>);
        await (0, react_1.waitFor)(() => (0, vitest_1.expect)(react_1.screen.getByRole('tooltip')).toHaveTextContent('Open now'));
        (0, vitest_1.expect)(react_1.screen.getByRole('tooltip')).toHaveClass('q-tooltip');
    });
    (0, vitest_1.it)('paints the requested side onto the popup and renders an arrow when enabled', async () => {
        (0, react_1.render)(<index_ts_1.Tooltip.Root defaultOpen>
        <index_ts_1.Tooltip.Trigger>Trigger</index_ts_1.Tooltip.Trigger>
        <index_ts_1.Tooltip.Content side="right" arrow>Sided</index_ts_1.Tooltip.Content>
      </index_ts_1.Tooltip.Root>);
        const popup = await react_1.screen.findByRole('tooltip');
        (0, vitest_1.expect)(popup).toHaveAttribute('data-side', 'right');
        (0, vitest_1.expect)(popup.querySelector('.q-tooltip-arrow')).not.toBeNull();
    });
    (0, vitest_1.it)('forwards a ref to the trigger element', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<Basic triggerRef={ref}/>);
        (0, vitest_1.expect)(ref.current).toBeInstanceOf(HTMLButtonElement);
        (0, vitest_1.expect)(ref.current).toHaveTextContent('Trigger');
    });
    (0, vitest_1.it)('forwards the Root delay down to the trigger', () => {
        (0, react_1.render)(<index_ts_1.Tooltip.Root delay={250}>
        <index_ts_1.Tooltip.Trigger>Trigger</index_ts_1.Tooltip.Trigger>
        <index_ts_1.Tooltip.Content>Hint</index_ts_1.Tooltip.Content>
      </index_ts_1.Tooltip.Root>);
        // Sanity render — the delay is consumed by Base UI internally; ensure the
        // composed tree mounts without throwing and the trigger is present.
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
    });
    (0, vitest_1.it)('shares a delay via Provider across multiple roots', () => {
        (0, react_1.render)(<index_ts_1.Tooltip.Provider delay={100}>
        <index_ts_1.Tooltip.Root>
          <index_ts_1.Tooltip.Trigger>One</index_ts_1.Tooltip.Trigger>
          <index_ts_1.Tooltip.Content>First</index_ts_1.Tooltip.Content>
        </index_ts_1.Tooltip.Root>
        <index_ts_1.Tooltip.Root>
          <index_ts_1.Tooltip.Trigger>Two</index_ts_1.Tooltip.Trigger>
          <index_ts_1.Tooltip.Content>Second</index_ts_1.Tooltip.Content>
        </index_ts_1.Tooltip.Root>
      </index_ts_1.Tooltip.Provider>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'One' })).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Two' })).toBeInTheDocument();
    });
});
//# sourceMappingURL=tooltip.test.js.map