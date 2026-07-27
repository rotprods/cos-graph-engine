import type { ComponentProps, ReactNode } from 'react';
import { Checkbox as Primitive } from '@base-ui/react/checkbox';
import type { ClassValue } from '../utils/cx.ts';
export type CheckboxSize = 'sm' | 'md' | 'lg';
export type CheckboxColor = 'brand' | 'white';
export type CheckboxLabelDirection = 'left' | 'right';
export type CheckboxLabelSize = 'sm' | 'md';
export interface CheckboxOptions {
    color?: CheckboxColor;
    size?: CheckboxSize;
}
export declare function checkbox(options?: CheckboxOptions, ...extra: ClassValue[]): string;
export type CheckboxProps = ComponentProps<typeof Primitive.Root> & CheckboxOptions;
export declare function Checkbox({ color, size, className, indeterminate, ...props }: CheckboxProps): any;
export interface CheckboxLabelProps extends Omit<ComponentProps<'label'>, 'color'> {
    label?: ReactNode;
    description?: ReactNode;
    direction?: CheckboxLabelDirection;
    size?: CheckboxLabelSize;
    color?: CheckboxColor;
    checkboxSize?: CheckboxSize;
    checkboxProps?: Omit<CheckboxProps, 'color' | 'size'>;
}
export declare function CheckboxLabel({ label, description, direction, size, color, checkboxSize, checkboxProps, className, children, ...props }: CheckboxLabelProps): any;
//# sourceMappingURL=checkbox.d.ts.map