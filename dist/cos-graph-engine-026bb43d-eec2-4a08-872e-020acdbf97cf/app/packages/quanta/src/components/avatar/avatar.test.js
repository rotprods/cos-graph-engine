"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
(0, vitest_1.describe)('<Avatar>', () => {
    (0, vitest_1.it)('shows initials derived from alt (up to two words)', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('AZ')).toBeInTheDocument();
    });
    (0, vitest_1.it)('renders the initials through Typography with the matching mono composite', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="md"/>);
        const initials = react_1.screen.getByText('AZ');
        (0, vitest_1.expect)(initials.tagName).toBe('SPAN');
        (0, vitest_1.expect)(initials).toHaveClass('text-q-mono-lg-semi-bold');
    });
    (0, vitest_1.it)('uses the dashed pending type ramp for the placeholder initials', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Add" variant="pending" size="md"/>);
        // pending md = mono-sm (12px), distinct from the filled md ramp (mono-lg).
        (0, vitest_1.expect)(react_1.screen.getByText('A')).toHaveClass('text-q-mono-sm-semi-bold');
    });
    (0, vitest_1.it)('renders a custom fallback node', () => {
        (0, react_1.render)(<index_ts_1.Avatar fallback={<strong>HF</strong>}/>);
        (0, vitest_1.expect)(react_1.screen.getByText('HF')).toBeInTheDocument();
    });
    (0, vitest_1.it)('applies className to the avatar root', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" className="custom-avatar"/>);
        const root = container.querySelector('.custom-avatar');
        (0, vitest_1.expect)(root).not.toBeNull();
        (0, vitest_1.expect)(root).toHaveClass('size-q-1000');
    });
    (0, vitest_1.it)('renders a labelled status dot', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" status="online"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('img', { name: 'online' })).toBeInTheDocument();
    });
    (0, vitest_1.it)('anchors the status dot on the avatar rim', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" status="online"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('img', { name: 'online' })).toHaveClass('q-avatar-status');
    });
    (0, vitest_1.it)('uses the Figma size ramp for xl avatars', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="xl"/>);
        (0, vitest_1.expect)(container.querySelector('.size-q-1400')).not.toBeNull();
    });
    (0, vitest_1.it)('uses the Figma mono ramp: 16px for xl, 10px for xxs', () => {
        const xl = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="xl"/>);
        (0, vitest_1.expect)(xl.container.querySelector('.text-q-mono-lg-semi-bold')).not.toBeNull();
        xl.unmount();
        const xxs = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="xxs"/>);
        (0, vitest_1.expect)(xxs.container.querySelector('.text-q-mono-xs-semi-bold')).not.toBeNull();
    });
    (0, vitest_1.it)('keeps the legacy 2xs alias mapped to the Figma xxs size', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="2xs"/>);
        (0, vitest_1.expect)(container.querySelector('.size-q-500')).not.toBeNull();
    });
    (0, vitest_1.it)('uses one initial for compact xs and xxs avatars', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="xs"/>);
        (0, vitest_1.expect)(react_1.screen.getByText('A')).toBeInTheDocument();
        (0, vitest_1.expect)(react_1.screen.queryByText('AZ')).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('scales the online dot to the Figma status size for xl avatars', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" size="xl" status="online"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('img', { name: 'online' })).toHaveClass('size-q-200');
    });
    (0, vitest_1.it)('paints the status dot with the Figma presence color', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" status="away"/>);
        (0, vitest_1.expect)(react_1.screen.getByRole('img', { name: 'away' })).toHaveClass('bg-q-brand-yellow');
    });
    (0, vitest_1.it)('paints a colored disk via the matched palette bg + fg tokens', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" color="blue"/>);
        const disk = container.querySelector('.bg-q-palette-blue-bg');
        (0, vitest_1.expect)(disk).not.toBeNull();
        (0, vitest_1.expect)(disk).toHaveClass('text-q-palette-blue-text');
    });
    (0, vitest_1.it)('gives light disks a dark fg so initials stay legible', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar alt="Dana Kane" color="yellow"/>);
        const disk = container.querySelector('.bg-q-brand-yellow');
        (0, vitest_1.expect)(disk).toHaveClass('text-q-text-inverse');
    });
    (0, vitest_1.it)('auto-derives a stable color from alt when none is given', () => {
        const a = (0, react_1.render)(<index_ts_1.Avatar alt="Sam Park"/>);
        const first = a.container.querySelector('[class*="bg-q-"]')?.className;
        a.unmount();
        (0, vitest_1.expect)(first).toBeTruthy();
        const b = (0, react_1.render)(<index_ts_1.Avatar alt="Sam Park"/>);
        (0, vitest_1.expect)(b.container.querySelector('[class*="bg-q-"]')?.className).toBe(first);
    });
    (0, vitest_1.it)('renders a custom badge in the rim slot, replacing the default status Dot', () => {
        (0, react_1.render)(<index_ts_1.Avatar alt="Aria Zhang" status="online" badge={<span data-testid="count">9+</span>}/>);
        const badge = react_1.screen.getByTestId('count');
        (0, vitest_1.expect)(badge.closest('.q-avatar-status')).not.toBeNull();
        // the custom badge wins — no default presence Dot is rendered
        (0, vitest_1.expect)(react_1.screen.queryByRole('img', { name: 'online' })).not.toBeInTheDocument();
    });
    (0, vitest_1.it)('renders a dashed placeholder with no colored fill', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar variant="pending" alt="Add"/>);
        (0, vitest_1.expect)(container.querySelector('.border-dashed')).not.toBeNull();
        (0, vitest_1.expect)(container.querySelector('.border-q-medium')).not.toBeNull();
        (0, vitest_1.expect)(container.querySelector('.border-q-transparent-light-30')).not.toBeNull();
        (0, vitest_1.expect)(container.querySelector('svg.q-avatar-dash')).toBeNull();
        (0, vitest_1.expect)(container.querySelector('[class*="bg-q-palette-"]')).toBeNull();
    });
    (0, vitest_1.it)('treats an image avatar with no explicit color as a neutral surface', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Avatar src="/x.png" alt="Member"/>);
        (0, vitest_1.expect)(container.querySelector('[class*="bg-q-palette-"]')).toBeNull();
        (0, vitest_1.expect)(container.querySelector('.bg-q-background-elevated-start')).not.toBeNull();
    });
});
//# sourceMappingURL=avatar.test.js.map