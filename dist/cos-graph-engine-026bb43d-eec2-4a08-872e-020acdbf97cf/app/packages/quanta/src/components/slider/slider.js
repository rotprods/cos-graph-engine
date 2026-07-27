"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Slider = Slider;
const react_1 = require("react");
const cx_ts_1 = require("../utils/cx.ts");
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
// Fan a single node out to several refs (internal measuring ref + caller ref).
function mergeRefs(...refs) {
    return (node) => {
        for (const ref of refs) {
            if (typeof ref === 'function')
                ref(node);
            else if (ref)
                ref.current = node;
        }
    };
}
function Slider(rawProps) {
    const { mode = 'stepped', value, defaultValue, onChange, onChangeEnd, disabled = false, showTicks, className, onKeyDown, ref, 'aria-label': ariaLabel, ...rest } = rawProps;
    // Mode-specific config.
    const steps = Math.max(2, rawProps.steps ?? (mode === 'stepped' ? 3 : 0));
    const min = rawProps.min ?? 0;
    const max = rawProps.max ?? 1;
    const snap = rawProps.step ?? 0;
    const ticksVisible = showTicks ?? (mode === 'stepped');
    // Normalise default.
    const initial = (() => {
        if (defaultValue !== undefined)
            return defaultValue;
        if (mode === 'stepped')
            return 0;
        return min;
    })();
    const [internal, setInternal] = (0, react_1.useState)(() => sanitize(initial, mode, steps, min, max, snap));
    const isControlled = value !== undefined;
    const current = isControlled ? sanitize(value, mode, steps, min, max, snap) : internal;
    const trackRef = (0, react_1.useRef)(null);
    const [isDragging, setIsDragging] = (0, react_1.useState)(false);
    const latestRef = (0, react_1.useRef)(current);
    latestRef.current = current;
    const commitValue = (0, react_1.useCallback)((next) => {
        const clean = sanitize(next, mode, steps, min, max, snap);
        if (clean === latestRef.current)
            return;
        latestRef.current = clean;
        if (!isControlled)
            setInternal(clean);
        onChange?.(clean);
    }, [isControlled, max, min, mode, onChange, snap, steps]);
    const valueFromPointer = (0, react_1.useCallback)((clientX) => {
        const track = trackRef.current;
        if (!track)
            return latestRef.current;
        const rect = track.getBoundingClientRect();
        if (rect.width <= 0)
            return latestRef.current;
        const f = clamp((clientX - rect.left) / rect.width, 0, 1);
        if (mode === 'stepped') {
            // Notches at i/(steps-1); snap to the nearest so f=0 → 0 (start) and
            // f=1 → steps-1 (end) are both reachable.
            return clamp(Math.round(f * (steps - 1)), 0, steps - 1);
        }
        return min + f * (max - min);
    }, [max, min, mode, steps]);
    const handlePointerDown = (e) => {
        if (disabled || e.button !== 0 && e.pointerType === 'mouse')
            return;
        e.preventDefault();
        const track = trackRef.current;
        if (!track)
            return;
        try {
            track.setPointerCapture(e.pointerId);
        }
        catch {
            // ignore — some browsers throw on synthetic events in tests
        }
        setIsDragging(true);
        commitValue(valueFromPointer(e.clientX));
    };
    const handlePointerMove = (e) => {
        if (!isDragging || disabled)
            return;
        commitValue(valueFromPointer(e.clientX));
    };
    const handlePointerEnd = (e) => {
        if (!isDragging)
            return;
        setIsDragging(false);
        const track = trackRef.current;
        if (track && track.hasPointerCapture?.(e.pointerId)) {
            try {
                track.releasePointerCapture(e.pointerId);
            }
            catch { }
        }
        onChangeEnd?.(latestRef.current);
    };
    const keyboardStep = (() => {
        if (mode === 'stepped')
            return 1;
        if (snap > 0)
            return snap;
        return (max - min) / 100;
    })();
    const handleKeyDown = (e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || disabled)
            return;
        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault();
                commitValue(current - keyboardStep);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault();
                commitValue(current + keyboardStep);
                break;
            case 'PageDown':
                e.preventDefault();
                commitValue(current - keyboardStep * 10);
                break;
            case 'PageUp':
                e.preventDefault();
                commitValue(current + keyboardStep * 10);
                break;
            case 'Home':
                e.preventDefault();
                commitValue(mode === 'stepped' ? 0 : min);
                break;
            case 'End':
                e.preventDefault();
                commitValue(mode === 'stepped' ? steps - 1 : max);
                break;
        }
    };
    // Fill fraction in [0..1]. Stepped: notch position k/(N-1) — step 0 is empty.
    const fillPct = (() => {
        if (mode === 'stepped')
            return (current / (steps - 1)) * 100;
        if (max === min)
            return 0;
        return ((current - min) / (max - min)) * 100;
    })();
    const isFull = fillPct >= 100 - 1e-6;
    // Continuous tick marks (decorative scale, evenly spread in an inset grid).
    const contTickCount = ticksVisible && mode === 'continuous'
        ? (rawProps.steps ?? 0)
        : 0;
    return (<div ref={mergeRefs(trackRef, ref)} role="slider" tabIndex={disabled ? -1 : 0} aria-label={ariaLabel} aria-valuemin={mode === 'stepped' ? 0 : min} aria-valuemax={mode === 'stepped' ? steps - 1 : max} aria-valuenow={current} aria-orientation="horizontal" aria-disabled={disabled || undefined} data-disabled={disabled ? '' : undefined} data-dragging={isDragging ? '' : undefined} data-mode={mode} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} className={(0, cx_ts_1.cx)('q-slider q-focus-ring relative inline-flex h-7 items-center overflow-hidden rounded-lg', 'cursor-pointer touch-none select-none outline-none', disabled && 'pointer-events-none cursor-not-allowed opacity-50', className)} {...rest}>
      <span aria-hidden style={{ width: `${fillPct}%` }} className={(0, cx_ts_1.cx)('pointer-events-none absolute inset-y-0 left-0 bg-q-overlay-hover', 'border-r-q-thin border-q-border-strong', 'rounded-l-lg', 'ease-out', isDragging ? 'transition-none' : 'transition-[width] duration-200', isFull && 'rounded-r-lg border-r-0')}/>
      {/* Stepped ticks: interior notches at the SAME full-track fraction as the
         * fill, so the fill edge lands exactly on the current notch's tick. The
         * endpoints (0 / full) are the track edges, so no edge-clipped ticks. */}
      {ticksVisible && mode === 'stepped' && steps > 2 && (<span aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: steps - 2 }, (_, i) => (<span key={i} className="absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 rounded-sm bg-q-border-strong" style={{ left: `${((i + 1) / (steps - 1)) * 100}%` }}/>))}
        </span>)}
      {contTickCount > 0 && (<span aria-hidden className="pointer-events-none absolute inset-0.5 grid items-center" style={{ gridTemplateColumns: `repeat(${contTickCount}, minmax(0, 1fr))`, gap: 'var(--hf-space-050)' }}>
          {Array.from({ length: contTickCount }, (_, i) => (<span key={i} className="flex h-full items-center justify-center">
              <span className="h-2 w-px rounded-sm bg-q-border-strong"/>
            </span>))}
        </span>)}
    </div>);
}
function sanitize(value, mode, steps, min, max, snap) {
    if (mode === 'stepped')
        return clamp(Math.round(value), 0, Math.max(0, steps - 1));
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    let v = clamp(value, lo, hi);
    if (snap > 0) {
        const offset = Math.round((v - lo) / snap) * snap;
        v = clamp(lo + offset, lo, hi);
    }
    return v;
}
//# sourceMappingURL=slider.js.map