/**
 * SVG Renderer — COS Graph Engine v2.1 Fase 4 T-4.1
 *
 * Renderiza grafos CSR como SVG inline con force-directed layout.
 * Zero dependencias externas.
 */
import { CSRGraph } from '../../graph/src/csr';
export interface Point {
    x: number;
    y: number;
}
export type LayoutType = 'force' | 'tree' | 'radial';
export interface SVGRenderOptions {
    width?: number;
    height?: number;
    layout?: LayoutType;
    iterations?: number;
    nodeRadius?: number;
    edgeColor?: string;
    nodeColor?: string;
    labelColor?: string;
    backgroundColor?: string;
    showLabels?: boolean;
    arrowheads?: boolean;
}
export declare class ForceLayout {
    private _positions;
    private _velocities;
    private _width;
    private _height;
    constructor(width?: number, height?: number);
    /** Compute layout for a graph */
    compute(graph: CSRGraph, iterations?: number, nodeRadius?: number): Map<string, Point>;
}
export declare class SVGGraphRenderer {
    private _layout;
    constructor();
    /** Render graph as SVG string */
    render(graph: CSRGraph, options?: SVGRenderOptions): string;
    private _computeLayout;
    private _treeLayout;
    private _radialLayout;
}
//# sourceMappingURL=svg-renderer.d.ts.map