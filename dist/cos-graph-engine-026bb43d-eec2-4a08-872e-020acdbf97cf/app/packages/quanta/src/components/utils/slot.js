"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLOT = void 0;
exports.slotStyle = slotStyle;
/** Guaranteed-present token used as the universal degrade target. */
const FALLBACK = 'var(--hf-color-brand-primary)';
/** color → the four `--q-tint*` properties (all sourced from `--hf-color-*`). */
exports.SLOT = {
    brand: {
        '--q-tint': 'var(--hf-color-brand-primary)',
        '--q-tint-fg': 'var(--hf-color-text-inverse)',
    },
    neutral: {
        '--q-tint': `var(--hf-color-text-primary, ${FALLBACK})`,
        '--q-tint-bg': `var(--hf-color-background-secondary-strong, ${FALLBACK})`,
        '--q-tint-fg': 'var(--hf-color-text-primary)',
        '--q-tint-border': `var(--hf-color-border-strong, ${FALLBACK})`,
    },
    success: {
        '--q-tint': `var(--hf-color-state-success-fg, ${FALLBACK})`,
        '--q-tint-fg': 'var(--hf-color-text-inverse)',
    },
    error: {
        '--q-tint': `var(--hf-color-state-error-fg, ${FALLBACK})`,
        '--q-tint-fg': 'var(--hf-color-text-inverse)',
    },
    warning: {
        '--q-tint': `var(--hf-color-state-warning-fg, ${FALLBACK})`,
        '--q-tint-fg': 'var(--hf-color-text-inverse)',
    },
    info: {
        '--q-tint': `var(--hf-color-state-info-fg, ${FALLBACK})`,
        '--q-tint-fg': 'var(--hf-color-text-inverse)',
    },
};
/**
 * Inline style object that wires a `color` prop into the slot custom properties.
 * Spread it into a component's `style`, then style surfaces with `q-slot-*`.
 *
 *   style={{ ...slotStyle(color), ...style }}
 */
function slotStyle(color) {
    return exports.SLOT[color];
}
//# sourceMappingURL=slot.js.map