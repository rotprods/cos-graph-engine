"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const react_2 = require("react");
const vitest_1 = require("vitest");
const index_ts_1 = require("../button/index.ts");
const index_ts_2 = require("./index.ts");
(0, vitest_1.describe)('ButtonGroup', () => {
    (0, vitest_1.it)('renders a role="group" with the composite class and its buttons', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup aria-label="Text style">
        <index_ts_1.Button>Bold</index_ts_1.Button>
        <index_ts_1.Button>Italic</index_ts_1.Button>
      </index_ts_2.ButtonGroup>);
        const group = react_1.screen.getByRole('group', { name: 'Text style' });
        (0, vitest_1.expect)(group).toHaveClass('q-button-group');
        (0, vitest_1.expect)(group.querySelectorAll('.q-button')).toHaveLength(2);
    });
    (0, vitest_1.it)('defaults to attached + horizontal', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup><index_ts_1.Button>One</index_ts_1.Button></index_ts_2.ButtonGroup>);
        const group = react_1.screen.getByRole('group');
        (0, vitest_1.expect)(group).toHaveClass('q-button-group-attached', 'q-button-group-horizontal');
        (0, vitest_1.expect)(group).not.toHaveClass('q-button-group-spaced');
    });
    (0, vitest_1.it)('renders the spaced shape when attached={false}', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup attached={false}><index_ts_1.Button>One</index_ts_1.Button></index_ts_2.ButtonGroup>);
        const group = react_1.screen.getByRole('group');
        (0, vitest_1.expect)(group).toHaveClass('q-button-group-spaced');
        (0, vitest_1.expect)(group).not.toHaveClass('q-button-group-attached');
    });
    (0, vitest_1.it)('applies the vertical orientation class', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup orientation="vertical"><index_ts_1.Button>One</index_ts_1.Button></index_ts_2.ButtonGroup>);
        (0, vitest_1.expect)(react_1.screen.getByRole('group')).toHaveClass('q-button-group-vertical');
    });
    (0, vitest_1.it)('propagates size + variant to child Buttons', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup size="sm" variant="outline">
        <index_ts_1.Button>A</index_ts_1.Button>
        <index_ts_1.Button>B</index_ts_1.Button>
      </index_ts_2.ButtonGroup>);
        for (const btn of react_1.screen.getAllByRole('button')) {
            (0, vitest_1.expect)(btn).toHaveClass('q-button-sm', 'q-button-outline');
        }
    });
    (0, vitest_1.it)("does not override a child's own size/variant", () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup size="sm" variant="outline">
        <index_ts_1.Button>Shared</index_ts_1.Button>
        <index_ts_1.Button size="lg" variant="primary">Own</index_ts_1.Button>
      </index_ts_2.ButtonGroup>);
        const own = react_1.screen.getByRole('button', { name: 'Own' });
        (0, vitest_1.expect)(own).toHaveClass('q-button-lg', 'q-button-primary');
        (0, vitest_1.expect)(own).not.toHaveClass('q-button-sm', 'q-button-outline');
    });
    (0, vitest_1.it)('leaves children untouched when no shared size/variant is set', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup>
        <index_ts_1.Button variant="ghost">Ghost</index_ts_1.Button>
      </index_ts_2.ButtonGroup>);
        (0, vitest_1.expect)(react_1.screen.getByRole('button', { name: 'Ghost' })).toHaveClass('q-button-ghost');
    });
    (0, vitest_1.it)('forwards ref + extra props to the group div', () => {
        const ref = (0, react_2.createRef)();
        (0, react_1.render)(<index_ts_2.ButtonGroup ref={ref} data-testid="grp"><index_ts_1.Button>One</index_ts_1.Button></index_ts_2.ButtonGroup>);
        (0, vitest_1.expect)(ref.current).toBe(react_1.screen.getByTestId('grp'));
        (0, vitest_1.expect)(ref.current).toHaveAttribute('role', 'group');
    });
    (0, vitest_1.it)('lets the caller className win (appended last)', () => {
        (0, react_1.render)(<index_ts_2.ButtonGroup className="custom-x"><index_ts_1.Button>One</index_ts_1.Button></index_ts_2.ButtonGroup>);
        (0, vitest_1.expect)(react_1.screen.getByRole('group')).toHaveClass('q-button-group', 'custom-x');
    });
    (0, vitest_1.it)('buttonGroup() recipe emits the same class string', () => {
        (0, vitest_1.expect)((0, index_ts_2.buttonGroup)()).toBe('q-button-group q-button-group-horizontal q-button-group-attached');
        (0, vitest_1.expect)((0, index_ts_2.buttonGroup)({ orientation: 'vertical', attached: false }, 'extra'))
            .toBe('q-button-group q-button-group-vertical q-button-group-spaced extra');
    });
});
//# sourceMappingURL=button-group.test.js.map