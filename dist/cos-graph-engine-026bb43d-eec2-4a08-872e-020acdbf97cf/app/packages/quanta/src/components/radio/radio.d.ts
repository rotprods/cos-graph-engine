import type { ComponentProps, ReactNode } from 'react';
import { Radio as Primitive } from '@base-ui/react/radio';
import { RadioGroup as PrimitiveGroup } from '@base-ui/react/radio-group';
import type { ClassValue } from '../utils/cx.ts';
import type { SlotColor } from '../utils/slot.ts';
/**
 * Radio — Base UI `Radio` skinned with quanta tokens, derived 1:1 from Checkbox
 * (same colour / size scale, states, focus ring and label sub-component). It is
 * circular with a centred dot indicator instead of a square with a check, and
 * has no indeterminate state. Always render Radios inside a `RadioGroup`, which
 * owns the selected `value`.
 *
 *   <RadioGroup defaultValue="a">
 *     <RadioLabel value="a" label="Option A" />
 *     <RadioLabel value="b" label="Option B" />
 *   </RadioGroup>
 */
export type RadioSize = 'sm' | 'md' | 'lg';
export type RadioColor = SlotColor | 'white';
export type RadioLabelDirection = 'left' | 'right';
export type RadioLabelSize = 'sm' | 'md';
export interface RadioOptions {
    color?: RadioColor;
    size?: RadioSize;
}
export declare function radio(options?: RadioOptions, ...extra: ClassValue[]): string;
/** Groups Radios and owns the selected `value` (controlled or `defaultValue`). */
export type RadioGroupProps = ComponentProps<typeof PrimitiveGroup>;
export declare function RadioGroup({ className, ...props }: RadioGroupProps): any;
export type RadioProps = ComponentProps<typeof Primitive.Root> & RadioOptions;
export declare function Radio({ color, size, className, ...props }: RadioProps): any;
export interface RadioLabelProps extends Omit<ComponentProps<'label'>, 'color'> {
    /** The radio's value within the group (required). */
    value: RadioProps['value'];
    label?: ReactNode;
    description?: ReactNode;
    direction?: RadioLabelDirection;
    size?: RadioLabelSize;
    color?: RadioColor;
    radioSize?: RadioSize;
    radioProps?: Omit<RadioProps, 'color' | 'size' | 'value'>;
}
export declare function RadioLabel({ value, label, description, direction, size, color, radioSize, radioProps, className, children, ...props }: RadioLabelProps): any;
//# sourceMappingURL=radio.d.ts.map