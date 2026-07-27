import type { ComponentProps, ReactNode } from 'react';
import { Field } from '@base-ui/react/field';
/**
 * Textarea — a multi-line labelled field on Base UI `Field`, pixel-matched to
 * the Figma TextArea (node 2134:76). Shares the Input field scaffolding
 * (`q-field-*` in input.css): the white-5% surface (radius/300, 1.5px border →
 * lime on focus / red on error) flexes inside the 164px Figma state frame with
 * an 80px minimum, top-aligned. Provide `error` for the invalid state; `rows`
 * sets the textarea's intrinsic row count when consumers grow the field.
 *
 *   <Textarea label="Bio" placeholder="Add description" description="We'll never share it" />
 *   <Textarea label="Notes" rows={6} error="Please enter only letters" defaultValue="Mary387" />
 */
type FieldProps = {
    /** Label above the control. */
    label?: ReactNode;
    /** Helper text below the control (hidden while an `error` shows). */
    description?: ReactNode;
    /** Error message — its presence puts the field in the invalid (red) state. */
    error?: ReactNode;
    /** Force the invalid state without a message. */
    invalid?: boolean;
    /** Append a red `*` to the label. */
    required?: boolean;
    /** Leading slot (20px icon, any node), pinned to the top. */
    start?: ReactNode;
    /** Trailing slot (20px icon, any node), pinned to the bottom. */
    end?: ReactNode;
    /** @deprecated Use `start` — kept as an alias for back-compat. */
    prefix?: ReactNode;
    /** @deprecated Use `end` — kept as an alias for back-compat. */
    suffix?: ReactNode;
    /** Swap the underlying control element (e.g. an auto-grow / 3rd-party textarea). */
    render?: ComponentProps<typeof Field.Control>['render'];
    /** Class for the root Field wrapper. */
    className?: string;
    /** Class for the control surface. */
    controlClassName?: string;
    /** Class for the `<textarea>` element. */
    inputClassName?: string;
    /** Props forwarded to the Base UI `Field.Root`. */
    fieldProps?: ComponentProps<typeof Field.Root>;
};
export type TextareaProps = FieldProps & Omit<ComponentProps<'textarea'>, 'prefix' | 'color' | 'children'>;
export declare function Textarea({ label, description, error, invalid: invalidProp, required, start, end, prefix, suffix, render, rows, className, controlClassName, inputClassName, fieldProps, ...controlProps }: TextareaProps): any;
export {};
//# sourceMappingURL=textarea.d.ts.map