"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('radio() class-builder', () => {
    (0, vitest_1.it)('defaults to brand + md', () => {
        (0, vitest_1.expect)((0, index_ts_1.radio)()).toBe('q-radio q-radio-brand q-radio-md');
    });
    (0, vitest_1.it)('applies color + size and merges extras', () => {
        (0, vitest_1.expect)((0, index_ts_1.radio)({ color: 'white', size: 'lg' }, 'is-custom', false)).toBe('q-radio q-radio-white q-radio-lg is-custom');
    });
});
(0, vitest_1.describe)('<Radio> in a <RadioGroup>', () => {
    (0, vitest_1.it)('renders Base UI radios with Figma classes and reflects the selected value', () => {
        (0, react_1.render)(<index_ts_1.RadioGroup defaultValue="a">
        <index_ts_1.Radio value="a" aria-label="A" color="white" size="sm"/>
        <index_ts_1.Radio value="b" aria-label="B"/>
      </index_ts_1.RadioGroup>);
        const a = react_1.screen.getByRole('radio', { name: 'A' });
        (0, vitest_1.expect)(a).toHaveClass('q-radio', 'q-radio-white', 'q-radio-sm');
        (0, vitest_1.expect)(a).toHaveAttribute('aria-checked', 'true');
        (0, vitest_1.expect)(react_1.screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'false');
    });
    (0, vitest_1.it)('moves selection on click (single-select)', async () => {
        const user = user_event_1.default.setup();
        (0, react_1.render)(<index_ts_1.RadioGroup defaultValue="a">
        <index_ts_1.Radio value="a" aria-label="A"/>
        <index_ts_1.Radio value="b" aria-label="B"/>
      </index_ts_1.RadioGroup>);
        await user.click(react_1.screen.getByRole('radio', { name: 'B' }));
        (0, vitest_1.expect)(react_1.screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
        (0, vitest_1.expect)(react_1.screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'false');
    });
    (0, vitest_1.it)('applies the group layout class', () => {
        const { container } = (0, react_1.render)(<index_ts_1.RadioGroup aria-label="group"><index_ts_1.Radio value="a" aria-label="A"/></index_ts_1.RadioGroup>);
        (0, vitest_1.expect)(container.querySelector('[role="radiogroup"]')).toHaveClass('q-radio-group');
    });
});
(0, vitest_1.describe)('<RadioLabel>', () => {
    (0, vitest_1.it)('renders the label, description and a selected radio', () => {
        (0, react_1.render)(<index_ts_1.RadioGroup defaultValue="x">
        <index_ts_1.RadioLabel value="x" label="Option X" description="Description"/>
      </index_ts_1.RadioGroup>);
        // Title/description are now rendered by <Typography>: the composite type +
        // semantic colour classes sit alongside the kept q-radio-label-* hooks.
        const title = react_1.screen.getByText('Option X');
        (0, vitest_1.expect)(title).toHaveClass('q-radio-label-title', 'text-q-label-sm-medium', 'text-q-text-primary');
        const description = react_1.screen.getByText('Description');
        (0, vitest_1.expect)(description).toHaveClass('q-radio-label-description', 'text-q-label-sm-regular', 'text-q-text-tertiary');
        const r = react_1.screen.getByRole('radio');
        (0, vitest_1.expect)(r).toHaveClass('q-radio');
        (0, vitest_1.expect)(r).toHaveAttribute('aria-checked', 'true');
    });
    (0, vitest_1.it)('supports right-aligned radio and medium label typography', () => {
        (0, react_1.render)(<index_ts_1.RadioGroup>
        <index_ts_1.RadioLabel value="x" direction="right" size="md" label="Option"/>
      </index_ts_1.RadioGroup>);
        (0, vitest_1.expect)(react_1.screen.getByText('Option').closest('.q-radio-label')).toHaveClass('q-radio-label-right', 'q-radio-label-md');
        // md label size drives the md title composite via <Typography>.
        (0, vitest_1.expect)(react_1.screen.getByText('Option')).toHaveClass('text-q-label-md-medium');
    });
});
//# sourceMappingURL=radio.test.js.map