"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Progress = Progress;
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const SIZE_CLASS = {
    xxs: 'q-progress-xxs',
    xs: 'q-progress-xs',
    sm: 'q-progress-sm',
    md: 'q-progress-md',
    lg: 'q-progress-lg',
};
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const stepState = (fill) => (fill >= 100 ? 'complete' : fill > 0 ? 'active' : 'pending');
/* ── SVG geometry (viewBox 0 0 100 100, centred). ───────────────────────────── */
const R = 42; // ring radius
const C = 2 * Math.PI * R; // circumference
const ORBIT = 40; // dot orbit radius
const DOT_R = 7; // dot radius
/** Point on a circle centred at (50,50). Angle in deg, 0° = 3 o'clock, clockwise. */
function polar(r, deg) {
    const a = (deg * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}
function Progress({ value, max = 100, variant = 'bar', shape = 'linear', steps = 4, size = 'md', color = 'brand', animated = true, className, style, children, 'aria-label': ariaLabel, ...props }) {
    const indeterminate = value === undefined;
    const p = indeterminate ? 0 : clamp01(value / (max || 1));
    const n = Math.max(1, Math.round(steps));
    const filled = Math.round(p * n);
    const aria = {
        role: 'progressbar',
        'aria-label': ariaLabel,
        'aria-valuemin': 0,
        'aria-valuemax': max,
        ...(indeterminate ? {} : { 'aria-valuenow': Math.round(p * max) }),
    };
    const rootStyle = { ...(0, slot_ts_1.slotStyle)(color), ...style };
    const dataStatic = animated ? undefined : '';
    const center = children != null ? <span className="q-progress-center">{children}</span> : null;
    // ── Circular bar / line / dots. ─────────────────────────────────────────────
    if (shape === 'circular') {
        let svg;
        if (variant === 'line') {
            const gap = C * (6 / 360); // 6° gap between segments
            const segLen = Math.max(0, C / n - gap);
            svg = (<g transform="rotate(-90 50 50)">
          {Array.from({ length: n }, (_, i) => (<circle key={i} className="q-progress-ring-seg" data-state={i < filled ? 'complete' : 'pending'} cx="50" cy="50" r={R} transform={`rotate(${(i * 360) / n} 50 50)`} style={{ strokeDasharray: `${segLen} ${C - segLen}` }}/>))}
        </g>);
        }
        else if (variant === 'dots') {
            svg = Array.from({ length: n }, (_, i) => {
                const [x, y] = polar(ORBIT, -90 + (i * 360) / n);
                return <circle key={i} className="q-progress-ring-dot" data-state={i < filled ? 'complete' : 'pending'} cx={x} cy={y} r={DOT_R}/>;
            });
        }
        else {
            // bar → ring
            svg = (<g transform="rotate(-90 50 50)">
          <circle className="q-progress-ring-track" cx="50" cy="50" r={R}/>
          <circle className={(0, cx_ts_1.cx)('q-progress-ring-arc', indeterminate && 'q-progress-ring-indeterminate')} cx="50" cy="50" r={R} style={indeterminate ? { strokeDasharray: `${C * 0.25} ${C}` } : { strokeDasharray: C, strokeDashoffset: C * (1 - p) }}/>
        </g>);
        }
        return (<div {...aria} data-static={dataStatic} className={(0, cx_ts_1.cx)('q-progress-circular', SIZE_CLASS[size], className)} style={rootStyle} {...props}>
        <svg className="q-progress-ring-svg" viewBox="0 0 100 100" aria-hidden>{svg}</svg>
        {center}
      </div>);
    }
    // ── Linear stepped variants (line / dots). ──────────────────────────────────
    if (variant === 'line') {
        return (<div {...aria} data-static={dataStatic} className={(0, cx_ts_1.cx)('q-progress-steps', SIZE_CLASS[size], className)} style={rootStyle} {...props}>
        {Array.from({ length: n }, (_, i) => {
                const fill = clamp01(p * n - i) * 100;
                return (<span key={i} className="q-progress-segment" data-state={stepState(fill)}>
              <span className="q-progress-segment-fill" style={{ width: `${fill}%` }}/>
            </span>);
            })}
      </div>);
    }
    if (variant === 'dots') {
        return (<div {...aria} data-static={dataStatic} className={(0, cx_ts_1.cx)('q-progress-dots', SIZE_CLASS[size], className)} style={rootStyle} {...props}>
        {Array.from({ length: n }, (_, i) => {
                // Place each dot at a fraction of the track so they span the full width
                // and overlap when there are too many to fit (never overflowing it).
                const frac = n > 1 ? i / (n - 1) : 0.5;
                return (<span key={i} className="q-progress-dot" data-state={i < filled ? 'complete' : 'pending'} style={{ left: `calc(var(--q-progress-dot) / 2 + ${frac} * (100% - var(--q-progress-dot)))` }}/>);
            })}
      </div>);
    }
    // ── Linear bar. ─────────────────────────────────────────────────────────────
    return (<div {...aria} data-static={dataStatic} className={(0, cx_ts_1.cx)('q-progress', SIZE_CLASS[size], className)} style={rootStyle} {...props}>
      <span className={(0, cx_ts_1.cx)('q-progress-fill', indeterminate && 'q-progress-indeterminate')} style={indeterminate ? undefined : { width: `${p * 100}%` }}/>
    </div>);
}
//# sourceMappingURL=progress.js.map