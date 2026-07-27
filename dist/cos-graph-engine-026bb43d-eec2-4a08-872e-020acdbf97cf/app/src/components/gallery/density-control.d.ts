/**
 * Column-density control. A Quanta stepped `Slider` maps its notches to the
 * gallery's target row heights: dragging right increases density (smaller
 * tiles / more per row), dragging left makes tiles larger. Changing it triggers
 * a layout recompute in the engine while scroll anchoring keeps the view stable.
 */
export interface DensityControlProps {
    value: number;
    onChange: (level: number) => void;
}
export declare function DensityControl({ value, onChange }: DensityControlProps): any;
//# sourceMappingURL=density-control.d.ts.map