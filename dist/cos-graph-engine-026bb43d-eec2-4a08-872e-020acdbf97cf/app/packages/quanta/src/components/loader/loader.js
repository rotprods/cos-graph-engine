"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loader = Loader;
const cx_ts_1 = require("../utils/cx.ts");
const slot_ts_1 = require("../utils/slot.ts");
const SIZE_CLASS = {
    xxs: 'q-loader-xxs',
    xs: 'q-loader-xs',
    sm: 'q-loader-sm',
    md: 'q-loader-md',
    lg: 'q-loader-lg',
};
const VARIANT_CLASS = {
    dots: 'q-loader-dots',
    circle: 'q-loader-circle',
    stars: 'q-loader-stars',
    shine: 'q-loader-shine',
};
/** Four-point sparkle (Figma "AI" star). Scales with the loader box. */
function Sparkle({ className }) {
    return (<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c.6 6.7 5.3 11.4 12 12-6.7.6-11.4 5.3-12 12-.6-6.7-5.3-11.4-12-12C6.7 11.4 11.4 6.7 12 0Z"/>
    </svg>);
}
function Loader({ variant = 'circle', size = 'md', color = 'brand', animated = true, className, style, 'aria-label': ariaLabel = 'Loading', ...props }) {
    const common = {
        role: 'status',
        'aria-label': ariaLabel,
        'aria-live': 'polite',
        'data-static': animated ? undefined : '',
        style: { ...(0, slot_ts_1.slotStyle)(color), ...style },
        ...props,
    };
    const rootClass = (0, cx_ts_1.cx)('q-loader', VARIANT_CLASS[variant], SIZE_CLASS[size], className);
    if (variant === 'dots') {
        return (<div {...common} className={rootClass}>
        {Array.from({ length: 4 }, (_, i) => <span key={i} className="q-loader-dot"/>)}
      </div>);
    }
    if (variant === 'stars') {
        return (<div {...common} className={rootClass}>
        <Sparkle className="q-loader-star q-loader-star-main"/>
        <Sparkle className="q-loader-star q-loader-star-sub"/>
      </div>);
    }
    if (variant === 'shine') {
        // The gloss sweep is a ::after; nothing else to render.
        return <div {...common} className={rootClass}/>;
    }
    // circle — spinning ring (neutral track + accent arc).
    return (<div {...common} className={rootClass}>
      <svg className="q-loader-spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="q-loader-spinner-track" cx="12" cy="12" r="9" strokeWidth="2.5"/>
        <path className="q-loader-spinner-arc" d="M12 3a9 9 0 0 1 9 9" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>);
}
//# sourceMappingURL=loader.js.map