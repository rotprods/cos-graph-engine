"use strict";
'use client';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeforeAfterCompare = BeforeAfterCompare;
const react_1 = require("react");
const chevron_left_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_left.svg?react"));
const chevron_right_svg_react_1 = __importDefault(require("@material-symbols/svg-400/outlined/chevron_right.svg?react"));
const icon_1 = require("@higgsfield/quanta/icon");
const media_1 = require("@higgsfield/quanta/media");
const typography_1 = require("@higgsfield/quanta/typography");
const utils_1 = require("@/lib/utils");
const clamp = (value) => Math.min(100, Math.max(0, value));
/** A small frosted corner label — "Before" / "After". */
function CompareLabel({ side, children }) {
    return (<span className={(0, utils_1.cn)('pointer-events-none absolute top-3 z-10 rounded-q-full bg-q-transparent-dark-60 px-2.5 py-1 backdrop-blur-sm', side === 'left' ? 'left-3' : 'right-3')}>
      <typography_1.Typography as="span" variant="caption-xs-medium" color="primary" className="uppercase">
        {children}
      </typography_1.Typography>
    </span>);
}
function BeforeAfterCompare({ beforeSrc, afterSrc, beforeAlt = 'Before', afterAlt = 'After', beforeLabel = 'Before', afterLabel = 'After', ratio = 'square', defaultPosition = 50, className, }) {
    const frameRef = (0, react_1.useRef)(null);
    const draggingRef = (0, react_1.useRef)(false);
    const [position, setPosition] = (0, react_1.useState)(() => clamp(defaultPosition));
    const updateFromClientX = (0, react_1.useCallback)((clientX) => {
        const frame = frameRef.current;
        if (frame == null)
            return;
        const rect = frame.getBoundingClientRect();
        if (rect.width === 0)
            return;
        setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
    }, []);
    const handlePointerDown = (event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
    };
    const handlePointerMove = (event) => {
        if (!draggingRef.current)
            return;
        updateFromClientX(event.clientX);
    };
    const handlePointerUp = (event) => {
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const handleKeyDown = (event) => {
        switch (event.key) {
            case 'ArrowLeft':
                setPosition(p => clamp(p - 2));
                event.preventDefault();
                break;
            case 'ArrowRight':
                setPosition(p => clamp(p + 2));
                event.preventDefault();
                break;
            case 'Home':
                setPosition(0);
                event.preventDefault();
                break;
            case 'End':
                setPosition(100);
                event.preventDefault();
                break;
        }
    };
    const rounded = Math.round(position);
    return (<div ref={frameRef} className={(0, utils_1.cn)('relative touch-none select-none overflow-hidden rounded-q-300', className)} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {/* Base layer — the enhanced "after" image sets the frame aspect. */}
      <media_1.Media ratio={ratio} rounded="none" className="w-full">
        <media_1.Media.Image src={afterSrc} alt={afterAlt} draggable={false}/>
      </media_1.Media>

      {/* Reveal layer — the original "before" image, clipped to the left of the divider. */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} aria-hidden="true">
        <media_1.Media.Image src={beforeSrc} alt="" draggable={false} className="size-full object-cover"/>
      </div>

      {beforeLabel != null ? <CompareLabel side="left">{beforeLabel}</CompareLabel> : null}
      {afterLabel != null ? <CompareLabel side="right">{afterLabel}</CompareLabel> : null}

      {/* Divider line + draggable handle. */}
      <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${position}%` }}>
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/90 shadow-q-overlay" aria-hidden="true"/>
        <button type="button" role="slider" aria-label="Compare before and after" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rounded} aria-valuetext={`${rounded}% enhanced`} onKeyDown={handleKeyDown} className="pointer-events-auto absolute top-1/2 left-1/2 flex h-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center rounded-q-full bg-white px-1 text-q-icon-inverse shadow-q-overlay transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-q-border-focus motion-reduce:transition-none motion-reduce:hover:scale-100">
          <icon_1.Icon as={chevron_left_svg_react_1.default} size="sm"/>
          <icon_1.Icon as={chevron_right_svg_react_1.default} size="sm"/>
        </button>
      </div>
    </div>);
}
//# sourceMappingURL=before-after-compare.js.map