import type { ComponentProps, ReactNode } from 'react';
import { Switch as Primitive } from '@base-ui/react/switch';
import { type SlotColor } from '../utils/slot.ts';
/**
 * Switch — a Base UI primitive skinned with quanta tokens.
 *
 * Base UI owns behavior + a11y (role="switch", hidden <input>, keyboard, focus,
 * form integration); quanta paints its state data-attributes (data-checked /
 * data-unchecked / data-disabled).
 */
export type SwitchSize = 'small' | 'medium' | 'default';
export type SwitchProps = Omit<ComponentProps<typeof Primitive.Root>, 'size'> & {
    /** Slot color — sets `--q-tint`; every surface derives from it. Default 'brand'. */
    color?: SlotColor;
    size?: SwitchSize;
};
export declare function Switch({ className, color, size, style, ...props }: SwitchProps): any;
export type SwitchLabelDirection = 'left' | 'right';
export type SwitchLabelSize = 'sm' | 'md';
export interface SwitchLabelProps extends Omit<ComponentProps<'label'>, 'color'> {
    /** Primary line. Any ReactNode (also overridable via `children`). */
    label?: ReactNode;
    /** Secondary line under the title. Any ReactNode. */
    description?: ReactNode;
    /** `left` = switch then text (default); `right` = text then switch (settings rows). */
    direction?: SwitchLabelDirection;
    /** Label typography scale. Default `sm`. */
    size?: SwitchLabelSize;
    /** Slot color forwarded to the Switch. */
    color?: SlotColor;
    /** Switch size. Defaults from `size` (`md` → `default`, else `medium`). */
    switchSize?: SwitchSize;
    /** Extra props for the underlying Switch (e.g. `checked`, `onCheckedChange`). */
    switchProps?: Omit<SwitchProps, 'color' | 'size'>;
}
/**
 * SwitchLabel — a Switch paired with a title + optional description, the same
 * labelled-control composite as `CheckboxLabel` / `RadioLabel`. `label` /
 * `description` take any node; `children` overrides the title. Compose richer
 * titles (e.g. a Badge) by passing nodes to `label`.
 */
export declare function SwitchLabel({ label, description, direction, size, color, switchSize, switchProps, className, children, ...props }: SwitchLabelProps): any;
//# sourceMappingURL=switch.d.ts.map