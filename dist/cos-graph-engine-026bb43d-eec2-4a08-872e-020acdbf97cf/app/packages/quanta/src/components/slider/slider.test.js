"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@testing-library/react");
const react_2 = require("react");
const vitest_1 = require("vitest");
const index_ts_1 = require("./index.ts");
function trackRect(width = 200, left = 0) {
    return {
        x: left,
        y: 0,
        left,
        top: 0,
        right: left + width,
        bottom: 28,
        width,
        height: 28,
        toJSON() { },
    };
}
function mockTrackWidth(el, width = 200) {
    const rect = trackRect(width);
    vitest_1.vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
}
(0, vitest_1.describe)('<Slider> stepped (default)', () => {
    (0, vitest_1.it)('renders the glass track + interior notch ticks + 1 fill bar', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider aria-label="x"/>);
        const slider = react_1.screen.getByRole('slider', { name: 'x' });
        // Glass surface (background-glass + blur + border) lives on the q-slider utility.
        (0, vitest_1.expect)(slider).toHaveClass('q-slider', 'h-7', 'rounded-lg', 'overflow-hidden', 'touch-none');
        (0, vitest_1.expect)(container.querySelectorAll('[aria-hidden="true"][style*="width"]')).toHaveLength(1);
        // steps=3 default → 1 interior notch tick (endpoints are the track edges).
        (0, vitest_1.expect)(container.querySelectorAll('.h-2.w-px')).toHaveLength(1);
    });
    (0, vitest_1.it)('notch fill: 0% at start (reachable) → 100% + rounded right at the last step', () => {
        const { container, rerender } = (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={3} value={0}/>);
        let fill = container.querySelector('[style*="width"]');
        // step 0 is the empty start — not a cumulative 1/N fill.
        (0, vitest_1.expect)(fill.style.width).toBe('0%');
        (0, vitest_1.expect)(fill).not.toHaveClass('rounded-r-lg');
        rerender(<index_ts_1.Slider aria-label="x" steps={3} value={1}/>);
        fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill.style.width).toBe('50%'); // notch 1 of [0, .5, 1]
        rerender(<index_ts_1.Slider aria-label="x" steps={3} value={2}/>);
        fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill.style.width).toBe('100%');
        (0, vitest_1.expect)(fill).toHaveClass('rounded-r-lg', 'border-r-0');
    });
    (0, vitest_1.it)('interior notch ticks scale with steps (steps-2)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={5} value={0}/>);
        // 5 notches → 3 interior ticks at 25% / 50% / 75%.
        const ticks = container.querySelectorAll('.h-2.w-px');
        (0, vitest_1.expect)(ticks).toHaveLength(3);
    });
    (0, vitest_1.it)('pointer can reach step 0 (start) by dragging to the far left', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={4} defaultValue={3} onChange={onChange}/>);
        const track = react_1.screen.getByRole('slider');
        mockTrackWidth(track, 300);
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, button: 0, pointerType: 'mouse' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(0);
    });
    (0, vitest_1.it)('pointer drag snaps to the segment under the pointer', () => {
        const onChange = vitest_1.vi.fn();
        const onChangeEnd = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={3} defaultValue={2} onChange={onChange} onChangeEnd={onChangeEnd}/>);
        const track = react_1.screen.getByRole('slider');
        mockTrackWidth(track, 300); // each segment 100 px wide
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 50, button: 0, pointerType: 'mouse' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(0);
        react_1.fireEvent.pointerMove(track, { pointerId: 1, clientX: 150 });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(1);
        react_1.fireEvent.pointerMove(track, { pointerId: 1, clientX: 290 });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(2);
        react_1.fireEvent.pointerUp(track, { pointerId: 1, clientX: 290 });
        (0, vitest_1.expect)(onChangeEnd).toHaveBeenCalledWith(2);
    });
    (0, vitest_1.it)('keyboard ←/→/Home/End', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={4} defaultValue={1} onChange={onChange}/>);
        const slider = react_1.screen.getByRole('slider');
        (0, react_1.act)(() => slider.focus());
        react_1.fireEvent.keyDown(slider, { key: 'ArrowRight' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(2);
        react_1.fireEvent.keyDown(slider, { key: 'End' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(3);
        react_1.fireEvent.keyDown(slider, { key: 'Home' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(0);
    });
    (0, vitest_1.it)('forwards ref to the root slider node without breaking internal measurement', () => {
        const ref = (0, react_2.createRef)();
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={4} defaultValue={3} onChange={onChange} ref={ref}/>);
        const track = react_1.screen.getByRole('slider', { name: 'x' });
        (0, vitest_1.expect)(ref.current).toBe(track);
        // Internal trackRef still drives pointer math (a caller ref must not clobber it).
        mockTrackWidth(track, 300);
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, button: 0, pointerType: 'mouse' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(0);
    });
    (0, vitest_1.it)('aria attributes reflect stepped semantics', () => {
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" steps={5} value={2}/>);
        const s = react_1.screen.getByRole('slider');
        (0, vitest_1.expect)(s).toHaveAttribute('aria-valuemin', '0');
        (0, vitest_1.expect)(s).toHaveAttribute('aria-valuemax', '4');
        (0, vitest_1.expect)(s).toHaveAttribute('aria-valuenow', '2');
    });
});
(0, vitest_1.describe)('<Slider> continuous', () => {
    (0, vitest_1.it)('renders without ticks by default', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol"/>);
        (0, vitest_1.expect)(container.querySelectorAll('.h-2.w-px')).toHaveLength(0);
    });
    (0, vitest_1.it)('fill = (value - min) / (max - min)', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol" min={0} max={100} value={25}/>);
        const fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill.style.width).toBe('25%');
    });
    (0, vitest_1.it)('drag produces fractional values (free, step=0)', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol" min={0} max={100} defaultValue={0} onChange={onChange}/>);
        const track = react_1.screen.getByRole('slider');
        mockTrackWidth(track, 200);
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 50, button: 0, pointerType: 'mouse' });
        // 50 / 200 = 25%
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(25);
        react_1.fireEvent.pointerMove(track, { pointerId: 1, clientX: 137 });
        // 137 / 200 = 68.5%
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(68.5);
    });
    (0, vitest_1.it)('step snaps to the nearest increment', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol" min={0} max={100} step={10} onChange={onChange}/>);
        const track = react_1.screen.getByRole('slider');
        mockTrackWidth(track, 200);
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 47, button: 0, pointerType: 'mouse' });
        // 47/200 = 23.5 → snap to 20
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(20);
    });
    (0, vitest_1.it)('keyboard moves by step (or 1% if free)', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol" min={0} max={100} step={5} defaultValue={50} onChange={onChange}/>);
        const slider = react_1.screen.getByRole('slider');
        (0, react_1.act)(() => slider.focus());
        react_1.fireEvent.keyDown(slider, { key: 'ArrowRight' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(55);
        react_1.fireEvent.keyDown(slider, { key: 'PageUp' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(100); // capped
        react_1.fireEvent.keyDown(slider, { key: 'Home' });
        (0, vitest_1.expect)(onChange).toHaveBeenLastCalledWith(0);
    });
    (0, vitest_1.it)('honours showTicks + steps for visual marks', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider mode="continuous" aria-label="vol" min={0} max={100} steps={5} showTicks/>);
        (0, vitest_1.expect)(container.querySelectorAll('.h-2.w-px')).toHaveLength(5);
    });
});
(0, vitest_1.describe)('<Slider> motion + disabled', () => {
    (0, vitest_1.it)('drag suspends the width transition; releasing restores it', () => {
        const { container } = (0, react_1.render)(<index_ts_1.Slider aria-label="x"/>);
        const track = react_1.screen.getByRole('slider');
        mockTrackWidth(track, 300);
        let fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill).toHaveClass('transition-[width]', 'duration-200', 'ease-out');
        react_1.fireEvent.pointerDown(track, { pointerId: 1, clientX: 50, button: 0, pointerType: 'mouse' });
        fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill).toHaveClass('transition-none');
        react_1.fireEvent.pointerUp(track, { pointerId: 1, clientX: 50 });
        fill = container.querySelector('[style*="width"]');
        (0, vitest_1.expect)(fill).toHaveClass('transition-[width]');
    });
    (0, vitest_1.it)('disabled blocks pointer + keyboard + sets tabIndex -1', () => {
        const onChange = vitest_1.vi.fn();
        (0, react_1.render)(<index_ts_1.Slider aria-label="x" disabled onChange={onChange}/>);
        const slider = react_1.screen.getByRole('slider');
        (0, vitest_1.expect)(slider).toHaveAttribute('tabIndex', '-1');
        (0, vitest_1.expect)(slider).toHaveAttribute('aria-disabled', 'true');
        (0, vitest_1.expect)(slider).toHaveClass('pointer-events-none', 'opacity-50');
        react_1.fireEvent.keyDown(slider, { key: 'ArrowRight' });
        (0, vitest_1.expect)(onChange).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=slider.test.js.map