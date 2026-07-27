"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Input>', () => {
    (0, vitest_1.it)('associates the label with the control', () => {
        (0, react_1.render)(<index_ts_1.Input label="Email" placeholder="you@example.com"/>);
        const input = react_1.screen.getByLabelText('Email');
        (0, vitest_1.expect)(input).toHaveClass('q-field-input');
        (0, vitest_1.expect)(input.tagName).toBe('INPUT');
    });
    (0, vitest_1.it)('renders the helper description', () => {
        (0, react_1.render)(<index_ts_1.Input label="Name" description="We'll never share this"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('We\'ll never share this')).toHaveClass('q-field-description');
    });
    (0, vitest_1.it)('shows the error (red) state and message instead of the description', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Input label="Name" description="helper" error="Please enter only letters" defaultValue="Mary387"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('Please enter only letters')).toHaveClass('q-field-error');
        (0, vitest_1.expect)(react_1.screen.queryByText('helper')).not.toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-field-control')).toHaveClass('q-field-control-invalid');
        (0, vitest_1.expect)(container.querySelector('.q-field-label')).toHaveClass('q-field-label-invalid');
        (0, vitest_1.expect)(react_1.screen.getByDisplayValue('Mary387')).toHaveAttribute('aria-invalid', 'true');
    });
    (0, vitest_1.it)('renders start and end slots', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Input label="Search" start={<span data-testid="pre"/>} end={<span data-testid="suf"/>}/>);
        (0, vitest_1.expect)(container.querySelectorAll('.q-field-affix')).toHaveLength(2);
        (0, vitest_1.expect)(react_1.screen.getByTestId('pre')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('suf')).toBeInTheDocument();
    });
    (0, vitest_1.it)('accepts the deprecated prefix / suffix aliases (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Input label="Search" prefix={<span data-testid="pre"/>} suffix={<span data-testid="suf"/>}/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('pre')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('suf')).toBeInTheDocument();
    });
    (0, vitest_1.it)('accepts typed input', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Input label="Name"/>);
        const input = react_1.screen.getByLabelText('Name');
        await user.type(input, 'Ada');
        (0, vitest_1.expect)(input).toHaveValue('Ada');
    });
});
//# sourceMappingURL=input.test.js.map