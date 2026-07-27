import type { ComponentProps, ReactNode } from 'react';
import { type SlotColor } from '../utils/slot.ts';
/**
 * Tag — a presentational labeled category, optionally removable. Soft slot tint
 * by default. When `onRemove` is provided, a trailing "✕" button is rendered
 * (a real <button> nested in the <span> container — valid, since the container
 * is non-interactive).
 *
 * Composable like Chip/Button: the label is `children`; `start` / `end` are
 * optional slots (any node — a leading Dot/Avatar/icon, a trailing count Badge)
 * that default to nothing and sit before/after the label. `start`/`end` render
 * only when set, so the legacy `<Tag>Label</Tag>` markup is byte-for-byte
 * unchanged. `end` precedes the remove button when both are present.
 */
export type TagProps = ComponentProps<'span'> & {
    /** Slot color. Default 'neutral'. */
    color?: SlotColor;
    /** Leading slot (Dot / Avatar / icon, any node) before the label. */
    start?: ReactNode;
    /** Trailing slot (count Badge / Kbd, any node) after the label, before remove. */
    end?: ReactNode;
    /** When set, renders a trailing remove button. */
    onRemove?: () => void;
    removeLabel?: string;
};
export declare function Tag({ color, start, end, onRemove, removeLabel, className, style, children, ...props }: TagProps): any;
//# sourceMappingURL=tag.d.ts.map