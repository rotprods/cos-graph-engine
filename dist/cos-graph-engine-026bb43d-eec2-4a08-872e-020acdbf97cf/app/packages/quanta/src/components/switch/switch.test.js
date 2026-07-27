"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Switch>', () => {
    (0, vitest_1.it)('renders the small switch by default', () => {
        (0, react_1.render)(<index_ts_1.Switch aria-label="Notifications"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('switch', { name: 'Notifications' })).toHaveClass('q-switch', 'q-switch-small');
    });
    (0, vitest_1.it)('supports the default Figma size', () => {
        (0, react_1.render)(<index_ts_1.Switch aria-label="Notifications" size="default"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('switch', { name: 'Notifications' })).toHaveClass('q-switch-default');
    });
    (0, vitest_1.it)('supports the medium Figma size', () => {
        (0, react_1.render)(<index_ts_1.Switch aria-label="Notifications" size="medium"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('switch', { name: 'Notifications' })).toHaveClass('q-switch-medium');
    });
    (0, vitest_1.it)('reflects checked and disabled state attributes', () => {
        (0, react_1.render)(<index_ts_1.Switch aria-label="Notifications" checked disabled/>);
        const control = react_1.screen.getByRole('switch', { name: 'Notifications' });
        (0, vitest_1.expect)(control).toBeChecked();
        (0, vitest_1.expect)(control).toHaveAttribute('aria-disabled', 'true');
        (0, vitest_1.expect)(control).toHaveAttribute('data-checked');
        (0, vitest_1.expect)(control).toHaveAttribute('data-disabled');
    });
    (0, vitest_1.it)('toggles when clicked', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Switch aria-label="Notifications"/>);
        const control = react_1.screen.getByRole('switch', { name: 'Notifications' });
        (0, vitest_1.expect)(control).not.toBeChecked();
        await user.click(control);
        (0, vitest_1.expect)(control).toBeChecked();
    });
    (0, vitest_1.it)('renders a bare control with no label wrapper (back-compat)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Switch aria-label="Bare"/>);
        (0, vitest_1.expect)(container.querySelector('.q-switch-label')).not.toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('switch', { name: 'Bare' })).toHaveClass('q-switch', 'q-switch-small');
    });
});
(0, vitest_1.describe)('<SwitchLabel>', () => {
    (0, vitest_1.it)('renders the label, description and a Switch with Typography composites', () => {
        (0, react_1.render)(<index_ts_1.SwitchLabel label="Wi-Fi" description="Connect automatically" switchProps={{ checked: true }}/>);
        // Title is rendered via <Typography> (label-sm-medium for the default sm
        // label size) but still carries the structural marker class.
        const title = react_1.screen.getByText('Wi-Fi');
        (0, vitest_1.expect)(title).toHaveClass('q-switch-label-title', 'text-q-label-sm-medium', 'text-q-text-primary');
        const desc = react_1.screen.getByText('Connect automatically');
        (0, vitest_1.expect)(desc).toHaveClass('q-switch-label-description', 'text-q-label-sm-regular', 'text-q-text-tertiary');
        const control = react_1.screen.getByRole('switch');
        (0, vitest_1.expect)(control).toHaveClass('q-switch');
        (0, vitest_1.expect)(control).toBeChecked();
    });
    (0, vitest_1.it)('supports right-aligned switch and medium label typography', () => {
        (0, react_1.render)(<index_ts_1.SwitchLabel direction="right" size="md" label="Email digest"/>);
        const title = react_1.screen.getByText('Email digest');
        // md label size resolves to the label-md-medium Typography composite.
        (0, vitest_1.expect)(title).toHaveClass('q-switch-label-title', 'text-q-label-md-medium');
        (0, vitest_1.expect)(title.closest('.q-switch-label')).toHaveClass('q-switch-label-right', 'q-switch-label-md');
    });
    (0, vitest_1.it)('lets children override the title and forwards color/size to the Switch', () => {
        (0, react_1.render)(<index_ts_1.SwitchLabel color="success" switchSize="default" switchProps={{ checked: true }}>
        <strong data-testid="rich">Custom</strong>
      </index_ts_1.SwitchLabel>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('rich')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByRole('switch')).toHaveClass('q-switch-default');
    });
});
//# sourceMappingURL=switch.test.js.map