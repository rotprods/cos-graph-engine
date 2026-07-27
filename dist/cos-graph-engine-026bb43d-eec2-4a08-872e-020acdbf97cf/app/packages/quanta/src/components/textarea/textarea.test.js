"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Textarea>', () => {
    (0, vitest_1.it)('renders a multiline control on the column surface', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Textarea label="Bio" rows={4}/>);
        const ta = react_1.screen.getByLabelText('Bio');
        (0, vitest_1.expect)(ta.tagName).toBe('TEXTAREA');
        (0, vitest_1.expect)(ta).toHaveClass('q-field-input', 'q-field-input-multiline');
        (0, vitest_1.expect)(container.querySelector('.q-field')).toHaveClass('q-field-multiline');
        (0, vitest_1.expect)(container.querySelector('.q-field-control')).toHaveClass('q-field-control-multiline');
    });
    (0, vitest_1.it)('renders the helper description', () => {
        (0, react_1.render)(<index_ts_1.Textarea label="Bio" description="We'll never share this"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('We\'ll never share this')).toHaveClass('q-field-description');
    });
    (0, vitest_1.it)('shows the error (red) state and message instead of the description', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Textarea label="Notes" description="helper" error="Please enter only letters" defaultValue="Mary387"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('Please enter only letters')).toHaveClass('q-field-error');
        (0, vitest_1.expect)(react_1.screen.queryByText('helper')).not.toBeInTheDocument();
        (0, vitest_1.expect)(container.querySelector('.q-field-control')).toHaveClass('q-field-control-invalid');
        (0, vitest_1.expect)(container.querySelector('.q-field-label')).toHaveClass('q-field-label-invalid');
    });
    (0, vitest_1.it)('accepts typed input', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.Textarea label="Bio"/>);
        const ta = react_1.screen.getByLabelText('Bio');
        await user.type(ta, 'Hello');
        (0, vitest_1.expect)(ta).toHaveValue('Hello');
    });
    (0, vitest_1.it)('renders canonical start / end affix slots', () => {
        (0, react_1.render)(<index_ts_1.Textarea label="Bio" start={<span data-testid="lead"/>} end={<span data-testid="trail"/>}/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('lead').closest('.q-field-affix')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('trail').closest('.q-field-affix')).toBeInTheDocument();
    });
    (0, vitest_1.it)('keeps the legacy prefix / suffix aliases (back-compat)', () => {
        (0, react_1.render)(<index_ts_1.Textarea label="Bio" prefix={<span data-testid="legacy-lead"/>} suffix={<span data-testid="legacy-trail"/>}/>);
        (0, vitest_1.expect)(react_1.screen.getByTestId('legacy-lead').closest('.q-field-affix')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.getByTestId('legacy-trail').closest('.q-field-affix')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders a bare textarea control with no affixes by default (back-compat)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Textarea label="Bio"/>);
        (0, vitest_1.expect)(container.querySelector('.q-field-affix')).toBeNull();
        (0, vitest_1.expect)(react_1.screen.getByLabelText('Bio').tagName).toBe('TEXTAREA');
    });
    (0, vitest_1.it)('swaps the control element via render', () => {
        (0, react_1.render)(<index_ts_1.Textarea label="Bio" render={<textarea data-testid="custom"/>}/>);
        const ta = react_1.screen.getByTestId('custom');
        (0, vitest_1.expect)(ta.tagName).toBe('TEXTAREA');
        (0, vitest_1.expect)(ta).toHaveClass('q-field-input');
    });
});
//# sourceMappingURL=textarea.test.js.map